# Requisitos documentados: solamente frontend, Fase 1

## Procedencia y estado de verificación

- **Requisitos documentados:** la tabla conserva los requisitos de Fase 1 recopilados durante `WEB-AUDIT-01` y usados para diseñar esta Skill.
- **Contraste con el PDF original:** pendiente. El archivo original no está accesible actualmente en el espacio de trabajo; estas referencias no deben presentarse como citas verificadas del PDF.
- **Evidencia disponible en el repositorio:** código de `WebClinica`, contratos puntuales de `API-Clinica`, informes `WEB-AUDIT-01` y estado técnico histórico del commit `bba962bb3b1d34ce733d20ffe2a591ad7327b0be`.
- **Verificación pendiente:** incorporar el PDF, comprobar título, páginas, numerales y redacción, y actualizar únicamente las referencias confirmadas. Hasta entonces, cualquier dictamen dependiente del documento es provisional.

La Skill continúa limitada al frontend de la Fase 1. La Fase 2 móvil/PWA queda excluida.

| Referencia documentada, pendiente de confirmar en PDF | Requisito frontend o integración | Criterio comprobable | Estado técnico al auditar |
|---|---|---|---|
| 5 (p.1) | Frontend web Angular autorizado | SPA Angular que consume API .NET 10 | Implementado; integración real sin E2E |
| 6 (p.1) | Arquitectura desacoplada | HTTP/SignalR a API, no SQL directo | Implementación estática compatible |
| 7 (p.1) | Git + seguimiento | Historial y evidencia de herramienta de gestión | Git evidenciado; gestión externa no verificada en auditoría |
| 8 + Entrega (pp.1,3) | Frontend accesible en Azure con URL pública | HTTPS y demo de usuario → frontend → API | Sin evidencia de publicación |
| 10.a–c (p.1) | Login y token Bearer | Login, protección de pantallas, sesión/expiración | Básico; expiración/401 pendiente |
| 11.a–d (p.1) | UI de usuarios/roles y permisos dinámicos por módulo/CRUD | Pantallas de asignación y UI dependiente de permisos reales | Usuarios sí; roles y acciones dinámicas incompletas |
| 12.a–b (p.2) | Menú dinámico y actualizable | Menú desde API, cambia en sesión ante permisos | Menú inicial sí; actualización en sesión no |
| 13.a (p.2) | Pacientes CRUD + acceso historial | Altas/consultas/ediciones/bajas según API y permisos | Pantallas activas; E2E pendiente |
| 13.b (p.2) | Medicamentos y lotes, entradas/salidas | CRUD, ingreso/vencimiento, existencias, movimientos | Medicamentos/lotes activos; movimientos generales no integrados |
| 13.c (p.2) | Empleados, especialidad/roles | Doctores, enfermeras, administrativos; asociación necesaria | Empleados activos; rol requiere revisión |
| 13.d (p.2) | Habitaciones y pacientes asignados | Libre/ocupada/limpieza, ingreso/egreso, SignalR bidireccional | UI/hub estáticos; E2E no probado |
| 13.e (p.2) | Historial, consultas, exámenes, diagnósticos, tratamientos, evolución | Operaciones permitidas por API y permisos | Pantallas por paciente; sin listado global consultas |
| 13.f (p.2) | Ventas de farmacia | Detalle, cantidad/precio/total/usuario, validación de inventario | UI y servicio activos; E2E pendiente |
| 14.a–g (p.2) | Respuestas UI ante reglas de negocio | Mostrar rechazos de stock, lote vencido, habitación ocupada y falta de permiso | Backend autoridad; comportamiento integrado pendiente |
| Alcance (p.1) | Multi-clínica | `idSucursal` coherente en operaciones y selecciones | Parcial; flujos transversales no demostrados |

## Fuera del alcance de la Skill
- Referencias documentadas 2–4: aprovisionamiento Azure SQL, ER y desarrollo de la API; solo comprobar fronteras de integración.
- Referencia documentada 9: Dockerfile y ejecución contenedorizada de la **API**, no del frontend.
- Referencias documentadas 10.b,d, 11.c y 14: la firma/autorización JWT, persistencia de permisos y reglas transaccionales corresponden al servidor; Angular debe comunicar sus errores, no sustituir al backend.
- Fase 2 documentada: catálogo móvil, detalle, filtros y PWA/aplicación móvil excluidos.
- Citas y reportes no están enumerados como módulos obligatorios independientes en 13; no afirmar que son requisito académico autónomo. Si existen en API/menú, corregir coherencia cuando la tarea lo pida.

## Dictamen por requisito
Usar `Cumple`, `Parcial`, `No cumple`, `No verificable` y `Fuera del alcance frontend`. Exigir evidencia de rutas + contrato + pruebas + demostración cuando aplique; no reutilizar los conteos provisionales de 42 requisitos que incluían fase móvil y requisitos de backend. Mientras el PDF no esté accesible, marcar como `No verificable` toda afirmación que dependa de su redacción, página o numeración exactas.
