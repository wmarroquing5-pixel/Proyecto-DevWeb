# Arquitectura y rutas activas
Última verificación: `bba962bb3b1d34ce733d20ffe2a591ad7327b0be` (auditoría 2026-10-18).

Angular SPA standalone: `src/main.ts` → `src/app/app.config.ts` (router, HttpClient, interceptor) → `src/app/app.routes.ts` (authGuard, layout, loadComponent). `src/app/core` reúne modelos, servicios y seguridad; `layout` contiene navegación; `pages` organiza dominios. No existe `shared` y no es por sí mismo un defecto. Estado basado en Signals/computed, estado local y BehaviorSubject de habitaciones.

## Rutas constatadas en auditoría
- `/dashboard`; `/pacientes` (+ alta/edición); `/empleados` (+ alta/edición), alias `/admin/empleados`.
- `/admin/usuarios` (+ alta/edición); `/historial/:id` (consulta nueva y detalle); `/habitaciones`.
- `/inventario` (medicamentos/lotes), alias `/medicamentos`; `/ventas` (nueva y detalle).
- Sin pantalla a la fecha auditada: `/citas`, `/consultas` (listado global), `/admin/roles`, `/reportes/citas`, `/reportes/pacientes`. El menú de la API puede ofrecerlas; evitar redirección silenciosa al dashboard.

## Convenciones
- Formularios template-driven con `FormsModule`/`ngModel`; servicios HTTP tipados; respuestas paginadas camelCase.
- Mantener responsabilidades y estructuras existentes; no introducir NgRx, nuevos frameworks ni `shared` sin caso real.
- Antes de mover/renombrar, buscar imports, lazy load, templates, selectors, specs y recursos estáticos.
- Consultar `module-map.md` para el corte vertical específico y `api-contracts.md` solo si cambia la comunicación.

## Deuda observada
- Manejo de ProblemDetails desigual, tres usos activos de `any`, accesibilidad de labels/modal, catálogos top 100, iconos API `fa-*` frente a Bootstrap `bi-*`.
- Citas y movimientos fuera del grafo de compilación: plantilla verificada ≠ módulo listo.
