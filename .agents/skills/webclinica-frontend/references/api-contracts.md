# Índice de contratos consumidos por WebClinica
Última verificación: `bba962bb3b1d34ce733d20ffe2a591ad7327b0be` (2026-10-18). Índice, **no sustituto de los DTO/controller actuales**. Para modificar llamada HTTP, comprobar su implementación exacta.

| Dominio | Servicio frontend | API / ruta | Verificación auditada |
|---|---|---|---|
| Login/sesión | `AuthService` | POST `/api/auth/login`, GET `/api/auth/me` | Contratos principales compatibles; expiración pendiente |
| Permisos | `AuthService`/UI pendiente | GET `/api/auth/permisos` | API disponible, UI aún no consume permisos operativos |
| Menú | `MenuService` | GET `/api/menu` | Payload correcto; hay rutas sin pantalla |
| Pacientes | `PacientesService` | `/api/pacientes` | CRUD tipado estático |
| Empleados | `EmpleadosService` | `/api/empleados` | `Medico`, `Enfermera`, `Administrativo` |
| Usuarios | `UsuariosService` | `/api/usuarios` | CRUD tipado estático; falta pantalla de roles |
| Catálogos | `CatalogosService` | `/api/sucursales`, `/api/especialidades`, `/api/turnos` | Límite primera página 100 |
| Habitaciones | `HabitacionesService` | `/api/habitaciones` | CRUD; pruebas HTTP simuladas |
| Asignación/egreso | `HabitacionesService` | `/api/asignaciones-habitacion`, `/{id}/egreso` | Paginación/búsqueda activa limitada |
| Historia/consulta | `HistorialService` | `/api/consultas`, `/api/diagnosticos`, `/api/historial-medico`, `/api/tratamientos`, `/api/examenes`, `/api/contactos-emergencia` | Operaciones por recurso: contrastar método puntual |
| Medicamentos | `InventarioService` | `/api/medicamentos`, `/api/medicamentos/catalogo` | `existenciaTotal` |
| Lotes | `InventarioService` | `/api/lotes-medicamento`, `/{id}/entradas` | `cantidadEsperada` |
| Categoría/marca | `InventarioService` | `/api/categorias`, `/api/marcas` | CRUD según recurso |
| Ventas | `VentasService` | `/api/ventas` | GET/POST; filtro `idPaciente` modelado pero no enviado |
| Tiempo real | `HabitacionesService` | `/hubs/habitaciones` | Evento `ActualizarEstadoHabitacion`: `{ habitacionId, estado }` |

## Invariantes
- Paginación `items`, `page`, `pageSize`, `totalCount`, `totalPages`.
- `ExistenciaTotal` → `existenciaTotal`; `FechaHistorial` → `fechaHistorial`; `CantidadEsperada` → `cantidadEsperada` por serialización camelCase; verificar DTO y configuración antes de editar.
- Hub de habitaciones **no** usa `/api/hubs/habitaciones`; JWT debe consultarse de nuevo para reconexión.
- No hay evidencia de controlador/hub de citas integrado. No fabricar endpoints.
- Roles/permisos por operación `Consultar`, `Crear`, `Modificar`, `Eliminar`: leer atributos de controlador y contrato de `/auth/permisos`; nunca deducir permisos solo del nombre del rol.
- Azure SQL/R2 solo detrás del backend; nunca SQL, SDK R2 ni secretos en frontend.

## Verificación mínima de cambios
Abrir método Angular → modelo TS → controlador/DTO .NET relevante → permiso/validador correspondiente → spec HTTP. Distinguir compatibilidad estática de E2E.
