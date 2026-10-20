# WEB-UX-01A — Auditoría UI/UX y viabilidad

Fecha de corte: 2026-10-19  
Ámbito: `WebClinica` (Angular). El backend se consultó solamente en lectura para confirmar contratos. No se modificaron API, Azure SQL, migraciones, dependencias, Skills, ni configuración de infraestructura.

## Método y límites

Se revisaron las rutas activas, componentes de página y formulario, servicios HTTP, modelos TypeScript, pruebas disponibles y los controladores/DTO necesarios para los contratos de fotografía. La matriz refleja el código actual, no la fotografía histórica de auditorías previas.

La API es la autoridad para autorización y reglas de negocio. Las mejoras propuestas conservan los IDs en las solicitudes y nunca consultan SQL, R2 ni servicios externos desde Angular. La carga de fotografías se limita al contrato HTTP confirmado; no se almacenarán imágenes en `localStorage` ni Base64 persistente.

### Categorías de viabilidad

| Categoría | Significado |
|---|---|
| A | Cambio estrictamente visual o de interacción local; no altera el contrato HTTP. |
| B | Implementable con servicios y contratos existentes confirmados. |
| C | Requiere comprobar el DTO, permiso, paginación o datos de catálogo puntuales antes de codificar. |
| D | Bloqueado: falta contrato backend integrado o la pantalla no pertenece al grafo funcional. |

## Inventario de módulos y pantallas

| Módulo | Ruta o pantalla | Estado observado | Categoría inicial |
|---|---|---|---|
| Sesión y navegación | `/login`, layout, sidebar, acceso denegado, 404 | Navegación dinámica, responsive y con estados de carga/reintento. | A |
| Dashboard | `/dashboard` | Tarjetas de acceso rápido vinculadas al menú autorizado. | A |
| Pacientes | listado, nuevo, edición, historial | CRUD y paginación activos; formulario conserva una URL de foto manual. | B |
| Empleados | listado, nuevo, edición | CRUD con sucursal, especialidad y turno; iconografía y confirmación heredadas. | A/B |
| Usuarios | listado, nuevo, edición | Listado ya resuelve rol y tipo de empleado desde catálogos; formulario aún recibe IDs numéricos. | B |
| Roles y permisos | `/admin/roles` | Gestión de roles/permisos y recarga de autorizaciones disponible. | B |
| Consultas e historial | listado global, historial paciente, nueva consulta, detalle | Flujos clínicos activos; aún presenta IDs técnicos en datos relacionados. | C |
| Habitaciones | tablero, crear, asignar, egreso | CRUD/asignación, SignalR y estados locales; sucursal y paciente se muestran parcialmente como IDs. | C |
| Inventario | medicamentos, formulario, lotes, entrada | CRUD, filtros y catálogos de categoría/marca; formulario mantiene URL de imagen. | B |
| Movimientos de inventario | componente aislado | No está en rutas y sus llamadas no forman un contrato funcional actual. | D |
| Ventas | listado, nueva venta, detalle | Venta y catálogo de medicamentos activos; sucursal, usuario y detalle exponen IDs sin descripción. | C |
| Citas | `/citas` y archivos mock | La ruta informa funcionalidad pendiente; el servicio real no está integrado. | D |
| Reportes | `/reportes/citas`, `/reportes/pacientes` | Rutas de funcionalidad pendiente sin pantalla ni contrato auditado. | D |

## Matriz de viabilidad requerida

