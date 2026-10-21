# SEC-03B-02 — Angular 18 a 19

Fecha: 2026-10-21. Estado: **COMPLETADO**, con riesgos de seguridad pendientes propios de esta etapa intermedia. SEC-03B-03 no iniciada.

## A. Versiones

| Paquete | Antes | Después |
|---|---|---|
| Node / npm | 22.23.4 / 10.9.9 | Sin cambios |
| Framework Angular y compiler-cli | 18.2.14 | 19.2.25 |
| Angular CLI y build-angular | 18.2.21 | 19.2.27 |
| TypeScript | 5.5.4 | 5.5.4 |
| Zone.js | 0.14.10 | 0.15.1 |
| RxJS | 7.8.2 | 7.8.2 |
| SignalR | 10.0.11 | 10.0.11 |
| Bootstrap / Icons | 5.3.8 / 1.13.1 | Sin cambios |
| Jasmine / Karma | 5.2.0 / 6.4.4 | Sin cambios |

Se consultó el registro npm antes de cambiar archivos: los últimos parches estables publicados de la línea 19.2 eran core/compiler-cli 19.2.25 y CLI/build 19.2.27. Los distintos números de parche corresponden a paquetes publicados por separado, con peers compatibles.

Se leyeron AGENTS.md, la skill frontend y sus referencias de stack, pruebas y seguridad, manifiesto, lockfile, angular.json, los tres tsconfig, main.ts, app.config.ts e informe SEC-03B-01. El informe original SEC-03A no se localizó; se usaron sus valores proporcionados y la evidencia de SEC-03B-01. Git no tenía modificaciones de archivos versionados: únicamente los informes anteriores sin seguimiento, que se conservaron.

## B. Dependencias modificadas

La herramienta oficial cambió los ocho paquetes runtime Angular, compiler-cli, CLI, build-angular y Zone.js. npm generó las actualizaciones transitivas del lockfile; no se editó manualmente. No se actualizaron dependencias directas ajenas a la migración. Se conservaron scripts, builder application, Karma, tipado estricto, RxJS, SignalR y Bootstrap.

Comando ejecutado correctamente:

```powershell
npx ng update '@angular/cli@19.2.27' '@angular/core@19.2.25' --allow-dirty
```

`--allow-dirty` permitió conservar los informes anteriores sin seguimiento. No omite peers. No se usaron force, legacy-peer-deps, audit fix, npm update ni commits automáticos. Una primera invocación con la opción no admitida `--interactive=false` terminó antes de modificar el proyecto; el reintento sin esa opción fue correcto.

## C. Archivos de aplicación

La migración oficial retiró `standalone: true` de 42 componentes porque Angular 19 lo usa por defecto. También reformateó metadatos y retiró comas finales. La comparación de los árboles sintácticos TypeScript confirmó que, excluyendo esa propiedad, no hay cambios de código en esos 42 archivos. No se alteraron plantillas ni lógica de negocio.

No cambiaron angular.json, tsconfig*.json, main.ts, app.config.ts, app.routes.ts, guards, interceptor ni servicios. Las migraciones CLI de SSR y configuración no necesitaron cambios. No se ejecutaron migraciones opcionales.

Dos archivos de pruebas requirieron adaptación al calendario de efectos de Angular 19, explicada en I. La lista individual con motivos figura al final.

## D. Instalación reproducible

`npm ci`: código 0, 981 paquetes añadidos y 982 auditados. `npm ls --depth=0`, inicial y final: código 0, sin errores de peers. Cero diferencias de versión entre los paquetes presentes y el lockfile.

SHA256 del lockfile generado, idéntico antes y después de npm ci:

`2A016614FEA85EE78CF1EA46E50E90F573336F12C4EBB77F32D3E370F3944172`

## E. Compatibilidad

Los peers publicados de core 19.2.25 exigen Zone.js ~0.15.0 y RxJS ^6.5.3 o ^7.4.0. Compiler-cli y builder admiten TypeScript >=5.5 <5.9; el TypeScript 5.5.4 conservado cumple. Node 22.23.4 cumple la matriz Angular 19. SignalR no declara peers Angular y Bootstrap conserva Popper ^2.11.8, resuelto sin error por npm.

## F. Pruebas

Suite completa final: **478/478 SUCCESS**, código 0, Chrome Headless 155.0.0.0. No se eliminó ninguna prueba ni aserción.

