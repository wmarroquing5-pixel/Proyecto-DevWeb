# Stack y entorno — corte auditado 2026-10-18
Última verificación: `bba962bb3b1d34ce733d20ffe2a591ad7327b0be`. Volver a consultar `package-lock.json` y `angular.json` si HEAD difiere.

- Angular Core/Router/Forms/HttpClient 18.2.14; Angular CLI/build 18.2.21; standalone/bootstrapApplication; lazy routes; esbuild.
- TypeScript 5.5.4 (strict, ES2022); RxJS 7.8.2; Signals y BehaviorSubject local; no NgRx.
- SignalR JS 10.0.11, Bootstrap 5.3.8, Bootstrap Icons 1.13.1, CSS; sin SCSS/NgModules.
- Jasmine 5.2.0 + Karma 6.4.4; ChromeHeadless. Node auditado 24.18.0/npm 11.16.0, no fijados en el proyecto.
- Scripts auditados: `npm run verify` (27 plantillas y build), `npm test -- --watch=false --browsers=ChromeHeadless`, `npm audit --omit=dev`.
- Build inicial auditado: 676.11 kB; 14/14 pruebas. Estos resultados no representan HEAD posterior.
- Configuración observada: solo `src/environments/environment.ts` con URL local HTTP (`http://localhost:5293`), `useMockApi: false`. No entorno de producción, Azure validado, SPA fallback ni CI detectados. Confirmar antes de desplegar.
- Seguridad de dependencias (corte): ocho paquetes Angular afectados (cuatro high/cuatro moderate). Planear migración compatible y aislada, sin `--force`; no afirmar que sigan vigentes sin `npm audit` actualizado.
- Dockerfile de API es responsabilidad backend/infraestructura según requisito 9; no crear Docker frontend por inferencia.

## Desarrollo/producción
- Para pruebas locales, validar que API real esté disponible antes de atribuir éxito E2E.
- Para Azure, exigir URL pública HTTPS de frontend y API; configuración del hub, CORS autorizados y fallback SPA. Las URLs públicas no se inventan.
- Los valores de `environment` frontend son públicos; jamás poner credenciales, secretos R2 o claves JWT allí.