| Módulo | Pantalla | Problema | Contrato API | Solución frontend | Requiere backend |
|---|---|---|---|---|---|
| Aplicación | Layout, sidebar y estados comunes | Estilos globales vacíos; cada página define jerarquía, espaciado y alertas de forma distinta. | No aplica. | **A:** tokens CSS y clases reutilizables para cabecera, tarjeta, tabla, filtros, estados y foco visible; mantener Bootstrap. | No |
| Aplicación | Acciones destructivas | Hay nueve usos de `confirm()`/`window.confirm()` con mensajes y comportamiento no homogéneos. | No aplica. | **A:** diálogo Angular/Bootstrap reutilizable, con título, consecuencia, cancelar como foco inicial y estado de envío. | No |
| Aplicación | Botones e iconos | Conviven `fa fa-*` y `bi bi-*`; varias acciones no tienen texto alternativo o tooltip consistente. | No aplica. | **A:** migrar las acciones estándar a Bootstrap Icons, `aria-label` y `title`; no cambiar operaciones ni permisos. | No |
| Aplicación | Carga, vacío y error | Spinners, alerts y textos de vacío están repetidos y no siempre incluyen `role` o reintento. | No aplica. | **A:** patrón reutilizable de estados y mensajes provenientes de `ApiErrorService`. | No |
| Pacientes | Listado y formulario | La foto es una URL editable y no un recurso gestionado; falta previsualización y eliminación segura. | Confirmado: `POST/GET/DELETE /api/pacientes/{id}/foto`, campo multipart `foto`; permisos Consultar/Modificar. | **B:** selector de archivo, previsualización temporal, carga después de crear/editar, lectura autenticada y eliminar con confirmación; retirar el campo de URL del flujo UI. | No |
| Medicamentos | Listado y formulario | `imagenURL` se captura como URL, aunque existe servicio de fotografía específico. | Confirmado: `POST/GET/DELETE /api/medicamentos/{id}/foto`, multipart `foto`; permisos Consultar/Modificar. | **B:** mismo control reusable de fotografía, sin persistencia local y conservando el contrato de medicamento para datos no visuales. | No |
| Usuarios | Listado | Antes mostraba IDs de rol y empleado; ahora resuelve rol y tipo de empleado mediante catálogos con permisos. | Confirmados `GET /api/usuarios`, `/api/roles`, `/api/empleados`, todos paginados. | **B ya iniciado:** conservar mapas por página, sin solicitudes por celda; mejorar únicamente la presentación común. | No |
| Usuarios | Alta y edición | El formulario solicita `ID Rol` e `ID Empleado`, lo que obliga a conocer claves internas. | Confirmados roles y empleados paginados, y `Crear/ActualizarUsuarioRequest` conserva `idRol` e `idEmpleado`. | **B:** selects buscables o select nativo con texto descriptivo; enviar los IDs seleccionados. No inventar relación si el empleado no está disponible. | No |
| Roles y permisos | Gestión de roles | Tablas, formularios y confirmaciones no siguen aún un patrón visual único. | `RolesService` y permisos CRUD existentes; actualización de autorización ya integrada. | **B:** aplicar patrón visual y acciones accesibles, conservando recarga de permisos. | No |
| Empleados | Listado y formulario | Estilo de tabla/acciones heredado y confirmación nativa; catálogos están disponibles. | Confirmados empleados y catálogos de sucursal, especialidad y turno. | **B:** normalizar tabla, filtros, acciones y selects descriptivos; conservar IDs de request. | No |
| Habitaciones | Tablero y modales | Se muestra `idSucursal`; se necesita contrastar qué catálogo y alcance de sucursal corresponde a cada respuesta antes de sustituirlo. | Habitaciones, asignación/egreso y hub están activos; el DTO de presentación no fue comprobado para nombre de sucursal. | **C:** verificar DTO/controlador y catálogo permitido; después mostrar descripción desde carga acotada o usar el campo del API. | Posiblemente, solo si la API no expone ni permite resolver la descripción. |
| Consultas e historial | Listado, detalle y formularios | Médicos, sucursal, paciente, lotes y entidades clínicas se muestran como IDs en varias secciones. | Consultas e historial existen; falta confirmar qué nombres devuelve cada DTO y qué catálogos se autorizan para cada permiso. | **C:** matriz por campo y carga por lista, jamás HTTP por celda; reemplazar solo IDs que tengan fuente contractual eficiente. | Posiblemente |
| Inventario y lotes | Listados y formularios | Categoría/marca ya tienen catálogos; los lotes muestran `idMedicamento` sin un nombre contractual verificado en la lista. | Medicamentos, catálogo, lotes y entradas existen. | **B/C:** normalizar categoría/marca (**B**) y verificar si lote puede incluir o resolver medicamento con paginación acotada (**C**). | Solo si el DTO de lote no permite una resolución eficiente. |
| Ventas | Listado, nueva venta y detalle | Sucursal, usuario, medicamento y lote se exponen principalmente como IDs; la nueva venta solicita manualmente ID de sucursal. | Venta y catálogo de medicamentos existen; no se comprobó un catálogo autorizado de usuarios ni nombres en el DTO de venta. | **C:** comprobar DTO y catálogos; usar nombres disponibles y mantener IDs para creación. | Posiblemente |
| Citas | Lista/mock y ruta pendiente | Servicio sin integración real y ruta de funcionalidad pendiente. | No hay controlador/contrato integrado comprobado. | **D:** no implementar ni rediseñar hasta contar con contrato real y autorización de alcance. | Sí |
| Movimientos de inventario | Componente aislado | Métodos/rutas antiguos y sin entrada activa en `app.routes.ts`. | No hay contrato actual corroborado para el componente. | **D:** mantener fuera de la entrega; tratar en una tarea de integración separada. | Sí |
| Reportes | Rutas pendientes | Sin componentes funcionales ni contrato de datos auditado. | No comprobado. | **D:** conservar mensaje de pendiente. | Sí |

## Fotografías: contratos confirmados