`npm run verify`: código 0, 45 plantillas analizadas sin problemas y build correcto. La suite incluye login/sesión, interceptor, guards, menú/RBAC, siete catálogos, pacientes, empleados, consultas/historial, habitaciones/SignalR, inventario/lotes, ventas y facturación. Esto verifica regresión mediante pruebas unitarias y mocks; no demuestra integración real con API, SignalR remoto ni recorridos E2E en producción.

## G. Build

`npm run build -- --configuration production`: código 0. Bundle inicial: 731.99 kB frente a 734.27 kB anteriores; transferencia estimada 145.79 kB frente a 145.56 kB. Salida en dist/web-clinica.

Advertencias de selectores CSS: `.form-floating>~label`, `.btn-group>+.btn` (dos veces) y `.btn-group-vertical>+.btn`. La primera existía; las demás aparecen con las nuevas herramientas de optimización. No se cambió Bootstrap ni se ocultaron avisos. No se realizó inspección visual de todos los controles.

## H. Seguridad

| Auditoría | Antes | Después |
|---|---|---|
| Total | 69: 7 low, 16 moderate, 43 high, 3 critical | 43: 2 low, 11 moderate, 28 high, 2 critical |
| Producción | 8: 4 moderate, 4 high | 8: 4 moderate, 4 high |

Ambas auditorías completaron con código 1 debido a vulnerabilidades. `npm outdated` completó con código 1 por versiones posteriores disponibles; no se instalaron esas versiones. Sus columnas Wanted confirman que los paquetes Angular están en el último parche permitido por sus rangos.

Se volvió a auditar la copia previa del lockfile Angular 18 con el mismo registro: reproduce 69 vulnerabilidades. La comparación de identificadores de avisos directos muestra **23 avisos resueltos y uno nuevo**; estas cifras no son el número de paquetes vulnerables y no deben restarse de 69.

### Aviso nuevo investigado y justificación de permanencia temporal

Esbuild 0.28.0: [GHSA-g7r4-m6w7-qqqr](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr), severidad low, corregido en 0.28.1. Requiere el servidor propio de esbuild con `servedir` en Windows. Angular/build 19.2.27 fija esbuild 0.28.0. Se inspeccionó el builder instalado: el servidor application de este proyecto usa `serveWithVite`, no el servidor `serve/servedir` vulnerable de esbuild. La aplicación no invoca esa API. No existe esa ruta de explotación en el build estático probado; la dependencia continúa marcada y no se afirma que esté corregida.

Se conserva la combinación oficial de paquetes 19.2 para esta etapa, sin introducir un override no validado. No usar directamente el servidor esbuild con servedir en Windows; reevaluar este aviso al cambiar de herramienta o iniciar las siguientes subfases. La clasificación de exposición es una inferencia de la configuración y código del builder inspeccionados, no una prueba de penetración.

Las demás alertas actuales ya estaban en la auditoría contemporánea del lockfile anterior, incluidas las de router SSR, Vite, proxies y herramientas CLI. El proyecto continúa siendo SPA sin SSR ni proxyConfig. Persisten dos paquetes de desarrollo con severidad critical: piscina y tar. Producción conserva ocho paquetes Angular vulnerables; esta etapa no constituye aprobación de despliegue ni cierre definitivo de SEC-03B.

## I. Regresiones y correcciones

Primera suite: 474 aprobadas y cuatro fallidas. Fallaban cierre del formulario clínico por revocación, cierre de entrada de lote por revocación, limpieza de lotes por permisos/sesión y descarte de respuesta del usuario anterior.

Los efectos creados dentro del componente ahora se ejecutan durante sincronización/detección de cambios. `TestBed.flushEffects()` no ejecutaba esos efectos de vista. Se sustituyeron cinco llamadas por `fixture.detectChanges()` en cuatro pruebas de dos archivos. Se conservaron todas las aserciones de permisos, ausencia de escrituras, limpieza de datos y respuestas de otra sesión; no se modificó el código de autorización. La suite completa posterior pasó.

Angular 19 también advierte que `allowSignalWrites` está obsoleto y carece de efecto. Se dejó el código existente intacto porque no requiere esta limpieza para migrar y sus comprobaciones siguen pasando.

## J. Integridad y riesgos pendientes

