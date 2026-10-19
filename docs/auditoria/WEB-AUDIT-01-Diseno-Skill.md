# WEB-AUDIT-01 — Diseño de la Skill `webclinica-frontend`

Este documento especifica la Skill futura. En esta auditoría **no se creó ni instaló** la Skill.

## 1. Propósito

Guiar a Codex al desarrollar, corregir, probar y mantener `WebClinica` con cambios mínimos, contratos comprobados y respeto por la base de datos existente. Debe reducir lecturas indiscriminadas y evitar que una compilación se confunda con integración funcional.

## 2. Activación

Nombre: `webclinica-frontend`.

Descripción propuesta para el frontmatter:

> Audita, desarrolla, corrige y prueba el frontend Angular WebClinica y su integración puntual con API-Clinica. Úsala para cambios en rutas, componentes, formularios, servicios HttpClient, DTO TypeScript, JWT, permisos, SignalR, inventario, lotes, ventas, historial, habitaciones, pacientes, empleados, usuarios, citas o preparación Azure del frontend. Consulta solo los controladores/DTO .NET relacionados y nunca altera Azure SQL ni crea migraciones.

Debe activarse cuando la tarea mencione WebClinica o una ruta/archivo/módulo del frontend. No debe activarse para una auditoría exclusivamente backend, una tarea puramente de base de datos ni una aplicación móvil independiente.

## 3. Estructura propuesta

La convención real de Skills admite un `SKILL.md` obligatorio, referencias bajo demanda y metadatos opcionales para la interfaz. Estructura recomendada:

```text
.agents/
└── skills/
    └── webclinica-frontend/
        ├── SKILL.md
        ├── agents/
        │   └── openai.yaml
        └── references/
            ├── architecture.md
            ├── frontend-stack.md
            ├── api-contracts.md
            ├── module-map.md
            ├── security-rules.md
            ├── testing-guide.md
            └── project-requirements.md
```

No se proponen `scripts/` en la primera versión. Los comandos existentes (`verify`, Karma y búsquedas Git/rg) bastan; añadir scripts sin una necesidad repetida aumentaría mantenimiento. Tampoco se requieren `assets/`.

## 4. Función de cada archivo

| Archivo | Contenido | Momento de carga |
|---|---|---|
| `SKILL.md` | Flujo obligatorio, reglas invariantes, selección de referencias y validación proporcional | Siempre que se active |
| `agents/openai.yaml` | Nombre visible, descripción corta y prompt inicial coherente con la Skill | Descubrimiento/UI; no contiene reglas técnicas duplicadas |
| `references/frontend-stack.md` | Versiones resueltas, herramientas, comandos y configuración Angular | Dependencias, build o entorno |
| `references/architecture.md` | Mapa real standalone/core/pages/layout, rutas activas y límites | Rutas, composición o refactor focalizado |
| `references/api-contracts.md` | Índice endpoint → método → DTO → permiso → consumidor Angular | Cualquier cambio REST/SignalR |
| `references/module-map.md` | Corte vertical por módulo, estado funcional y archivos desconectados | Trabajo funcional por dominio |
| `references/security-rules.md` | JWT, 401/403, permisos, localStorage, CORS, SignalR y secretos | Auth, autorización, HTML, URL o despliegue |
| `references/testing-guide.md` | Matriz cambio → pruebas, E2E seguro y restricciones Azure SQL | Antes de validar |
| `references/project-requirements.md` | Trazabilidad académica respaldada por el PDF y evidencias de entrega | Trabajo universitario o aceptación |

## 5. Contenido mínimo de `SKILL.md`

El entrypoint debe permanecer breve y dirigir la lectura progresiva. Esquema propuesto:

```markdown
---
name: webclinica-frontend
description: <descripción de activación propuesta>
---

# WebClinica Frontend

## Antes de modificar
1. Lee AGENTS.md y `git status --short --branch`.
2. Identifica ruta, componente, servicio, modelo y spec del módulo.
3. Abre solo la referencia necesaria de `references/module-map.md`.
4. Si cambia consumo API, contrasta el endpoint exacto en `references/api-contracts.md`
   y luego con controlador/DTO fuente.
5. Conserva la arquitectura standalone y reutiliza servicios/modelos activos.

## Reglas invariables
- No alterar Azure SQL, esquema, migraciones, Migrate ni EnsureCreated.
- No inventar endpoints, campos, permisos ni hubs.
- Backend es autoridad de JWT, permisos y reglas de negocio.
- No guardar secretos ni enviar JWT fuera de environment.apiUrl/hubUrl.
- No integrar archivos desconectados solo porque existan.
- Hacer cambios mínimos y preservar contratos existentes.

## Validación
- Ejecuta pruebas focalizadas y `npm run verify`.
- Para auth/permisos/SignalR, ejecuta la suite completa y E2E seguro si la API está disponible.
- No escribir datos reales en Azure SQL.
- Reporta código existente, prueba aislada e integración real por separado.

## Referencias
- Stack/build: references/frontend-stack.md
- Arquitectura/rutas: references/architecture.md
- Contratos: references/api-contracts.md
- Módulos: references/module-map.md
- Seguridad: references/security-rules.md
- Pruebas: references/testing-guide.md
- Requisitos: references/project-requirements.md
```

