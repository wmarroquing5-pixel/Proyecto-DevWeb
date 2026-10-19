# WEB-NAV-01 — Backlog de módulos anunciados por el menú

Fecha de verificación: 2026-10-19.

Este backlog deriva de la reconciliación entre `API-Clinica/Common/MenuCompleto.cs`, `API-Clinica/Services/MenuService.cs` y las rutas reales de `WebClinica`. Las tareas no autorizan cambios de esquema: la base de datos existente continúa inmutable. Cada implementación deberá volver a contrastar los contratos vigentes antes de escribir código.

## Seguimiento

- `WEB-ROL-01`: implementación frontend completada el 2026-10-19; validación E2E de escritura pendiente de un entorno no productivo autorizado.
- `WEB-CON-01`: implementación frontend completada el 2026-10-19; validación E2E autenticada pendiente.
- `WEB-INV-01`: implementación frontend completada el 2026-10-19 para entradas, ajustes y consumo clínico soportados; historial global de movimientos pendiente de contrato backend.
- `WEB-CIT-01`: condicionada a disponer de un contrato real que no requiera alterar la base de datos.
- `WEB-REP-01`: condicionada a definir contratos y alcance académico; actualmente es complementaria.

## WEB-ROL-01 — Administración de roles y permisos

**Seguimiento.** Implementado en WebClinica con CRUD de roles, matriz derivada de los módulos devueltos por `/api/permisos`, escrituras individuales y autorización separada para `Roles` y `Permisos`. No se realizaron escrituras E2E contra Azure SQL.

**Objetivo.** Implementar la pantalla administrativa de roles y su relación con los permisos dinámicos, reutilizando los patrones de usuarios y las protecciones de WEB-SEC-02/03.

**Estado inicial.** La API publica `/admin/roles` en el menú y WebClinica ya reconoce el módulo `Roles`, pero no existen modelos, servicio ni componentes Angular para administrarlo. WEB-NAV-01 conserva la opción autorizada y la conduce temporalmente a la pantalla informativa.

**Contratos API disponibles.** `GET/POST/PUT/DELETE /api/roles` usa `RolResponse` y `GuardarRolRequest`, protegido por las operaciones del módulo `Roles`. `GET/POST/PUT/DELETE /api/permisos` usa `PermisoResponse` y `GuardarPermisoRequest`, protegido por el módulo `Permisos`. Ambos listados usan `PagedResponse<T>`.

**Dependencias.** `PermisosService`, `permisoGuard`, `AutorizacionActualizacionService`, `MenuService`, componentes y estilos de administración de usuarios, y los contratos de `RolesController`, `PermisosController` y `AdministracionDtos.cs`.

**Prioridad académica.** Alta. La administración de usuarios, roles y permisos dinámicos está expresamente vinculada con la Fase 1.

**Archivos relacionados.** `WebClinica/src/app/app.routes.ts`, `core/models/permiso.model.ts`, `core/services/permisos.service.ts`, `pages/usuarios/*`, `API-Clinica/Controllers/RolesController.cs`, `API-Clinica/Controllers/PermisosController.cs` y `API-Clinica/DTOs/AdministracionDtos.cs`.

**Riesgos.** Confundir los permisos del módulo `Roles` con los del módulo `Permisos`; modificar un rol propio y perder acceso durante la sesión; duplicar reglas que ya aplica la API; asumir borrado permitido cuando existen permisos asociados.

**Criterios de aceptación.** Listado paginado de roles; operaciones visibles según permisos vigentes; edición de permisos con el contrato real; respuesta correcta a revocación/concesión; manejo de ProblemDetails; navegación sin roles hardcodeados; sin cambios en base de datos.

**Pruebas necesarias.** Servicio HTTP y serialización; guard de ruta; acciones por operación; paginación; errores 401/403/409; actualización del menú y permisos tras cambios; plantillas; integración segura contra una API no productiva.

## WEB-CON-01 — Listado global de consultas

