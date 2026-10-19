# WEB-AUDIT-01 — Informe forense integral de WebClinica

Fecha de corte: 18 de octubre de 2026, `America/Guatemala`.

Commit auditado: `bba962bb3b1d34ce733d20ffe2a591ad7327b0be` (`main`, sincronizado con `origin/main`).

## 1. Resumen ejecutivo

WebClinica es una SPA Angular 18 standalone que compila correctamente, analiza 27 plantillas sin errores y aprueba 14 pruebas unitarias. Los servicios activos consumen la API ASP.NET Core .NET 10 mediante contratos tipados; las propiedades críticas `totalCount`, `totalPages`, `existenciaTotal`, `fechaHistorial`, los tipos de empleado y `cantidadEsperada` están alineadas estáticamente con los DTO del backend.

El producto no está listo para declararse terminado ni desplegado. La API local no estaba disponible y no se ejecutó E2E. Faltan configuración HTTPS de producción, hosting SPA, CI y evidencia Azure. El menú puede enviar cinco rutas sin pantalla. Citas y movimientos de inventario permanecen desconectados. El frontend no controla expiración JWT, no centraliza 401/403 y no aplica permisos por operación a botones/rutas. Npm reporta ocho paquetes Angular vulnerables de producción: cuatro altos y cuatro moderados.

No se confirmó ningún hallazgo P0. Los principales P1 son dependencias vulnerables, sesión/401-403, permisos operativos incompletos, rutas funcionales faltantes, módulos desconectados y ausencia de configuración/evidencia de producción.

La evaluación académica es **provisional**. No se encontró `Proyecto_Final_Desarrollo_Web_2026(1).pdf`; los 42 identificadores se evaluaron contra el texto del encargo, no contra la fuente oficial. Conteo provisional: 1 Cumple, 27 Parcial, 1 No cumple, 6 No verificable y 7 No aplica al frontend.

## 2. Alcance y restricciones

Se auditó de forma selectiva:

- configuración Angular/TypeScript/npm;
- rutas, componentes, plantillas, estilos, modelos, servicios, guard e interceptor;
- pruebas y scripts existentes;
- controladores, DTO, autorización, menú y SignalR del backend necesarios para contrastar Angular;
- estado Git y preparación de despliegue.

No se modificaron código de producción, configuraciones existentes, dependencias ni backend. No se instaló/actualizó ningún paquete, no se creó la Skill, no se ejecutaron migraciones, no se escribió en Azure SQL y no se hicieron commit, push, pull o cambios de rama. Los únicos archivos nuevos son estos siete informes.

## 3. Metodología y evidencia

1. Captura de Git, versiones y archivos de configuración.
2. Lectura de rutas y construcción del grafo de imports desde `src/main.ts`.
3. Corte vertical componente → servicio → modelo → controlador/DTO por módulo.
4. Búsquedas de sesión, permisos, HTML inseguro, secretos, suscripciones y código desconectado.
5. Ejecución segura de `npm run verify`, Karma headless y `npm audit --omit=dev`.
6. Comprobación de disponibilidad de `/health/live` sin iniciar ni modificar la API.
7. Revisión de convenciones reales de Skills para diseñar, no implementar, `webclinica-frontend`.

Evidencia de prueba y limitaciones están en `WEB-AUDIT-01-Pruebas.md`. La arquitectura y matriz de contratos están en `WEB-AUDIT-01-Arquitectura.md`.

## 4. Stack tecnológico real

