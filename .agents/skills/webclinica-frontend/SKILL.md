---
name: webclinica-frontend
description: Desarrolla, audita y prueba exclusivamente el frontend Angular WebClinica de la Fase 1 del Proyecto Final de Desarrollo Web. Úsala al modificar rutas, componentes, formularios, servicios HttpClient, JWT, permisos dinámicos, SignalR, pacientes, empleados, usuarios/roles, habitaciones, historial clínico, inventario/lotes, ventas o despliegue frontend Azure. Verifica contratos puntuales de API-Clinica .NET 10 sin modificar backend, esquema Azure SQL ni migraciones. No usar para Fase 2 móvil ni tareas exclusivamente backend.
---

# WebClinica frontend — Fase 1

## Ubicación de informes y documentación generada

Todos los informes, auditorías, diagnósticos técnicos, matrices, evidencias de validación, resultados de pruebas y resúmenes de implementación deben guardarse fuera de los proyectos, en:

- API-Clinica: `C:\Users\DESARROLLO\Documents\ChatGPT\Docs\API-Clinica`
- WebClinica: `C:\Users\DESARROLLO\Documents\ChatGPT\Docs\WebClinica`
- Informes de ambos proyectos: `C:\Users\DESARROLLO\Documents\ChatGPT\Docs\Compartido`

Crea la carpeta correspondiente si no existe. Usa nombres descriptivos con fecha e identificador de tarea, cuando exista.

No guardes estos documentos en la raíz de los repositorios ni en sus carpetas de código, pruebas o compilación.

Esta regla se aplica a los documentos generados para entregar o registrar resultados. El código, las pruebas automatizadas, la configuración, los archivos operativos y las propias skills deben conservar su ubicación.

Si no puedes acceder a la ruta indicada, informa el impedimento. No guardes el informe dentro del proyecto como alternativa ni afirmes que fue guardado.

## Alcance y fuentes
- Exclusivamente `WebClinica` (Angular SPA) y los requisitos frontend documentados para la Fase 1. No desarrollar aplicación móvil/PWA de Fase 2 por esta Skill.
- Basado en `WEB-AUDIT-01` con corte 2026-10-18, commit `bba962bb3b1d34ce733d20ffe2a591ad7327b0be`. Es una fotografía: confirmar contra código y Git actuales.
- `AGENTS.md` es la fuente principal de arquitectura global, base de datos inmutable, secretos, alcance y cambios mínimos. Esta Skill añade únicamente reglas de trabajo frontend. Consultar solamente las referencias necesarias de esta carpeta.

## Procedimiento obligatorio (lectura mínima)
1. Ejecutar `git status --short --branch`; identificar raíz del frontend y archivos realmente disponibles. No suponer que la auditoría aún describe HEAD.
2. Ubicar el corte vertical: ruta/componente → servicio Angular → modelo/DTO → test. Usar `rg` antes de abrir archivos grandes. Consultar `references/module-map.md` solo para el dominio pertinente.
3. Si cambian HTTP, payload, permisos o eventos, abrir la sección específica de `references/api-contracts.md` y contrastar contra controlador/DTO/hub .NET vigente en modo lectura. No inventar endpoints ni campos.
4. Aplicar cambios mínimos, preservar standalone, rutas lazy, diseño Bootstrap y comportamiento probado; no conectar módulos desconectados sin contrato real.
5. Para auth/permisos/SignalR leer `references/security-rules.md`; para dependencias, build o Azure leer `references/frontend-stack.md`; para rutas leer `references/architecture.md`.
6. Validar proporcionalmente según `references/testing-guide.md`; informar pruebas ejecutadas, fallidas y no realizadas. Build y mocks no equivalen a E2E.
7. Si la tarea busca cumplimiento de la Fase 1, abrir `references/project-requirements.md` y aportar evidencia por requisito; no calificar despliegue Azure sin prueba pública.

## Reglas específicas de frontend
- Aplicar las restricciones globales de `AGENTS.md`; Angular solo consume la API REST/SignalR y nunca accede directamente a SQL o R2.
- El backend puede consultarse en modo lectura para verificar controladores, DTO, permisos y hubs, pero esta Skill no modifica archivos backend.
- Si la solución requiere cambiar la API: identificar y documentar la incompatibilidad, detener el cambio backend, indicar `api-rest-clinica-audit` y, si afecta persistencia, `database-contract`, y solicitar autorización antes de salir del alcance frontend. No cambiar automáticamente de Skill.
- Backend controla JWT, permisos y reglas de negocio. No exponer tokens, enviarlos a dominios ajenos a API/hub autorizados ni hardcodear roles/permisos.
- No `npm audit fix --force`, actualización mayor, `git reset --hard`, `git clean -fd`, commit o push salvo autorización.
- No modificar funcionalidades de Fase 2; citas/reportes solo se desarrollan si se solicitan y tienen contrato verificado, no por aparecer en menú o archivo residual.

## Selección de referencias (carga progresiva)
- `references/module-map.md`: cambio de módulo o localización de archivos.
- `references/api-contracts.md`: REST, SignalR, DTO y serialización.
- `references/security-rules.md`: JWT, guard, 401/403, permisos, XSS, sesión.
- `references/architecture.md`: rutas, composición y estado.
- `references/frontend-stack.md`: versiones, entornos, build/Azure.
- `references/testing-guide.md`: pruebas, riesgos y E2E seguro.
- `references/project-requirements.md`: requisitos documentados de aceptación Fase 1; corroborar el PDF antes de tratarlos como referencia oficial.

## Entrega
Informar archivos afectados, requisito/contrato verificado, validaciones reales, riesgos y pendientes. No ampliar el alcance ni reauditar todo el repositorio sin necesidad. Si cambió un contrato/ruta real, actualizar solo la referencia afectada y su commit de verificación.