**Objetivo.** Crear el listado global de consultas reutilizando el servicio y los DTO existentes, sin duplicar los formularios ni el historial por paciente.

**Estado.** Implementado en frontend el 2026-10-19. `/consultas` dejó de ser una pantalla temporal y ahora carga el listado global funcional, protegido mediante `Consultas/Consultar`.

**Contratos utilizados.** `GET /api/consultas` devuelve `PagedResponse<ConsultaListadoDto>` con `items`, `page`, `pageSize`, `totalCount` y `totalPages`; acepta `idPaciente`, `idMedico`, `idSucursal`, `idClinica`, `desde`, `hasta`, `page` y `pageSize`, y exige `Consultas/Consultar`. El listado reutiliza `HistorialService`, `ConsultaFiltroDto` y `ConsultaListadoDto`. La navegación al detalle existente usa `/historial/:id/consulta/:idConsulta` con el identificador de paciente y consulta incluidos en el DTO.

**Funcionalidad entregada.** Tabla responsive con los campos reales del DTO; filtros por paciente, médico, sucursal, clínica y rango de fechas; tamaños de página 10, 20, 50 y 100; paginación del servidor; total real; estados de carga, vacío y error; reintento de lectura; enlaces al detalle y al historial visibles únicamente con `Historial/Consultar`. Los filtros se conservan al paginar, vuelven a página 1 al buscar y se validan antes de solicitar la API.

**Seguridad.** La ruta y el filtro adicional del menú usan `Consultas/Consultar`. El componente no persiste datos clínicos, cancela solicitudes sustituidas o destruidas, limpia el listado al finalizar sesión o revocarse el permiso e ignora respuestas pertenecientes a otra identidad autenticada. Los errores pasan por `ApiErrorService`.

**Pruebas ejecutadas.** 25 casos nuevos o ampliados para contrato HTTP, Bearer, parámetros, paginación, camelCase, respuestas vacías, 400/401/403/500, componente, filtros, navegación, permisos, revocación, logout, cambio de usuario, ruta y menú. Suite completa: 178/178 aprobadas. `npm run verify`: 32 plantillas válidas y build de producción correcto. Persiste la advertencia conocida de Bootstrap `.form-floating>~label`.

**Limitaciones.** La tabla muestra identificadores porque `ConsultaListadoDto` no incluye nombres, motivo, estado ni otras relaciones descriptivas. La API ordena por `IdConsulta` ascendente y restringe automáticamente a un médico autenticado cuando corresponde. La API local respondió 401 a la solicitud anónima de solo lectura, pero no había credenciales autorizadas para ejecutar el flujo E2E; no se usaron datos clínicos reales y la validación HTTP funcional utiliza respuestas simuladas.

**Dependencia backend.** `API-Clinica/Services/MenuService.cs` todavía asocia `/consultas` con `Historial`, aunque `ConsultasController` exige `Consultas`. Angular elimina la opción entregada a quien carece de `Consultas/Consultar`, pero el servidor puede omitirla a un usuario que sí posee `Consultas/Consultar` y no `Historial/Consultar`. Corregir esa asociación requiere una tarea backend separada y no forma parte de WEB-CON-01.

**Pendientes.** Ejecutar E2E GET en un entorno no productivo con usuarios de alcances distintos y corregir la asociación del menú en backend tras autorización específica. No quedan cambios frontend pendientes dentro de WEB-CON-01.

## WEB-INV-01 — Integración de movimientos de inventario

**Estado.** Implementado en frontend el 2026-10-19 dentro de las pantallas funcionales existentes. La consulta y el registro de entradas permanecen en `/inventario/lotes`; el consumo clínico se registra desde el tratamiento de la consulta. No se creó una ruta general de movimientos porque la API no ofrece un contrato de lectura para ese historial.

