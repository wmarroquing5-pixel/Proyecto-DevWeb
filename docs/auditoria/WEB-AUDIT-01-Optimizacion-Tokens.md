# WEB-AUDIT-01 — Estrategia de contexto y consumo de tokens

## 1. Objetivo

Permitir que Codex modifique WebClinica con contexto suficiente y verificable sin releer todo el frontend ni todo el backend en cada tarea. No se atribuyen porcentajes de ahorro porque no se realizó una medición controlada de tokens antes/después.

## 2. Nivel 1 — contexto permanente mínimo

Este nivel debe estar disponible en toda tarea y caber en unas pocas reglas estables:

1. Stack: Angular 18 standalone, TypeScript estricto, Bootstrap/Bootstrap Icons, RxJS, Signals, HttpClient, JWT y SignalR; backend ASP.NET Core .NET 10 + EF Core + Azure SQL.
2. Flujo obligatorio: Frontend → API REST/SignalR → servicios .NET → EF Core → Azure SQL.
3. La base existente es inmutable: no migraciones, `Migrate`, `EnsureCreated` ni cambios de esquema.
4. El backend es autoridad de permisos y reglas de negocio; el frontend no debe inventar contratos.
5. Analizar primero rutas y archivos del módulo; reutilizar modelos/servicios existentes y hacer cambios mínimos.
6. Nunca versionar secretos, conexiones, JWT ni claves de Azure/R2.
7. Después de cambios: ejecutar validaciones proporcionales; para código frontend, como mínimo template/build y los specs relacionados.
8. Documentación de referencia: `docs/auditoria/` y `WebClinica/AUDITORIA-WEBCLINICA.md`.

Estas reglas pertenecen a `AGENTS.md` porque aplican a cualquier trabajo del repositorio, no solo al frontend.

## 3. Nivel 2 — contexto por funcionalidad

El agente debe cargar solo la fila correspondiente a la tarea.

| Área | Archivos frontend iniciales | Backend mínimo de referencia | Validación focalizada |
|---|---|---|---|
| Autenticación | `auth.service.ts`, `auth.interceptor.ts`, `auth.guard.ts`, login, `user.model.ts` | `AuthController.cs`, DTO login, JWT config | specs de login/guard/interceptor |
| Menú/permisos | `menu.service.ts`, sidebar, rutas | `MenuController.cs`, `MenuService.cs`, `MenuCompleto.cs`, permiso actual | spec de menú + navegación |
| Pacientes | modelo, servicio, dos páginas | `PacientesController.cs`, `PacienteDtos.cs` | build + specs del módulo cuando existan |
| Empleados | modelo, servicio, páginas, catálogos | `EmpleadosController.cs`, `EmpleadoDtos.cs`, catálogos relacionados | valores de tipo y catálogos |
| Usuarios/roles | modelo, servicio, páginas | `UsuariosController.cs`, `RolesController.cs`, DTO administración | permisos y validación de contraseña |
| Habitaciones | modelo, servicio, board y modales | controladores de habitación/asignación, DTO, transacción | spec de habitaciones + E2E seguro |
| SignalR | `habitaciones.service.ts`, board, environment | `HabitacionHub.cs`, notifier, `Program.cs` | conexión, evento, reconexión y cleanup |
| Historial | `historial.model.ts`, servicio, tres páginas | seis controladores/DTO relacionados | filtros, IDs y fechas |
| Inventario/lotes | `inventario.model.ts`, servicio y páginas activas | medicamentos, lotes, categorías, marcas, DTO farmacia | `cantidadEsperada`, paginación, stock |
| Ventas | `venta.model.ts`, servicio y tres páginas | `VentasController.cs`, `VentaDtos.cs`, `VentaService.cs` | request, filtros, lotes vencidos/concurrencia |
| Citas | archivos desconectados | Primero buscar controlador/hub real | no integrar mientras servicios estén vacíos |

## 4. Nivel 3 — referencias bajo demanda

| Documento | Abrir cuando |
|---|---|
| `WEB-AUDIT-01-Arquitectura.md` | Cambien rutas, capas, integración o módulos |
| `WEB-AUDIT-01-Matriz-Cumplimiento.md` | La tarea afecte una entrega universitaria |
| `WEB-AUDIT-01-Seguridad.md` | Cambien sesión, permisos, HTML, dependencias o SignalR |
| `WEB-AUDIT-01-Pruebas.md` | Se diseñen pruebas, CI, E2E o rendimiento |
| `WEB-AUDIT-01-Informe-Forense.md` | Se necesite el dictamen global y prioridades |
| `references/api-contracts.md` de la Skill futura | Se modifique una llamada REST/SignalR concreta |
| PDF oficial | Se emita un dictamen académico o cambien requisitos |

