# Mapa de módulos Fase 1
Última verificación: `bba962bb3b1d34ce733d20ffe2a591ad7327b0be` (2026-10-18). Usar `rg --files src/app` para recuperar rutas reales; nombres listados son pistas, no garantía de permanencia.

| Área | Punto de entrada / archivos a localizar | Situación al auditar | Prioridad |
|---|---|---|---|
| Sesión | login, `core/services/auth.service.ts`, guard, interceptor, `user.model.ts` | Básico activo; expiración/401-403 pendiente | P1 |
| Menú/permisos | layout/sidebar, `menu.service.ts`, `app.routes.ts` | Dinámico de consulta; sin control CRUD ni actualización inmediata | P1 |
| Pacientes | ruta `/pacientes`, modelo/servicio/páginas | CRUD implementado estáticamente; sin E2E | P1 validar |
| Empleados | `/empleados`, catálogos, modelo/servicio | Tipos exactos soportados; asociación de rol revisar | P1 validar |
| Usuarios/roles | `/admin/usuarios`, `usuarios.service.ts` | Usuarios activos; `/admin/roles` sin pantalla | P1 |
| Habitaciones | `/habitaciones`, `habitaciones.service.ts`, board/modales | CRUD/asignación/egreso; SignalR probado aislado | P1 validar |
| Historial/consultas | `/historial/:id`, `historial.service.ts` | Consulta y detalle; `/consultas` global ausente | P1 |
| Inventario/lotes | `/inventario`, `inventario.service.ts`, formularios | Medicamentos/lotes activos; movimientos fuera del grafo | P1 |
| Ventas | `/ventas`, `venta.service.ts`, formulario/detalle | Carrito/registro; filtro idPaciente omitido | P1 validar |
| Sucursales | `catalogos.service.ts` y campos `idSucursal` | Soporte parcial multi-clínica; no probar aislamiento sin API | P1 validar |

## Archivos no integrados al corte
- `core/mock/citas.mock.ts`, `core/models/cita.model.ts`, `core/services/cita.service.ts` (vacío), `core/services/cita-realtime.service.ts` (vacío), `pages/citas/citas-list.component.ts` (sin ruta).
- `pages/inventario/inventario-movimientos.component.ts`: sin ruta, utiliza métodos inexistentes y rutas antiguas.
- Reportes: dos entradas de menú sin pantallas. **No presentar estos archivos como funcionalidad entregada.**
- Citas y reportes no aparecen como módulos CRUD expresamente enumerados en numeral 13 del PDF; no elevarlos a obligación académica independiente por el menú. Consultas sí pertenecen al historial (13.e).

## Procedimiento por módulo
1. Elegir una sola fila.
2. Buscar ruta, servicio, modelo, spec y consumidores con `rg`.
3. Solo si cambia contrato, buscar controlador/DTO exacto .NET.
4. Proteger los flujos existentes y las invariantes del requisito 13/14.
5. Ejecutar pruebas focalizadas y reportar E2E pendiente cuando proceda.