**Contratos comprobados.** `GET /api/medicamentos/catalogo` expone `existenciaTotal` y exige `Medicamentos/Consultar`. `GET /api/lotes-medicamento` y `GET /api/lotes-medicamento/{id}` exponen la existencia por lote y exigen `LotesMedicamento/Consultar`. `POST /api/lotes-medicamento/{id}/entradas` recibe `RegistrarEntradaInventarioRequest`, devuelve `EntradaInventarioResponse` y exige `LotesMedicamento/Modificar`. `PUT /api/lotes-medicamento/{id}` recibe `ActualizarLoteMedicamentoRequest`, incluida `cantidadEsperada`, y exige `LotesMedicamento/Modificar`. `POST /api/ventas` exige `Ventas/Crear`; la API selecciona lotes vigentes, descuenta existencias y registra sus salidas dentro de una sola transacción. `POST /api/tratamientos/{id}/consumos` recibe `ConsumoClinicoCreateDto`, devuelve `ConsumoClinicoResponseDto` y exige `ConsumoClinico/Crear` además de que el usuario sea el médico responsable activo.

**Funcionalidad entregada.** La pantalla de lotes muestra la cantidad disponible real, usa paginación del servidor, registra entradas con sucursal, cantidad positiva y observaciones, solicita confirmación, bloquea dobles envíos y vuelve a leer los lotes tras la respuesta satisfactoria. Los ajustes existentes conservan `cantidadEsperada`, exigen sucursal y justificación al cambiar existencias, requieren confirmación y se distinguen de una salida clínica. Los tratamientos asociados a lote permiten registrar el consumo real con el endpoint clínico. Las respuestas inesperadas de listados y entradas se rechazan en lugar de generar existencias locales.

**Consolidación.** Se eliminaron los tres archivos del componente desconectado `inventario-movimientos`, que dependía de métodos inexistentes (`resumen`, `listarMovimientos` y `registrarMovimiento`), modelos ficticios, rutas `/dashboard/inventario...` y una salida general no autorizada. Se conservaron las rutas `/inventario`, `/medicamentos` y `/inventario/lotes`; no se agregó una opción al menú del backend.

**Seguridad y errores.** Las lecturas usan `LotesMedicamento/Consultar`; entradas y ajustes usan `LotesMedicamento/Modificar`; consumo clínico usa `ConsumoClinico/Crear`; ventas conservan `Ventas/Crear`. Las acciones se ocultan o bloquean después de una revocación, las respuestas pendientes se asocian con la identidad autenticada y los errores 400, 401, 403, 404, 409, red y servidor pasan por `ApiErrorService`. Las escrituras no se reintentan automáticamente.

**Pruebas ejecutadas.** Se añadieron 49 casos para contratos HTTP, Bearer, paginación, existencias, entradas, ajustes, consumo clínico, ProblemDetails, respuestas inesperadas, confirmación, doble clic, permisos, revocación, cambio de usuario, rutas y ausencia de doble descuento en ventas. Suite completa: 249/249 aprobadas en ChromeHeadless. `npm run verify`: 31 plantillas válidas y build de producción correcto. Persiste la advertencia conocida de Bootstrap `.form-floating>~label`.

**Operaciones sin soporte.** No existe controlador ni endpoint GET para consultar `MovimientoInventario`; por ello no se muestra fecha, tipo, usuario o justificación como historial global. Tampoco existe una salida administrativa general: ventas y consumo clínico son las únicas salidas semánticas verificadas. Un detalle de venta no se utiliza como sustituto del historial.

**Limitaciones y dependencia backend.** Para habilitar un historial global se necesita un contrato backend paginado, con alcance por permisos y sucursal, que exponga únicamente los campos autorizados. El consumo clínico no devuelve existencia resultante y se mantiene en el contexto del tratamiento, donde la API valida lote vigente, stock, médico responsable y concurrencia. No se ejecutaron escrituras E2E ni se usaron datos productivos; la validación funcional de escritura utiliza `HttpTestingController` y mocks.

## WEB-CIT-01 — Integración del módulo de citas

**Objetivo.** Evaluar y, solo si existe un contrato compatible con el esquema inmutable, integrar un módulo de citas real.

