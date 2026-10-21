# SEC-03B-03 — cierre de Angular 20.3

Fecha: 2026-10-21. Estado: **COMPLETADO para esta subfase**, con vulnerabilidades de desarrollo pendientes. Este informe sustituye como estado vigente al README del bloqueo anterior, que se conserva como evidencia histórica. No se inició SEC-03B-04.

## A. Respaldo persistente

Ruta externa al repositorio:

`C:\Users\DESARROLLO\Documents\ChatGPT\Respaldos-API-Clinica\SEC-03B-03`

El manifiesto `integrity-manifest.json` conserva ruta relativa, tamaño y SHA256 de cada archivo. Se respaldaron fuentes y configuración frontend, package.json, package-lock.json, archivos nuevos e informes de seguridad, incluidos registros locales. No se respaldaron node_modules, dist, .angular, configuración privada del backend ni archivos .env. No se incorporaron secretos operativos al respaldo.

## B–C. Cantidad e integridad

**217 archivos respaldados y verificados** contra sus originales. Se reabrieron desde una segunda ejecución de terminal y se compararon todos los SHA256 antes de migrar: cero discrepancias, ambos archivos de paquetes presentes, los 46 archivos previos incluidos y destino fuera del repositorio. No se empleó una carpeta temporal.

Al cierre se releyeron las 217 copias: ninguna inválida. Evidencias: [verificación previa](persistent-backup-verification.json) y [control final](final-integrity.json). El manifiesto reside junto al respaldo y no se alteró para incorporar cambios posteriores.

## D. Trabajo existente y archivos modificados

Al comenzar había **47 archivos versionados modificados**, no 46: estaban presentes los 46 identificados previamente, más angular.json. Además existían los informes sin seguimiento. Todos quedaron preservados en el respaldo; sus rutas están en el manifiesto y su campo modifiedNow. Los 44 archivos fuente/pruebas de SEC-03B-02 se conservaron intactos en esta ejecución.

Se detectó otro cambio preexistente: package.json y package-lock.json ya correspondían a Angular 20.3.34, CLI/build 20.3.40 y TypeScript 5.9.3. No se conoce desde esta ejecución la procedencia exacta de esa actualización; no se atribuye al comando ejecutado posteriormente ni se afirma que el nuevo respaldo sea una fotografía de Angular 19. El respaldo protege el estado real encontrado.

Respecto al respaldo persistente, los únicos archivos de código adaptados fueron:

| Archivo desde WebClinica/ | Motivo |
|---|---|
| src/app/core/services/auth-session.service.ts | Migración oficial del import DOCUMENT de common a core. |
| src/app/core/services/autorizacion-actualizacion.service.ts | La misma migración oficial del import DOCUMENT. |

Solo cambiaron los imports y formato asociado; no cambió la lógica de sesión, JWT, expiración, permisos ni autorización. Ninguna prueba fue editada. Se añadieron este informe y las evidencias de validación.

## E. Ejecución oficial e inspección

Tras verificar el respaldo se ejecutó el comando autorizado:

```powershell
npx ng update '@angular/cli@20.3.40' '@angular/core@20.3.34' --allow-dirty
```

Terminó con código 0 e informó que ambos paquetes ya estaban en las versiones objetivo. No ejecutó migraciones por ese motivo. Se inspeccionaron los manifiestos oficiales de migraciones instalados; quedaba pendiente DOCUMENT, por lo que se ejecutaron las migraciones obligatorias con migrate-only, desde core 19.2.25 hasta 20.3.34 y desde CLI 19.2.27 hasta 20.3.40.

Core aplicó DOCUMENT en los dos archivos indicados. InjectFlags, TestBed.get y BootstrapContext SSR completaron sin cambios. CLI verificó generación compatible con el estilo previo, imports SSR, moduleResolution bundler y configuración Karma: sin cambios necesarios. El bloque schematics de angular.json ya estaba presente. Se conservaron standalone, builder application, Jasmine/Karma y tipado estricto; no se ejecutaron migraciones opcionales de plantillas ni router.

Incidencias de herramienta conservadas en logs:

