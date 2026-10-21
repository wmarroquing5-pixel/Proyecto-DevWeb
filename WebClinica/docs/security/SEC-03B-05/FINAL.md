# SEC-03B-05 — Auditoría final de seguridad y regresión

Fecha: 2026-10-21. **Auditoría completada con observaciones; no constituye aprobación de despliegue ni cierre de toda la remediación.** No se modificaron código, dependencias, overrides ni infraestructura.

## A. Inventario definitivo

| Elemento | Versión comprobada |
|---|---|
| Node / npm | 22.23.4 / 10.9.9 |
| Framework Angular y compiler-cli | 21.2.25 |
| CLI / build-angular / @angular/build | 21.2.27 |
| TypeScript | 5.9.3 |
| RxJS / Zone.js | 7.8.2 / 0.15.1 |
| SignalR | 10.0.11 |
| Bootstrap / Icons | 5.3.8 / 1.13.1 |
| Jasmine / Karma | 5.2.0 / 6.4.4 |
| SDK MCP de CLI / Vite | 1.31.0 / 7.3.6 |

Manifiesto y lockfile sincronizados; npm ls sin errores de peers. Se conserva detección de cambios con Zone.js, componentes standalone, rutas lazy y el runner Jasmine/Karma. [Inventario completo de dependencias directas y peers](inventory.json).

Se leyeron AGENTS.md y la skill webclinica-frontend y se revisaron los informes disponibles de las subfases anteriores. SEC-03A no se encontró como informe independiente; sus cifras históricas proceden de los informes y contexto proporcionado. La auditoría actual usa el árbol instalado y consultas nuevas al registro.

## B. Git, respaldos e integridad acumulada

Hay **52 archivos versionados modificados acumulados desde la fotografía de Angular 18**; ya estaban modificados al iniciar esta auditoría. Incluyen paquetes, configuración, metadatos standalone, imports oficiales, retirada de CommonModule sin uso y sincronización de cuatro archivos de pruebas. Se conservaron todos.

El control SHA256 de los archivos versionados antes/después de SEC-03B-05 da **cero modificaciones**. Backend, JWT, guard/interceptor, RBAC, contratos REST y R2 no cambiaron durante esta auditoría. No se accedió ni modificó Azure SQL ni sus 67 asignaciones; no se hizo un recuento nuevo en la BD. No hubo migraciones SQL, commit, push, despliegue ni operaciones contra servicios productivos. El tráfico externo se limitó a fuentes documentales/registro npm y descargas de dependencias; las pruebas utilizaron mocks locales.

Respaldos persistentes fuera del repositorio, verificados archivo a archivo:

| Ruta bajo C:\Users\DESARROLLO\Documents\ChatGPT\Respaldos-API-Clinica | Archivos | SHA256 inválidos |
|---|---|---|
| SEC-03B-03 | 217 | 0 |
| SEC-03B-04 | 241 | 0 |

Cada respaldo representa su momento histórico, no el estado final de Angular 21. El de SEC-03B-04 protege el estado Angular 20 anterior al último salto. [Integridad de respaldos](backup-integrity.json), [integridad de código y lista acumulada](integrity.json), git-status-before.log y before-hashes.log.

## C–D. Vulnerabilidades actuales

| Alcance | Critical | High | Moderate | Low | Total de paquetes afectados |
|---|---|---|---|---|---|
| Árbol completo | 0 | **14** | **2** | 0 | **16** |
| Producción, omit=dev | 0 | 0 | 0 | 0 | **0** |

Se ejecutaron npm audit --json, npm audit --omit=dev --json, npm outdated --json y npm ls --depth=0. Audit completo devuelve 1 por avisos; producción devuelve 0; outdated devuelve 1 por versiones posteriores. No hubo fallo de consulta. [Auditoría completa](audit.json), [producción](audit-production.json), [outdated](outdated.json).

Los **16 paquetes** no equivalen a 16 CVE independientes: hay **11 avisos directos**, propagados a padres y peers. La severidad agregada de un paquete puede ocultar avisos de menor severidad en su misma fila.

