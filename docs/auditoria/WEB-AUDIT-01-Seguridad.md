# WEB-AUDIT-01 — Seguridad de WebClinica

Fecha de corte: 18 de octubre de 2026.

## 1. Resultado

No se confirmó un defecto crítico explotable de forma inmediata en el código examinado. Sí existe una exposición alta por dependencias Angular fuera de soporte con avisos de XSS y otros problemas; además, la sesión carece de control local de expiración y de manejo centralizado de 401/403. La API aplica JWT y permisos dinámicos en cada controlador revisado, por lo que sigue siendo la autoridad efectiva.

## 2. Modelo de autenticación y autorización

1. `LoginComponent` envía usuario y contraseña a `POST /api/auth/login`.
2. `AuthService` almacena `accessToken` y el usuario en `localStorage` (`auth_token`, `auth_user`).
3. `authInterceptor` adjunta `Authorization: Bearer` solo si la URL pertenece exactamente a `environment.apiUrl` o a uno de sus subrecursos.
4. `authGuard` permite el layout si existen token y usuario; no inspecciona la firma ni la fecha de expiración.
5. `GET /api/menu` retorna un menú ya filtrado por los permisos consultables del usuario.
6. La API protege operaciones con `PermisoRequerido(modulo, operación)` y política JWT.

Controles correctos confirmados:

- El interceptor no envía el JWT a URLs externas (`auth.interceptor.ts:7-16`) y existe una prueba específica.
- El logout elimina token y usuario (`auth.service.ts:53-56`).
- El guard cubre todo el layout autenticado (`app.routes.ts:15-17`).
- La API valida autenticación y permisos por operación en los controladores.
- CORS de desarrollo permite únicamente `http://localhost:4200` y credenciales; producción parte sin orígenes configurados.
- No se encontraron `innerHTML`, `bypassSecurityTrust`, `eval` ni secretos incrustados en el frontend.
- Los valores sensibles de API revisados están vacíos en `appsettings.json` y se esperan mediante configuración externa.

## 3. Hallazgos trazables

