# WEB-TRAT-06B-3 — Creación controlada de base aislada

**Fecha:** 22/10/2026, zona America/Guatemala. **Resultado:** completado. La única instrucción SQL de modificación ejecutada fue `CREATE DATABASE [ClinicaTratamiento_Aislado_06B];` en la instancia local autorizada. No se ejecutaron los scripts de esquema, DDL o pruebas.

## 1. Verificación previa de solo lectura

Conexión explícita por memoria compartida a `lpc:.\SQLEXPRESS`, autenticación integrada y contexto `master`; no se usó `DefaultConnection` ni una conexión Azure. El motor devolvió:

| Metadato | Resultado |
|---|---|
| `@@SERVERNAME` | `DESKTOP-QTDJOHF\SQLEXPRESS` |
| `SERVERPROPERTY('MachineName')` | `DESKTOP-QTDJOHF` |
| `SERVERPROPERTY('InstanceName')` | `SQLEXPRESS` |
| `SERVERPROPERTY('EngineEdition')` | `4` |
| `SERVERPROPERTY('Edition')` | `Express Edition (64-bit)` |
| `DB_NAME()` | `master` |
| `ORIGINAL_LOGIN()` | `DESKTOP-QTDJOHF\DESARROLLO` |
| `IS_SRVROLEMEMBER('sysadmin')` | `1` |
| `COUNT_BIG(*)` en `sys.databases` con nombre exacto `ClinicaTratamiento_Aislado_06B` | `0` (no existía) |

La identidad era la cuenta Windows integrada ya identificada en WEB-TRAT-06B-2. Sus privilegios son amplios; esto **no** aprueba usarla para pruebas de aplicación. La cuenta restringida sigue pendiente de definición por DBA. No se leyeron filas clínicas ni credenciales.

## 2. Creación autorizada

Tras comprobar servidor, instancia, edición y ausencia de la base, se ejecutó desde `master` **solo**:

```sql
CREATE DATABASE [ClinicaTratamiento_Aislado_06B];
```

`sqlcmd` terminó con código `0` y sin mensaje de error. No se incluyó `USE`, `CREATE TABLE`, `CREATE USER`, `GRANT`, `INSERT`, `UPDATE`, `DELETE` ni otra instrucción de modificación. La fecha `create_date` informada por SQL Server es `2026-10-22T22:41:34.763` (hora local del servidor; coincidente con America/Guatemala en este equipo).

## 3. Verificación posterior de solo lectura

Nueva conexión explícita a `ClinicaTratamiento_Aislado_06B` por el mismo transporte local. El motor devolvió el servidor `DESKTOP-QTDJOHF\SQLEXPRESS`, `EngineEdition=4`, `DB_NAME()=ClinicaTratamiento_Aislado_06B` e identidad `DESKTOP-QTDJOHF\DESARROLLO`.

| Comprobación | Resultado |
|---|---|
| `sys.databases.name` exacto | `ClinicaTratamiento_Aislado_06B` |
| `state_desc` | `ONLINE` |
| Tablas de usuario (`sys.tables`, `is_ms_shipped=0`) | `0` |
| Objetos de aplicación (`sys.objects` tipos tabla/vista/procedimiento/función, `is_ms_shipped=0`) | `0` |
| Principales de base consultados | `dbo`, `guest`, `INFORMATION_SCHEMA`, `sys`; son principales del sistema. |

Una primera cuenta exploratoria mostró dos principales distintos de `dbo`/`guest`; la consulta nominal posterior identificó que eran `INFORMATION_SCHEMA` y `sys`. **No se creó usuario personalizado ni se asignó permiso** en esta intervención. Los permisos propios que SQL Server establezca al crear cualquier base no se presentan como cambios manuales.

## 4. Integridad, incidencias y límites

- Los comandos se dirigieron únicamente a `lpc:.\SQLEXPRESS`, instancia local. No hubo conexión de esta fase a Azure SQL ni operación sobre `db_Clinica`.
- No se modificaron API-Clinica, WebClinica, roles, permisos ni migraciones EF Core. No se ejecutaron `ESQUEMA-AISLADO.sql`, `DDL-EJECUCION-AISLADA.sql` ni los scripts de pruebas; sus barreras `THROW` permanecen intactas.
- No se utilizaron datos de pacientes. La base nueva no contiene tablas de usuario u objetos de aplicación según el catálogo consultado.
- Incidencia aclarada: los dos principales adicionales del inventario preliminar son `INFORMATION_SCHEMA` y `sys`, no usuarios creados para las pruebas.
- La verificación cubre las operaciones realizadas por Codex en esta fase; no es una auditoría de otros procesos del equipo. No se hicieron escrituras posteriores a la creación.

**Estado WEB-TRAT-06B-3:** completado. Crear tablas, cuentas de prueba o ejecutar DDL/DML requerirá autorización nueva y expresa. `WEB-TRAT-01` permanece bloqueado.