Respecto a SEC-03B-04 siguen siendo 16 paquetes, pero aparecieron en la consulta dos avisos adicionales de Vite: GHSA-9jrq-w75r-8gcw y GHSA-rq7h-c2jc-7f22. No hubo cambios de dependencias; cambió el conjunto de avisos del registro. [Diferencia de avisos](advisory-delta.json).

## E. Matriz de los 16 hallazgos

Todos están en herramientas de desarrollo/test y ausentes de los inputs del bundle de producción inspeccionado. Las familias F1–F4 de la siguiente sección proporcionan para **cada fila que las hereda** identificadores, condiciones de explotación, parches, compatibilidad, mitigaciones y riesgo. Los padres y rangos completos, incluidas rutas anidadas, están en [findings.json](findings.json).

Categorías: **A** actualización compatible; **B** cambio mayor/sustitución; **C** sin parche aplicable al árbol actual; **D** no aplicable a la ruta real comprobada. **A candidato** significa mismo major/patch y requisito Node compatible, pero el padre fija la versión anterior: requiere autorización y validación de integración, no está demostrado como corrección lista para aplicar. D no elimina el aviso del inventario ni se extiende a usos futuros.

| # | Paquete instalado | Severidad | Lo incorpora | Avisos heredados | Clasificación y riesgo residual |
|---|---|---|---|---|---|
| 1 | @angular-devkit/build-angular 21.2.27 | High | WebClinica, dev directa | F2, F3, F4 | C por braces; B sustitución de cadena; A candidato para Vite. Riesgo condicional de herramientas. |
| 2 | @angular-devkit/build-webpack 0.2102.27 | High | build-angular | F2, F3 | C/B; no se corrige degradando Angular. |
| 3 | @angular/build 21.2.27 | High | build-angular | F2, F4 | C para braces vía Karma; A candidato Vite. |
| 4 | @angular/cli 21.2.27 | High | WebClinica, dev directa | F1 | D en MCP stdio inspeccionado; A candidato/C con pin actual. |
| 5 | @modelcontextprotocol/sdk 1.31.0 | High | CLI, pin exacto | F1: cuatro GHSA | D en ruta actual; riesgo latente si se habilita HTTP/tasks/OAuth. |
| 6 | braces 3.0.3 | High | Karma, chokidar y micromatch | F2 | C; DoS si llegan patrones anidados no confiables. |
| 7 | chokidar 3.6.0, dos rutas | High | Karma y webpack-dev-server | F2 | C/B; controlar patrones y acceso a watchers. |
| 8 | http-proxy-middleware 3.0.7 y 2.0.10 | High | build-angular y webpack-dev-server | F2 vía micromatch | C/B; no es un aviso directo nuevo de proxy en este árbol. |
| 9 | karma 6.4.4 | High | WebClinica y peers de herramientas | F2 | C; B evaluar otro runner junto con la cadena webpack. |
| 10 | karma-jasmine 5.1.0 | High | WebClinica; peer Karma | F2 | C/B; heredado, sin GHSA propio en esta consulta. |
| 11 | karma-jasmine-html-reporter 2.1.0 | High | WebClinica; peers Karma/Jasmine | F2 | C/B; heredado, sin GHSA propio. |
| 12 | micromatch 4.0.8 | High | http-proxy-middleware | F2 | C; el parser braces no tiene parche publicado. |
| 13 | sockjs 0.3.24 | Moderate | webpack-dev-server | F3 | D para v4 sin buffer; B si se sustituye uuid/consumidor. |
| 14 | uuid 8.3.2 | Moderate | sockjs, rango ^8.3.2 | F3 | D en uso observado; parche mínimo pertenece a major 11. |
| 15 | vite 7.3.6 | High | @angular/build, pin exacto | F4: cinco GHSA | A candidato 7.3.7; D parcial por plataforma; riesgo Windows/custom no descartado. |
| 16 | webpack-dev-server 5.2.6 | High | build-webpack/build-angular | F2, F3 | C/B; hereda braces y uuid; no tiene aviso directo en esta consulta. |

