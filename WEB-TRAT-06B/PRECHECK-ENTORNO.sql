/* WEB-TRAT-06B-1 — CONSULTAS PREPARADAS, NO EJECUTADAS EN ESTE CORTE.
   Exclusivamente metadatos. No DDL, DML, procedimientos mutadores ni filas
   clínicas. Abrir directamente la base aislada aprobada; nunca db_Clinica.
   La identidad esperada permanece sin definir: el precheck falla cerrado. */
SET NOCOUNT ON;
DECLARE @BaseEsperada sysname = N'ClinicaTratamiento_Aislado_06B';
DECLARE @MaquinaEsperada sysname = N'DESKTOP-QTDJOHF';
DECLARE @InstanciaEsperada sysname = N'SQLEXPRESS';
DECLARE @LoginEsperado sysname = N'__IDENTIDAD_AUN_NO_APROBADA__';

SELECT @@SERVERNAME AS Servidor,
       CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) AS Maquina,
       CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) AS Instancia,
       CONVERT(nvarchar(128), SERVERPROPERTY('Edition')) AS Edicion,
       CONVERT(int, SERVERPROPERTY('EngineEdition')) AS EdicionMotor,
       CONVERT(nvarchar(128), SERVERPROPERTY('ProductVersion')) AS VersionMotor,
       DB_NAME() AS BaseActual,
       ORIGINAL_LOGIN() AS LoginOriginal,
       USER_NAME() AS UsuarioBase;

IF DB_NAME() <> @BaseEsperada
   OR CONVERT(int, SERVERPROPERTY('EngineEdition')) <> 4
   OR CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) <> @MaquinaEsperada
   OR CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) <> @InstanciaEsperada
   OR @LoginEsperado = N'__IDENTIDAD_AUN_NO_APROBADA__'
   OR ORIGINAL_LOGIN() <> @LoginEsperado
    THROW 51040, N'Precheck cerrado: servidor, edición, base o identidad no aprobados.', 1;

/* Solo se alcanzará tras una autorización futura que defina @LoginEsperado. */
SELECT s.name AS Esquema, t.name AS Tabla, t.create_date AS FechaCreacion
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
ORDER BY t.name;

SELECT ORIGINAL_LOGIN() AS LoginOriginal,
       USER_NAME() AS UsuarioBase,
       IS_SRVROLEMEMBER(N'sysadmin') AS EsSysadmin,
       IS_ROLEMEMBER(N'db_owner') AS EsDbOwner,
       IS_ROLEMEMBER(N'db_ddladmin') AS EsDbDdladmin,
       IS_ROLEMEMBER(N'db_datawriter') AS EsDbDatawriter,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CONNECT') AS PuedeConectar,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CREATE TABLE') AS PuedeCrearTabla,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'ALTER') AS PuedeAlterarBase,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CONTROL') AS PuedeControlarBase;

SELECT s.name AS Esquema, t.name AS Tabla,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + N'.' + QUOTENAME(t.name), N'OBJECT', N'SELECT') AS PuedeLeer,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + N'.' + QUOTENAME(t.name), N'OBJECT', N'INSERT') AS PuedeInsertar,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + N'.' + QUOTENAME(t.name), N'OBJECT', N'UPDATE') AS PuedeActualizar,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + N'.' + QUOTENAME(t.name), N'OBJECT', N'DELETE') AS PuedeEliminar,
       HAS_PERMS_BY_NAME(QUOTENAME(s.name) + N'.' + QUOTENAME(t.name), N'OBJECT', N'ALTER') AS PuedeAlterar
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
ORDER BY t.name;

/* Si la base aún no existe, no ejecutar esta consulta contra master: primero
   se requiere autorización independiente para crear una base nueva sintética. */
