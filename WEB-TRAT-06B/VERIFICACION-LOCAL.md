# WEB-TRAT-06B-2 — Verificación local de SQL Server Express

**Fecha:** 22/10/2026 (America/Guatemala). **Alcance:** solo lectura y revisión estática. La base aislada no existe; por instrucción, la preparación se detiene antes de crear objetos o configurar identidades. `WEB-TRAT-01` permanece bloqueado.

## 1. Instancia y edición identificadas

Codex ejecutó únicamente un `SELECT` de metadatos por memoria compartida (`lpc:.\SQLEXPRESS`), con autenticación integrada y base explícita `master`. Resultado directo del motor:

| Propiedad | Resultado |
|---|---|
| `@@SERVERNAME` | `DESKTOP-QTDJOHF\SQLEXPRESS` |
| `SERVERPROPERTY('MachineName')` | `DESKTOP-QTDJOHF` |
| `SERVERPROPERTY('InstanceName')` | `SQLEXPRESS` |
| `SERVERPROPERTY('Edition')` | `Express Edition (64-bit)` |
| `SERVERPROPERTY('EngineEdition')` | `4` |
| `SERVERPROPERTY('ProductVersion')` | `17.0.1145.4` |
| `DB_NAME()` | `master` |

La clave de registro local `SQLEXPRESS : MSSQL17.SQLEXPRESS` corrobora la instalación. La primera conexión dentro del sandbox no pudo abrir memoria compartida; la repetición autorizada fuera del sandbox respondió. Se especificó el transporte local `lpc:`: los comandos de Codex de esta fase no se dirigieron a Azure SQL. Esto no certifica las conexiones de otros procesos del equipo. No se utilizó `DefaultConnection` ni `aud_empresa`.

## 2. Estado de la base aislada

El `SELECT` sobre `sys.databases` con nombre exacto `ClinicaTratamiento_Aislado_06B` devolvió **cero filas**. La base no existe en la instancia consultada. Por ello no pueden verificarse sus tablas, ausencia de datos clínicos, permisos de base ni compatibilidad del DDL en motor. No se creó la base ni se ejecutó ningún script preparado.

## 3. Identidad y permisos

| Dato leído | Resultado |
|---|---|
| `ORIGINAL_LOGIN()` | `DESKTOP-QTDJOHF\DESARROLLO` |
| Autenticación | Integrada de Windows (`sqlcmd -E`); no se solicitó ni imprimió contraseña. |
| `USER_NAME()` en `master` | `dbo` |
| `IS_SRVROLEMEMBER('sysadmin')` | `1` |
| `HAS_PERMS_BY_NAME(NULL,NULL,'CREATE ANY DATABASE')` | `1` |

La identidad disponible posee privilegios amplios y **no** es adecuada como cuenta cotidiana de pruebas de la aplicación. No se creó ni modificó usuario o rol. Para una fase futura, el DBA deberá definir por separado: una identidad de aprovisionamiento autorizada para crear únicamente la base local y aplicar el DDL aprobado, y una identidad de pruebas limitada a la base sintética y las operaciones necesarias. La autorización del propietario debe nombrar instancia, base, objetos y pruebas permitidos. El estado de permisos dentro de la base todavía no es verificable porque esta no existe.

## 4. Revisión estática de scripts pendientes

| Script | Resultado de revisión | Estado |
|---|---|---|
| `PRECHECK-ENTORNO.sql` | Solo consultas de metadatos; comprueba servidor, instancia, edición, base, login, tablas y permisos. Identidad aprobada aún es marcador, por lo que falla cerrado antes del inventario. | No ejecutado. |
| `ESQUEMA-AISLADO.sql` | `THROW` como primera instrucción; marcador de identidad y guardas de destino. Siete estructuras base mínimas, sin `CREATE DATABASE`. | No ejecutado. |
| `DDL-EJECUCION-AISLADA.sql` | `THROW` inicial; guardas de destino/identidad. Contiene las siete tablas propuestas; el DDL fuente de `WEB-TRAT-06A` conserva su protección y no se modificó. | No ejecutado. |
| `PRUEBAS-INTEGRIDAD.sql` | `THROW` inicial; datos sintéticos y casos FK, CHECK, UNIQUE, índices filtrados, origen y relaciones. | No ejecutado. |
| `PRUEBAS-TRANSACCIONES.sql` | `THROW` inicial; casos preparados de COMMIT, ROLLBACK y concurrencia. | No ejecutado. |

Los cuatro scripts con escritura mantienen `THROW` inicial, no tienen lotes `GO` ni `CREATE DATABASE`, y conservan identidad pendiente que falla cerrado. El precheck es de solo lectura, pero tampoco se ejecutó en este paso; su destino de base aislada no existe. Esta revisión no equivale a validación sintáctica con motor ni a pruebas aprobadas.

## 5. Riesgos y autorizaciones adicionales

1. **Bloqueo inmediato:** falta `ClinicaTratamiento_Aislado_06B`; detener preparación aquí. Crear la base requiere autorización nueva y expresa. No utilizar `db_Clinica`, un respaldo con pacientes ni `script.sql` productivo.
2. **Privilegio excesivo:** el login Windows observado es `sysadmin`; el DBA debe aprobar y limitar las identidades de aprovisionamiento y prueba antes de ejecutar DDL/DML.
3. **Garantías clínicas pendientes:** la equivalencia farmacéutica, la igualdad entre consulta/diagnóstico/tratamiento y medicamento/lote, los estados y las correcciones siguen pendientes según `WEB-TRAT-06A`. Una prueba estructural futura no aprobaría por sí sola el flujo clínico.
4. **Ejecución futura:** solicitar autorización separada para crear la base local vacía, preparar las tablas base sintéticas, producir una copia ejecutable revisada del DDL y correr pruebas con datos sintéticos. Repetir el precheck de servidor, base, identidad y permisos **antes de cada escritura**. No retirar ahora ningún `THROW`.

## 6. Operaciones realizadas y estado

En este corte: consulta de metadatos de solo lectura a la instancia local, revisión de archivos y creación de **este informe**. DDL, INSERT, UPDATE, DELETE, migraciones, cambios de permisos, pruebas de escritura y conexiones a Azure SQL por Codex: **ninguno**. API-Clinica y WebClinica no se modificaron. La base productiva no fue objeto de ninguna operación de esta fase.

**Conclusión:** SQL Server Express local está disponible, pero el entorno **no está listo para ejecutar** DDL o pruebas: faltan la base aislada, identidad de prueba restringida y autorización expresa. Sí está listo para que el propietario y el DBA revisen una solicitud concreta de creación de la base local. WEB-TRAT-06B-2 queda cerrado como verificación de solo lectura, con preparación detenida por ausencia de la base.