### F1. SDK MCP: los cuatro avisos

| GHSA / CVE | Severidad | Condición de explotación | Parche y requisitos adicionales |
|---|---|---|---|
| [GHSA-22jm-h49p-29qw](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-22jm-h49p-29qw), CVE-2026-111767 | High | Servidor HTTP con taskStore compartido entre sesiones. | SDK 1.32.0; evitar tareas experimentales o separar almacén por sesión. |
| [GHSA-6prh-2h8m-c8cw](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6prh-2h8m-c8cw), CVE-2026-111769 | Moderate | Cliente HTTP/SSE u OAuth sigue redirecciones entre orígenes y reenvía datos. | SDK 1.32.0; no restaurar redirectPolicy=follow. Stdio no está afectado. |
| [GHSA-46jr-4wx8-v453](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-46jr-4wx8-v453), CVE-2026-111768 | High | Clientes no confiables alcanzan servidor HTTP y provocan validación masiva de elementos. | SDK 1.32.0 **y** maxToolInputElements más límite de tamaño HTTP; actualizar solo la versión no activa esos límites. |
| [GHSA-rvq5-wwqv-78pq](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-rvq5-wwqv-78pq), CVE-2026-111771 | Moderate | Middleware bearer HTTP no verifica audiencia cuando el emisor sirve a varios servicios. | SDK 1.32.0 **y** expectedResource/AuthInfo.resource o validación equivalente de aud. |

Evidencia local: node_modules/@angular/cli/src/commands/mcp/cli.js crea StdioServerTransport. No se encontraron taskStore, middleware bearer ni transportes cliente HTTP/SSE del SDK en src de CLI; la aplicación no importa el SDK y sus scripts no habilitan ng mcp. Por esas rutas comprobadas la clasificación es D, no por tratarse simplemente de una devDependency. No se auditó todo consumidor externo del SDK ni se garantizan usos futuros. [Cadena npm](mcp-chain.json).

SDK 1.32.0 está publicado y admite Node >=18; peers consultados zod ^3.25 o ^4.0 y @cfworker/json-schema ^4.1.1. CLI 21.2.27 fija **1.31.0**, por lo que un npm ci normal no lo actualiza. Un override específico sería un candidato A de semver, pendiente de autorización y pruebas propias de CLI/MCP; no se declara compatibilidad integrada demostrada. La sugerencia de audit de CLI 22 es un cambio mayor B, fuera de esta tarea.

Mitigación actual: transporte stdio y ausencia de funciones HTTP/tasks de ese SDK en la configuración examinada. Conservar esa restricción y reevaluar si se habilitan. Los tokens bearer de estos avisos son los del SDK MCP, no una falla demostrada del JWT clínico.

### F2. Braces y sus cadenas

