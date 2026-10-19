# Validación focalizada y aceptación
Última verificación: `bba962bb3b1d34ce733d20ffe2a591ad7327b0be` (2026-10-18).

## Línea base histórica, NO garantía actual
- 27/27 plantillas, build producción correcto, 14/14 specs Karma/ChromeHeadless.
- Bundle inicial 676.11 kB; sin E2E integrado porque API local no estaba disponible.
- No había lint, cobertura exigible ni CI.

## Matriz proporcional
| Cambio | Comprobación necesaria |
|---|---|
| Documentación | Enlaces/rutas consistentes, `git diff --check` |
| HTML/CSS local | `npm run verify`, inspección visual y accesibilidad concreta |
| Componente/modelo | Specs pertinentes + `npm run verify` |
| Servicio HTTP | Mock HTTP del contrato, códigos/error/paginación + `npm run verify` |
| JWT/permisos/SignalR | Pruebas de guard/interceptor/menú/hub, suite completa y E2E seguro si existe entorno autorizado |
| Dependencias/entornos Azure | Build producción, suite, `npm audit --omit=dev`, HTTPS/rutas SPA, pruebas de integración autorizadas |

Comandos históricos (comprobar scripts):
```powershell
cd WebClinica
npm run verify
npm test -- --watch=false --browsers=ChromeHeadless
npm audit --omit=dev
```
No ejecutar `npm ci` si el usuario prohibió instalaciones; tampoco asumir API disponible.

## Escenarios Fase 1 prioritarios
- JWT válido/inválido/expirado; 401/403; menú con perfiles diferentes y revocación/concesión de permisos.
- CRUD de pacientes, empleados, usuarios, medicamentos, lotes, habitaciones y registros clínicos conforme a endpoint real.
- Habitación: estados libre/ocupada/en limpieza, asignación, egreso, concurrencia y SignalR con dos clientes + reconexión.
- Historial: consulta, diagnóstico con permiso, tratamientos, exámenes y evolución.
- Ventas: carrito/detalle, precios/cantidades, existencia insuficiente, lote vencido, descuento automático y concurrencia (validaciones del servidor).
- Multi-clínica: selección y consistencia por sucursal, sin inventar modelo de aislamiento.
- Despliegue: frontend/API HTTPS accesibles y flujo real, sin declarar éxito solo por build.

## Seguridad de pruebas
- No mutar Azure SQL real ni usar registros clínicos reales para testing. Las pruebas E2E de escritura requieren entorno/BD descartable autorizada.
- Si no existe tal entorno, implementar solo mocks/unitarias y clasificar E2E como `No ejecutado`.
- Reportar: validado estáticamente, unit tests, integración real, producción, todos por separado.
