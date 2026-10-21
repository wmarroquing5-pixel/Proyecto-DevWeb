# SEC-03B-04 — Angular 20.3 a 21.2

Fecha: 2026-10-21. **COMPLETADO para esta subfase**, con riesgos de desarrollo pendientes. No se inició SEC-03B-05 ni se desplegó.

## A. Versiones anteriores y nuevas

| Paquete | Antes | Después |
|---|---|---|
| Framework Angular y compiler-cli | 20.3.34 | **21.2.25** |
| CLI y build-angular | 20.3.40 | **21.2.27** |
| Node | 22.23.4 | 22.23.4 |
| npm del equipo | 10.9.9 | 10.9.9 |
| TypeScript | 5.9.3 | 5.9.3 |
| RxJS | 7.8.2 | 7.8.2 |
| Zone.js | 0.15.1 | 0.15.1 |
| SignalR | 10.0.11 | 10.0.11 |
| Bootstrap / Icons | 5.3.8 / 1.13.1 | Sin cambios |
| Jasmine / Karma | 5.2.0 / 6.4.4 | Sin cambios |

Los parches objetivo se consultaron antes de ejecutar y se fijaron explícitamente. No se instaló Angular 22. Las dependencias directas ajenas a Angular conservaron sus versiones; [comparación](direct-dependencies.json).

## B. Integridad del respaldo

Respaldo nuevo e independiente del anterior:

`C:\Users\DESARROLLO\Documents\ChatGPT\Respaldos-API-Clinica\SEC-03B-04`

Contiene **241 archivos**, incluidos los **49 archivos versionados modificados**, los archivos nuevos relevantes, manifiestos, configuraciones y los informes/registros anteriores. Preserva rutas relativas y tamaños; `integrity-manifest.json` registra SHA256 por archivo. No incluye node_modules, dist, .angular ni archivos .env o configuración privada del backend.

Los 241 hashes se compararon con los originales desde una segunda ejecución independiente antes de la autorización, y nuevamente antes de migrar. Al cierre se releyeron las copias: **cero discrepancias**. [Verificación inicial](backup-verification.json), [integridad final](final-integrity.json).

Se leyó AGENTS.md y se revisaron los informes disponibles de SEC-03B-01/02/03; SEC-03A se conoce mediante los valores históricos y las referencias de esos informes. Se aplicó la skill webclinica-frontend. Se inspeccionaron Git, manifiesto, lockfile, angular.json y requisitos de los paquetes objetivo antes de cambiar dependencias.

## C. Migraciones y recuperación de instalación

Comando oficial autorizado, ejecutado después de verificar el respaldo:

```powershell
npx ng update '@angular/cli@21.2.27' '@angular/core@21.2.25' --allow-dirty
```