| Recurso | Operaciones verificadas | Regla UI de la entrega |
|---|---|---|
| Paciente | `POST`, `GET`, `DELETE /api/pacientes/{id}/foto`; `POST` recibe `multipart/form-data` con clave `foto`. | Selección local y preview efímero; el archivo se envía a la API tras disponer del ID. La lectura pasa por el endpoint protegido. |
| Medicamento | `POST`, `GET`, `DELETE /api/medicamentos/{id}/foto`; misma clave multipart `foto`. | Misma experiencia y mismas restricciones. |
| Empleados, usuarios, habitaciones y ventas | No se halló endpoint de fotografía aplicable en esta auditoría. | No añadir carga de foto ni campos ficticios. |

La UI debe mostrar el error `ProblemDetails` que devuelva la API, revocar el preview cuando finalice la operación y no asumir que una URL guardada es una imagen pública.

## Estándar visual propuesto

Se aplicará de forma incremental sobre Bootstrap 5 y Bootstrap Icons, sin introducir dependencias ni reconstruir pantallas funcionales.

| Elemento | Convención propuesta |
|---|---|
| Contenedor | `page-shell` con ancho fluido, espaciado responsive y encabezado de página. |
| Cabecera | Título `h1/h2`, texto de contexto y acciones primarias alineadas; una acción principal por pantalla. |
| Tarjetas | `ui-card` con borde suave, cabecera opcional y separación uniforme. |
| Formularios | Etiqueta asociada, ayuda/validación junto al control, grupos responsive y pie fijo con Guardar/Cancelar. |
| Tablas | Contenedor responsive, encabezado legible, columna de acciones compacta, `caption` o etiqueta accesible y vacío explícito. |
| Filtros | Tarjeta de filtros con Buscar/Limpiar; reinicio de página al cambiar filtros y paginación basada en `totalPages`. |
| Acciones | Agregar `bi-plus-lg`; editar `bi-pencil`; detalle `bi-eye`; eliminar `bi-trash`; guardar `bi-check-lg`; cancelar `bi-x-lg`. Todas con etiqueta visible o `aria-label`/`title`. |
| Confirmaciones | Modal de confirmación reutilizable; texto que identifique la entidad y posible consecuencia. |
| Estados | Cargando con `role=status`; vacío con siguiente acción; error con `role=alert`, detalle seguro y reintento cuando aplique. |
| Estado de dominio | Badge con texto además de color: Activo/Inactivo, stock, habitación y prioridad. |
| Fotografías | Avatar/miniatura con fallback, preview local no persistente, selección/reemplazo/eliminación y estado de carga. |
| Accesibilidad | Foco visible, navegación de teclado, contraste Bootstrap, encabezados semánticos y reducción de movimiento respetada. |

## Orden de entregas independientes

1. **WEB-UX-01B:** base visual compartida y acciones/confirmaciones accesibles; pruebas unitarias y `npm run verify`.
2. **WEB-UX-01C:** tablas, filtros, estados y paginación de pacientes, empleados, usuarios, roles, inventario y ventas; validar permisos de cada acción.
3. **WEB-UX-01D:** formularios con catálogos descriptivos, empezando por usuario–rol–empleado; conservar el ID en los `POST`/`PUT`.
4. **WEB-UX-01E:** fotografías de pacientes y medicamentos contra los endpoints confirmados; pruebas HTTP del multipart, lectura y eliminación.
5. **WEB-UX-01F:** resolver solo las filas C cuya fuente contractual quede confirmada; documentar las que requieran API.
6. **WEB-UX-01G:** `npm run verify`, suite completa de ChromeHeadless, revisión de accesibilidad manual, `git diff --check` y reporte final. E2E de escritura queda pendiente de un entorno descartable autorizado.

## Hallazgos que deben conservarse

- El sidebar y dashboard ya manejan navegación dinámica y estados de carga/error; son referencia visual, no candidatos a rediseño masivo.
- Las rutas de citas y reportes informan explícitamente que están pendientes; no deben redirigirse silenciosamente.
- Los cambios sin confirmar de usuarios ya sustituyen IDs por nombres en el listado con carga paginada y sin solicitudes por celda. Esta auditoría los conserva como trabajo existente.
- La sesión usa `localStorage` para JWT bajo el diseño actual; esta tarea no cambia el mecanismo de autenticación.
- La compilación o los mocks no sustituyen una prueba E2E contra una API y base de datos de prueba autorizadas.

## Resultado de WEB-UX-01A

La base visual y las mejoras de usuarios, catálogos y fotografías de pacientes/medicamentos son factibles sin cambios de backend. Habitaciones, historial, lotes y ventas requieren comprobación puntual para no traducir IDs con datos incompletos o solicitudes por fila. Citas, movimientos y reportes permanecen bloqueados por contrato/integración y quedan fuera de la implementación de esta serie.

## WEB-UX-01B — Sistema visual y piloto de acciones accesibles

### Componentes y estilos

