/* WEB-TRAT-06B-1 — PRUEBAS TRANSACCIONALES BASICAS PREPARADAS; NO EJECUTAR.
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
    THROW 51031, N'Destino SQL no coincide con el entorno aislado.', 1;

SET NOCOUNT ON;
SET XACT_ABORT OFF;

/* T01: ROLLBACK explícito de fila sintética. */
BEGIN TRANSACTION;
INSERT dbo.Usuario DEFAULT VALUES;
DECLARE @RollbackId int = CONVERT(int, SCOPE_IDENTITY());
ROLLBACK TRANSACTION;
IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE IdUsuario = @RollbackId)
    THROW 51131, N'T01: quedó una fila tras ROLLBACK.', 1;
PRINT N'T01: ROLLBACK eliminó la fila sintética.';

/* T02: COMMIT de fila sintética y limpieza exacta posterior. */
BEGIN TRANSACTION;
INSERT dbo.Usuario DEFAULT VALUES;
DECLARE @CommitId int = CONVERT(int, SCOPE_IDENTITY());
COMMIT TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM dbo.Usuario WHERE IdUsuario = @CommitId)
    THROW 51132, N'T02: no se observó la fila confirmada.', 1;
DELETE FROM dbo.Usuario WHERE IdUsuario = @CommitId;
IF EXISTS (SELECT 1 FROM dbo.Usuario WHERE IdUsuario = @CommitId)
    THROW 51133, N'T02: no se limpió la fila sintética.', 1;
PRINT N'T02: COMMIT visible y limpieza sintética exacta.';

/* T03: error de FK tras escritura previa, rollback del conjunto. */
BEGIN TRANSACTION;
INSERT dbo.Usuario DEFAULT VALUES;
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

/* T05: plan e índices bajo carga. Capturar sys.indexes y planes en Express
   aislado; ensayar rangos de receta/línea y orden con Venta/ConsumoClinico.
   Requiere servicios/arnés adicional y se deja pendiente para WEB-TRAT-06B-2. */
