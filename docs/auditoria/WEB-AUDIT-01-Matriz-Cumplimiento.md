# WEB-AUDIT-01 — Matriz provisional de cumplimiento académico

## Advertencia de fuente

No se encontró `Proyecto_Final_Desarrollo_Web_2026(1).pdf` en el repositorio ni en `C:\Users\DESARROLLO\Documents\ChatGPT`. Por ello, esta matriz evalúa **los 42 enunciados AUD-REQ proporcionados en el encargo**, pero no puede conservar todavía la página, sección, numeración ni redacción exacta del PDF.

Este documento no es un dictamen académico definitivo. Se debe incorporar el PDF y correlacionar cada fila antes de presentar cumplimiento ante la universidad. Los estados siguientes reflejan únicamente la evidencia técnica disponible al 18 de octubre de 2026.

## Resumen provisional

| Estado permitido | Cantidad |
|---|---:|
| Cumple | 1 |
| Parcial | 27 |
| No cumple | 1 |
| No verificable | 6 |
| No aplica al frontend | 7 |
| **Total** | **42** |

“Parcial” se usa cuando existe código, pero falta prueba integrada, despliegue o una parte funcional. Una compilación correcta no eleva por sí sola un módulo a “Cumple”.

## Matriz

| ID | Requisito del encargo; referencia PDF pendiente | Responsable | Evidencia | Estado | Acción pendiente |
|---|---|---|---|---|---|
| AUD-REQ-01 | Uso de Azure SQL Database | Backend/Infraestructura | `API-Clinica/Program.cs` configura SQL Server; no se inspeccionó Azure ni se escribieron datos | **No aplica al frontend** | Evaluar conexión/despliegue backend por separado y correlacionar PDF |
| AUD-REQ-02 | Modelo Entidad-Relación visual | Documentación | No existe PDF ni diagrama ER localizado en el alcance frontend | **No aplica al frontend** | Aportar diagrama y PDF para validar formato/alcance |
| AUD-REQ-03 | Backend ASP.NET Core .NET 10 con Entity Framework Core | Backend | `API-Clinica.csproj`, `Program.cs`, `ClinicaDbContext`; backend solo fue referencia | **No aplica al frontend** | Usar auditoría backend como evidencia separada |
| AUD-REQ-04 | Frontend web que consuma la API REST | Frontend/Integración | Servicios `HttpClient` tipados; API local no disponible para E2E | **Parcial** | Ejecutar flujos reales con API y datos descartables |
| AUD-REQ-05 | Arquitectura Frontend → API → EF Core → Azure SQL | Integración | El código respeta el flujo; no hay acceso SQL en Angular | **Parcial** | Demostrar el flujo desplegado de extremo a extremo |
| AUD-REQ-06 | Control de versiones Git y seguimiento | Documentación | `main` sincronizada con `origin/main`; historial y merge commit `bba962b` | **Cumple** | Conservar trazabilidad de futuros cambios |
| AUD-REQ-07 | Publicación del frontend y API en Azure | Infraestructura | No hay URL, pipeline ni evidencia de despliegue accesible | **No verificable** | Aportar recursos Azure, URLs HTTPS y prueba pública |
| AUD-REQ-08 | Dockerfile funcional y demostración de API en contenedor | Backend/Infraestructura | No se localizó Dockerfile; evaluación fuera del frontend | **No aplica al frontend** | Auditar contenedor API y aportar demostración |
| AUD-REQ-09 | Inicio de sesión mediante JWT | Frontend/Backend | Login, JWT, guard e interceptor; spec de éxito/401 | **Parcial** | Probar contra API real y gestionar expiración |
| AUD-REQ-10 | Credenciales validadas por backend | Integración | `POST /api/auth/login`; prueba HTTP simulada | **Parcial** | E2E con credenciales de prueba autorizadas |
| AUD-REQ-11 | Recursos protegidos mediante tokens | Integración | Bearer restringido a API; guard global; API exige autorización | **Parcial** | Probar 401/403 y expiración; añadir manejo global |
| AUD-REQ-12 | Administración de usuarios y roles | Frontend/Backend | CRUD de usuarios; API tiene roles, pero Angular no ofrece administración de roles | **Parcial** | Implementar UI/contrato de roles si el PDF lo exige |
| AUD-REQ-13 | Permisos dinámicos por módulo y operación | Integración | API usa `PermisoRequerido`; Angular no consume permisos operativos | **Parcial** | Condicionar rutas/acciones usando `/api/auth/permisos` |
| AUD-REQ-14 | Menú dinámico según permisos | Integración | `/api/menu` filtra por permiso consultable; spec de menú | **Parcial** | Corregir rutas sin pantalla y probar perfiles reales |
| AUD-REQ-15 | Actualización del menú ante cambios de permisos | Integración | No hay invalidación/evento durante sesión | **No cumple** | Definir recarga/versionado y probar revocación/concesión |
| AUD-REQ-16 | Pacientes y datos generales | Frontend/Integración | Lista/formulario y CRUD REST; sin pruebas del módulo ni E2E | **Parcial** | Añadir specs y prueba integrada |
| AUD-REQ-17 | Inventario de medicamentos | Frontend/Integración | Lista, formulario, filtros y servicio; movimientos antiguos desconectados | **Parcial** | Probar CRUD y definir alcance de movimientos |
| AUD-REQ-18 | Registro y administración de lotes | Frontend/Integración | Lista/formulario/entrada, `cantidadEsperada` compatible | **Parcial** | Probar altas, ajustes, concurrencia y errores |
| AUD-REQ-19 | Empleados, especialidades y roles | Frontend/Integración | Empleados y especialidades/turnos; roles no forman parte del flujo de empleado | **Parcial** | Aclarar requisito con PDF y completar asociación requerida |
| AUD-REQ-20 | Habitaciones y estados | Frontend/Integración | Tablero y CRUD/asignación/egreso; pruebas aisladas | **Parcial** | E2E con transiciones reales |
| AUD-REQ-21 | Actualización de habitaciones mediante SignalR | Integración | Ruta/evento/JWT/cleanup coherentes; spec unitario | **Parcial** | Probar dos clientes, desconexión y reconexión real |
| AUD-REQ-22 | Asignación de pacientes a habitaciones | Frontend/Integración | Modal y endpoint `asignaciones-habitacion` | **Parcial** | Probar permisos, ocupación y errores concurrentes |
| AUD-REQ-23 | Fechas de ingreso y egreso | Integración | DTO y endpoint de egreso disponibles; frontend dispara egreso | **Parcial** | Confirmar fechas/zonas horarias en E2E |
| AUD-REQ-24 | Historial clínico | Frontend/Integración | Pantalla y servicio de historial por paciente | **Parcial** | Pruebas automatizadas e integración real |
| AUD-REQ-25 | Consultas médicas | Frontend/Integración | Alta y detalle; no hay listado global `/consultas` | **Parcial** | Alinear navegación del menú y probar CRUD permitido |
| AUD-REQ-26 | Diagnósticos | Frontend/Integración | Alta/listado dentro de consulta; API autorizada | **Parcial** | Probar permisos y validaciones |
| AUD-REQ-27 | Tratamientos | Frontend/Integración | Alta/listado dentro de consulta | **Parcial** | Probar contrato y errores |
| AUD-REQ-28 | Exámenes médicos | Frontend/Integración | Alta/listado dentro de consulta | **Parcial** | Probar contrato y errores |
| AUD-REQ-29 | Evolución clínica | Frontend/Integración | Usa `historial-medico` para registrar/listar evolución | **Parcial** | Confirmar semántica exigida por PDF y probar E2E |
| AUD-REQ-30 | Ventas de farmacia | Frontend/Integración | Carrito y POST `/ventas`; backend transaccional | **Parcial** | Probar venta exitosa, stock insuficiente y concurrencia |
| AUD-REQ-31 | Detalle de ventas | Frontend/Integración | Ruta `/ventas/:id`, GET detalle y pantalla | **Parcial** | Añadir spec y E2E |
| AUD-REQ-32 | Control de existencias | Integración | UI limita carrito; backend bloquea/actualiza stock en transacción serializable | **Parcial** | Demostrar comportamiento real con datos de prueba |
| AUD-REQ-33 | Validación de lotes vencidos | Backend/Integración | `VentaService` selecciona lotes con `FechaVencimiento > today`; no E2E | **Parcial** | Probar límites de fecha y zona horaria |
| AUD-REQ-34 | Descuento automático de inventario | Backend | Implementado en servicio de venta, fuera de responsabilidad frontend | **No aplica al frontend** | Validar con pruebas backend/E2E separadas |
| AUD-REQ-35 | Protección contra asignación simultánea de habitaciones | Backend | Existe coordinador transaccional; no se auditó integralmente en este trabajo | **No aplica al frontend** | Ejecutar prueba concurrente backend en entorno descartable |
| AUD-REQ-36 | Autorización para registrar diagnósticos | Backend | `DiagnosticosController` exige permiso `Historial/Crear` | **No aplica al frontend** | Validar matriz de permisos y respuesta 403 por separado |
| AUD-REQ-37 | CRUD por módulo según corresponda | Integración | Servicios/pantallas cubren buena parte; consultas no tienen delete, roles/reportes/citas incompletos | **Parcial** | Correlacionar operaciones exigidas por PDF y probarlas |
| AUD-REQ-38 | Aplicación móvil conectada a la misma API | Móvil/Integración | No se encontró proyecto móvil ni evidencia de PWA aceptada | **No verificable** | Aportar proyecto móvil y criterio exacto del PDF |
| AUD-REQ-39 | Catálogo de productos móvil | Móvil | No hay evidencia móvil | **No verificable** | Aportar código y prueba contra `/medicamentos/catalogo` |
| AUD-REQ-40 | Nombre, precio, marca, descripción, existencia e imagen en móvil | Móvil | El API/web tiene parte del DTO; no hay UI móvil demostrable | **No verificable** | Aportar pantalla y contrato móvil |
| AUD-REQ-41 | Vista detallada móvil de productos | Móvil | No hay evidencia móvil | **No verificable** | Aportar navegación/detalle y prueba |
| AUD-REQ-42 | Filtros móviles por nombre, marca y categoría | Móvil | No hay evidencia móvil | **No verificable** | Aportar implementación y validación |

