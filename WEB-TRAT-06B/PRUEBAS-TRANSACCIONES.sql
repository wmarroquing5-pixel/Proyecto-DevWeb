/* WEB-TRAT-C — PRUEBAS TRANSACCIONALES PREPARADAS; NO EJECUTAR.
   Solo SQL Server Express local y base aislada aprobada; nunca Azure SQL.
   No representan descuentos reales ni sustituyen pruebas de servicios C#.
   Requieren autorización y una identidad de pruebas de alcance restringido. */
THROW 51030, N'Pruebas transaccionales no autorizadas.', 1;

DECLARE @IdentidadAprobada sysname = N'__IDENTIDAD_PRUEBAS_AUN_NO_APROBADA__';
IF DB_NAME() <> N'ClinicaTratamiento_Aislado_06B'
   OR CONVERT(int, SERVERPROPERTY('EngineEdition')) <> 4
   OR CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) <> N'DESKTOP-QTDJOHF'
   OR CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) <> N'SQLEXPRESS'
   OR @IdentidadAprobada = N'__IDENTIDAD_PRUEBAS_AUN_NO_APROBADA__'
   OR ORIGINAL_LOGIN() <> @IdentidadAprobada
   OR COALESCE(IS_SRVROLEMEMBER(N'sysadmin'), 1) <> 0
   OR OBJECT_ID(N'dbo.CorreccionClinica', N'U') IS NOT NULL
   OR (SELECT COUNT_BIG(*) FROM sys.tables WHERE schema_id = SCHEMA_ID(N'dbo')
       AND name IN (N'Sucursal', N'Paciente', N'Empleado', N'Clinica', N'Rol',
       N'Categoria', N'Marca', N'Usuario', N'Consulta', N'Diagnostico',
       N'Medicamento', N'LoteMedicamento', N'Tratamiento', N'MovimientoInventario',
       N'RecetaClinica', N'RecetaLinea', N'EntregaFarmacia', N'EntregaDetalle',
       N'AdministracionClinica', N'SalidaClinica')) <> 20
    THROW 51031, N'Destino SQL no coincide con el entorno aislado.', 1;

SET NOCOUNT ON;
SET XACT_ABORT ON;

/* T01: ROLLBACK explícito de fila sintética. */
BEGIN TRANSACTION;
INSERT dbo.Rol DEFAULT VALUES;
DECLARE @RollbackRol int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Usuario(IdRol, Username, PasswordHash)
VALUES (@RollbackRol, CONCAT(N'rollback-', CONVERT(nvarchar(36), NEWID())), N'HASH-SINTETICO-NO-VALIDO');
DECLARE @RollbackId int = CONVERT(int, SCOPE_IDENTITY());
ROLLBACK TRANSACTION;
IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE IdUsuario = @RollbackId)
   OR EXISTS (SELECT 1 FROM dbo.Rol WHERE IdRol = @RollbackRol)
    THROW 51131, N'T01: quedó una fila tras ROLLBACK.', 1;
PRINT N'T01: ROLLBACK eliminó la fila sintética.';

/* T02: COMMIT de fila sintética y limpieza exacta posterior. */
BEGIN TRANSACTION;
INSERT dbo.Rol DEFAULT VALUES;
DECLARE @CommitRol int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Usuario(IdRol, Username, PasswordHash)
VALUES (@CommitRol, CONCAT(N'commit-', CONVERT(nvarchar(36), NEWID())), N'HASH-SINTETICO-NO-VALIDO');
DECLARE @CommitId int = CONVERT(int, SCOPE_IDENTITY());
COMMIT TRANSACTION;
DECLARE @CommitVisible bit = CASE WHEN EXISTS
    (SELECT 1 FROM dbo.Usuario WHERE IdUsuario = @CommitId) THEN 1 ELSE 0 END;
BEGIN TRANSACTION;
DELETE FROM dbo.Usuario WHERE IdUsuario = @CommitId;
DELETE FROM dbo.Rol WHERE IdRol = @CommitRol;
COMMIT TRANSACTION;
IF @CommitVisible <> 1
    THROW 51132, N'T02: no se observó la fila confirmada.', 1;
IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE IdUsuario = @CommitId)
   OR EXISTS (SELECT 1 FROM dbo.Rol WHERE IdRol = @CommitRol)
    THROW 51133, N'T02: no se limpió la fila sintética.', 1;
PRINT N'T02: COMMIT visible y limpieza sintética exacta.';

/* T03: error de FK tras escritura previa, rollback del conjunto. */
BEGIN TRANSACTION;
INSERT dbo.Rol DEFAULT VALUES;
DECLARE @ErrorRol int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Usuario(IdRol, Username, PasswordHash)
VALUES (@ErrorRol, CONCAT(N'error-', CONVERT(nvarchar(36), NEWID())), N'HASH-SINTETICO-NO-VALIDO');
DECLARE @ErrorId int = CONVERT(int, SCOPE_IDENTITY());
BEGIN TRY
    INSERT dbo.RecetaClinica(IdTratamiento, IdDiagnostico, IdUsuarioPrescriptor,
        NumeroVersion, Estado, FechaPrescripcionUtc, ClaveOperacion, HashSolicitud)
    VALUES (2147483647, 2147483647, @ErrorId, 1, N'Vigente',
        SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x01));
    ROLLBACK TRANSACTION;
    THROW 51134, N'T03: se aceptó una FK imposible.', 1;
END TRY
BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
END CATCH;
IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE IdUsuario = @ErrorId)
   OR EXISTS (SELECT 1 FROM dbo.Rol WHERE IdRol = @ErrorRol)
    THROW 51135, N'T03: quedó una fila parcial tras el error.', 1;
PRINT N'T03: error FK produjo reversión completa del fixture.';

/* T04: concurrencia UNIQUE de Idempotency-Key.
   Requiere DOS sesiones manuales con receta/usuario sintéticos autorizados:
   A inicia transacción, inserta EntregaFarmacia con UUID fijo y retiene COMMIT.
   B intenta el MISMO UUID desde otra conexión. Comprobar bloqueo y, tras COMMIT A,
   error 2601/2627 en B; si A hace ROLLBACK, B podrá confirmar una sola fila.
   Registrar tiempos, @@SPID, lock waits y recuento final. No automatizar con
   el login sysadmin actual ni afirmar resultado antes de realizar el ensayo.
   El resultado no prueba aún descuento de inventario ni hash de respuesta. */

/* T05: consultas de catálogo e índices de las seis tablas de alternativa C.
   Requiere servicios/arnés adicional y autorización; no cubre correcciones,
   devoluciones, reintegros ni conversiones farmacéuticas pendientes. */
