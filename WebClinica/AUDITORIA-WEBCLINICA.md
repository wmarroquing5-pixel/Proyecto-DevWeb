# Auditoría y consolidación de WebClinica

Fecha: 18 de octubre de 2026, America/Guatemala.

## A. Diagnóstico inicial

- Rama: `main`. HEAD: `224756e8a1952e88582a94cb05bdaf2b282618b2`.
- MERGE_HEAD: `4528b9e9cce0acbb9800e0a5f6a7f30db67f348f` (App Web con modulos).
- Fusión abierta, sin conflictos; 53 archivos preparados. Inicialmente no había cambios sin preparar ni archivos nuevos sin seguimiento.
- Se contrastaron `git diff --cached` y `git diff MERGE_HEAD -- WebClinica`: el segundo mostró 30 rutas con ajustes locales frente al código recibido. Se conservaron las correcciones de contratos y la unificación previa de catalogo.service.ts en catalogos.service.ts.
- Versiones resueltas: Angular 18.2.14, CLI 18.2.20, TypeScript 5.5.x, Bootstrap 5.3.8 y SignalR 10.0.11.
- Entorno de pruebas: Node 24.18.0, npm 11.16.0, Chrome Headless 155. Los resultados no amplían la matriz oficial de Angular 18; conviene fijar Node 22.x para reproducibilidad.
- No se hizo otra fusión, fetch, actualización mayor, commit ni push.

Se revisaron core (modelos, servicios, mocks, guard e interceptor), pages, layout, rutas, configuración Angular/TypeScript, entornos, scripts, lockfile, .gitignore, public e índice HTML. No existen shared, features ni src/assets. public/favicon.ico está referenciado en src/index.html.

Se construyó el grafo de imports relativos y cargas dinámicas desde src/main.ts y se contrastó con rutas, selectores, templates, estilos y pruebas. Tras la limpieza hay 52 archivos TypeScript alcanzables y ningún import relativo con destino inexistente. El código desconectado conservado está inventariado en C.

Defectos comprobados:

1. La lista observable de habitaciones nunca recibía la carga HTTP; los eventos no podían actualizarla.
2. El servicio SignalR vivía en el inyector raíz y la suscripción del tablero persistía al abandonar la pantalla.
3. El menú exigía roles que /auth/me no devuelve, aunque el backend ya lo filtra por permisos.
4. /admin/empleados y /medicamentos, usados por menú/formularios, no abrían sus listados existentes.
5. El interceptor enviaba el JWT a cualquier URL HTTP.
6. Ocho modelos duplicaban PagedResponse; dos duplicaban CatalogoMedicamentoResponse y dos CategoriaResponse.
7. El verificador omitía las plantillas inline de los componentes integrados.

## B. Elementos eliminados — categoría A

Se eliminaron 30 archivos. Las rutas siguientes son relativas a WebClinica. Antes se buscaron archivos, clases, selectores, imports, referencias de configuración, rutas y recursos; los únicos consumidores encontrados pertenecían a las implementaciones retiradas. Se verificaron también imports dinámicos.

