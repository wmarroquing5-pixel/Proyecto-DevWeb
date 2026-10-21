# SEC-03B-01 — instalación reproducible

Fecha: 2026-10-21. Estado: COMPLETADO para preparación y validación; las vulnerabilidades siguen pendientes de las subfases de migración.

## A. Entorno

Node v22.23.4, npm 10.9.9 y `nvm current` v22.23.4. Git inicialmente limpio. Angular permanece en 18.2.14, CLI/build en 18.2.21, TypeScript en 5.5.4 y Zone.js en 0.14.10.

## B. Instalación

`npm ci` finalizó con código 0: 967 paquetes añadidos, 968 auditados. Primer intento falló con EPERM; el reintento autorizado fuera del sandbox terminó correctamente. No se ejecutó audit fix, update ni migraciones.

Antes de instalar se verificaron manifiestos coincidentes, ausencia de paquetes versionados en node_modules y ausencia de archivos sueltos en su raíz excepto .bin y .package-lock.json. No se encontraron mecanismos de parches en el manifiesto. Esto no constituye una comparación forense del contenido de todos los paquetes.

## C. Integridad

Hashes SHA256 idénticos antes y después:

- package.json: `32B68579872EE1ADA173E4E6073851D1F6FAFBCFE2C873E55FD279FD64997D41`
- package-lock.json: `C0B1C3898F182D1C8EE6950FCF3B5846AF083BE2FCD586898A678AC27DDA80FE`

`npm ls --depth=0`: código 0. Diferencias de versión entre paquetes presentes y lockfile: 55 antes, 0 después. Los paquetes opcionales de otras plataformas pueden estar ausentes legítimamente. No se ha demostrado la causa histórica exacta de la divergencia.

## D–E. Auditorías

| Auditoría | Resultado | Código |
|---|---|---|
| npm audit | 69: 7 low, 16 moderate, 43 high, 3 critical | 1 |
| npm audit --omit=dev | 8: 4 moderate, 4 high | 1 |

Ambos recuentos reproducen SEC-03A. El código 1 de las auditorías finales indica vulnerabilidades, no fallo de instalación. Los intentos iniciales dentro del sandbox fallaron por DNS ENOTFOUND; las consultas finales fuera del sandbox sí completaron. Los detalles y enlaces de cada aviso están en los registros completos.

## F. Validación funcional

`npm run verify`: código 0, 45 plantillas sin problemas y build correcto.

`npm test -- --watch=false --browsers=ChromeHeadless`: 478/478 SUCCESS, código 0 con Chrome Headless 155.0.0.0. Reproduce la línea base funcional. El intento inicial no pudo iniciar Chrome en el sandbox; se repitió fuera del sandbox sin modificar pruebas.

## G. Producción

`npm run build -- --configuration production`: código 0. Bundle inicial 734.27 kB, transferencia estimada 145.56 kB. Advertencia CSS por selector `.form-floating>~label`; no bloqueó el build.

## H–I. Alcance y cierre

Sin bloqueos para cerrar esta preparación. Persisten las vulnerabilidades documentadas. No se modificaron código frontend, backend, Azure SQL, JWT, RBAC ni R2; no hubo commit, push ni despliegue. No se inició SEC-03B-02. `git diff --check` pasó; manifiesto y lockfile no presentan diferencias Git.

La comparación con SEC-03A usa los valores proporcionados por el usuario; el informe original no se localizó en la revisión previa.

## Evidencias locales completas

Los archivos .log están excluidos de Git por la regla existente `*.log`; se conservan localmente junto a este informe:

- [Instalación inicial](npm-ci.log) y [reintento correcto](npm-ci-retry.log).
- [Árbol de dependencias](npm-ls.log).
- [Auditoría completa final](npm-audit-retry.log) y [producción final](npm-audit-production-retry.log).
- [Auditoría inicial con fallo DNS](npm-audit.log) y [producción inicial](npm-audit-production.log).
- [Verify](verify.log).
- [Pruebas iniciales](angular-tests.log) y [pruebas correctas](angular-tests-retry.log).
- [Build producción](production-build.log).
- [Códigos de validaciones](exit-codes.log).