## Módulos funcionales frente a módulos incompletos

| Clasificación | Módulos | Alcance de la afirmación |
|---|---|---|
| Funcionales por código y build | autenticación básica, menú, pacientes, empleados, usuarios, habitaciones, historial/consultas, inventario/lotes, ventas | Compilan y sus contratos principales coinciden; no equivale a E2E aprobado |
| Probados de forma aislada | login, guard, interceptor, menú, SignalR de habitaciones | 14 specs totales |
| Incompletos | citas; movimientos generales de inventario; roles; reportes; listado global de consultas | Sin ruta, servicios vacíos/incompatibles o pantalla inexistente |
| No demostrados | despliegue Azure, contenedor API, aplicación móvil, E2E real | Falta evidencia |

## Alcance multisucursal

Los DTO y formularios contienen `idSucursal` en empleados, consultas, habitaciones, lotes y ventas, y la API valida sucursal en múltiples operaciones. Esto evidencia intención y soporte parcial multisucursal. No se demostró aislamiento de datos por sucursal, selección global de sucursal ni flujos completos entre sedes; ese alcance requiere pruebas integradas y la redacción oficial del PDF.

## Paso obligatorio para cerrar la matriz

Incorporar `Proyecto_Final_Desarrollo_Web_2026(1).pdf`, extraer su índice y requisitos, renderizar las páginas relevantes para inspección visual y añadir a cada fila: número oficial, cita breve/paráfrasis, página y evidencia de aceptación. Hasta entonces, cualquier conteo debe presentarse como **provisional**.