## 6. Reglas que permanecen en `AGENTS.md`

Conservar allí únicamente reglas de todo el repositorio:

- stack general .NET/API/EF/Azure SQL/JWT/SignalR;
- inmutabilidad absoluta del esquema y prohibición de migraciones/creación;
- arquitectura Frontend → API → EF Core → Azure SQL;
- secretos mediante configuración externa;
- analizar lo necesario, reutilizar y hacer cambios mínimos;
- validación backend obligatoria después de cambios backend;
- implementar solo el módulo solicitado.

No copiar la matriz académica, lista de rutas Angular, comandos detallados del frontend ni catálogo de endpoints en `AGENTS.md`.

## 7. Reglas específicas de la Skill

- arquitectura standalone y organización `core/layout/pages`;
- cómo encontrar la ruta y el corte vertical;
- selección de referencias por módulo;
- obligación de contrastar DTO/controlador cuando cambie HttpClient;
- estrategia de entornos Angular y límites actuales;
- preservación del interceptor JWT y SignalR;
- tratamiento de los módulos desconectados de citas/movimientos;
- matriz de pruebas proporcional al tipo de cambio;
- distinción entre build, pruebas simuladas y E2E.

## 8. Información que no debe duplicarse

| Fuente canónica | No duplicar en |
|---|---|
| `AGENTS.md`: reglas de BD y repositorio | Cada referencia de módulo |
| `frontend-stack.md`: versiones | `SKILL.md` y todas las fichas |
| `api-contracts.md`: endpoints/DTO/permisos | Componentes y `module-map.md` |
| `module-map.md`: rutas/componentes por dominio | `architecture.md` salvo el mapa global |
| `security-rules.md`: amenazas y sesión | `testing-guide.md` salvo casos a ejecutar |
| `project-requirements.md`: matriz académica | `SKILL.md` |
| Código fuente | Referencias; estas deben resumir y enlazar |

## 9. Actualización de referencias

Cada referencia debe declarar `Última verificación: <commit>`. Reglas:

1. Cambio de ruta/componente activo → actualizar `architecture.md` y `module-map.md`.
2. Cambio de endpoint, DTO, paginación o permiso → actualizar solo la sección afectada de `api-contracts.md` y su módulo.
3. Cambio de dependencia/configuración → actualizar `frontend-stack.md` y riesgos relacionados.
4. Nueva prueba o cambio de runner → actualizar `testing-guide.md`.
5. Incorporación/cambio del PDF → actualizar `project-requirements.md`; conservar referencia exacta de página/sección.
6. No actualizar documentación por cambios internos que no alteren su contrato o instrucción.

Las actualizaciones deben contrastarse con la fuente y pasar una búsqueda de enlaces/rutas. No copiar automáticamente documentación generada por OpenAPI sin seleccionar lo que consume Angular.

## 10. Comprobación de efectividad

Usar un conjunto estable de tareas de evaluación:

1. corregir un campo de paciente;
2. añadir un filtro de ventas;
3. cambiar una regla de visibilidad por permiso;
4. reparar reconexión SignalR;
5. diagnosticar un error de lote.

Comparar ejecución con y sin Skill mediante:

- archivos/bytes leídos;
- tokens registrados por la plataforma;
- tiempo para hallar contrato correcto;
- intentos fallidos por endpoint/campo inventado;
- cambios fuera de alcance;
- comandos de validación pertinentes;
- resultado de revisión y pruebas.

La Skill se considera útil si reduce contexto irrelevante y mantiene o mejora exactitud y cobertura. No debe aprobarse solo porque el prompt sea más corto.

## 11. Evidencia suficiente y condición de implementación

Existe evidencia técnica suficiente para implementar una **primera versión** de la Skill: stack, arquitectura, rutas, contratos principales, riesgos y pruebas están documentados. Falta el PDF oficial para completar `project-requirements.md` con referencias exactas. La Skill puede implementarse con esa referencia marcada como pendiente; no debe afirmar cumplimiento académico definitivo hasta incorporar y verificar el documento.