| Tecnología | Versión | Uso real | Archivo de evidencia | Estado |
|---|---:|---|---|---|
| Angular core | 18.2.14 | SPA y componentes standalone | `package-lock.json`, `src/main.ts` | Instalado, importado e implementado; vulnerable/fuera de rama actual |
| Angular CLI | 18.2.21 | build, serve y test | lockfile, `package.json` | Implementado |
| Build Angular application/esbuild | 18.2.21 | bundle de producción y lazy chunks | `angular.json` | Implementado |
| TypeScript | 5.5.4 | lenguaje principal, modo estricto | lockfile, `tsconfig.json` | Implementado |
| JavaScript ES2022 | ES2022 | destino de compilación | `tsconfig.json` | Implementado |
| Node.js | 24.18.0 usado | ejecución local | salida `node -v` | Compatible con engines del CLI; no fijado por proyecto |
| npm | 11.16.0 usado | scripts/auditoría | salida `npm -v` | No fijado por proyecto |
| Standalone components | Angular 18 | composición sin NgModules | `main.ts`, componentes | Implementado |
| Angular Router | 18.2.14 | guard, layout, alias y lazy loading | `app.routes.ts` | Implementado; rutas faltantes |
| HttpClient | 18.2.14 | API REST tipada | `app.config.ts`, servicios | Implementado |
| RxJS | 7.8.2 | observables HTTP y estado de habitaciones | servicios | Implementado |
| Angular Signals | 18.2.14 | sesión, menú y módulos desconectados | `auth.service.ts`, `menu.service.ts` | Implementado |
| SignalR JS | 10.0.11 | habitaciones en tiempo real | `habitaciones.service.ts` | Implementado y probado aisladamente |
| Bootstrap | 5.3.8 | CSS, grid, formularios, tablas, modales visuales | `angular.json`, plantillas | Implementado |
| Bootstrap Icons | 1.13.1 | iconografía local `bi-*` | `angular.json`, plantillas | Implementado; menú API envía `fa-*` |
| CSS | nativo | estilos globales y por componente | `*.css` | Implementado; no SCSS |
| Jasmine/Karma | 5.2.0 / 6.4.4 | 14 pruebas en Chrome Headless | seis `*.spec.ts`, `angular.json` | Implementado |
| `karma-coverage` | 2.2.x | paquete disponible | `package.json` | Instalado, sin script/umbral/reporte |
| Angular animations | 18.2.14 | sin proveedor/import funcional detectado | `package.json`, búsqueda en `src` | Dependencia instalada; uso no demostrado |
| JWT | contrato backend | login, persistencia e interceptor | auth service/interceptor/guard | Implementado parcialmente |
| Docker frontend | — | no encontrado | búsqueda en repositorio | Ausente |
| Lint | — | sin script/configuración | `package.json` | Ausente |
| CI/CD | — | no se encontró workflow/pipeline | repositorio | Ausente |
| Entorno producción | — | solo URL local HTTP | `environment.ts`, `angular.json` | Ausente |

Recursos estáticos: únicamente `WebClinica/public/favicon.ico`. El diseño usa grid y tablas responsivas de Bootstrap, pero no existe auditoría visual sistemática para móvil ni PWA/service worker.

## 5. Arquitectura encontrada

La estructura efectiva es `core` (contratos/servicios/seguridad), `layout` y `pages`. No hay `shared` ni `features`, decisión aceptable para el tamaño actual. El estado es local y liviano; no existe store global adicional. Las rutas lazy están generalizadas. No se detectaron ciclos de imports.

Seis archivos de producción quedan fuera del grafo alcanzable: mock/modelo/dos servicios/página de citas y la página de movimientos de inventario. Los servicios de citas tienen 0 bytes. El componente de movimientos llama métodos ausentes y rutas antiguas. Estos archivos son evidencia de trabajo pendiente, no funcionalidad entregada.

El mapa completo y la matriz Angular/API se encuentran en `WEB-AUDIT-01-Arquitectura.md`.

## 6. Integración con API

Los módulos activos presentan compatibilidad estática principal:

- autenticación y menú;
- pacientes, empleados y usuarios;
- habitaciones y asignaciones;
- consultas, diagnósticos, historial/evolución, tratamientos, exámenes y contactos;
- medicamentos, lotes, categorías y marcas;
- ventas y detalles;
- hub de habitaciones.

Incompatibilidades confirmadas:

1. `/citas`, `/consultas`, `/admin/roles` y dos reportes del menú no tienen ruta Angular.
2. El filtro `idPaciente` de ventas está modelado, pero no se envía al API.
3. Citas no tiene servicio REST ni SignalR implementado; la API tampoco registra hub de citas.
4. Movimientos de inventario no coincide con el `InventarioService` activo.
5. Catálogos y búsqueda de asignación activa se limitan a la primera página de 100.

La API local rechazó la conexión en `http://localhost:5293`; no se declaran aprobados los CRUD ni SignalR de extremo a extremo.

## 7. Cumplimiento académico provisional

| Estado | Cantidad | Interpretación |
|---|---:|---|
| Cumple | 1 | Git tiene evidencia suficiente disponible |
| Parcial | 27 | Código presente, pero falta una parte o demostración integrada |
| No cumple | 1 | Actualización del menú ante cambios de permiso no existe |
| No verificable | 6 | Publicación Azure y cinco requisitos móviles sin evidencia |
| No aplica al frontend | 7 | BD/modelado/backend/contenedor y reglas puramente servidor |

El detalle de las 42 filas está en `WEB-AUDIT-01-Matriz-Cumplimiento.md`. Se solicita incorporar el PDF oficial antes del dictamen definitivo.

## 8. Hallazgos principales