Actualizó el manifiesto, pero la instalación interna terminó con un error de npm 10.9.9: `Cannot read properties of null (reading 'edgesOut')` en Arborist, antes de ejecutar las migraciones de código. El registro completo se conserva en npm-install-arborist-error.log. Existe un [reporte del mismo fallo en npm/cli](https://github.com/npm/cli/issues/9787); no se atribuye a un conflicto de código de Clínica.

La recuperación fue acotada y conserva la evidencia:

1. Se probó npm **11.16.0 temporal** mediante npx, compatible con Node 22.23.4. No se instaló globalmente ni se cambió configuración del sistema. El intento contra el lockfile antiguo produjo ERESOLVE; un segundo intento con el grupo Angular explícito también falló.
2. Una resolución aislada, sin el árbol antiguo y con versiones directas no Angular fijadas a las previas, pasó sin force ni legacy-peer-deps.
3. Se preservó el lockfile antiguo como package-lock-before-resolution.log y el manifiesto de Angular como package-before-resolution.log. npm generó un lockfile nuevo usando temporalmente los mismos pins no Angular de la comprobación aislada; se restauraron los rangos exactos que había dejado ng update y npm sincronizó de nuevo el lockfile. No se editó a mano su contenido ni se copiaron paquetes. La regeneración recalculó dependencias transitivas y ninguna dependencia directa ajena a Angular cambió de versión.
4. `npm ci` con el npm **10.9.9 original** pasó usando ese lockfile. No se requirió usar npm temporal para la instalación reproducible final.
5. Se completaron las migraciones oficiales mediante la CLI **21 local** en modo migrate-only: CLI desde 20.3.40 hasta 21.2.27 y core desde 20.3.34 hasta 21.2.25. NG_DISABLE_VERSION_CHECK=true se usó solo en ese proceso para mantener el ejecutor local. Ambas finalizaron con código 0.

Migraciones inspeccionadas:

- CLI: Karma y moduleResolution bundler no necesitaron cambios; la migración de lib retiró la lista explícita de tsconfig.json, usando las bibliotecas predeterminadas para el target ES2022. Se conservaron strict y las comprobaciones de plantillas.
- Core: BootstrapContext SSR, ApplicationConfig, opciones de bootstrap y lastSuccessfulNavigation no necesitaron cambios.
- La migración oficial de control flow retiró CommonModule sin uso de los imports de 13 componentes que ya utilizaban bloques. La comparación con el respaldo muestra que no cambió sus plantillas ni lógica de negocio.
- No se ejecutaron migraciones opcionales. Se mantuvieron el builder application, carga lazy, detección de cambios con Zone.js y Jasmine/Karma. No se habilitaron funciones experimentales.

No hubo conflictos que requirieran sobrescribir trabajo previo. Los fallos de instalación y sus reintentos están preservados y no se presentan como ejecuciones exitosas del comando inicial.

## D. Archivos modificados

Respecto al respaldo de Angular 20 hay **18 archivos de código/configuración/manifiestos modificados**: package.json, package-lock.json, tsconfig.json, 13 componentes y dos archivos de pruebas. Se añadieron informes y evidencias de esta subfase. La lista individual con motivo figura al final y en [changed-files.json](changed-files.json).

No cambiaron app.config.ts, rutas, guards de aplicación, interceptor, servicios de sesión/permisos/menú, CatalogoAdminShellComponent, servicios SignalR ni los contratos REST. Los cambios en roles y permisos se limitan a imports sin uso.

## E. Instalación reproducible

`npm ci`: **código 0**, 979 paquetes instalados y 980 auditados con npm 10.9.9. `npm ls --depth=0`, inicial y final: código 0, sin errores de peers. Cero diferencias de versión entre los paquetes presentes y el lockfile; ninguna dependencia @angular de versión 20 o 22 en el lockfile.

SHA256 del lockfile antes de npm ci y al cierre, idéntico:

`d238371e7152885a8484c518492d92ef8df77684ae01455dba38f051c19dfcdd`

No se usaron overrides, omisiones especiales de peers/opcionales ni umbrales de auditoría. Las auditorías estándar se ejecutaron sobre el árbol final completo.

## F. Compatibilidad TypeScript / Zone.js

Los peers publicados e instalados de core 21.2.25 admiten Zone.js ~0.15.0 o ~0.16.0 y RxJS ^6.5.3 o ^7.4.0. Compiler-cli admite TypeScript >=5.9 <6.1; el builder restringe el rango a >=5.9 <6.0. La intersección se cumple con **TypeScript 5.9.3**, **Zone.js 0.15.1** y **RxJS 7.8.2**. Node 22.23.4 satisface el requisito ^22.12.0. [Matriz oficial Angular](https://angular.dev/reference/versions).

Se conservó provideZoneChangeDetection y sus polyfills; no se cambió la aplicación a zoneless.

## G. Pruebas completas

Suite final Chrome Headless 155.0.0.0: **478/478 SUCCESS**, código 0.

`npm run verify`: código 0, **45 plantillas sin problemas** y build correcto. La suite conserva sus verificaciones de autenticación, sesión/JWT, 401/403, interceptor, guards, menú/RBAC, catálogos, consultas, pacientes/empleados, inventario/lotes, ventas/facturación y habitaciones/SignalR.

No se eliminaron pruebas ni aserciones. Las dos adaptaciones de sincronización se explican en K. Esto valida regresión mediante unitarias/mocks; no constituye E2E remoto contra API/SQL real ni inspección visual de todos los recorridos.

## H. Build producción

`npm run build -- --configuration production`: **código 0**. Bundle inicial **750.88 kB**, transferencia estimada **150.34 kB**, frente a 742.33 kB / 148.56 kB en Angular 20. Se mantiene dentro de los presupuestos configurados, sin aumentarlos. Salida en dist/web-clinica. `git diff --check`: código 0.

## I. Seguridad anterior y posterior

| Auditoría | Angular 20 | Angular 21 |
|---|---|---|
| Total | 20: 18 high, 2 moderate | **16: 14 high, 2 moderate** |
| Producción | 0 | **0** |
| Critical | 0 | **0** |

`npm audit` terminó con código 1 por vulnerabilidades; `npm audit --omit=dev` con código 0. No son fallos de instalación. `npm outdated` terminó con código 1 por versiones posteriores disponibles; no se instalaron. [Auditoría total](audit.json), [producción](audit-production.json), [comparación completa](security-comparison.json).

La comparación por identificador no encuentra **avisos nuevos**. Dejan de aparecer dos avisos de follow-redirects, uno de source-map-js y uno de webpack-dev-middleware. El número de avisos directos y el número de paquetes afectados por sus cadenas son métricas distintas.

## J. Riesgos de desarrollo pendientes

Todos los paquetes vulnerables finales están en desarrollo; el resultado cero de producción no elimina sus riesgos durante el desarrollo.

- **SDK MCP 1.31.0**, dependencia de Angular CLI 21.2.27: permanecen los cuatro avisos revisados en SEC-03B-03: [tareas y sesión](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-22jm-h49p-29qw), [redirecciones HTTP/OAuth](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw), [memoria durante validación](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-46jr-4wx8-v453) y [audiencia de tokens MCP](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-rvq5-wwqv-78pq). Son dos high y dos moderate a nivel de avisos. Los rangos incluyen 1.31.0 y excluyen 1.32.0. No se activó ng mcp ni se integró el SDK en la aplicación; no corresponde al JWT clínico. No habilitar esas funciones de la CLI sin resolver o reevaluar sus avisos.
- **braces**, propagado por micromatch/chokidar a Karma y herramientas de build: agotamiento de pila con patrones anidados. Se mantiene el runner solicitado, sin degradar Karma a la versión antigua sugerida por audit ni excluir paquetes para alterar el resultado.
- **uuid**, propagado a sockjs: comprobación insuficiente de límites de buffer en funciones v3/v5/v6 cuando se aporta un buffer. Se conserva como riesgo transitivo del entorno de herramientas.
- **Vite**: permanecen los tres avisos relacionados con launch-editor en Windows (escape de argumentos, interpretación de flags y comprobación de rutas). Corresponden al servidor de desarrollo y su integración con el editor, no al bundle estático servido en producción.

Las cadenas afectadas incluyen build-angular, build-webpack, @angular/build, CLI, http-proxy-middleware, webpack-dev-server y adaptadores Jasmine/Karma. Los títulos, rangos y rutas exactas de cada cadena están en audit.json y security-comparison.json. No se efectuaron pruebas de explotación ni se declara ausencia de exposición en cualquier configuración de herramientas. No se habilitaron servidores MCP ni se expuso un servidor de desarrollo como parte de esta tarea.

Persisten advertencias de deprecación de allowSignalWrites, animations, platform-browser-dynamic y paquetes transitivos. No se reconstruyeron módulos funcionales para eliminarlas. No se cierra la seguridad global SEC-03 por reducir contadores.

## K. Regresiones y correcciones

Primera suite: **476 aprobadas y dos fallidas**. Las pruebas asumían que una sola microtarea bastaba para alcanzar una suscripción del guard o terminar una navegación; con Angular 21 esa espera no sincronizaba el flujo real.

- permiso.guard.spec.ts: el Subject emitía y completaba antes de que el guard se suscribiera, provocando EmptyError. Ahora espera una promesa resuelta al suscribirse al Observable pendiente; conserva las aserciones de no conceder la ruta antes de los permisos y permitirla después.
- autorizacion-actualizacion.service.spec.ts: la aserción se ejecutaba antes de completar la redirección. Ahora espera NavigationEnd suscrito antes de disparar la revalidación; conserva URL denegada y sesión autenticada. [Ciclo de eventos oficial del router](https://angular.dev/guide/routing/lifecycle-and-events).

No se cambió lógica de guard, autorización o sesión para aprobar. Se conservó el fallo inicial en angular-tests.log; la suite posterior completa pasó. No se introdujo any, no se relajaron strict/plantillas y no se alteraron aserciones.

## L. Integridad y estado

Backend intacto: los hashes versionados comparados con la fotografía disponible de SEC-03B-02 no muestran diferencias. Sin acceso ni modificaciones a Azure SQL, sus 67 asignaciones RBAC o R2; no se hizo un nuevo recuento en SQL. JWT, políticas de autorización, rutas y contratos REST de aplicación permanecen intactos.

Sin migraciones SQL, despliegues, reset, stash, clean, commit o push. El respaldo persistente conserva todo el trabajo previo; no hubo restauraciones destructivas. npm global permanece en 10.9.9. No se instaló Angular 22 ni se cambió el runner.

**SEC-03B-04 COMPLETADO**: Angular 21.2 compatible, respaldo verificado, instalación reproducible, 478 pruebas, verify/build correctos y cero vulnerabilidades altas/críticas de producción. Permanecen 16 vulnerabilidades de desarrollo documentadas. **SEC-03B-05 no iniciada.**

Registros completos locales excluidos por la regla existente *.log: ng-update, npm-install-arborist-error, npm-install-recovery, npm-install-angular-group, resolution-fresh, lock-regeneration, lock-manifest-sync, npm-ci, cli-migrations, core-migrations, npm-ls, verify, angular-tests, angular-tests-final, production-build, npm-audit, npm-audit-production, npm-outdated, npm-ls-final y exit-codes. Se conservan manifiesto/lockfile anteriores y la resolución aislada como diagnóstico. Los JSON de integridad, comparación y dependencias acompañan este informe.

## Archivos modificados respecto al respaldo

| Archivo desde WebClinica/ | Motivo |
|---|---|
| `package-lock.json` | Resolución generada por npm; recuperación documentada. |
| `package.json` | Versiones Angular 21 de ng update. |
| `src/app/core/guards/permiso.guard.spec.ts` | Sincronización con suscripción/evento real; mismas aserciones. |
| `src/app/core/services/autorizacion-actualizacion.service.spec.ts` | Sincronización con suscripción/evento real; mismas aserciones. |
| `src/app/pages/empleados/empleados.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/habitaciones/asignar-paciente-modal.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/habitaciones/crear-habitacion-modal.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/habitaciones/registrar-egreso-modal.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/historial/consulta-nueva.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/inventario/lote-form.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/inventario/medicamento-form.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/pacientes/paciente-form.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/pacientes/pacientes.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/permisos/permisos.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/roles/roles.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/usuarios/usuario-form.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `src/app/pages/usuarios/usuarios.component.ts` | Migración oficial: retirar CommonModule sin uso; sin cambio de plantilla/lógica. |
| `tsconfig.json` | Migración oficial de lib; target y strict conservados. |