**Estado inicial.** Hay un componente desconectado, un modelo y un mock residual. `cita.service.ts` y `cita-realtime.service.ts` están vacíos. La API no posee `CitasController`, DTO de citas ni `/hubs/citas`; únicamente el menú y el permiso `Citas` anuncian el módulo. El modelo residual propone tablas que no existen y no puede utilizarse como contrato.

**Contratos API disponibles.** Ninguno para consultar, crear, reprogramar o cambiar el estado de citas. Tampoco existe un evento SignalR de citas. `GET /api/menu` únicamente autoriza la visibilidad de `/citas`.

**Dependencias.** Definición funcional y contractual del módulo, comprobación de que el esquema existente puede soportarlo sin cambios, endpoints autorizados y, si se requiere tiempo real, un hub y eventos formalmente definidos en una tarea backend separada.

**Prioridad académica.** Complementaria. Citas no figura como CRUD independiente expresamente exigido por la referencia disponible de Fase 1; debe confirmarse con la fuente académica oficial.

**Archivos relacionados.** `WebClinica/src/app/pages/citas/*`, `core/models/cita.model.ts`, `core/mock/citas.mock.ts`, `core/services/cita.service.ts`, `core/services/cita-realtime.service.ts`, `app.routes.ts` y `API-Clinica/Common/MenuCompleto.cs`.

**Riesgos.** Inventar endpoints o eventos; usar mocks como comportamiento productivo; introducir supuestos de tablas, constraints o índices prohibidos; conectar una pantalla que aparenta operaciones persistentes sin backend.

**Criterios de aceptación.** Contrato real documentado y verificado; compatibilidad demostrada con el esquema existente; servicio Angular tipado; permisos por operación; pantalla sin mocks productivos; SignalR únicamente si existe contrato; sin migraciones ni cambios de base de datos.

**Pruebas necesarias.** Contratos HTTP; estados y reglas confirmadas; autorización; concurrencia si el contrato la contempla; reconexión SignalR si existe; componentes; E2E seguro. La tarea debe permanecer bloqueada si falta el contrato.

## WEB-REP-01 — Evaluación e implementación de reportes

**Objetivo.** Determinar el alcance de los reportes de citas del día y pacientes atendidos y desarrollar únicamente los que cuenten con requisitos y contratos aprobados.

**Estado inicial.** El menú publica `/reportes/citas` y `/reportes/pacientes` bajo `Reportes/Consultar`. No existen componentes, servicios, DTO ni controladores de reportes. WEB-NAV-01 conserva ambas rutas como funcionalidades pendientes autorizadas.

**Contratos API disponibles.** Ninguno para datos agregados o exportación. `GET /api/menu` solo aporta etiquetas, rutas y autorización de consulta.

**Dependencias.** Definición académica y funcional, origen de datos permitido, filtros, alcance por usuario/sucursal, formato de salida y contratos API. Si el reporte de citas depende de WEB-CIT-01, esa tarea deberá resolverse primero.

**Prioridad académica.** Baja/complementaria mientras la fuente oficial de Fase 1 no lo exija expresamente. No debe desplazar roles ni historial.

**Archivos relacionados.** `WebClinica/src/app/app.routes.ts`, `core/services/menu.service.ts`, `core/models/permiso.model.ts`, `API-Clinica/Common/MenuCompleto.cs` y `API-Clinica/Services/MenuService.cs`.

**Riesgos.** Inferir métricas diferentes a las solicitadas; consultar datos sin respetar alcance; inventar endpoints; cargar grandes volúmenes para agregar en el navegador; tratar una entrada de menú como requisito académico suficiente.

**Criterios de aceptación.** Alcance aprobado; endpoint paginado o agregado documentado; filtros y autorización por `Reportes/Consultar`; estados de carga/vacío/error; diseño responsive; exportación solo si está contratada; sin acceso directo a base de datos.

**Pruebas necesarias.** Servicio HTTP; filtros; permisos; alcance de datos; valores vacíos y límites; errores; plantilla; rendimiento razonable; E2E con datos no productivos.
