# API-MENU-01 — Auditoría y corrección del catálogo dinámico de navegación

## 1. Identificación

- Fecha: 2026-10-19.
- Rama: `main`.
- Proyecto modificado: `API-Clinica`.
- Proyecto de pruebas: `API-Clinica.Tests`.
- Endpoint auditado: `GET /api/menu`.
- Base de datos evaluada: contrato EF Core en lectura y pruebas aisladas con EF Core InMemory.
- Azure SQL: no consultada ni modificada.
- Frontend: `WebClinica` revisado exclusivamente en lectura.

## 2. Resumen ejecutivo

El catálogo estaba desactualizado respecto de las pantallas funcionales de WebClinica. No anunciaba lotes, habitaciones ni ventas; anunciaba citas y reportes aunque esas rutas muestran una funcionalidad pendiente; y asociaba `/consultas` al módulo `Historial`, en contradicción con `ConsultasController` y el guard Angular, que exigen `Consultas/Consultar`.

La corrección mantiene el mismo DTO y el mismo endpoint. El catálogo ahora anuncia únicamente rutas globales funcionales verificadas y `MenuService` concede cada entrada solo cuando existe exactamente un permiso efectivo de consulta para el módulo asociado. Los permisos desconocidos o duplicados no habilitan ni siquiera Dashboard. No existe tratamiento especial por usuario, rol, nombre `admin` o identificador.

## 3. Catálogo anterior

| Opción | Ruta | Asociación anterior | Estado auditado |
|---|---|---|---|
| Dashboard | `/dashboard` | Cualquier permiso consultable | Funcional, pero aceptaba módulos desconocidos |
| Pacientes | `/pacientes` | `Pacientes/Consultar` | Funcional |
| Citas | `/citas` | `Citas/Consultar` | Ruta Angular pendiente; se anunciaba como opción normal |
| Consultas | `/consultas` | `Historial/Consultar` | Permiso incorrecto |
| Medicamentos | `/medicamentos` | `Medicamentos/Consultar` | Funcional mediante alias Angular |
| Usuarios | `/admin/usuarios` | `Usuarios/Consultar` | Funcional |
| Roles | `/admin/roles` | `Roles/Consultar` | Funcional |
| Empleados | `/admin/empleados` | `Empleados/Consultar` | Funcional mediante alias Angular |
| Reporte de citas | `/reportes/citas` | `Reportes/Consultar` | Ruta Angular pendiente |
| Reporte de pacientes | `/reportes/pacientes` | `Reportes/Consultar` | Ruta Angular pendiente |

Omisiones confirmadas: `/inventario/lotes`, `/habitaciones` y `/ventas` tenían componentes Angular funcionales, controladores REST y permisos de consulta, pero no figuraban en `MenuCompleto` ni en la asociación ruta–módulo.

## 4. Catálogo corregido y contratos

| Módulo | Ruta del menú | Permiso exacto | Endpoint asociado | Ruta Angular | Estado |
|---|---|---|---|---|---|
| Inicio | `/dashboard` | Al menos un módulo reconocido con `Consultar` | No requiere endpoint clínico | `/dashboard` | Funcional |
| Pacientes | `/pacientes` | `Pacientes/Consultar` | `GET /api/pacientes` | `/pacientes` | Funcional |
| Consultas | `/consultas` | `Consultas/Consultar` | `GET /api/consultas` | `/consultas` | Funcional |
| Medicamentos | `/medicamentos` | `Medicamentos/Consultar` | `GET /api/medicamentos` | Alias a `/inventario` | Funcional mediante alias |
| Lotes | `/inventario/lotes` | `LotesMedicamento/Consultar` | `GET /api/lotes-medicamento` | `/inventario/lotes` | Funcional |
| Habitaciones | `/habitaciones` | `Habitaciones/Consultar` | `GET /api/habitaciones` | `/habitaciones` | Funcional |
| Ventas | `/ventas` | `Ventas/Consultar` | `GET /api/ventas` | `/ventas` | Funcional |
| Usuarios | `/admin/usuarios` | `Usuarios/Consultar` | `GET /api/usuarios` | `/admin/usuarios` | Funcional |
| Roles | `/admin/roles` | `Roles/Consultar` | `GET /api/roles` | `/admin/roles` | Funcional |
| Empleados | `/admin/empleados` | `Empleados/Consultar` | `GET /api/empleados` | Alias a `/empleados` | Funcional mediante alias |