- `WebClinica/src/styles.css` incorpora tokens de superficie, borde, texto, sombra y canvas, además de `page-shell`, `page-header`, `ui-card`, `ui-table`, `ui-table-wrap`, `ui-form`, `ui-actions`, estados de foco y soporte para `prefers-reduced-motion`.
- `WebClinica/src/app/shared/components/ui-state.component.ts` unifica carga, vacío y error con `role="status"` o `role="alert"` y reintento opcional.
- `WebClinica/src/app/shared/components/confirm-dialog.component.ts` proporciona diálogo `alertdialog`, descripción, consecuencia, foco inicial en Cancelar, Escape, cancelación, estado ocupado y prevención de doble confirmación.

### Convenciones aplicadas

La pantalla piloto usa Bootstrap Icons (`bi-plus-lg`, `bi-pencil`, `bi-trash`) con texto visible o `aria-label` y `title`. Las acciones conservan su tamaño Bootstrap, foco visible, estado deshabilitado y los IDs originales de los usuarios. No se migraron todavía las demás pantallas: se reservan para WEB-UX-01C.

### Pantalla piloto

`/admin/usuarios` usa los componentes compartidos para la cabecera, estados de carga/vacío/error, tabla responsive y confirmación de desactivación. La eliminación continúa condicionada por `PermisosService`, envía el `idUsuario` real, muestra el nombre del usuario en la confirmación y bloquea doble envío mientras la petición está activa. La resolución existente de rol y tipo de empleado, incluida su paginación acotada, permanece intacta.

### Pruebas y validación

- `npm run check:templates`: 33 plantillas analizadas, 0 problemas.
- `npm run build`: correcto; permanece el aviso CSS conocido de Bootstrap sobre `.form-floating>~label`.
- `npm test -- --watch=false --browsers=ChromeHeadless`: no completó porque el entorno no pudo iniciar ChromeHeadless; el bundle de pruebas sí se generó.
- `git diff --check`: correcto, con el aviso normal de conversión LF/CRLF de un archivo existente.
- `git diff --cached --check`: correcto.

### Pendientes WEB-UX-01C

Migrar progresivamente tablas, encabezados, iconos y confirmaciones de pacientes, empleados, roles, historial, habitaciones, inventario y ventas; reutilizar `UiStateComponent` donde corresponda; ampliar las pruebas de permisos y CRUD por módulo. No se modificaron contratos REST, backend, Azure SQL, permisos, JWT, dependencias, Skills, commits ni push en WEB-UX-01B.

## WEB-UX-01C — Estandarización progresiva

### Estado por etapa

| Etapa | Estado | Evidencia |
|---|---|---|
| C0 — Línea base | Aprobada | 33 plantillas, build correcto y 295/295 pruebas ChromeHeadless. |
| C1 — Pacientes y empleados | Aprobada | 33 plantillas, build correcto y 309/309 pruebas ChromeHeadless. |
| C2 — Roles y permisos | Aprobada | Tablas normalizadas; build correcto y 313/313 pruebas ChromeHeadless. |
| C3 — Consultas e historial | Aprobada | Correlativos paginados; build correcto y 315/315 pruebas ChromeHeadless. |
| C4 — Habitaciones | Excluida con validación | Es un tablero de tarjetas, sin tablas; build correcto y 315/315 pruebas ChromeHeadless. |
| C5 — Inventario, medicamentos y lotes | Aprobada | Código operativo conservado y lotes correlativos; build correcto y 317/317 pruebas ChromeHeadless. |
| C6 — Ventas | Aprobada | Listado, detalle y carrito normalizados; build correcto y 320/320 pruebas ChromeHeadless. |
| C7 — Integración final | Aprobada | 33 plantillas, build correcto, 320/320 pruebas y controles Git correctos. |

### C0 — Recuperación de la línea base

Chrome y Edge estaban instalados, pero el sandbox impedía que el navegador se conectara a Karma. No fue necesario instalar dependencias ni modificar `angular.json`, `package.json` o Karma. Al ejecutar ChromeHeadless fuera del sandbox aparecieron dos regresiones de WEB-UX-01B: el escenario de eliminación de usuarios no activaba el permiso Eliminar y una aserción esperaba la capitalización previa de “Nuevo Usuario”. Se corrigieron únicamente esas dos inconsistencias y se eliminó la configuración local temporal usada durante el diagnóstico.

Resultado final C0:

- `npm run verify`: correcto.
- Plantillas: 33/33.
- Build de producción: correcto.
- ChromeHeadless: 295/295 pruebas aprobadas.
- Advertencia conocida: selector Bootstrap `.form-floating>~label`.
- `git diff --check` y `git diff --cached --check`: correctos.

### C1 — Pacientes y empleados