La matriz completa, el catálogo de pruebas y los contratos extensos no deben cargarse en cada tarea.

## 5. Protocolo de lectura selectiva

### Paso 1: localizar

1. Leer `AGENTS.md` y la sección breve del `SKILL.md` futuro.
2. Ejecutar `git status --short --branch` para conocer el estado sin interpretar cambios como propios.
3. Buscar la ruta en `app.routes.ts` y el elemento de menú, si aplica.
4. Usar `rg` para localizar el componente, servicio, modelo, endpoint y specs relacionados.

### Paso 2: inspeccionar solo el corte vertical

Abrir en este orden:

1. componente/ruta;
2. servicio Angular;
3. modelo/DTO TypeScript;
4. controlador y DTO .NET exactos;
5. servicio .NET solo si la regla de negocio importa;
6. pruebas existentes.

No leer todos los controladores, entidades o servicios del backend para un cambio aislado.

### Paso 3: comprobar referencias antes de editar

- Buscar selector, clase, método y ruta.
- Confirmar si el archivo está alcanzable desde `main.ts`/rutas.
- Confirmar consumidores antes de renombrar o eliminar.
- Verificar camelCase/identificadores con el DTO real.
- Comprobar si el endpoint exige permiso específico.

### Paso 4: validar proporcionalmente

| Cambio | Validación mínima |
|---|---|
| Texto/estilo local | template check + inspección visual focalizada |
| Componente | spec relacionado + `npm run verify` |
| Servicio/modelo REST | spec HTTP relacionado + `npm run verify` |
| Auth/permisos/SignalR | specs focalizados + suite completa + E2E seguro cuando API esté disponible |
| Dependencias/configuración | instalación limpia en rama aislada, build, suite, audit y E2E |
| Solo documentación | enlaces, rutas, consistencia y `git diff --check` |

## 6. Resúmenes técnicos reutilizables

Cada módulo debe tener una ficha corta con esta forma:

```markdown
# Módulo
- Rutas UI:
- Componentes activos:
- Servicio/modelo:
- Endpoints y permisos:
- Invariantes:
- Pruebas:
- Riesgos pendientes:
- Última verificación (commit):
```

La ficha debe referenciar archivos, no copiar implementaciones completas. Los detalles de DTO pertenecen a la referencia de contratos y deben actualizarse solo cuando cambie el backend.

## 7. Reglas para evitar repetición

- Mantener una sola definición de stack y reglas globales.
- No duplicar la matriz académica en `SKILL.md`.
- No pegar controladores/DTO completos en referencias; documentar campos que condicionan al frontend y enlazar la fuente.
- No repetir un hallazgo en todos los documentos; usar su ID y enlazar el informe dueño.
- No regenerar una auditoría integral por cambios triviales.
- Registrar el commit de evidencia en cada actualización para detectar documentación obsoleta.
- Si un contrato no cambió, conservar su ficha y verificar solo el endpoint afectado.

## 8. Cuándo escalar a auditoría integral

Escalar únicamente si ocurre al menos una condición:

- actualización mayor de Angular/TypeScript/SignalR;
- cambio transversal de autenticación o permisos;
- cambio de estructura de respuestas paginadas;
- múltiples módulos dejan de compilar;
- cambio de arquitectura de despliegue/entornos;
- incorporación del PDF oficial o cambio del alcance académico;
- integración de citas, móvil o un nuevo dominio completo.

Para una corrección aislada, basta el corte vertical y sus pruebas.

## 9. Comandos mínimos recomendados

```powershell
git status --short --branch
rg -n "termino" WebClinica/src/app API-Clinica/Controllers API-Clinica/Dtos
cd WebClinica
npm run verify
npm test -- --watch=false --browsers=ChromeHeadless
```

`npm audit --omit=dev` se ejecuta en revisiones de seguridad/dependencias, no tras cada cambio visual. Las pruebas E2E deben apuntar a un entorno descartable autorizado y nunca deben escribir en Azure SQL de producción.

## 10. Cómo medir la mejora futura

Antes y después de activar la Skill, ejecutar el mismo conjunto de tareas representativas y registrar:

- archivos abiertos y bytes leídos;
- llamadas de búsqueda;
- tokens de entrada/salida reportados por la herramienta;
- tiempo hasta identificar los archivos correctos;
- iteraciones por errores de contrato;
- pruebas ejecutadas y defectos detectados.

Solo con esas mediciones se podrá cuantificar ahorro. El objetivo funcional es mantener o mejorar exactitud, cobertura y tiempo de resolución con menos contexto irrelevante.