[GHSA-vfj7-8cjw-p6xm / CVE-2026-93687](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), High: patrones profundamente anidados pueden agotar la pila del parser y terminar Node. Versiones afectadas <=3.0.3; el registro y aviso consultados **no publican parche**. Evidencia de implementación: [compile.js del proyecto](https://github.com/micromatch/braces/blob/3.0.3/lib/compile.js).

Clasificación C. B es evaluar la sustitución de herramientas que arrastran esa rama; cambiar solo Karma no basta mientras permanezca la rama webpack. No se ejecutó un exploit. El repositorio no ofrece globs de usuario final a este parser, pero las herramientas procesan archivos/configuraciones del proyecto: no es irrelevante para CI o proyectos no confiables. Mitigación recomendada, no aplicada: entradas/globs confiables y acotadas, no ejecutar tareas de terceros sin revisión, limitar exposición de servidores de desarrollo y test. Riesgo residual: DoS de desarrollo/CI condicionado a alcanzar el parser.

Las propuestas de audit que degradan Karma a 4.0.0 o build-angular a 0.1002.1 no son correcciones compatibles con Angular 21. No se siguieron.

### F3. UUID / SockJS

[GHSA-w5hq-g745-h8pq](https://github.com/uuidjs/uuid/security/advisories/GHSA-w5hq-g745-h8pq), Moderate: v3/v5/v6 aceptan buffers externos sin validar correctamente tamaños/offsets. Parche mínimo 11.1.1; también 12.0.1 y 13.0.1 en sus ramas. No hay backport comprobado para uuid 8.3.2.

node_modules/sockjs/lib/transport.js importa exclusivamente uuid.v4 y lo llama como v4(), sin buffer. La fuente del aviso distingue v4 como no afectado. D para esta ruta exacta; riesgo bajo en ella, reevaluar si aparecen otros consumidores. [Cadena npm](uuid-chain.json). Sustituir 8 por 11 excede ^8.3.2 y es B; no proponer un override mayor a ciegas.

### F4. Vite y código de launch-editor incorporado

Vite 7.3.6 incorpora launch-editor 2.14.1 dentro de dist/node/chunks/config.js. Actualizar solo un paquete launch-editor externo no sustituye ese código empaquetado.

| Aviso oficial | Severidad | Condiciones y aplicabilidad |
|---|---|---|
| [GHSA-698v-4r3x-3vcv / CVE-2026-112943](https://github.com/vitejs/launch-editor/security/advisories/GHSA-698v-4r3x-3vcv) | Moderate | Windows, argumentos al editor, rutas/entorno controlables; escape insuficiente de %. No se descarta en esta plataforma. |
| [GHSA-r825-w8mm-5pxw / CVE-2026-112944](https://github.com/vitejs/launch-editor/security/advisories/GHSA-r825-w8mm-5pxw) | Moderate | Rutas interpretadas como flags por ciertos editores. Para Vite moderno el aviso requiere WSL; D para esta ejecución Windows nativa, no para otros equipos. |
| [GHSA-587h-7wmj-h5pm / CVE-2026-112942](https://github.com/vitejs/launch-editor/security/advisories/GHSA-587h-7wmj-h5pm) | High | Windows y argumento de archivo controlable; combinado con el escape permite llegar al shell eludiendo la comprobación de existencia. Riesgo condicional real, no descartado. |
| [GHSA-9jrq-w75r-8gcw](https://github.com/vitejs/vite/security/advisories/GHSA-9jrq-w75r-8gcw) | Low | Middleware custom pasa URL sin normalizar a transformIndexHtml, HTML con módulo inline y datos/acciones sensibles; visita a sitio malicioso con dev server activo. |
| [GHSA-rq7h-c2jc-7f22](https://github.com/vitejs/vite/security/advisories/GHSA-rq7h-c2jc-7f22) | Moderate | Servidor expuesto, sistema no Windows y ruta importada que coincide con ruta absoluta legible fuera de allow. D para esta ejecución Windows; no para CI Linux futuro. |

Para los cinco avisos Vite **7.3.7** es el parche de su misma rama. Launch-editor 2.14.2 corrige sus tres avisos, pero Vite necesita su propia actualización. @angular/build 21.2.27 fija Vite 7.3.6; Node 22.23.4 cumple el requisito de 7.3.7. C bajo el pin actual y A candidato para un parche dirigido con autorización, no compatibilidad integrada probada. [Cadena npm](vite-chain.json).

Angular usa appType=custom en node_modules/@angular/build/src/builders/dev-server/vite/server.js; index-html-middleware.js pasa req.url a transformIndexHtml. El index fuente no tiene scripts inline, pero no se validó el HTML de desarrollo transformado: no se clasifica automáticamente GHSA-9jrq como no aplicable. La producción estática es un escenario distinto.

Mitigación existente: no hay --host público ni proxyConfig en scripts/configuración de aplicación. No equivale a probar firewall o aislamiento de todos los servidores. Recomendaciones pendientes: no exponer dev server, evitar apertura de editor con rutas no confiables, parchear de forma dirigida y verificar los flujos de desarrollo, incluyendo los no-Windows si se usan.

## F–G. Correcciones compatibles y mitigaciones priorizadas

**No se aplicó ninguna corrección.** No hay actualización directa ordinaria ya validada que elimine todo el conjunto conservando sin más los pins actuales.

1. **Vite 7.3.7:** candidato A por patch y Node; el padre fija 7.3.6. Plan: autorizar prueba en copia aislada con override exclusivamente de @angular/build→vite, comparar grafo y ejecutar build/tests y smoke del dev server. Retirar la propuesta si altera funcionalidad; no cambiar Angular ni runner. No afirmar que baste hasta validarlo.
2. **SDK 1.32.0:** candidato A por minor y Node, pero exact pin de CLI. Validar separadamente CLI/MCP y peers antes de autorizar override. No es urgente por el flujo D comprobado; HTTP futuro requiere además límites/audiencia, no solo subir versión.
3. **Braces:** C, sin parche publicado. B: estudiar eliminación conjunta de ramas Karma/webpack mediante herramientas compatibles con Angular 21, conservando y migrando la suite solo en tarea autorizada. No hacer degradaciones.
4. **UUID:** D en v4 de SockJS; no forzar major 11 para mejorar un contador. B solo si hay uso vulnerable nuevo o un padre que soporte la versión corregida.

Karma merece atención adicional: su configuración predeterminada usa listenAddress=0.0.0.0 y hostname=localhost (node_modules/karma/lib/constants.js). El hostname mostrado en logs no prueba que escuche solo en loopback. No hay override de listenAddress en la configuración frontend revisada; firewall/exposición efectiva no se verificaron. Proponer limitarlo a 127.0.0.1 en una tarea autorizada. El proceso de pruebas terminó; no se dejó un servidor desplegado.

## H–J. Reproducibilidad, regresión y build

| Verificación nueva | Resultado |
|---|---|
| npm ci | Código 0; 979 paquetes instalados, 980 auditados. |
| npm ls --depth=0 | Código 0, sin errores de peers. |
| npm run verify | Código 0; 45 plantillas sin problemas y build correcto. |
| Suite Angular completa | **478/478 SUCCESS**, código 0, ChromeHeadless 155. |
| Build producción | Código 0; 750.88 kB inicial, 150.34 kB estimados de transferencia. |
| git diff --check | Código 0. |

Se usó --stats-json adicionalmente en el build explícito para inspeccionar sus inputs, sin modificar configuración. Las dependencias se reconstruyeron, no se actualizaron. package.json, package-lock.json y todo el código/pruebas conservan sus hashes iniciales. Lockfile SHA256: `d238371e7152885a8484c518492d92ef8df77684ae01455dba38f051c19dfcdd`.

Hay **58 archivos de pruebas y 58 suites**; sin xit/xdescribe/fit/fdescribe encontrados. No se midió porcentaje de cobertura de líneas/ramas en esta ejecución. Las 478 aprobadas son evidencia de casos ejecutados, no de cobertura completa. [Inventario de cobertura disponible](coverage-inventory.json).

| Área solicitada | Evidencia existente, ejecutada con mocks |
|---|---|
| Login, JWT y expiración | login.component.spec.ts y auth.service.spec.ts; sesión inválida/expirada, restauración y eventos de ciclo de vida. |
| Interceptor / 401 / 403 | auth.interceptor.spec.ts; adjuntar token a API autorizada, invalidación y revalidación. |
| Menú / CAME / roles | menu.service, permisos.service, roles.service, sidebar, roles/permisos componentes y permiso.model specs. |
| Rutas protegidas | auth.guard, permiso.guard y app.routes specs. |
| Siete catálogos | specs de categorías, clínicas, especialidades, marcas, servicios, sucursales y turnos. |
| Pacientes / empleados | specs de componentes y formularios disponibles. No se deduce cobertura completa de todo formulario. |
| Consultas / historial | historial.service y consulta-detalle specs; carga clínica y consumo protegido. No hay un spec individual para cada vista clínica. |
| Habitaciones / SignalR | habitaciones.service, board y modales; reconexión, callbacks, errores y recuperación mediante dobles. |
| Medicamentos / lotes | inventario.service y specs de inventario/formularios/lotes. |
| Ventas / facturación | venta.service, factura.service y specs de lista, detalle y creación. |

No se detectaron regresiones en esa suite respecto a 478 de SEC-03B-04. Los cambios acumulados desde Angular 18 se revisaron mediante Git/informes/fotografía de hashes; no se reejecutó una instalación Angular 18 ni se afirma equivalencia exhaustiva del sistema completo.

## K. Configuración de seguridad de producción

### Hallazgo P1: entorno y endpoints locales empaquetados

Solo existe src/environments/environment.ts: production=false, apiUrl=http://localhost:5293/api y hubUrl=http://localhost:5293/hubs/habitaciones. angular.json no define fileReplacements de producción ni otro mecanismo runtime de endpoints. Ambos endpoints se encontraron en el chunk de producción `chunk-645ZQLXC.js`.

**El build actual no está preparado para consumo de API/hub HTTPS de producción.** localhost apunta al equipo del visitante; desde una página HTTPS, HTTP también puede ser bloqueado como contenido mixto. Este hallazgo ya existía antes de las migraciones y no se corrigió por estar fuera del alcance de lectura.

El flag production=false de la aplicación no implica por sí solo que Angular esté sin optimizar: el CLI sí compiló en configuración production. No se halló uso de environment.production ni useMockApi para activar un flujo de desarrollo en los servicios activos. Aun así, falta una configuración explícita de endpoints y entorno de producción.

Plan previo a cualquier despliegue: obtener las URLs HTTPS reales de API y hub, definir su selección mediante el mecanismo de configuración que se acuerde, reconstruir y verificar que no quedan endpoints locales. No inventar dominios ni conectar pruebas de escritura a datos productivos.

### Bundle, secretos, source maps y dependencias efectivas

Inspección de **62 archivos públicos**: no hay .map ni referencias sourceMappingURL. El escaneo por patrones de claves privadas PEM, JWT con forma de token, claves AWS/Azure y cadenas SQL con contraseña no encontró coincidencias. **Es un escaneo limitado por patrones, no prueba absoluta de inexistencia de secretos.** No se imprimieron valores sensibles.

Los stats tienen 368 inputs. Paquetes presentes: @angular/common, core, forms, platform-browser, router; SignalR; Bootstrap e Icons; RxJS, tslib y Zone.js. CLI, SDK MCP, Karma, Vite y sus parsers no figuran como inputs. Dependencia declarada de producción no equivale a código efectivamente empaquetado. [Inspección reproducible del bundle](bundle-inspection.json).

Los archivos stats.json y licencias de build están fuera de browser/. Publicar únicamente los artefactos previstos para servir al navegador, no el directorio de diagnóstico completo. No se comprobó un hosting real ni su contenido público.

### Cabeceras: documentación propuesta, no aplicada

No se encontró configuración frontend de hosting para cabeceras ni CSP en index.html. No se hicieron peticiones a producción; las cabeceras HTTP reales son **no verificadas**, no se asegura que falten en un hosting externo.

| Control a validar en hosting | Base propuesta |
|---|---|
| HTTPS/HSTS | HTTPS obligatorio; Strict-Transport-Security después de verificar HTTPS y alcance de subdominios. |
| MIME | X-Content-Type-Options: nosniff. |
| Referer | Referrer-Policy: strict-origin-when-cross-origin. |
| Framing/CSP | frame-ancestors según uso autorizado; object-src none y base-uri self. |
| Scripts/estilos/conexiones | CSP primero en Report-Only; ajustar nonce/hashes/estilos inline y connect-src a API/hub reales, sin políticas ciegas que rompan Angular/Bootstrap. |
| Permisos del navegador | Permissions-Policy según funciones necesarias; no habilitar cámara/micrófono/geolocalización sin requisito. |
| Caché | Revisar HTML y respuestas autenticadas; assets con hash pueden tener caché inmutable. No alterar backend desde esta auditoría. |

Referencias: [seguridad Angular](https://angular.dev/best-practices/security) y [OWASP Secure Headers](https://owasp.org/projects/secure-headers-project). El JWT sigue en localStorage por el diseño existente: una ejecución XSS podría acceder a él; no se cambia el contrato de autenticación en esta tarea. CSP/Trusted Types requieren validación funcional antes de enforcement.

## L. Límites de integración y E2E

Las pruebas usan TestBed, HttpTestingController/provideHttpClientTesting, spies y dobles de SignalR. Incluso una suite titulada integración de inventario usa HTTP simulado: no es una prueba contra .NET o SQL. No se probaron navegador+API reales, permisos contra las 67 asignaciones de BD, doble cliente SignalR remoto, persistencia, concurrencia real, R2, cabeceras de hosting ni HTTPS público.

No se ejecutaron cargas adversariales ni ataques contra servidores públicos. Una siguiente validación real requeriría un entorno aislado y datos descartables autorizados. No se deduce cumplimiento de producción a partir de build o de audit omit=dev=0.

## M. Plan priorizado, pendiente de autorización

1. **P1 — Preparación de producción:** seleccionar configuración explícita de entorno y URLs HTTPS reales de API/hub, reconstruir e inspeccionar bundle. Revisar cabeceras y caché con el hosting, sin desplegar automáticamente.
2. **P1 — Desarrollo Windows:** validar Vite 7.3.7 en copia aislada con override dirigido, pruebas completas y smoke de servidor/editor. No instalar Angular 22 ni tocar otros paquetes para bajar contadores.
3. **P2 — Exposición de test:** proponer listenAddress=127.0.0.1 para Karma y comprobar acceso local/CI. No asumir que localhost en logs es binding restringido.
4. **P2 — Riesgos no parcheables y futuros:** mantener el registro de braces; estudiar sustitución conjunta de runner/cadena webpack solo con autorización. SDK 1.32.0 queda como evaluación separada si se amplía MCP o se busca eliminar deuda del SDK; no forzar UUID mayor cuando su flujo probado usa v4.
5. **P2 — Evidencia faltante:** pruebas E2E en entorno seguro y revisión visual/porcentajes de cobertura antes de declarar equivalencia funcional completa.

Para cada corrección: respaldo nuevo del estado real, cambio mínimo, comparación de grafo/avisos, npm ci, suite, verify y build; revisión antes de publicar. No se inicia ninguna de estas acciones sin autorización. El plan de Vite es una evaluación de compatibilidad, no una promesa de que el override esté validado.

## N. Estado SEC-03B-05

**AUDITORÍA COMPLETADA CON OBSERVACIONES.** Instalación y regresión técnica aprobadas; cero vulnerabilidades conocidas de producción en npm. Permanecen 16 paquetes vulnerables de desarrollo y un bloqueo de configuración para producción. No se declara seguridad total ni aprobación de despliegue.

Solo se crearon documentación y evidencias de auditoría, más los artefactos normales de npm ci/tests/build. Código, dependencias y configuración del sistema no cambiaron. No hubo commit/push, despliegue ni nuevas fases automáticas.

Evidencias adicionales: findings.json contiene la matriz completa por paquete con versiones/rutas, GHSA, padres/rangos, condiciones, parche, compatibilidad, mitigación y riesgo; inventory.json, integrity.json, backup-integrity.json, bundle-inspection.json y coverage-inventory.json acompañan este informe. Registros .log locales (excluidos por la regla Git existente): npm-ci, npm-ls, verify, angular-tests, production-build, exit-codes, inventarios de specs, estado Git y hashes iniciales. Los JSON audit/outdated/explain preservan respuestas del registro y cadenas inspeccionadas.