Las pantallas de listado reutilizan `page-shell`, `page-header`, `ui-card`, `ui-table`, `ui-table-wrap`, `ui-actions`, `UiStateComponent` y `ConfirmDialogComponent`.

Pacientes:

- Encabezado, filtros etiquetados, tabla responsive, paginación con `totalPages` y estados de carga, vacío y error.
- Acciones Nuevo, Historial, Editar y Desactivar con Bootstrap Icons, `aria-label`, `title` y permisos dinámicos.
- La confirmación identifica al paciente, conserva su historial y envía el `idPaciente` real al contrato DELETE existente.
- No se modificó el formulario ni la fotografía.

Empleados:

- Encabezado, filtros etiquetados, tabla responsive, paginación con `totalPages` y estados reutilizables.
- Acciones Nuevo, Editar y Eliminar con Bootstrap Icons, etiquetas accesibles y permisos dinámicos.
- La confirmación identifica al empleado, mantiene la semántica de eliminación definida por la API y envía el `idEmpleado` real.
- No se modificaron catálogos, formulario ni servicio.

Pruebas agregadas para ambos módulos: listado, rutas de edición/historial con ID real, permisos, confirmación cancelada y aceptada, eliminación por ID real, carga, vacío, error y límites de paginación.

Resultado final C1:

- `npm run verify`: correcto.
- Plantillas: 33/33.
- Build de producción: correcto.
- ChromeHeadless: 309/309 pruebas aprobadas.
- `git diff --check` y `git diff --cached --check`: correctos.
- Backend, Azure SQL, migraciones, servicios REST, DTO, JWT, permisos y dependencias: sin modificaciones.

## WEB-UX-01C2 — Grids, márgenes y correlativos visuales

### A. Diagnóstico de tablas

Se localizaron trece tablas en el frontend. Doce pertenecen a flujos funcionales activos: Pacientes, Empleados, Usuarios, Roles, matriz de Permisos, Consultas, Historial, Medicamentos, Lotes, listado de Ventas, detalle de Venta y carrito de Nueva Venta. Todas reutilizan ahora `ui-table` y `ui-table-wrap`.

La tabla restante está en el componente mock de Citas. Se excluyó porque `/citas` continúa señalada como funcionalidad pendiente y no existe un contrato integrado que permita considerarla un grid funcional. Habitaciones y asignaciones también se excluyeron del correlativo porque su presentación es un tablero de tarjetas y modales, no una tabla.

Los identificadores se clasificaron así:

- Claves principales visibles sustituidas por `No.`: paciente, empleado, usuario, rol, consulta, lote y venta.
- Relaciones conservadas para WEB-UX-01D/01F: sucursal, paciente, médico, clínica, usuario, medicamento y lote cuando identifican otra entidad.
- Datos operativos conservados: código de medicamento, número de lote, filtro por ID de venta e ID de venta en su pantalla de detalle.
- Tablas sin clave primaria visible: matriz de Permisos, catálogo de Medicamentos y carrito; solo recibieron espaciado y alineación.

### B. Estándar de márgenes y columnas

`WebClinica/src/styles.css` establece un padding uniforme de `.75rem 1rem` para encabezados y celdas. Las clases `ui-col-index`, `ui-col-date`, `ui-col-number` y `ui-col-actions` alinean correlativos, fechas, cantidades y acciones sin anchos fijos. Las acciones aplicadas a una celda conservan su comportamiento de tabla, alineación final, separación homogénea y tamaño Bootstrap.

El desplazamiento horizontal queda contenido en `ui-table-wrap`, sin introducir overflow global. Los botones modificados conservan texto visible o incorporan `aria-label` y `title`. Los encabezados `No.` usan la misma convención en todos los listados actualizados.

### C. Implementación de correlativos

Se añadió la utilidad pura `WebClinica/src/app/shared/utils/correlativo.ts`:

- `correlativoPaginado(index, pagina, tamanoPagina)` aplica `(pagina - 1) * tamanoPagina + index + 1`.
- `correlativoLista(index)` aplica `index + 1` en listas completas.

La utilidad no modifica DTO, modelos persistentes ni respuestas HTTP. Las expresiones `track` continúan usando la clave primaria real. Los filtros y cambios de página recalculan el número según el orden visible y el tamaño de página efectivo.

### D. Cambios por módulo

| Grupo | Módulos | Resultado |
|---|---|---|
| 1 | Pacientes, Empleados, Usuarios | `No.` paginado, tabla responsive y acciones alineadas. `idSucursal` de Empleados se conservó como relación. |
| 2 | Roles, Permisos | Roles usa correlativo paginado; la matriz, que no mostraba `idPermiso`, solo recibió el estándar visual y acciones accesibles. |
| 3 | Consultas, Historial | `idConsulta` se reemplazó visualmente por correlativo. Se conservaron IDs relacionados y se corrigió la correspondencia de encabezados/celdas del historial. |
| 4 | Habitaciones, asignaciones | Sin cambios: tablero de tarjetas sin tabla. Los IDs reales continúan en asignación, egreso y actualización. |
| 5 | Medicamentos, Lotes, Inventario | Medicamentos conserva el código operativo; Lotes usa correlativo paginado. Precio, stock, existencia y fechas tienen alineación común. |
| 6 | Ventas, detalle, carrito | Ventas usa correlativo paginado; el detalle usa correlativo de lista; el carrito conserva su lista sin agregar una clave artificial. |

