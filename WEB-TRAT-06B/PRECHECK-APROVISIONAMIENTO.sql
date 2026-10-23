/* WEB-TRAT-06B-4 — PRECHECK SOLO LECTURA, PREPARADO SIN EJECUTAR.
   Se protege también este archivo para evitar que se confunda una lectura
   futura con verificación ya realizada. Copia revisada y autorización nueva
   antes de ejecutar. No contiene DDL ni DML. No hay GO. */
THROW 51080, N'Precheck de aprovisionamiento aún no autorizado para ejecución.', 1;

SET NOCOUNT ON;
DECLARE @OperadorAprobado sysname = N'__OPERADOR_PENDIENTE__';
DECLARE @BaseEsperada sysname = N'ClinicaTratamiento_Aislado_06B';

SELECT @@SERVERNAME AS Servidor,
       CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) AS Maquina,
       CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) AS Instancia,
       CONVERT(nvarchar(128), SERVERPROPERTY('Edition')) AS Edicion,
       CONVERT(int, SERVERPROPERTY('EngineEdition')) AS EdicionMotor,
       DB_NAME() AS BaseActual,
       ORIGINAL_LOGIN() AS LoginOriginal,
       USER_NAME() AS UsuarioBase;

IF COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'') <> N'DESKTOP-QTDJOHF'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), N'') <> N'SQLEXPRESS'
   OR COALESCE(CONVERT(int, SERVERPROPERTY('EngineEdition')), -1) <> 4
   OR DB_NAME() <> @BaseEsperada
   OR @OperadorAprobado = N'__OPERADOR_PENDIENTE__'
   OR ORIGINAL_LOGIN() <> @OperadorAprobado
   OR NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = @BaseEsperada AND state_desc = N'ONLINE')
   OR COALESCE(HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'VIEW DEFINITION'), 0) <> 1
    THROW 51081, N'Servidor, edición, base, estado o identidad no aprobados.', 1;

SELECT COUNT_BIG(*) AS TablasUsuario FROM sys.tables WHERE is_ms_shipped = 0;
SELECT COUNT_BIG(*) AS ObjetosAplicacion FROM sys.objects
WHERE is_ms_shipped = 0 AND type IN (N'U', N'V', N'P', N'FN', N'IF', N'TF');
SELECT name AS Principal, type_desc AS TipoPrincipal
FROM sys.database_principals
WHERE name NOT IN (N'dbo', N'guest', N'INFORMATION_SCHEMA', N'sys')
ORDER BY name;
SELECT IS_SRVROLEMEMBER(N'sysadmin') AS EsSysadmin,
       IS_ROLEMEMBER(N'db_owner') AS EsDbOwner,
       IS_ROLEMEMBER(N'db_ddladmin') AS EsDbDdladmin,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CREATE TABLE') AS PuedeCrearTabla,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'VIEW DEFINITION') AS PuedeVerDefiniciones,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'ALTER') AS PuedeAlterarBase,
       HAS_PERMS_BY_NAME(N'dbo', N'SCHEMA', N'ALTER') AS PuedeAlterarDbo;

IF EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped = 0)
   OR EXISTS (SELECT 1 FROM sys.objects WHERE is_ms_shipped = 0
              AND type IN (N'U', N'V', N'P', N'FN', N'IF', N'TF'))
    THROW 51082, N'La base no está vacía; suspender el aprovisionamiento inicial.', 1;

/* Esta lectura no concede permisos ni certifica por sí sola que los grupos
   Windows existan o carezcan de acceso a otras bases. Verificarlo aparte. */