El orden anterior es determinista y se valida por prueba automatizada. No existen rutas duplicadas.

## 5. Decisiones sobre módulos contextuales o pendientes

| Módulo | Decisión | Evidencia |
|---|---|---|
| Citas | Retirado del catálogo operativo | `/citas` carga `FuncionalidadPendienteComponent` |
| Reportes | Retirados del catálogo operativo | Ambas rutas cargan `FuncionalidadPendienteComponent` |
| Asignaciones de habitación | Sin entrada independiente | Las operaciones se realizan dentro del tablero de habitaciones; no existe ruta Angular global propia |
| Historial clínico | Sin entrada independiente | Sus rutas requieren `:id` de paciente o consulta |
| Consumo clínico | Sin entrada independiente | Es una operación contextual dentro del detalle clínico |
| Categorías y marcas | Sin entrada independiente | Son dependencias del inventario y no tienen ruta global de menú |

No se inventaron endpoints, rutas, permisos ni equivalencias.

## 6. Semántica de autorización verificada

`AccesoActualService` comprueba que el JWT corresponda a un usuario activo, con el mismo rol activo y username vigente. Después lee los permisos del rol mediante EF Core sin seguimiento. Los permisos repetidos para un mismo módulo se descartan con comparación independiente de mayúsculas.

`MenuService` aplica una segunda validación defensiva:

1. El módulo debe estar reconocido por el catálogo.
2. Debe existir exactamente un permiso para ese módulo.
3. `PuedeConsultar` debe ser verdadero.
4. Los permisos `Crear`, `Modificar` o `Eliminar` no sustituyen `Consultar`.
5. Un permiso desconocido no habilita Dashboard.
6. El nombre o ID del usuario y del rol no participan en el filtrado.

La consulta de permisos se ejecuta en cada solicitud; no se introdujo una caché que retrase concesiones o revocaciones.

## 7. Compatibilidad con WebClinica

El contrato JSON se conserva sin cambios: `label`, `route`, `icon`, `hidden`, `roles` y `children`, serializados en camelCase. Las entradas administrativas mantienen la jerarquía existente. Los campos decorativos `roles` se conservaron por compatibilidad, pero no intervienen en la autorización.

Las rutas nuevas existen en `app.routes.ts` y el DTO puede ser normalizado por el `MenuService` Angular. Sin embargo, WEB-UI-01 mantiene una lista local de rutas autorizables que todavía no incluye `/inventario/lotes`, `/habitaciones` ni `/ventas`; por ello el frontend actual deserializa estas entradas, pero las descarta durante su filtrado defensivo. API-MENU-01 prohíbe modificar WebClinica, así que la visualización completa queda pendiente de una tarea frontend separada. No se aplicó ninguna codificación alternativa o equivalencia insegura para ocultar esta incompatibilidad.

Existe además una restricción frontend ya presente: el alias `/medicamentos` redirige a `/inventario`, cuya ruta Angular exige también `Categorias/Consultar` y `Marcas/Consultar`. El contrato solicitado para la opción de menú sigue siendo `Medicamentos/Consultar`; no se amplió ni se sustituyó ese permiso desde el backend.

## 8. Pruebas ejecutadas

Las pruebas nuevas se encuentran en `API-Clinica.Tests/MenuTests.cs` y usan dobles del servicio o una base EF Core InMemory con JWT de prueba. No utilizan credenciales ni infraestructura productiva.