### E. Pruebas por grupo

| Grupo | Plantillas/build | ChromeHeadless | Git checks |
|---|---|---:|---|
| 1 | Correcto | 312/312 | Correctos |
| 2 | Correcto | 313/313 | Correctos |
| 3 | Correcto | 315/315 | Correctos |
| 4 | Correcto, sin cambios de código | 315/315 | Correctos |
| 5 | Correcto | 317/317 | Correctos |
| 6 / regresión final | 33/33 plantillas y build correcto | 320/320 | Correctos |

Las pruebas cubren páginas 1, 2 y 3, tamaños 5, 10 y 20, listas completas, IDs SQL no consecutivos, estados vacíos existentes, filtros y reinicio de página, rutas con IDs reales, permisos dinámicos, entradas de lote, detalle/historial y payload de creación de venta. La prueba focalizada final de Ventas aprobó 3/3 antes de la regresión completa.

Permanece únicamente la advertencia conocida del optimizador CSS de Bootstrap para `.form-floating>~label`.

### F. Compatibilidad CRUD

Editar, eliminar, consultar historial, abrir detalle, gestionar permisos, registrar entradas de inventario y crear ventas continúan usando los IDs originales. Ninguna operación recibe el correlativo visual. Tampoco se cambiaron servicios REST, DTO, contratos HTTP, permisos dinámicos, JWT ni reglas de sesión.

### G. Responsive y accesibilidad

Las doce tablas funcionales usan desplazamiento horizontal controlado, padding común y columnas semánticas. Las acciones nuevas o ajustadas incluyen etiquetas accesibles y títulos; la columna de acciones mantiene alineación estable aun cuando cambie el texto de otras celdas. Se conserva el foco visible y `prefers-reduced-motion` de la base visual.

### H. Estado Git y límites

La rama continúa en `main`, alineada con `origin/main`, con cambios locales sin commit ni push. `git diff --check` y `git diff --cached --check` finalizan correctamente; los avisos LF/CRLF son informativos. No se modificaron API-Clinica, Azure SQL, migraciones, dependencias ni Skills. No se ejecutaron escrituras contra una base de datos.

## WEB-UX-01D — Selectores descriptivos y formularios (entrega parcial D0–D1)

### D0 — Línea base y matriz de viabilidad

Antes de implementar D1 se confirmó la línea base solicitada: `npm run verify` aprobó las 33 plantillas y el build de producción, y ChromeHeadless aprobó 320/320 pruebas. Se revisaron los formularios funcionales, sus servicios frontend y los controladores/DTO del backend en modo lectura.