| ID | Severidad / prioridad | Hallazgo | Archivo/línea | Requisito | Consecuencia | Recomendación |
|---|---|---|---|---|---|---|
| DEP-01 | Alta / P1 | Ocho paquetes Angular vulnerables de producción | `package-lock.json`; auditoría npm | 09, 11 | Riesgos XSS/DoS/fuga según patrón afectado | Migración mayor controlada y pruebas completas |
| AUTH-01 | Alta / P1 | Se ignora `expiresAtUtc`; autenticación local depende de presencia | `auth.service.ts:14,35` | 09, 11 | UI conserva sesión expirada | Validar expiración y limpiar sesión |
| AUTH-02 | Alta / P1 | No existe manejo global de 401/403 | `auth.interceptor.ts` | 11, 13, 15 | Sesión incoherente y errores heterogéneos | Interceptor de errores y adaptador ProblemDetails |
| PERM-01 | Alta / P1 | Angular no aplica permisos por operación | ausencia en `src/app`; API `PermisoRequerido` | 13, 15, 36, 37 | Acciones visibles terminan en 403 | Consumir `/auth/permisos`, guard/metadatos y botones |
| NAV-01 | Alta / P1 | Cinco rutas del menú no existen | `app.routes.ts`; `MenuCompleto.cs:30-95` | 14, 25, 37 | Navegación silenciosa a dashboard | Alinear menú y router |
| MOD-01 | Alta / P1 | Citas está desconectado y sus servicios están vacíos | `pages/citas`, `cita*.service.ts` | 25/alcance citas | Módulo no ejecutable | Definir contrato real e integrar por fases |
| MOD-02 | Alta / P1 | Movimientos de inventario está desconectado e incompatible | componente líneas 58-142 | 17, 32 | Función no ejecutable | Adaptar a endpoints existentes sin BD nueva |
| AZR-01 | Alta / P1 | No hay entorno de producción, HTTPS ni evidencia Azure | `environment.ts:3-7`, `angular.json` | 07 | Build local no desplegable de forma segura | Configurar entorno/hosting y demostrar despliegue |
| API-01 | Media / P2 | `idPaciente` no se envía en filtros de venta | `venta.service.ts:23-31` | 30, 31 | Filtro declarado no funciona | Agregar parámetro y prueba HTTP |
| PAG-01 | Media / P2 | Primera página fija de 100 en catálogos/asignación | `catalogos.service.ts`; modal egreso:51 | 19, 22, 37 | Registros posteriores invisibles | Recorrer páginas o búsqueda server-side |
| SIG-01 | Media / P2 | SignalR no recupera snapshot al reconectar ni maneja cierre | `habitaciones.service.ts:33-49` | 21 | Estado obsoleto tras cortes | `onreconnected` + recarga HTTP + estado UI |
| QUA-01 | Media / P2 | Pruebas concentradas en infraestructura transversal | seis specs | 16-37 | Regresiones de negocio sin detectar | Specs por módulo y E2E seguro |
| ACC-01 | Media / P2 | Labels/modales tienen carencias de nombre/foco; HTML está en `lang="en"` | plantillas; `index.html` | calidad general | Accesibilidad y lectura asistida deficientes | Asociar labels, aria/foco y `lang="es"` |
| ICO-01 | Baja / P3 | API envía `fa-*`, frontend solo carga Bootstrap Icons | `MenuCompleto.cs`; `angular.json:30-31` | 14 | Iconos del menú pueden no mostrarse | Mapear a `bi-*` o unificar biblioteca |

No se detectaron secretos frontend, HTML inseguro explícito, envío de JWT a terceros ni acceso directo a base de datos.

## 9. Estado de SignalR

La ruta, JWT, nombre del evento y payload coinciden con la API. La conexión usa reconexión automática; el servicio registra antes de iniciar, actualiza la lista compartida y libera handler/conexión. El tablero usa una instancia acotada y `takeUntilDestroyed`. Tres pruebas cubren evento, token dinámico y cleanup.

Falta demostrar conexión real, reconexión tras caída, recuperación de eventos perdidos y respuesta a token expirado. Resultado: **implementación parcial con buena base, no aprobación E2E**.

## 10. Calidad y pruebas

Resultados:

- 27/27 plantillas válidas.
- build de producción aprobado.
- 14/14 tests aprobados.
- bundle inicial 676.11 kB, bajo el presupuesto de 1 MB.
- cero ciclos de imports detectados.
- una advertencia CSS de Bootstrap.
- sin lint, cobertura exigible, E2E ni CI.

La suite cubre app, login, guard, interceptor, menú y habitaciones. Los módulos clínicos y farmacia no tienen specs propios.

