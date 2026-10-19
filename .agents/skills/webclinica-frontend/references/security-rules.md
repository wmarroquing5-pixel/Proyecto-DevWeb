# Seguridad frontend — Fase 1
Última verificación: `bba962bb3b1d34ce733d20ffe2a591ad7327b0be` (2026-10-18). Hallazgos de auditoría: SEC-01 a SEC-10.

## Autenticación y sesión
- Login real `POST /api/auth/login` y `GET /api/auth/me`. Guard protege layout, interceptor adjunta Bearer solamente a API autorizada.
- La respuesta proporciona `expiresAtUtc`; al corte no se valida. Al implementar, utilizar fecha del contrato, limpiar sesión expirada y cubrir restauración y solicitudes concurrentes con pruebas.
- 401: invalidación de sesión y navegación coherente sin bucles; 403: mantener distinción de permiso denegado, no tratarlo automáticamente como credenciales inválidas.
- Convertir errores ASP.NET `ProblemDetails` (`title`, `detail`, `errors`) de modo centralizado y seguro.
- JWT actualmente persistido en `localStorage` (riesgo XSS); no cambiar a cookies sin diseño/contrato autorizado. No registrar ni exponer tokens.

## Autorización dinámica
- PDF Fase 1 numerales 11 y 12: roles/permisos se asignan dinámicamente por módulo y operación; menú depende del backend y debe reflejar cambios durante la sesión.
- No hardcodear permiso por ID de usuario ni rol; consultar API de permisos, usar guard/metadatos de rutas y visibilidad de acciones Consultar/Crear/Modificar/Eliminar. Servidor siempre revalida.
- Diseñar actualización/invalidez de caché de menú ante cambios, reconexión, navegación sensible o 403; comprobar revocación real sin recargar manualmente.
- No mostrar enlaces que redirigen silenciosamente a dashboard si la ruta aún no existe.

## SignalR habitaciones
- Ruta `/hubs/habitaciones`, no `/api/hubs/habitaciones`; `accessTokenFactory` obtiene token actual.
- Evento `ActualizarEstadoHabitacion` y payload habitacionId/estado; comprobar en código fuente antes de tocarlo.
- Evitar handlers duplicados; liberar `off`/`stop`; recuperación tras reconexión debe refrescar estado vía HTTP. No inferir E2E por specs aislados.

## Seguridad operacional
- No exponer secrets/SQL/R2 en frontend. Evitar HTML no confiable, `bypassSecurityTrust*`, `eval`, credenciales en logs y URLs no aprobadas.
- Validar errores HTTP y datos de formularios sin delegar reglas de negocio únicamente al cliente.
- No vender sin stock, no usar lote vencido ni asignar habitación ocupada: comprobar UX pero autoridad definitiva es API (PDF 14).
- Ocho avisos Angular detectados al corte: actualizar en tarea separada con compatibilidad comprobada; `npm audit fix --force` prohibido.