| Archivo | Motivo y evidencia |
|---|---|
| `src/app/pages/empleados/empleados-list.component.ts` | Listado antiguo sin ruta; la ruta activa carga EmpleadosComponent y su formulario. |
| `src/app/pages/empleados/empleados-list.component.html` | Listado antiguo sin ruta; la ruta activa carga EmpleadosComponent y su formulario. |
| `src/app/pages/empleados/empleados-list.component.css` | Listado antiguo sin ruta; la ruta activa carga EmpleadosComponent y su formulario. |
| `src/app/pages/pacientes/pacientes-list.component.ts` | Listado antiguo sin ruta; la ruta activa carga PacientesComponent y su formulario. |
| `src/app/pages/pacientes/pacientes-list.component.html` | Listado antiguo sin ruta; la ruta activa carga PacientesComponent y su formulario. |
| `src/app/pages/pacientes/pacientes-list.component.css` | Listado antiguo sin ruta; la ruta activa carga PacientesComponent y su formulario. |
| `src/app/pages/pacientes/paciente-historial.component.ts` | Vista anterior sin ruta; reemplazada por las tres pantallas de pages/historial. |
| `src/app/pages/pacientes/paciente-historial.component.html` | Vista anterior sin ruta; reemplazada por las tres pantallas de pages/historial. |
| `src/app/pages/pacientes/paciente-historial.component.css` | Vista anterior sin ruta; reemplazada por las tres pantallas de pages/historial. |
| `src/app/pages/menu-dinamico/menu-dinamico.component.ts` | Demo de cambio de roles sin ruta ni selector consumidor; el menú real está en Sidebar. |
| `src/app/pages/menu-dinamico/menu-dinamico.component.html` | Demo de cambio de roles sin ruta ni selector consumidor; el menú real está en Sidebar. |
| `src/app/pages/menu-dinamico/menu-dinamico.component.css` | Demo de cambio de roles sin ruta ni selector consumidor; el menú real está en Sidebar. |
| `src/app/pages/inventario/inventario-list.component.html` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/pages/inventario/inventario-list.component.css` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/pages/habitaciones/habitaciones-board.component.html` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/pages/habitaciones/habitaciones-board.component.css` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/pages/ventas/ventas-list.component.html` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/pages/ventas/ventas-list.component.css` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/pages/ventas/ventas-nueva.component.html` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/pages/ventas/ventas-nueva.component.css` | Recurso externo sin referencia: el componente activo define template/styles inline. |
| `src/app/core/services/habitacion.service.ts` | Implementación anterior sin consumidores; HabitacionesService y el tablero actual usan el contrato real. |
| `src/app/core/services/habitacion-realtime.service.ts` | Implementación anterior sin consumidores; HabitacionesService y el tablero actual usan el contrato real. |
| `src/app/core/services/historial-clinico.service.ts` | Solo lo consumía el historial antiguo; reemplazado por HistorialService y pages/historial. |
| `src/app/core/mock/empleados.mock.ts` | Sin consumidores tras retirar las implementaciones antiguas; ningún servicio activo usa mocks. |
| `src/app/core/mock/habitaciones.mock.ts` | Sin consumidores tras retirar las implementaciones antiguas; ningún servicio activo usa mocks. |
| `src/app/core/mock/inventario.mock.ts` | Sin consumidores tras retirar las implementaciones antiguas; ningún servicio activo usa mocks. |
| `src/app/core/mock/login.mock.ts` | Sin consumidores tras retirar las implementaciones antiguas; ningún servicio activo usa mocks. |
| `src/app/core/mock/menu.mock.ts` | Sin consumidores tras retirar las implementaciones antiguas; ningún servicio activo usa mocks. |
| `src/app/core/mock/pacientes.mock.ts` | Sin consumidores tras retirar las implementaciones antiguas; ningún servicio activo usa mocks. |
| `src/app/core/mock/ventas.mock.ts` | Sin consumidores tras retirar las implementaciones antiguas; ningún servicio activo usa mocks. |

Verificación común de cada eliminación: ausencia de referencias funcionales externas al grupo retirado, compilación AOT correcta, 27 plantillas válidas, 14 pruebas aprobadas y cero imports relativos con destinos inexistentes. Los estilos activos no se cambiaron.

No se retiraron dependencias adicionales. La eliminación de `boostrap` ya estaba preparada al comenzar y se conservó; Bootstrap e iconos permanecen. La unificación previa de catalogo.service.ts tampoco se atribuye a esta auditoría.

## C. Elementos conservados

### Categoría C: funcionales o con contratos distintos

- Todas las pantallas alcanzables: login, dashboard, pacientes/formulario, empleados/formulario, usuarios/formulario, habitaciones/tres modales, historial/consultas, inventario/medicamentos/lotes y ventas/detalle.
- Servicios activos: AuthService, MenuService, CatalogosService, EmpleadosService, PacientesService, UsuariosService, HabitacionesService, HistorialService, InventarioService y VentasService.
- Guard, interceptor, contratos REST, rutas lazy y las cuatro pruebas originales.
- Bootstrap CSS e iconos están incluidos en angular.json. RxJS, SignalR, Zone.js y tslib tienen uso funcional o de plataforma.
- Angular compiler se utiliza en el verificador de plantillas; platform-browser-dynamic forma parte de la infraestructura de pruebas. No se retiraron paquetes Angular por una búsqueda superficial de imports: también tienen dependencias y peers.
- CrearEmpleadoRequest y ActualizarEmpleadoRequest mantienen nombres separados por su significado público aunque hoy compartan campos. Los catálogos simplificados de empleados son proyecciones con propiedades opcionales, no copias exactas del catálogo completo.
- app.component.css, styles.css, favicon y configuraciones TypeScript tienen referencias, aunque algunos tengan poco contenido.

### Categoría D: pendientes de integración

| Elementos | Dependencias pendientes |
|---|---|
| pages/citas/citas-list.component.{ts,html,css} | Sin ruta activa. Importa CitaService y CitaRealtimeService, cuyos archivos recibidos están vacíos. Faltan implementaciones y contraste REST. |
| core/models/cita.model.ts y core/mock/citas.mock.ts | Material del módulo planificado. El mock referencia tipos antiguos ausentes en los modelos actuales; debe adaptarse antes de integrarlo. |
| core/services/cita.service.ts y cita-realtime.service.ts | Se conservan como recibidos. No son servicios ejecutables; la API no registra /hubs/citas. |
| pages/inventario/inventario-movimientos.component.{ts,html,css} | Funcionalidad distinta sin ruta; usa tipos y métodos antiguos ausentes en InventarioService y enlaces /dashboard/inventario... inexistentes. Adaptar a endpoints existentes, sin crear tablas. |

La compilación AOT solo valida el grafo alcanzable. No certifica estos módulos desconectados. El parseo de sus HTML solo verifica sintaxis.

## D. Correcciones realizadas

1. **Modelos:** nuevo core/models/paged-response.model.ts; los ocho modelos originales reexportan el tipo manteniendo imports públicos. venta.model.ts reexporta CatalogoMedicamentoResponse de inventario y habitacion.model.ts reexporta CategoriaResponse de inventario. No cambian campos JSON.
2. **SignalR:** habitaciones.service.ts llena el BehaviorSubject con la respuesta HTTP y aplica eventos sin mutar el arreglo previo. Registra el manejador antes de iniciar, lo retira al destruirse, completa el observable y detiene la conexión. El tablero provee una instancia compartida con sus modales y termina su suscripción con takeUntilDestroyed.
3. **Menú:** menu.service.ts respeta los permisos filtrados por la API y solo filtra hidden recursivamente. Eliminados import y comentario mock obsoletos. La autorización sigue en la API.
4. **Rutas:** alias exactos /admin/empleados → /empleados y /medicamentos → /inventario. No se renombraron rutas funcionales ni habilitaron módulos incompletos.
5. **JWT:** auth.interceptor.ts limita Bearer a la API configurada y sus rutas, comprobando separadores para evitar prefijos como api-other o api.external.invalid.
6. **Plantillas:** scripts/check-templates.js extrae template de decoradores Component mediante el AST de TypeScript ya instalado. Analiza 22 plantillas inline y cinco externas con el parser Angular.
7. **Limpieza menor:** import sin uso en dashboard y comentario del entorno que prometía un modo mock no implementado por los servicios activos.
8. **Pruebas:** nuevos specs de habitaciones, interceptor, menú y guard; login.component.spec.ts amplía cobertura con éxito completo y rechazo 401 mediante HttpTestingController.

## E. Compatibilidad con el backend

Se leyeron controladores, DTO, Program.cs, HabitacionEstadoNotifier, MenuCompleto y MenuService. El backend permaneció intacto.

| Contrato real | Resultado |
|---|---|
| DTOs/PagedResponse.cs: Items, Page, PageSize, TotalCount, TotalPages | Conservado en camelCase y centralizado. Los listados mantienen res.totalCount. |
| FarmaciaDtos.cs: CatalogoMedicamentoResponse.ExistenciaTotal | Conservado como existenciaTotal en inventario y ventas. |
| HistorialMedicoDtos.cs: FechaHistorial | Conservado como fechaHistorial. |
| Empleados: Medico, Enfermera, Administrativo | Valores exactos conservados en filtros y formularios. |
| ActualizarLoteMedicamentoRequest.CantidadEsperada | Conserva la existencia original. Sucursal/justificación obligatorias al cambiar existencias o crear con stock. |
| POST /api/auth/login: username/password; respuesta accessToken/tokenType/expiresAtUtc | Compatible; probado en memoria. GET /auth/me entrega idUsuario, idRol, username e idEmpleado, sin roles. |
| GET /api/menu | API filtra por permisos. Se corrigió el segundo filtro incompatible del frontend. |
| /api/pacientes, /empleados, /usuarios | GET/POST/PUT/DELETE y DTO contrastados. Edición/eliminación usan idPaciente/idEmpleado/idUsuario reales. |
| /api/medicamentos, /medicamentos/catalogo, /lotes-medicamento, /{id}/entradas, /categorias, /marcas | Rutas, verbos y paginación presentes. Edición de lotes usa idLote y cantidadEsperada. |
| /api/habitaciones, /asignaciones-habitacion, /{id}/egreso | Rutas/verbos compatibles; egreso utiliza idAsignacion. |
| /api/consultas, /diagnosticos, /historial-medico, /tratamientos, /examenes, /contactos-emergencia | Rutas, filtros y verbos contrastados. Fechas como strings ISO/DateOnly según DTO. |
| /api/ventas y detalle por idVenta | Request con idSucursal/items y respuesta contrastados; catálogo compartido con inventario. |
| /hubs/habitaciones | Ruta correcta fuera de /api; evento ActualizarEstadoHabitacion con { habitacionId, estado }, confirmado en HabitacionEstadoNotifier. |

SignalR relee auth_token con accessTokenFactory, también al reconectar. No renueva JWT vencidos: no se implementó un refresh inexistente. La configuración de desarrollo mantiene HTTP localhost:5293; no hay entorno separado de producción ni fileReplacements. El despliegue requiere URLs HTTPS confiables de API/hub.

Límites e incompatibilidades pendientes:

- El menú puede emitir /citas, /consultas, /admin/roles y /reportes/* sin pantallas equivalentes activas; terminan en el comodín a dashboard. No se inventaron pantallas ni endpoints.
- Ventas declara idPaciente en el filtro pero no lo envía en HttpParams; la pantalla actual no lo ofrece.
- Catálogos/asignaciones solo consultan la primera página, habitualmente 100 registros. Egreso podría no encontrar una asignación posterior. Requiere paginación con el contrato existente.
- Formularios usan any y err.error.message aunque la API puede responder ProblemDetails. Pendiente revisar manejo de errores.
- SignalR no reintenta automáticamente un fallo de inicio ni recupera eventos perdidos durante desconexión. No se garantiza entrega completa.
- El guard conserva la comprobación local de sesión; no agrega expiración/limpieza global de 401. La API sigue validando JWT y permisos.
- Existen clases de iconos fa, pero solo se incluye Bootstrap Icons. No se cambió el diseño.

No se hicieron escrituras reales en Azure SQL ni llamadas directas a SQL/R2. Los POST de pruebas fueron interceptados en memoria. La API local no estaba disponible: la compatibilidad se contrastó estáticamente y mediante simulación, no de extremo a extremo.

## F. Seguridad y dependencias

`npm audit --omit=dev --json`: **8 paquetes vulnerables, 4 high y 4 moderate, 0 critical**, código 1 por hallazgos. Son ocho paquetes afectados, no ocho avisos únicos. Todos son dependencias directas y se resolvieron en 18.2.14.

| Paquete | Severidad | Origen/riesgo | Versión propuesta por npm |
|---|---|---|---|
| @angular/animations | moderate | Hereda core. | 20.1.8; salto mayor, no resuelve toda la familia. |
| @angular/common | high | XSRF, DoS de formatos y HttpTransferCache; hereda core. | 22.2.3, salto mayor. |
| @angular/compiler | high | Bypass de sanitización/XSS, i18n, SVG/namespaces. | 22.2.3, salto mayor. |
| @angular/core | high | XSS/i18n, SVG, host bindings e hidratación. | 22.2.3, salto mayor. |
| @angular/forms | moderate | Hereda common/core/platform-browser. | 22.2.3, salto mayor. |
| @angular/platform-browser | moderate | Hereda animations/common/core. | 22.2.3, salto mayor. |
| @angular/platform-browser-dynamic | moderate | Hereda common/compiler/core/platform-browser. | 22.2.3, salto mayor. |
| @angular/router | high | Hereda Angular y tiene DoS con parámetros matriciales SSR. | 22.2.3, salto mayor. |

Avisos directos de npm (rangos que incluyen la instalación actual):

| Aviso | Rango | Riesgo |
|---|---|---|
| [prjf-86w9-mfqv](https://github.com/angular/angular/security/advisories/GHSA-prjf-86w9-mfqv) | <=18.2.14 | XSS ICU. |
| [g93w-mfhg-p222](https://github.com/advisories/GHSA-g93w-mfhg-p222) | >=17.0.0-next.0 <=18.2.14 | XSS en atributos i18n. |
| [jrmj-c5cx-3cw6](https://github.com/advisories/GHSA-jrmj-c5cx-3cw6) | <=18.2.14 | Atributos script SVG. |
| [v4hv-rgfq-gp49](https://github.com/advisories/GHSA-v4hv-rgfq-gp49) | <=18.2.14 | XSS SVG/MathML. |
| [58c5-g7wp-6w37](https://github.com/angular/angular/security/advisories/GHSA-58c5-g7wp-6w37) | <19.2.16 | Fuga XSRF mediante URLs //. |
| [48r7-hpm6-gfxm](https://github.com/advisories/GHSA-48r7-hpm6-gfxm) | <=19.2.25 | OOM formatDate. |
| [39pv-4j6c-2g6v](https://github.com/advisories/GHSA-39pv-4j6c-2g6v) | <=19.2.25 | Colisiones HttpTransferCache. |
| [p3vc-36g9-x9gr](https://github.com/advisories/GHSA-p3vc-36g9-x9gr) | <=18.2.14 | DoS digitsInfo. |
| [q6f4-qqrg-jv6x](https://github.com/advisories/GHSA-q6f4-qqrg-jv6x) | <=18.2.14 | Caché de respuestas con credenciales. |
| [jhpw-976m-542j](https://github.com/advisories/GHSA-jhpw-976m-542j) | <=19.2.25 | Ambigüedad de claves de caché. |
| [p297-fm68-3q8c](https://github.com/advisories/GHSA-p297-fm68-3q8c) | <=19.2.25 | Fuga con withRequestsMadeViaParent. |
| [58w9-8g37-x9v5](https://github.com/advisories/GHSA-58w9-8g37-x9v5) | <=19.2.25 | Bypass en binding bidireccional. |
| [f3m7-gqxr-g87x](https://github.com/advisories/GHSA-f3m7-gqxr-g87x) | <=18.2.14 | Bypass de namespaces. |
| [jj27-h5hq-8x99](https://github.com/advisories/GHSA-jj27-h5hq-8x99) | <=19.2.25 | XSS en eventos i18n. |
| [hh8m-fm6v-7cvg](https://github.com/angular/angular/security/advisories/GHSA-hh8m-fm6v-7cvg) | <=19.2.25 | Bypass de host bindings. |
| [692r-grfm-v8x7](https://github.com/advisories/GHSA-692r-grfm-v8x7) | <=18.2.14 | Namespace de componentes dinámicos. |
| [rgjc-h3x7-9mwg](https://github.com/advisories/GHSA-rgjc-h3x7-9mwg) | <=19.2.25 | DOM/caché de hidratación. |
| [ff3f-86qr-9cv3](https://github.com/angular/angular/security/advisories/GHSA-ff3f-86qr-9cv3) | <=19.2.25 | DoS SSR por parámetros matriciales. |

Versiones corregidas verificadas en avisos oficiales: XSRF en 19.2.16/20.3.14/21.0.1; XSS ICU en 19.2.19/20.3.17/21.1.6/21.2.0; host bindings en 20.3.28/21.2.20/22.1.0; DoS SSR en 20.3.32/21.2.24/22.2.0. Corrigen cada aviso citado, no garantizan resolver los demás. Los avisos consultados no ofrecen parche para Angular 18.

Aplicabilidad y mitigación:

- SPA sin SSR, HttpTransferCache ni hidratación configurados. No se observaron i18n/ICU, bypassSecurityTrust, innerHTML ni directivas propias con host bindings peligrosos. Reduce aplicabilidad de ciertos avisos; no equivale a corregirlos.
- Las URLs HTTP activas provienen del entorno, no empiezan por //. La limitación del JWT al backend es una corrección propia distinta del parche XSRF de Angular.
- Mantener plantillas/traducciones controladas y evitar HTML, URLs y formatos numéricos/fechas no confiables. Evaluar CSP/Trusted Types con el hosting en otro trabajo.
- Planificar una migración autorizada a Angular soportado, alineando paquetes, CLI, TypeScript y Node y repitiendo pruebas/E2E. No se ejecutó npm audit fix ni --force.

**Vulnerabilidades de dependencias corregidas: ninguna. Pendientes: las ocho reportadas.** package.json y lockfile no se modificaron respecto del inicio de esta auditoría.

npm ci también reportó 67 vulnerabilidades del árbol completo (7 low, 16 moderate, 41 high, 3 critical), incluidas herramientas de desarrollo. No confundirlas con las ocho de producción. Hubo avisos de deprecación de transitivas como inflight, rimraf, glob, critters, tar y uuid; revisar junto con la actualización del build, sin overrides indiscriminados.

La búsqueda en src/public/configuración frontend no encontró cadenas SQL, SigningKey ni acceso directo a R2. No se imprimieron ni incorporaron secretos externos.

## G. Pruebas

| Comprobación | Resultado real |
|---|---|
| npm ci | Aprobado: 967 paquetes instalados; primer intento EPERM en sandbox, repetido con permiso fuera de él. |
| npm run verify | Aprobado: plantillas y compilación de producción. |
| check:templates, mediante verify | 27 plantillas, 0 problemas: 22 inline y 5 externas. Antes eran 13 externas, ocho obsoletas. |
| npm run build independiente | Aprobado; bundle inicial aproximado 676.11 kB. |
| npm test -- --watch=false --browsers=ChromeHeadless | 14 aprobadas: 4 originales y 10 nuevas. Chrome requirió ejecución fuera del sandbox. Un error de tipado de un spec nuevo se corrigió antes de la ejecución final. |
| npm audit --omit=dev --json | Ejecutado; código 1 por ocho vulnerabilidades. Primer intento sin red, repetido con permiso. |
| dotnet restore API-Clinica/API-Clinica.csproj | Aprobado. |
| dotnet build API-Clinica/API-Clinica.csproj --no-restore | Aprobado: 0 errores, 0 advertencias. Sin arrancar API ni migrar. |
| git diff --check y git diff --cached --check | Sin errores de espacios. |
| Imports relativos | Cero destinos inexistentes. No valida tipos del código desconectado. |
| E2E contra API local | Pendiente: GET a localhost:5293/health/live, /health/ready y /api/auth/me rechazados por falta de servidor. Reintentados fuera del sandbox. |
| Azure SQL | Sin escrituras/migraciones/cambios de esquema ejecutados. No se hizo auditoría remota del esquema. |

Cobertura nueva: login username/accessToken/me/menu y rechazo 401; navegación protegida con/sin sesión; menú autorizado sin roles; aislamiento JWT frente a URLs externas; evento real de habitaciones después de carga HTTP, lista vacía, token actualizado y cierre de conexión/suscripción al destruir el tablero.

CRUD de usuarios, empleados, pacientes, medicamentos, lotes, consultas y ventas: contrastados por código y compilación. Sus operaciones reales no fueron ejecutadas y no se declaran aprobadas de extremo a extremo.

Advertencia conservada: `.form-floating>label -> Did not expect successive traversals`, durante optimización de Bootstrap CSS. El CSS contiene floating labels con pseudoclases/combinadores; el build finaliza correctamente. No se editaron node_modules ni estilos activos para silenciarla. Pendiente comprobar floating labels en navegador y revisar el optimizador con una actualización compatible.

## H. Pendientes

1. Arrancar API con configuración externa y ejecutar E2E de lectura con sesión autorizada; probar reconexión real y expiración JWT.
2. Autorizar/planificar actualización mayor Angular y herramientas para resolver seguridad.
3. Integrar citas con contratos reales; no existe hub de citas registrado.
4. Adaptar inventario-movimientos, sin reutilizar su sugerencia antigua de crear tablas.
5. Resolver rutas del menú sin pantallas, paginación de catálogos/asignaciones, ProblemDetails y límites de autenticación/reconexión detallados en E.
6. Definir entorno HTTPS de producción e iconografía; comprobar floating labels.
7. Revisar manualmente la fusión antes de decidir su cierre.

## I. Estado final Git

- Rama final: `main`; fusión abierta con el mismo MERGE_HEAD y sin entradas en conflicto.
- HEAD sin cambios: `224756e8a1952e88582a94cb05bdaf2b282618b2`. No se creó commit ni se realizó push.
- 90 rutas preparadas respecto de HEAD: 31 modificadas, 29 añadidas y 30 eliminadas. Incluyen la integración previa y esta auditoría; no son 90 cambios nuevos de limpieza.
- Directorio de trabajo sin diferencias respecto del índice y sin archivos nuevos sin seguimiento.
- Backend sin diferencias respecto de HEAD. No se prepararon node_modules, dist, cachés, secretos ni artefactos de compilación.
- Se preservó la integración funcional y solo se añadieron al índice los cambios revisados de WebClinica.
- `git diff --check` y `git diff --cached --check` se verifican tras anexar este inventario.

Inventario completo del índice (A = añadido, M = modificado, D = eliminado):

```text
M	WebClinica/.gitignore
A	WebClinica/AUDITORIA-WEBCLINICA.md
M	WebClinica/package-lock.json
M	WebClinica/package.json
M	WebClinica/scripts/check-templates.js
M	WebClinica/src/app/app.component.spec.ts
M	WebClinica/src/app/app.routes.ts
A	WebClinica/src/app/core/guards/auth.guard.spec.ts
A	WebClinica/src/app/core/interceptors/auth.interceptor.spec.ts
M	WebClinica/src/app/core/interceptors/auth.interceptor.ts
D	WebClinica/src/app/core/mock/empleados.mock.ts
D	WebClinica/src/app/core/mock/habitaciones.mock.ts
D	WebClinica/src/app/core/mock/inventario.mock.ts
D	WebClinica/src/app/core/mock/login.mock.ts
D	WebClinica/src/app/core/mock/menu.mock.ts
D	WebClinica/src/app/core/mock/pacientes.mock.ts
D	WebClinica/src/app/core/mock/ventas.mock.ts
A	WebClinica/src/app/core/models/catalogos.model.ts
M	WebClinica/src/app/core/models/empleado.model.ts
M	WebClinica/src/app/core/models/habitacion.model.ts
A	WebClinica/src/app/core/models/historial.model.ts
M	WebClinica/src/app/core/models/inventario.model.ts
M	WebClinica/src/app/core/models/paciente.model.ts
A	WebClinica/src/app/core/models/paged-response.model.ts
M	WebClinica/src/app/core/models/user.model.ts
A	WebClinica/src/app/core/models/usuario.model.ts
M	WebClinica/src/app/core/models/venta.model.ts
M	WebClinica/src/app/core/services/auth.service.ts
A	WebClinica/src/app/core/services/catalogos.service.ts
M	WebClinica/src/app/core/services/cita-realtime.service.ts
M	WebClinica/src/app/core/services/cita.service.ts
M	WebClinica/src/app/core/services/empleado.service.ts
D	WebClinica/src/app/core/services/habitacion-realtime.service.ts
D	WebClinica/src/app/core/services/habitacion.service.ts
A	WebClinica/src/app/core/services/habitaciones.service.spec.ts
A	WebClinica/src/app/core/services/habitaciones.service.ts
D	WebClinica/src/app/core/services/historial-clinico.service.ts
A	WebClinica/src/app/core/services/historial.service.ts
M	WebClinica/src/app/core/services/inventario.service.ts
A	WebClinica/src/app/core/services/menu.service.spec.ts
M	WebClinica/src/app/core/services/menu.service.ts
M	WebClinica/src/app/core/services/paciente.service.ts
A	WebClinica/src/app/core/services/usuarios.service.ts
M	WebClinica/src/app/core/services/venta.service.ts
M	WebClinica/src/app/layout/main/main-layout.component.ts
M	WebClinica/src/app/layout/sidebar/sidebar.component.html
M	WebClinica/src/app/pages/dashboard/dashboard.component.ts
A	WebClinica/src/app/pages/empleados/empleado-form.component.ts
D	WebClinica/src/app/pages/empleados/empleados-list.component.css
D	WebClinica/src/app/pages/empleados/empleados-list.component.html
D	WebClinica/src/app/pages/empleados/empleados-list.component.ts
A	WebClinica/src/app/pages/empleados/empleados.component.ts
A	WebClinica/src/app/pages/habitaciones/asignar-paciente-modal.component.ts
A	WebClinica/src/app/pages/habitaciones/crear-habitacion-modal.component.ts
D	WebClinica/src/app/pages/habitaciones/habitaciones-board.component.css
D	WebClinica/src/app/pages/habitaciones/habitaciones-board.component.html
M	WebClinica/src/app/pages/habitaciones/habitaciones-board.component.ts
A	WebClinica/src/app/pages/habitaciones/registrar-egreso-modal.component.ts
A	WebClinica/src/app/pages/historial/consulta-detalle.component.ts
A	WebClinica/src/app/pages/historial/consulta-nueva.component.ts
A	WebClinica/src/app/pages/historial/historial-paciente.component.ts
D	WebClinica/src/app/pages/inventario/inventario-list.component.css
D	WebClinica/src/app/pages/inventario/inventario-list.component.html
M	WebClinica/src/app/pages/inventario/inventario-list.component.ts
A	WebClinica/src/app/pages/inventario/lote-form.component.ts
A	WebClinica/src/app/pages/inventario/lotes-medicamento.component.ts
A	WebClinica/src/app/pages/inventario/medicamento-form.component.ts
M	WebClinica/src/app/pages/login/login.component.spec.ts
M	WebClinica/src/app/pages/login/login.component.ts
D	WebClinica/src/app/pages/menu-dinamico/menu-dinamico.component.css
D	WebClinica/src/app/pages/menu-dinamico/menu-dinamico.component.html
D	WebClinica/src/app/pages/menu-dinamico/menu-dinamico.component.ts
A	WebClinica/src/app/pages/pacientes/paciente-form.component.ts
D	WebClinica/src/app/pages/pacientes/paciente-historial.component.css
D	WebClinica/src/app/pages/pacientes/paciente-historial.component.html
D	WebClinica/src/app/pages/pacientes/paciente-historial.component.ts
D	WebClinica/src/app/pages/pacientes/pacientes-list.component.css
D	WebClinica/src/app/pages/pacientes/pacientes-list.component.html
D	WebClinica/src/app/pages/pacientes/pacientes-list.component.ts
A	WebClinica/src/app/pages/pacientes/pacientes.component.ts
A	WebClinica/src/app/pages/usuarios/usuario-form.component.ts
A	WebClinica/src/app/pages/usuarios/usuarios.component.ts
A	WebClinica/src/app/pages/ventas/venta-detalle.component.ts
D	WebClinica/src/app/pages/ventas/ventas-list.component.css
D	WebClinica/src/app/pages/ventas/ventas-list.component.html
M	WebClinica/src/app/pages/ventas/ventas-list.component.ts
D	WebClinica/src/app/pages/ventas/ventas-nueva.component.css
D	WebClinica/src/app/pages/ventas/ventas-nueva.component.html
M	WebClinica/src/app/pages/ventas/ventas-nueva.component.ts
M	WebClinica/src/environments/environment.ts
```