| Formulario | Campo actual | Entidad relacionada | Endpoint GET | Permiso | Tipo de control | Viabilidad |
|---|---|---|---|---|---|---|
| Usuario alta/edición | `idRol` numérico | Rol | `GET /api/roles` y `/api/roles/{id}` | `Roles/Consultar` | Select nativo descriptivo, catálogo pequeño paginado | **B**, implementado en D1 |
| Usuario alta/edición | `idEmpleado` numérico opcional | Empleado | `GET /api/empleados?nombre&activo&page&pageSize` y `/api/empleados/{id}` | `Empleados/Consultar` | Búsqueda remota con debounce, página de 20 y detalle de selección previa | **C**, implementado en D1 |
| Empleado alta/edición | `idSucursal` | Sucursal | `GET /api/sucursales` y `/api/sucursales/{id}` | `Sucursales/Consultar` | Select nativo descriptivo | **B**, implementado en D1.1 |
| Empleado alta/edición | `idEspecialidad` opcional | Especialidad | `GET /api/especialidades` y `/api/especialidades/{id}` | `Especialidades/Consultar` | Select nativo descriptivo | **B**, implementado en D1.1 |
| Empleado alta/edición | `idTurno` opcional | Turno | `GET /api/turnos` y `/api/turnos/{id}` | `Turnos/Consultar` | Select nativo con nombre y jornada | **B**, implementado en D1.1 |
| Paciente alta/edición | Sin claves foráneas editables | No aplica | No aplica | `Pacientes/Crear` o `Modificar` | Campos propios del paciente | **A**, no requiere selector relacional |
| Nueva consulta | `idPaciente` proviene de la ruta | Paciente | `GET /api/pacientes/{id}` | `Pacientes/Consultar` | Contexto de navegación; debe mostrarse descripción en D2 | **C**, pendiente D2 |
| Nueva consulta | `idMedico` nulo en UI | Empleado médico | La API resuelve al empleado médico autenticado; `GET /api/empleados` permite búsqueda | `Empleados/Consultar` para catálogo | Valor derivado del contexto autenticado | **A** para creación actual; no sustituir por selección sin revisar alcance en D2 |
| Nueva consulta | `idSucursal` | Sucursal | `GET /api/sucursales` | `Sucursales/Consultar` | Select nativo ya descriptivo | **B**, pendiente de estados visuales en D2 |
| Nueva consulta/filtros | `idClinica` opcional/filtro numérico | Clínica | `GET /api/clinicas` y `/api/clinicas/{id}` | `Clinicas/Consultar` | Select nativo si la ruta obtiene el permiso real | **B**, pendiente D2 |
| Filtros de consultas | `idPaciente` | Paciente | `GET /api/pacientes?nombre&activo&page&pageSize`, detalle por ID | `Pacientes/Consultar` | Búsqueda remota paginada | **C**, pendiente D2 |
| Filtros de consultas | `idMedico` | Empleado médico | `GET /api/empleados?nombre&tipoEmpleado=Medico&page&pageSize`, detalle por ID | `Empleados/Consultar` | Búsqueda remota paginada | **C**, pendiente D2 |
| Filtros de consultas | `idSucursal`, `idClinica` | Sucursal y clínica | Catálogos paginados respectivos | `Sucursales/Consultar`, `Clinicas/Consultar` | Selects nativos descriptivos | **B**, pendiente D2 |
| Detalle clínico | `idDiagnostico` de evolución | Diagnóstico de la consulta | Diagnósticos ya cargados por `idConsulta` | `Historial/Consultar` | Select contextual con descripción | **A**, ya descriptivo; conservar en D2 |
| Detalle clínico/consumo | `idConsulta`, `idPaciente`, `idLote`, `idTratamiento` | Contexto clínico y lote | Detalles y listas del flujo ya cargado | Permisos de `Consultas`, `Historial` y `ConsumoClinico` | Valores contextuales, sin reselección | **A**, no añadir selectores artificiales |
| Crear habitación | `idSucursal` numérico | Sucursal | `GET /api/sucursales` | `Sucursales/Consultar` | Select nativo descriptivo | **B**, pendiente D3 y permiso de ruta |
| Asignar habitación | `idPaciente` numérico | Paciente | Búsqueda paginada y detalle de pacientes | `Pacientes/Consultar` | Búsqueda remota paginada | **C**, pendiente D3 |
| Registrar egreso | Asignación y habitación recibidas por contexto | Asignación | Detalle ya cargado por el tablero | `AsignacionesHabitacion/Modificar` | Contextual | **A**, no requiere selector |
| Medicamento alta/edición | `idCategoria`, `idMarca` | Categoría y marca | `GET /api/categorias`, `GET /api/marcas`, ambos con detalle | `Categorias/Consultar`, `Marcas/Consultar` | Selects nativos ya descriptivos | **B**, pendiente de paginación/estados en D4 |
| Lote alta/edición | `idMedicamento` | Medicamento | `GET /api/medicamentos/catalogo?nombre&page&pageSize` y detalle | `Medicamentos/Consultar` | Búsqueda remota o detalle de selección previa | **C**, pendiente D4; la primera página no puede presentarse como catálogo completo |
| Ajuste/entrada de lote | `idSucursal` numérico | Sucursal | `GET /api/sucursales` | `Sucursales/Consultar` | Select nativo descriptivo | **B**, pendiente D4 y permiso de ruta |
| Nueva venta | `idSucursal` numérico | Sucursal | `GET /api/sucursales` | `Sucursales/Consultar` | Select nativo sujeto al alcance real del usuario | **B**, pendiente D5; la visibilidad no implica autorización de venta |
| Nueva venta | `idMedicamento` | Medicamento con existencia | `GET /api/medicamentos/catalogo?nombre&page&pageSize` | `Medicamentos/Consultar` | Búsqueda remota descriptiva ya existente | **C**, conservar y completar debounce/paginación en D5 |
| Roles y permisos | `idRol` proviene del rol seleccionado; módulo de matriz | Rol y permiso | Roles/permisos ya cargados por la pantalla | `Roles/Consultar`, `Permisos/Consultar` | Contextual; no se introduce ID manual | **A**, ya resuelto |
| Citas | IDs de paciente, médico y sucursal en componente mock | Relaciones de cita | No existe contrato de citas integrado y la ruta sigue pendiente | No hay autorización contractual integrada | No implementar | **D**, bloqueo de backend/integración |