- Un intento migrate-only dentro del sandbox falló por DNS antes de modificar archivos. El reintento con red funcionó.
- La selección automática de CLI utilizó temporalmente 22.2.3 como ejecutor, sin instalar Angular 22 en el proyecto ni actualizar dependencias a esa versión. Para verificar específicamente las migraciones CLI 20 se ejecutó la CLI local 20.3.40, con NG_DISABLE_VERSION_CHECK=true solo en ese proceso.
- Un intento de fijar el paquete mediante el argumento de migrate-only fue rechazado antes de aplicar cambios; se corrigió usando el ejecutable local. La ejecución final completó con código 0.

No hubo conflictos con modificaciones anteriores ni restauraciones. No se usaron reset, stash, clean, force, legacy-peer-deps, audit fix, commit ni push.

## F. Versiones finales

| Dependencia | Línea base Angular 19 | Final |
|---|---|---|
| Node / npm | 22.23.4 / 10.9.9 | Sin cambios |
| Angular framework / compiler-cli | 19.2.25 | 20.3.34 |
| CLI / build-angular | 19.2.27 | 20.3.40 |
| TypeScript | 5.5.4 | 5.9.3 |
| RxJS | 7.8.2 | 7.8.2 |
| Zone.js | 0.15.1 | 0.15.1 |
| SignalR | 10.0.11 | 10.0.11 |
| Bootstrap / Icons | 5.3.8 / 1.13.1 | Sin cambios |
| Jasmine / Karma | 5.2.0 / 6.4.4 | Sin cambios |