- Backend intacto: hashes de todos sus archivos versionados coinciden con la fotografía inicial.
- Sin acceso ni modificaciones a Azure SQL; sin migraciones SQL. Las 67 asignaciones RBAC no se tocaron. No se hizo un nuevo recuento en la base de datos.
- JWT, RBAC, rutas, permisos, servicios SignalR y configuración R2 intactos. Cambios en componentes de roles/permisos/login limitados a metadatos standalone y formato.
- Conservados los informes anteriores y el trabajo existente. No se modificó la configuración global de Node/npm.
- Sin commit, push, despliegue ni avance a Angular 20/21.
- `git diff --check`: código 0. No se introdujo any ni se relajaron opciones strict.
- Riesgos restantes: vulnerabilidades descritas, advertencias CSS/allowSignalWrites y ausencia de E2E real o revisión visual completa. La ausencia de regresiones se limita a la suite y build ejecutados.

## K. Estado y evidencias

**COMPLETADO para el salto controlado a Angular 19.2.x.** No iniciar SEC-03B-03 automáticamente. El cierre de la seguridad final corresponde a las siguientes subfases autorizadas.

Evidencias JSON conservadas en esta carpeta: [auditoría total](audit.json), [producción](audit-production.json), [línea base reconsultada](audit-baseline-rechecked.json) y [comparación de avisos](security-comparison.json).

Registros completos locales, excluidos de Git por la regla existente `*.log`: target-peers.log, ng-update.log, ng-update-retry.log, npm-ci.log, npm-ls.log, npm-ls-final.log, verify.log, angular-tests.log, angular-tests-final.log, production-build.log, npm-audit.log, npm-audit-production.log, npm-outdated.log, exit-codes.log, before-hashes.log, application-review.log e integrity.log. Los intentos fallidos se conservan; no se sobrescribieron los registros de SEC-03B-01.

Fuentes: [compatibilidad Angular](https://angular.dev/reference/versions), [comando oficial ng update](https://angular.dev/cli/update), [efectos Angular 19](https://v19.angular.dev/api/core/effect), metadatos npm guardados en target-peers.log y [aviso de esbuild](https://github.com/evanw/esbuild/security/advisories/GHSA-g7r4-m6w7-qqqr).

## Archivos modificados individualmente

| Archivo (desde WebClinica/) | Motivo |
|---|---|
| `src/app/app.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/layout/main/main-layout.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/layout/sidebar/sidebar.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/acceso-denegado/acceso-denegado.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/catalogos/categorias-admin.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/catalogos/clinicas-admin.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/catalogos/especialidades-admin.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/catalogos/marcas-admin.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/catalogos/servicios-admin.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/catalogos/sucursales-admin.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/catalogos/turnos-admin.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/dashboard/dashboard.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/empleados/empleado-form.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/empleados/empleados.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/facturas/factura-detalle.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/facturas/factura-nueva.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/facturas/facturas-list.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/funcionalidad-pendiente/funcionalidad-pendiente.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/habitaciones/asignar-paciente-modal.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/habitaciones/crear-habitacion-modal.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/habitaciones/habitaciones-board.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/habitaciones/registrar-egreso-modal.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/historial/consulta-detalle.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/historial/consulta-nueva.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/historial/consultas-list.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/historial/historial-paciente.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/inventario/inventario-list.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/inventario/lote-form.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/inventario/lotes-medicamento.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/inventario/medicamento-form.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/login/login.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/pacientes/paciente-form.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/pacientes/pacientes.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/pagina-no-encontrada/pagina-no-encontrada.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/permisos/permisos.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/roles/roles.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/usuarios/usuario-form.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/usuarios/usuarios.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/ventas/venta-detalle.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/ventas/ventas-list.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/ventas/ventas-nueva.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/shared/components/catalogo-admin-shell.component.ts` | Retirar standalone explícito y formato de migración oficial; AST restante equivalente. |
| `src/app/pages/historial/consulta-detalle.component.spec.ts` | Una sincronización con detectChanges para efecto de componente; mismas aserciones. |
| `src/app/pages/inventario/lotes-medicamento.component.spec.ts` | Cuatro sincronizaciones con detectChanges para efectos de componente; mismas aserciones. |
| `package.json` | Versiones Angular y Zone.js compatibles. |
| `package-lock.json` | Resolución generada por npm durante ng update. |