| Evidencia | Resultado |
|---|---|
| Catálogo exacto, ordenado y sin duplicados | APROBADO |
| Exclusión de citas y reportes pendientes | APROBADO |
| Nueve asociaciones módulo–ruta funcional | APROBADO |
| `Consultas/Consultar` habilita `/consultas` | APROBADO |
| `Historial/Consultar` no habilita `/consultas` | APROBADO |
| Modificar sin Consultar no habilita módulo | APROBADO |
| Permiso vacío o desconocido no habilita Dashboard | APROBADO |
| Permisos duplicados se deniegan | APROBADO |
| Concesión y revocación sin caché | APROBADO |
| Nombre de rol `Admin` sin privilegio especial | APROBADO |
| Endpoint sin JWT devuelve 401 | APROBADO |
| Usuario activo sin permisos recibe `[]` | APROBADO |
| Usuario o rol inactivo recibe 403 | APROBADO |
| Respuesta HTTP filtra duplicados | APROBADO |
| DTO se serializa en camelCase | APROBADO |

Resultado focalizado: 22 pruebas aprobadas, 0 fallidas y 0 omitidas.

Validación técnica adicional:

- `dotnet restore`: correcto; proyectos actualizados.
- `dotnet build --no-restore --configuration Release`: correcto, 0 errores y 0 advertencias.
- Regresión segura sin suites SQL externas: 349 aprobadas, 0 fallidas y 2 omitidas por atributos `Skip` preexistentes.
- Ejecución completa descubierta: 432 casos; 350 aprobados, 2 omitidos y 80 bloqueados por requerir `CLINICA_SQL_INTEGRATION=1` y una instancia SQLEXPRESS aislada.
- `npm run verify` en WebClinica: compilación de producción correcta y 31 plantillas válidas; persiste únicamente la advertencia CSS conocida de Bootstrap para `.form-floating>~label`.
- Suite frontend ejecutada en esta sesión antes de API-MENU-01: 271 aprobadas de 271. API-MENU-01 no modificó archivos frontend.

El adaptador instalado presenta el marcador dinámico `$XunitDynamicSkip$` como fallo de ejecución. Los 80 casos se detuvieron en `SqlServerTestDatabase.CreateAsync` antes de abrir una conexión o ejecutar lógica de prueba; por tanto se clasifican como BLOQUEADA y no como fallos funcionales de API-MENU-01. No se habilitó la variable porque hacerlo habría autorizado escrituras sobre una base SQL externa al alcance.

La integración autenticada contra una API local y Azure SQL real queda BLOQUEADA por ausencia de credenciales autorizadas para un usuario de prueba. No se interpreta la prueba InMemory como E2E productivo.

## 9. Cambios realizados

| Archivo | Cambio | Motivo |
|---|---|---|
| `API-Clinica/Common/MenuCompleto.cs` | Retira rutas pendientes e incorpora lotes, habitaciones y ventas | Alinear el catálogo con pantallas globales funcionales |
| `API-Clinica/Services/MenuService.cs` | Corrige Consultas, incorpora asociaciones faltantes y valida módulos/duplicados | Igualar la semántica de autorización de los controladores |
| `API-Clinica.Tests/MenuTests.cs` | Añade pruebas unitarias y HTTP aisladas | Cubrir catálogo, seguridad y compatibilidad |
| `docs/auditoria/API-MENU-01.md` | Registra auditoría, matriz y limitaciones | Trazabilidad de API-MENU-01 |

## 10. Restricciones y riesgos

- No se modificó el esquema ni los datos de Azure SQL.
- No se crearon migraciones ni scripts SQL.
- No se asignaron permisos, roles o privilegios a cuentas reales.
- No se modificaron controladores ni atributos de autorización.
- No se cambió JWT, rutas REST, dependencias o configuración productiva.
- No se modificó WebClinica.
- No se realizó commit ni push.
- La visibilidad de las tres rutas nuevas requiere que una tarea frontend futura amplíe su mapa local ruta–módulo conservando los mismos permisos exactos.

## 11. Resultado del alcance

- APROBADO: catálogo backend, asociaciones de permisos, denegación por defecto, DTO y pruebas aisladas.
- FALLIDO: ninguno dentro del código backend corregido.
- NO IMPLEMENTADO: citas y reportes operativos; se excluyen deliberadamente del catálogo.
- BLOQUEADA: verificación autenticada contra la configuración local/real y visibilidad final de nuevas rutas en el frontend por restricción de alcance.