| ID | Severidad / prioridad | Descripción y escenario | Evidencia | Requisito afectado | Consecuencia | Corrección recomendada |
|---|---|---|---|---|---|---|
| SEC-01 | Alta / P1 | Angular 18.2.14 aparece en ocho paquetes vulnerables de producción. Los avisos incluyen bypass de sanitización/XSS. Si una futura plantilla incorpora contenido controlado por un atacante en un patrón afectado, el token de `localStorage` podría ser extraído. | `package-lock.json`; `npm audit --omit=dev --json`: 4 high, 4 moderate | AUD-REQ-09, 11 | Secuestro de sesión y acciones con permisos de la víctima | Planificar migración conjunta a una versión Angular soportada; probar plantillas, auth y E2E. No usar `audit fix --force` sin plan. |
| SEC-02 | Alta / P1 | La respuesta de login contiene `expiresAtUtc`, pero no se persiste ni valida. `isAuthenticated` solo comprueba presencia de usuario y token. Un token expirado mantiene la UI en estado autenticado hasta que fallen solicitudes. | `auth.service.ts:14,22,35`; `user.model.ts:3-6` | AUD-REQ-09, 11 | Sesión incoherente, errores repetidos y datos de pantalla potencialmente visibles tras expirar | Guardar la expiración no sensible, validarla al restaurar la sesión y limpiar sesión ante 401. |
| SEC-03 | Alta / P1 | No hay interceptor global de 401/403. Solo login distingue 401; el resto muestra mensajes heterogéneos. | Ausencia en `auth.interceptor.ts`; `login.component.ts:61`; búsquedas en `src/app` | AUD-REQ-11, 13, 15 | El usuario permanece en una sesión inválida; permisos revocados no se reflejan de forma coherente | Añadir un interceptor de errores que cierre sesión en 401 y trate 403 sin ocultar el detalle seguro de `ProblemDetails`. |
| SEC-04 | Alta / P1 | El frontend no consume `/api/auth/permisos` ni condiciona botones por operación. El menú solo cubre permiso de consulta. El backend bloquea la operación, pero la UI ofrece acciones que pueden terminar en 403. | `menu.service.ts:16,32`; ausencia de permisos operativos en `src/app`; `AuthController.cs:44`; atributos `PermisoRequerido` | AUD-REQ-13, 15, 36, 37 | UX engañosa y mayor superficie de solicitudes no autorizadas; no implica bypass del servidor | Cargar permisos operativos desde la API, mantenerlos en memoria y ocultar/deshabilitar acciones; conservar siempre la autorización del backend. |
| SEC-05 | Media / P2 | El JWT se almacena en `localStorage`. No existe XSS propio confirmado, pero cualquier XSS en la aplicación o dependencia puede leerlo. | `auth.service.ts:22,35,54`; `habitaciones.service.ts:36` | AUD-REQ-09, 11 | Amplifica el impacto de un XSS | Tras actualizar Angular, evaluar sesión con cookie `HttpOnly`, `Secure`, `SameSite` si el contrato de API puede cambiar. Mientras tanto, aplicar CSP/Trusted Types en hosting y mantener prohibido HTML no confiable. |
| SEC-06 | Media / P2 | El guard comprueba sesión, no permisos de ruta. El acceso directo abre pantallas y la API rechaza datos/operaciones. | `auth.guard.ts:5-8`; una sola guarda en `app.routes.ts:17` | AUD-REQ-11, 13 | Pantallas vacías/errores 403 y exposición de estructura de UI | Añadir metadatos de permiso y guard de autorización reutilizable, sin duplicar reglas del servidor. |
| SEC-07 | Media / P2 | El menú solo se recarga en inicio/login/dashboard; no existe invalidación cuando cambian permisos durante una sesión. | `menu.service.ts:20-23`; `login.component.ts:43`; `dashboard.component.ts:20` | AUD-REQ-15 | Un permiso retirado puede seguir visible hasta recarga, aunque la API impide usarlo | Definir evento/versionado o recarga de permisos/menú al volver a foco, en navegación sensible o ante 403. |
| SEC-08 | Media / P2 | Errores se leen frecuentemente como `err.error.message`; `ProblemDetails` puede usar `title`, `detail` y `errors`. | Componentes de formularios/listados; `Program.cs` registra `AddProblemDetails` | AUD-REQ-37 | Mensajes genéricos, validaciones de campo perdidas y diagnóstico difícil | Crear un adaptador tipado de `ProblemDetails` y política uniforme de mensajes. |
| SEC-09 | Media / P2 | El hub usa JWT y reconexión automática, pero no reacciona a token expirado ni a `onclose`; no recupera el snapshot tras reconectar. | `habitaciones.service.ts:33-49`; ausencia de `onreconnecting/onreconnected/onclose` | AUD-REQ-21 | Estado de habitaciones obsoleto y reconexiones fallidas tras expirar sesión | Al reconectar, recargar HTTP; exponer estado de conexión; limpiar sesión si la autenticación falla. |
| SEC-10 | Baja / P3 | El frontend acepta URL de imagen de medicamento sin previsualización ni política visible de orígenes; no ejecuta subida de archivos. | `medicamento-form.component.ts:61-63`; no hay `input type=file` | AUD-REQ-40 | Recursos mixtos, rastreo externo o imagen rota según CSP/hosting | Validar esquema HTTPS y aplicar allowlist/proxy de imágenes si el requisito móvil/web lo necesita. |

## 4. Dependencias vulnerables

Resultado reproducible de `npm audit --omit=dev --json`:

| Paquete afectado | Versión instalada | Severidad agregada | Observación |
|---|---:|---|---|
| `@angular/animations` | 18.2.14 | Moderate | Hereda avisos de core |
| `@angular/common` | 18.2.14 | High | XSRF, formatos y `HttpTransferCache` |
| `@angular/compiler` | 18.2.14 | High | Varios bypass XSS/sanitización |
| `@angular/core` | 18.2.14 | High | XSS, namespaces e hidratación |
| `@angular/forms` | 18.2.14 | Moderate | Hereda common/core/platform-browser |
| `@angular/platform-browser` | 18.2.14 | Moderate | Hereda dependencias afectadas |
| `@angular/platform-browser-dynamic` | 18.2.14 | Moderate | Hereda compiler/core |
| `@angular/router` | 18.2.14 | High | Hereda Angular; aviso SSR de DoS |

Metadatos de npm: **0 critical, 4 high, 4 moderate, 0 low; total 8 paquetes de producción afectados**. Npm propone saltos mayores (20.1.8 o 22.2.3 según el paquete), de modo que la remediación requiere migración controlada. No se modificaron `package.json` ni `package-lock.json`.

La aplicación auditada es una SPA sin SSR, hidratación, i18n, `HttpTransferCache`, HTML dinámico ni sanitizadores deshabilitados. Eso reduce la aplicabilidad de algunos avisos, pero no elimina la exposición de una rama Angular antigua.

## 5. SignalR

| Control | Resultado | Evidencia |
|---|---|---|
| Ruta | Correcta: `/hubs/habitaciones` | `environment.ts:5`; `Program.cs:103` |
| JWT | `accessTokenFactory` relee `auth_token` | `habitaciones.service.ts:34-37`; prueba unitaria |
| Evento | `ActualizarEstadoHabitacion` y `{ habitacionId, estado }` coinciden | `habitaciones.service.ts:42`; `HabitacionEstadoNotifier.cs:15-16` |
| Reconexión | `withAutomaticReconnect()` | `habitaciones.service.ts:38` |
| Actualización UI | Evento actualiza el `BehaviorSubject` cargado por HTTP | `habitaciones.service.ts:42-44,65-68` |
| Liberación | `off`, `stop`, `complete` al destruir servicio; componente usa `takeUntilDestroyed` | `habitaciones.service.ts:114-118`; `habitaciones-board.component.ts:137` |
| Duplicados | Instancia limitada al tablero y modales | `habitaciones-board.component.ts:14` |
| Fallo inicial | Solo registra el error; no reintenta de forma explícita | `habitaciones.service.ts:46-49` |
| Recuperación tras reconexión | No implementada | Sin manejador `onreconnected` |
| Prueba integrada | No ejecutable; API local no disponible | conexión rechazada en `localhost:5293` |

Dictamen: implementación estática coherente y pruebas aisladas correctas; funcionamiento en tiempo real **parcial**, pendiente de una prueba integrada con reconexión y expiración JWT.

## 6. Exposición de información

- No se encontraron contraseñas, JWT, claves de firma, cadenas SQL ni secretos de Azure/R2 en el frontend.
- `environment.ts` expone únicamente URLs locales, lo normal en una SPA.
- No se encontraron logs de tokens ni datos personales. Los `console.error` revisados reportan errores de conexión, no credenciales.
- No existe acceso directo a Azure SQL desde Angular.
- La API conserva `SigningKey`, conexión y credenciales R2 vacíos en configuración versionada; deben suministrarse externamente.

## 7. Orden de remediación

1. **P1:** migrar Angular a una rama soportada siguiendo una matriz de compatibilidad y repetir las 14 pruebas, build y E2E.
2. **P1:** gestionar expiración y 401/403 de forma centralizada.
3. **P1:** consumir permisos por operación y actualizar menú/permisos durante sesiones activas.
4. **P2:** endurecer hosting con HTTPS, CSP y Trusted Types; evaluar cookies HttpOnly como cambio coordinado de contrato.
5. **P2:** completar telemetría y recuperación de SignalR.
6. **P2:** normalizar `ProblemDetails`.

No debe relajarse ningún permiso del backend para resolver problemas de interfaz. La base de datos permanece inmutable.