Los peers instalados de compiler-cli y build admiten TypeScript >=5.8 <6.0; core admite Zone.js ~0.15.0 y RxJS ^6.5.3 o ^7.4.0. TypeScript 5.9.3 también facilita el siguiente salto, sin realizarlo. [Matriz oficial de compatibilidad](https://angular.dev/reference/versions).

## G. npm ci y reproducibilidad

`npm ci`: código 0; 994 paquetes instalados y 995 auditados. `npm ls --depth=0`: código 0, sin incompatibilidades de peers. Cero diferencias de versión entre paquetes presentes y lockfile; no aparecen paquetes @angular de versión 19.

SHA256 del lockfile, idéntico antes de npm ci y al cierre:

`ebe6feb6a733c1314b3ec7b7c2a03b96c278e2e043e4941d412a5fda6da024df`

El lockfile no se editó manualmente. Las migraciones migrate-only no cambiaron dependencias.

## H. Validaciones finales

| Comprobación | Resultado |
|---|---|
| npm run verify | Código 0; 45 plantillas sin problemas y build correcto. |
| Suite completa ChromeHeadless | Código 0; **478/478 SUCCESS**. |
| Build producción explícito | Código 0; bundle inicial 742.33 kB, transferencia estimada 148.56 kB. |
| git diff --check | Código 0. |
| npm outdated | Código 1 por versiones posteriores disponibles; no se instalaron. |

Se ejecutaron suite y builds antes y después de DOCUMENT. Los resultados finales corresponden al código posterior a esa migración. La suite existente cubre autenticación/sesión, 401/403, interceptor, guards, menú/RBAC, catálogos, pacientes/empleados, consultas/historial, medicamentos/lotes, habitaciones/SignalR, ventas y facturación. No se eliminaron, omitieron ni debilitaron pruebas. La comprobación es unitaria con mocks; no constituye E2E contra API/SQL real ni inspección visual de todos los recorridos.

## I. Seguridad

| Auditoría | Línea base | Final |
|---|---|---|
| Total | 43: 2 low, 11 moderate, 28 high, 2 critical | **20: 2 moderate, 18 high; cero critical** |
| Producción | 8: 4 moderate, 4 high | **0** |

`npm audit` devolvió 1 por avisos detectados; `npm audit --omit=dev` devolvió 0. Son resultados completos del registro, no fallos de instalación. [Auditoría total](audit.json), [producción](audit-production.json) y [comparación por aviso](security-comparison.json).

Esbuild está en **0.28.1**, fuera del rango vulnerable al aviso Windows GHSA-g7r4-m6w7-qqqr de la subfase anterior. Vite 7.3.6 y webpack-dev-middleware 7.4.2 conservan otros avisos de herramientas que figuran en audit.json. La reducción del total no se presenta como eliminación de todos los riesgos.

### Avisos nuevos investigados

La comparación con el JSON de SEC-03B-02 identifica cuatro avisos nuevos en **@modelcontextprotocol/sdk 1.31.0**, dependencia dev fijada por Angular CLI 20.3.40:

| Aviso oficial | Severidad | Condición afectada |
|---|---|---|
| [GHSA-22jm-h49p-29qw](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-22jm-h49p-29qw) | High | Tareas experimentales no vinculadas a la sesión creadora. |
| [GHSA-6prh-2h8m-c8cw](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw) | Moderate | Redirecciones HTTP/OAuth a otro origen reenviando cabeceras/cuerpo. |
| [GHSA-46jr-4wx8-v453](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-46jr-4wx8-v453) | High | Agotamiento de memoria al validar solicitudes HTTP. |
| [GHSA-rvq5-wwqv-78pq](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-rvq5-wwqv-78pq) | Moderate | Aceptación de tokens emitidos para otro servicio en autenticación MCP. |

Los rangos de los avisos incluyen 1.31.0 y señalan 1.32.0 como versión fuera de ellos. `npm explain` confirmó que el SDK procede de CLI, no de los módulos de Clínica. No se configuró ni ejecutó ng mcp; el código y scripts de la aplicación no importan el SDK ni usan sus clientes, servidores o autenticación. No afecta al JWT clínico ni al árbol de producción auditado. Esta clasificación de exposición se basa en dependencias y configuración, no en pruebas de explotación.

Se conserva temporalmente el árbol oficial Angular 20 como etapa de migración, sin overrides ajenos ni salto automático de CLI. No habilitar el servidor MCP de esta CLI sin resolver esos avisos. Deben reevaluarse en SEC-03B-04; no se declaran corregidos ni irrelevantes para cualquier uso futuro. Los demás avisos se conservaron como riesgos de desarrollo en el informe completo.

## J. Regresiones, integridad y limitaciones

No hubo fallos funcionales en las dos ejecuciones de 478 pruebas. La única adaptación de aplicación necesaria fue DOCUMENT; no se introdujo any ni se relajó strict. Persisten avisos de deprecación de allowSignalWrites, animations y platform-browser-dynamic; no se sustituyeron módulos funcionales por esas advertencias.

Backend: todos los hashes versionados comparados con la fotografía disponible de SEC-03B-02 permanecen iguales. No se accedió ni modificó Azure SQL, sus 67 asignaciones RBAC, R2, contratos REST o políticas de autorización. No se ejecutaron migraciones SQL, despliegues, commits ni push. Las dos modificaciones de imports en servicios no cambian JWT ni reglas RBAC. No se realizó un nuevo recuento en SQL.

El respaldo persistente contiene el estado Angular 20 hallado al inicio, no permite reconstruir por sí solo una línea base Angular 19 completa. Esta limitación de procedencia queda explícita; las pruebas y las migraciones obligatorias sí se verificaron en esta ejecución. No se garantiza funcionamiento E2E remoto por haber pasado mocks y builds.

## K. Estado y evidencias

**SEC-03B-03 COMPLETADO**: respaldo persistente validado, Angular 20.3 compatible, migraciones obligatorias revisadas y ejecutadas, instalación reproducible, 478 pruebas, verify y build correctos; auditorías actualizadas con riesgos documentados. Esto no cierra SEC-03 ni autoriza despliegue. No iniciar SEC-03B-04 automáticamente.

Los registros completos .log permanecen localmente en esta carpeta y están excluidos por la regla Git existente: ng-update, npm-ci, npm-ls, verify, angular-tests, production-build, npm-audit, npm-audit-production, npm-outdated, cli-migrations, cli-migrations-retry, cli20-migrations, cli20-local-migrations, core-migrations, verify-final, angular-tests-final, production-build-final y exit-codes. Se conservaron intentos fallidos, los informes anteriores y el manifiesto externo del respaldo.
