# WEB-TRAT-06B-1 — Precheck de entorno, sin escrituras

**Fecha:** 22/10/2026 (America/Guatemala). **Estado:** `PRECHECK-ENTORNO.sql` preparado **sin ejecutarlo**. Los datos de instancia siguientes proceden de una consulta de solo lectura realizada en el turno anterior; en esta intervención no se abrió conexión ni se ejecutó SQL. No se creó la base.

## Evidencia histórica de Codex, turno anterior

Se invocó `SQLCMD.EXE` mediante autenticación integrada **solo** con `-S localhost\SQLEXPRESS -d master` y un `SELECT` de metadatos; la primera llamada en sandbox agotó el tiempo de espera y la repetición autorizada fuera de sandbox respondió. No se utilizó cadena ni credenciales de Azure.

| Dato | Resultado leído del motor local |
|---|---|
| `@@SERVERNAME` | `DESKTOP-QTDJOHF\SQLEXPRESS` |
| `SERVERPROPERTY('MachineName')` | `DESKTOP-QTDJOHF` |
| `SERVERPROPERTY('InstanceName')` | `SQLEXPRESS` |
| `SERVERPROPERTY('Edition')` | `Express Edition (64-bit)` |
| `SERVERPROPERTY('EngineEdition')` | `4` |
| `SERVERPROPERTY('ProductVersion')` | `17.0.1145.4` |
| `DB_NAME()` / base conectada | `master` |
| `ORIGINAL_LOGIN()` | `DESKTOP-QTDJOHF\DESARROLLO` |
| `USER_NAME()` | `dbo` |
| `IS_SRVROLEMEMBER('sysadmin')` | `1` |
| `sys.databases` filtrado por nombre exacto `ClinicaTratamiento_Aislado_06B` | **Sin filas**: la base propuesta no existe actualmente. |

El registro local anunció `SQLEXPRESS : MSSQL17.SQLEXPRESS`; el dato del motor anterior fue la verificación efectiva entonces. `Get-Service` no pudo leer Service Control Manager con el nivel de acceso disponible, pero la consulta SQL previa demostró que la instancia respondió. Esa evidencia no se presenta como ejecución del nuevo `PRECHECK-ENTORNO.sql` ni como estado actual garantizado. La identidad integrada observada tenía privilegio **sysadmin**, excesivo para la batería de aplicación; se recomienda una identidad de pruebas restringida. El aprovisionamiento inicial, si se autoriza, requiere responsable DBA y control separado.

## Precheck preparado en esta intervención, no ejecutado

[`PRECHECK-ENTORNO.sql`](PRECHECK-ENTORNO.sql) muestra servidor, máquina, instancia, edición, base y login con metadatos; luego exige base exacta `ClinicaTratamiento_Aislado_06B`, máquina `DESKTOP-QTDJOHF`, instancia `SQLEXPRESS`, `EngineEdition=4` e identidad aprobada. El valor de identidad es un marcador no aprobado, por lo que **falla cerrado** hasta una autorización nueva. Solo tras esa barrera enumera `sys.tables` y permisos efectivos relevantes (`HAS_PERMS_BY_NAME`, roles de base y sysadmin). No lee filas clínicas ni contiene DDL/DML.

## Procedencia y límites

- `DB-AUDIT-AZURE-02/FINAL.md` contiene evidencia de Azure obtenida **por el usuario desde SSMS**; no forma parte de esta conexión local de Codex. El `script.sql` del escritorio es referencia documental y contiene `USE [db_Clinica]`; no se ejecutó.
- En la consulta anterior la base aislada **no existía**. No se puede demostrar todavía su ausencia de filas clínicas, sus permisos efectivos ni sus tablas. Debe nacer vacía y sintética; no se admite restaurar una copia clínica. Aquella conexión fue a `master`, sin inspección de filas de pacientes.
- Se verificó el destino explícito de los comandos efectuados por Codex. Esto no prueba que ningún otro proceso del equipo tenga conexiones a Azure; el futuro arnés debe estar configurado únicamente para loopback y repetir el preflight antes de toda escritura.
- La edición Express y la identidad se observaron por SELECT **en el turno anterior**. En esta intervención no se abrió conexión ni se ejecutó siquiera un SELECT; tampoco DDL, DML, migraciones ni pruebas.

## Puerta previa a cualquier escritura

El propietario debe autorizar expresamente **servidor `DESKTOP-QTDJOHF\SQLEXPRESS`, base nueva exacta `ClinicaTratamiento_Aislado_06B`, creación de base, siete tablas base sintéticas, siete tablas propuestas, datos sintéticos y pruebas con ROLLBACK/COMMIT**. Debe quedar claro que Azure SQL y `db_Clinica` quedan excluidas. El DBA debe aprobar la identidad de aprovisionamiento y una identidad de prueba restringida. Después de crear la base, repetir SELECT de servidor, edición, base, login y permisos antes de retirar cualquier barrera `THROW`. Si la identidad o el destino difieren, detenerse.

**Estado:** script de precheck preparado; su ejecución y el precheck de base, datos y permisos restringidos siguen pendientes. El corte documental WEB-TRAT-06B-1 puede declararse preparado, nunca validado estructuralmente en motor.