Los datos documentales como DPI, NIT, teléfono y códigos operativos no se trataron como claves foráneas. Los formularios clínicos internos que reciben la consulta, diagnóstico, tratamiento o lote desde el contexto tampoco deben obligar al usuario a volver a seleccionar esas relaciones.

### D1 — Usuarios

- `ID Rol` se sustituyó por un select que muestra el nombre real y conserva `idRol`.
- Los roles se consultan con `RolesService.listarTodosRoles()`, en páginas de 100 y con límite explícito de cinco páginas. Si el catálogo supera ese límite se informa un error en vez de presentar datos parciales.
- Solo los roles activos son asignables. Un rol inactivo previamente guardado se identifica, pero el backend exige reemplazarlo antes de guardar.
- La regla de `AdministracionService` se refleja en la UI: sin `Roles/Modificar`, una creación queda limitada al rol del actor y una edición solo puede conservar el rol original.
- El empleado opcional usa búsqueda remota por nombre, debounce de 300 ms, cancelación de la petición reemplazada mediante `unsubscribe`, páginas de 20 y `activo=true` para nuevas selecciones.
- `GET /api/empleados/{id}` resuelve una relación previamente guardada que no aparece en la página actual. Un empleado inactivo existente se muestra como relación actual y conserva su ID porque la API valida existencia, no estado activo.
- Las rutas de alta y edición exigen ahora los permisos reales `Roles/Consultar` y `Empleados/Consultar`, además de los permisos de Usuarios ya existentes.
- Carga, vacío, error recuperable, falta de permiso y paginación reutilizan el estado visual compartido en modo compacto. Guardar y Cancelar siguen las convenciones `ui-form` y Bootstrap Icons.
- Los DTO no cambiaron: POST conserva `CrearUsuarioRequest` y PUT conserva `ActualizarUsuarioRequest`.

### D1.1 — Empleados

- Los selectores existentes de sucursal, especialidad y turno se conservaron y se integraron con `page-shell`, `page-header`, `ui-card` y `ui-form`.
- Etiquetas y controles quedaron asociados con `for`/`id`; los campos requeridos son identificables y las relaciones opcionales ofrecen una opción nula explícita.
- `CatalogosService` recorre todas las páginas de los catálogos pequeños hasta un máximo de cinco páginas. No descarga páginas ilimitadas ni presenta solo la primera como completa.
- Para nuevas asignaciones solo se ofrecen registros activos. En edición se conserva y etiqueta una sucursal, especialidad o turno inactivo que ya estuviera relacionado, acorde con la validación actual de `EmpleadoService`, que verifica existencia.
- Cada catálogo tiene carga, vacío, error con reintento y falta de autorización. Una relación ausente o inválida bloquea el envío sin sustituir silenciosamente el ID.
- POST y PUT mantienen exactamente `idSucursal`, `idEspecialidad` e `idTurno` en los DTO actuales.

### Seguridad, sesión y rendimiento

Los formularios consultan `PermisosService` antes de cada catálogo y antes de guardar. `AuthSessionService` vincula cada respuesta a la identidad formada por usuario y token. Un cambio de sesión o revocación invalida revisiones, cancela suscripciones activas, limpia catálogos y descarta respuestas tardías. Los catálogos no se persisten en almacenamiento. `ApiErrorService` conserva mensajes seguros de `ProblemDetails`.

Roles, sucursales, especialidades y turnos se tratan como catálogos pequeños con un máximo de 500 registros. Empleados se trata como catálogo grande: búsqueda remota, 20 resultados por página y detalle puntual de la selección previa. No se añadió ninguna biblioteca.

### Pruebas y regresión D1

La suite aumentó de 320 a 345 pruebas. Las 25 pruebas netas nuevas cubren:

- nombres descriptivos e IDs reales en POST/PUT;
- relación opcional, selección requerida e IDs inválidos;
- catálogos cargados, vacíos, con error y sin permiso;
- roles y relaciones inactivas;
- selección fuera de la página mediante detalle;
- paginación acotada y búsqueda con debounce;
- rutas con permisos de catálogo;
- cambio de sesión, revocación y respuesta tardía;
- `ProblemDetails` y prevención de doble envío.

Resultado de D1:

- `npm run verify`: correcto.
- Plantillas: 33/33 válidas.
- Build de producción: correcto.
- ChromeHeadless: **345/345** pruebas aprobadas.
- Permanece el aviso conocido del optimizador CSS de Bootstrap para `.form-floating>~label`.

### Límites y estado

D2–D5 permanecen sin implementar por instrucción expresa de validar primero D1. Citas continúa en grupo D hasta que exista un contrato integrado. No se modificaron `API-Clinica`, Azure SQL, migraciones, JWT, DTO REST, dependencias ni Skills; tampoco se realizaron escrituras E2E sobre datos reales. La rama continúa sin commit ni push.
