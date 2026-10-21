# SEC-03B-03 — control previo de ejecución autorizada

Fecha: 2026-10-21. Estado: **BLOQUEADO antes de ejecutar la migración**.

## A. Versiones anteriores y nuevas

Node 22.23.4 y npm 10.9.9 confirmados. Permanecen Angular 19.2.25, CLI/build 19.2.27, TypeScript 5.5.4, Zone.js 0.15.1 y RxJS 7.8.2. No se instalaron versiones nuevas. Objetivo previamente consultado: framework/compiler-cli 20.3.34 y CLI/build 20.3.40.

## B. Dependencias modificadas

Ninguna en esta ejecución. No se ejecutó ng update, npm ci, npm update ni audit fix.

## C–D. Migraciones y archivos adaptados

No se aplicaron migraciones ni adaptaciones de código. Git muestra los mismos 46 archivos versionados modificados de SEC-03B-02; ninguno está fuera de WebClinica. Se registraron sus rutas y hashes actuales en [preflight-hashes.json](preflight-hashes.json) y el estado Git completo en preflight-status.log (registro local excluido por la regla existente *.log).

Esto documenta el estado actual, pero no reemplaza una copia recuperable ni demuestra equivalencia con los 185 archivos de la copia anterior.

## E. npm ci

No ejecutado: no se cumplió el requisito previo de verificar la copia de seguridad existente.

## F. TypeScript, RxJS y Zone.js

Sin cambios. La revisión anterior confirmó peers del objetivo Angular 20.3: TypeScript >=5.8 <6.0, Zone.js ~0.15.0 y RxJS ^6.5.3 o ^7.4.0. Esa actualización sigue pendiente.

## G–H. Pruebas y build

No ejecutados en esta continuación. Última evidencia disponible de SEC-03B-02: 478/478 pruebas, verify y build producción correctos. No se atribuyen esos resultados a Angular 20.

`git diff --check` ejecutado en el control previo: código 0.

## I. Auditoría

No se reejecutó en esta continuación. Línea base disponible: 43 vulnerabilidades totales y 8 de producción. No existe un resultado posterior a Angular 20 que comparar.

## J–K. Bloqueo y riesgos

El usuario condicionó la ejecución a verificar que la copia de 185 archivos siguiera disponible y que sus hashes SHA256 fueran válidos. No existe inventory.json en la ruta registrada:

`C:\Users\DESARROLLO\AppData\Local\Packages\sandbox.{2dab89fe-b85e-4814-b0b5-7ff8e66a6d40}\AC\Temp\SEC-03B-03-before-fAJsiS`

La lectura devolvió ENOENT. Una comprobación posterior fuera del sandbox devolvió Test-Path=False y no encontró una carpeta coincidente en ese directorio. No se conoce la causa exacta de su desaparición. El respaldo anterior se creó en una carpeta temporal, ubicación inadecuada para preservación entre ejecuciones.

Antes de continuar hace falta crear y verificar un respaldo nuevo en una ubicación persistente y autorizarlo como sustituto del anterior. No se afirma que se hayan verificado los 185 hashes históricos.

No se modificaron backend, SQL, JWT, RBAC, las 67 asignaciones, contratos REST ni R2 en esta ejecución. No se conectó a la base de datos ni se hizo un recuento nuevo de asignaciones. No se ejecutó reset, stash, clean, commit, push ni despliegue.

## L. Estado

**BLOQUEADO / NO COMPLETADO** por copia previa no disponible. Angular permanece en 19.2.25. SEC-03B-04 no iniciada. Los únicos archivos nuevos de esta continuación son documentación y evidencias de control previo.