## 11. Preparación para Azure

| Criterio | Resultado |
|---|---|
| Build producción | Sí |
| URL API/hub publicada | No; localhost HTTP |
| HTTPS | No configurado en frontend |
| Separación de entornos | No |
| Fallback de rutas SPA | Sin evidencia |
| Recursos estáticos | Favicon e iconos empaquetados |
| Secretos frontend | No encontrados |
| SignalR producción | URL no definida; CORS producción vacío hasta configuración externa |
| Pipeline CI/CD | No encontrado |
| Despliegue probado | No |

Dictamen: **compilable**, pero no hay evidencia para afirmar preparado, desplegado, público o validado en Azure.

## 12. Recomendaciones priorizadas

### P0 — crítica

Ninguna confirmada.

### P1 — alta

1. Planificar actualización Angular soportada que resuelva los avisos, sin `--force` indiscriminado.
2. Centralizar expiración, 401/403 y `ProblemDetails`.
3. Integrar permisos por operación y actualización del menú.
4. Reconciliar las cinco rutas del menú.
5. Definir entorno HTTPS/SignalR y hosting SPA para Azure; luego demostrarlo.
6. Integrar citas contra contratos reales o mantenerla explícitamente fuera del alcance.
7. Adaptar movimientos usando tablas/endpoints existentes.
8. Ejecutar E2E en entorno descartable, sin tocar Azure SQL real.

### P2 — media

1. Añadir specs a módulos clínicos/farmacia y cobertura con umbrales graduales.
2. Completar reconexión SignalR con recarga de snapshot.
3. Resolver paginación fija y filtro `idPaciente`.
4. Añadir lint/CI y pruebas de accesibilidad.
5. Tipar formularios/filtros que usan `any`.

### P3 — baja

1. Unificar iconografía.
2. Documentar Node/npm LTS y requisitos de ejecución.
3. Mantener fichas de módulo con commit de verificación.

## 13. Requisitos para ejecutar WebClinica

1. Node compatible con el CLI (`^18.19.1 || ^20.11.1 || >=22.0.0`) y npm 8+; se recomienda fijar una LTS soportada por la versión Angular seleccionada.
2. Dependencias instaladas desde el lockfile mediante `npm ci`.
3. API iniciada en `http://localhost:5293` para la configuración actual.
4. CORS de desarrollo con `http://localhost:4200`, ya presente en la API.
5. Configuración externa válida para la API: conexión, JWT y servicios externos; nunca dentro del frontend/repositorio.
6. Chrome/Chromium para Karma headless.

Comandos:

```powershell
cd C:\Users\DESARROLLO\Documents\ChatGPT\API-Clinica\WebClinica
npm ci
npm start
```

Validación:

```powershell
npm run verify
npm test -- --watch=false --browsers=ChromeHeadless
```

`npm ci` no fue necesario durante esta auditoría y no se ejecutó. En producción se requieren URLs HTTPS y una configuración separada; no debe publicarse el `environment.ts` actual como configuración final.

## 14. Propuesta de Skill y contexto

La Skill `webclinica-frontend` debe mantener un `SKILL.md` corto y siete referencias bajo demanda: arquitectura, stack, contratos, mapa de módulos, seguridad, pruebas y requisitos. `AGENTS.md` conserva las reglas globales de base inmutable y arquitectura. La especificación completa está en `WEB-AUDIT-01-Diseno-Skill.md`.

La estrategia de tokens usa tres niveles: ocho reglas permanentes, un corte vertical por módulo y documentos extensos solo cuando la tarea los necesite. Se debe medir consumo real antes de afirmar porcentajes. Véase `WEB-AUDIT-01-Optimizacion-Tokens.md`.

## 15. Estado Git antes y después

| Momento | Rama/HEAD | Estado |
|---|---|---|
| Antes | `main`, `bba962bb3b1d34ce733d20ffe2a591ad7327b0be`, igual a `origin/main` | Limpio; sin fusión abierta ni conflictos |
| Después | Misma rama y HEAD | Solo `docs/auditoria/` con siete informes nuevos sin seguimiento; código/configuración existentes intactos |

No se hizo commit ni push. La compilación solo produjo artefactos ignorados por Git.

## 16. Conclusión sobre la Skill

Existe evidencia suficiente para implementar una primera versión de `webclinica-frontend`: stack, arquitectura, contratos principales, módulos, reglas de seguridad y comandos de prueba están verificados. Falta el PDF para completar la referencia académica. La implementación futura debe marcar `project-requirements.md` como provisional hasta incorporar el documento oficial; esta auditoría no creó la Skill.
