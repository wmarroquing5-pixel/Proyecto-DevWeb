/* WEB-TRAT-C — PRUEBAS SINTETICAS PREPARADAS; NO EJECUTAR.
   Requieren autorización posterior, base exacta, catorce tablas sintéticas y
   seis tablas de alternativa C creadas. El THROW inicial impide escrituras.
   Todo el fixture usa IDs/nombres ficticios y se revierte al final.
   No comprueba inventario clínico ni equivalencia farmacéutica. */
THROW 51020, N'Pruebas de integridad no autorizadas.', 1;

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
    THROW 51021, N'Destino SQL no coincide con el entorno aislado.', 1;

SET NOCOUNT ON;
SET XACT_ABORT OFF;
BEGIN TRY
BEGIN TRANSACTION;

INSERT dbo.Sucursal DEFAULT VALUES;
DECLARE @Sucursal int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Paciente DEFAULT VALUES;
DECLARE @Paciente int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Empleado(IdSucursal) VALUES (@Sucursal);
DECLARE @Medico int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Rol DEFAULT VALUES;
DECLARE @Rol int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Categoria DEFAULT VALUES;
DECLARE @Categoria int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Marca DEFAULT VALUES;
DECLARE @Marca int = CONVERT(int, SCOPE_IDENTITY());

INSERT dbo.Usuario(IdRol, IdEmpleado, Username, PasswordHash)
VALUES (@Rol, @Medico, CONCAT(N'prueba-06b-', CONVERT(nvarchar(36), NEWID())), N'HASH-SINTETICO-NO-VALIDO');
DECLARE @Usuario int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Consulta(IdPaciente, IdMedico, IdSucursal, FechaConsulta)
VALUES (@Paciente, @Medico, @Sucursal, SYSUTCDATETIME());
DECLARE @Consulta int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Diagnostico(IdConsulta, Descripcion) VALUES (@Consulta, N'Diagnóstico sintético de prueba');
DECLARE @Diagnostico int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Tratamiento(IdConsulta, Descripcion, FechaInicio)
VALUES (@Consulta, N'Tratamiento sintético A', CONVERT(date, SYSUTCDATETIME()));
DECLARE @Tratamiento1 int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Tratamiento(IdConsulta, Descripcion, FechaInicio)
VALUES (@Consulta, N'Tratamiento sintético B', CONVERT(date, SYSUTCDATETIME()));
DECLARE @Tratamiento2 int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.Medicamento(IdCategoria, IdMarca, Codigo, Nombre, PrecioVenta, Presentacion)
VALUES (@Categoria, @Marca, CONCAT(N'MED-', CONVERT(nvarchar(36), NEWID())),
    N'Medicamento sintético', 1.00, N'Presentación sintética no validada');
DECLARE @Medicamento int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.LoteMedicamento(IdMedicamento, NumeroLote, FechaIngreso, FechaVencimiento, CantidadDisponible)
VALUES (@Medicamento, CONCAT(N'LOTE-', CONVERT(nvarchar(36), NEWID())),
    CONVERT(date, SYSUTCDATETIME()), DATEADD(year, 1, CONVERT(date, SYSUTCDATETIME())), 10);
DECLARE @Lote int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.LoteMedicamento(IdMedicamento, NumeroLote, FechaIngreso, FechaVencimiento, CantidadDisponible)
VALUES (@Medicamento, CONCAT(N'LOTE-', CONVERT(nvarchar(36), NEWID())),
    CONVERT(date, SYSUTCDATETIME()), DATEADD(year, 1, CONVERT(date, SYSUTCDATETIME())), 10);
DECLARE @Lote2 int = CONVERT(int, SCOPE_IDENTITY());

DECLARE @ClaveEntrega uniqueidentifier = NEWID();
INSERT dbo.RecetaClinica(IdTratamiento, IdDiagnostico, IdUsuarioPrescriptor,
    NumeroVersion, Estado, FechaPrescripcionUtc, ClaveOperacion, HashSolicitud)
VALUES (@Tratamiento1, @Diagnostico, @Usuario, 1, N'Vigente', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x01));
DECLARE @Receta1 int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.RecetaClinica(IdTratamiento, IdDiagnostico, IdUsuarioPrescriptor,
    NumeroVersion, Estado, FechaPrescripcionUtc, ClaveOperacion, HashSolicitud)
VALUES (@Tratamiento2, @Diagnostico, @Usuario, 1, N'Vigente', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x02));
DECLARE @Receta2 int = CONVERT(int, SCOPE_IDENTITY());

INSERT dbo.RecetaLinea(IdReceta, IdMedicamento, Orden, CantidadPrescritaUnidades,
    UnidadInventario, Dosis, UnidadDosis, Via, Frecuencia, DuracionDias)
VALUES (@Receta1, @Medicamento, 1, 10, N'unidad sintética', 1, N'unidad sintética',
    N'vía de prueba', N'pauta de prueba', 1);
DECLARE @Linea1 int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.RecetaLinea(IdReceta, IdMedicamento, Orden, CantidadPrescritaUnidades,
    UnidadInventario, Dosis, UnidadDosis, Via, Frecuencia, DuracionDias)
VALUES (@Receta2, @Medicamento, 1, 10, N'unidad sintética', 1, N'unidad sintética',
    N'vía de prueba', N'pauta de prueba', 1);
DECLARE @Linea2 int = CONVERT(int, SCOPE_IDENTITY());

INSERT dbo.EntregaFarmacia(IdReceta, IdUsuarioResponsable, FechaConfirmacionUtc,
    ClaveOperacion, HashSolicitud)
VALUES (@Receta1, @Usuario, SYSUTCDATETIME(), @ClaveEntrega, CONVERT(binary(32), 0x03));
DECLARE @Entrega int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.EntregaDetalle(IdEntrega, IdReceta, IdRecetaLinea, IdLote, CantidadEntregadaUnidades)
VALUES (@Entrega, @Receta1, @Linea1, @Lote, 2);
DECLARE @Detalle int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.MovimientoInventario(IdLote, IdUsuario, IdSucursal, TipoMovimiento, Cantidad)
VALUES (@Lote, @Usuario, @Sucursal, N'Uso Interno', 2);
DECLARE @Movimiento1 int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.SalidaClinica(IdMovimiento, IdEntregaDetalle)
VALUES (@Movimiento1, @Detalle);

INSERT dbo.AdministracionClinica(IdRecetaLinea, IdUsuarioResponsable, Origen,
    IdLote, CantidadUnidades, DosisAplicada, UnidadDosis, Via,
    FechaAdministracionUtc, ClaveOperacion, HashSolicitud)
VALUES (@Linea1, @Usuario, N'InventarioDirecto', @Lote, 1, 1,
    N'unidad sintética', N'vía de prueba', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x04));
DECLARE @Administracion int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.MovimientoInventario(IdLote, IdUsuario, IdSucursal, TipoMovimiento, Cantidad)
VALUES (@Lote, @Usuario, @Sucursal, N'Uso Interno', 1);
DECLARE @Movimiento2 int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.SalidaClinica(IdMovimiento, IdAdministracion, OrigenAdministracion)
VALUES (@Movimiento2, @Administracion, N'InventarioDirecto');
INSERT dbo.AdministracionClinica(IdRecetaLinea, IdUsuarioResponsable, Origen,
    IdEntregaDetalle, CantidadUnidades, DosisAplicada, UnidadDosis, Via,
    FechaAdministracionUtc, ClaveOperacion, HashSolicitud)
VALUES (@Linea1, @Usuario, N'EntregaPrevia', @Detalle, 1, 1,
    N'unidad sintética', N'vía de prueba', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x0A));
PRINT N'ESTRUCTURA-POSITIVA: fixture sintético insertado dentro de transacción reversible';

/* I01: FK de tratamiento inexistente. Esperado 547. */
BEGIN TRY
    INSERT dbo.RecetaClinica(IdTratamiento, IdDiagnostico, IdUsuarioPrescriptor,
        NumeroVersion, Estado, FechaPrescripcionUtc, ClaveOperacion, HashSolicitud)
    VALUES (2147483647, @Diagnostico, @Usuario, 1, N'Vigente', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x05));
    THROW 51101, N'I01 aceptó FK inválida.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I01 rechazo FK inválida: 547';
END CATCH;

/* I02: CHECK de cantidad cero. Esperado 547. */
BEGIN TRY
    INSERT dbo.EntregaDetalle(IdEntrega, IdReceta, IdRecetaLinea, IdLote, CantidadEntregadaUnidades)
    VALUES (@Entrega, @Receta1, @Linea1, @Lote2, 0);
    THROW 51102, N'I02 aceptó cantidad cero.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I02 rechazo cantidad cero: 547';
END CATCH;

/* I03: línea de otra receta en una entrega. Esperado 547. */
BEGIN TRY
    INSERT dbo.EntregaDetalle(IdEntrega, IdReceta, IdRecetaLinea, IdLote, CantidadEntregadaUnidades)
    VALUES (@Entrega, @Receta1, @Linea2, @Lote, 1);
    THROW 51103, N'I03 aceptó línea de otra receta.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I03 rechazo FK compuesta: 547';
END CATCH;

/* I04: administración de entrega con línea ajena. Esperado 547. */
BEGIN TRY
    INSERT dbo.AdministracionClinica(IdRecetaLinea, IdUsuarioResponsable, Origen,
        IdEntregaDetalle, CantidadUnidades, DosisAplicada, UnidadDosis, Via,
        FechaAdministracionUtc, ClaveOperacion, HashSolicitud)
    VALUES (@Linea2, @Usuario, N'EntregaPrevia', @Detalle, 1, 1,
        N'unidad sintética', N'vía de prueba', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x06));
    THROW 51104, N'I04 aceptó detalle de otra línea.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I04 rechazo FK compuesta: 547';
END CATCH;

/* I05: CHECK de origen mixto. Esperado 547. */
BEGIN TRY
    INSERT dbo.AdministracionClinica(IdRecetaLinea, IdUsuarioResponsable, Origen,
        IdEntregaDetalle, IdLote, CantidadUnidades, DosisAplicada, UnidadDosis, Via,
        FechaAdministracionUtc, ClaveOperacion, HashSolicitud)
    VALUES (@Linea1, @Usuario, N'EntregaPrevia', @Detalle, @Lote, 1, 1,
        N'unidad sintética', N'vía de prueba', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x07));
    THROW 51105, N'I05 aceptó origen mixto.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I05 rechazo CHECK de origen: 547';
END CATCH;

/* I06: UUID duplicado de entrega. Esperado 2601 o 2627. */
BEGIN TRY
    INSERT dbo.EntregaFarmacia(IdReceta, IdUsuarioResponsable, FechaConfirmacionUtc,
        ClaveOperacion, HashSolicitud)
    VALUES (@Receta1, @Usuario, SYSUTCDATETIME(), @ClaveEntrega, CONVERT(binary(32), 0x08));
    THROW 51106, N'I06 aceptó UUID duplicado.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
    PRINT N'I06 rechazo UUID duplicado: 2601/2627';
END CATCH;

/* I07: NULL en OrigenAdministracion antes aceptable por UNKNOWN. Esperado 547. */
INSERT dbo.MovimientoInventario(IdLote, IdUsuario, IdSucursal, TipoMovimiento, Cantidad)
VALUES (@Lote, @Usuario, @Sucursal, N'Uso Interno', 1);
DECLARE @Movimiento3 int = CONVERT(int, SCOPE_IDENTITY());
INSERT dbo.AdministracionClinica(IdRecetaLinea, IdUsuarioResponsable, Origen,
    IdLote, CantidadUnidades, DosisAplicada, UnidadDosis, Via,
    FechaAdministracionUtc, ClaveOperacion, HashSolicitud)
VALUES (@Linea1, @Usuario, N'InventarioDirecto', @Lote, 1, 1,
    N'unidad sintética', N'vía de prueba', SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x0B));
DECLARE @AdministracionSinSalida int = CONVERT(int, SCOPE_IDENTITY());
BEGIN TRY
    INSERT dbo.SalidaClinica(IdMovimiento, IdAdministracion, OrigenAdministracion)
    VALUES (@Movimiento3, @AdministracionSinSalida, NULL);
    THROW 51107, N'I07 aceptó origen de salida NULL.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I07 rechazo origen NULL: 547';
END CATCH;

/* I08: mismo movimiento vinculado dos veces. Esperado 2601/2627. */
BEGIN TRY
    INSERT dbo.SalidaClinica(IdMovimiento, IdEntregaDetalle)
    VALUES (@Movimiento1, @Detalle);
    THROW 51108, N'I08 aceptó movimiento duplicado.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
    PRINT N'I08 rechazo movimiento duplicado: 2601/2627';
END CATCH;

/* I09: estado de receta no permitido. Esperado 547. */
BEGIN TRY
    INSERT dbo.RecetaClinica(IdTratamiento, IdDiagnostico, IdUsuarioPrescriptor,
        NumeroVersion, Estado, FechaPrescripcionUtc, ClaveOperacion, HashSolicitud)
    VALUES (@Tratamiento2, @Diagnostico, @Usuario, 2, N'EstadoInvalido',
        SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x09));
    THROW 51109, N'I09 aceptó estado inválido.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I09 rechazo estado inválido: 547';
END CATCH;

/* I10: índice UNIQUE filtrado: segunda receta Vigente del mismo tratamiento.
   La versión es distinta para aislar el índice filtrado. Esperado 2601/2627. */
BEGIN TRY
    INSERT dbo.RecetaClinica(IdTratamiento, IdDiagnostico, IdUsuarioPrescriptor,
        NumeroVersion, Estado, FechaPrescripcionUtc, ClaveOperacion, HashSolicitud)
    VALUES (@Tratamiento1, @Diagnostico, @Usuario, 2, N'Vigente',
        SYSUTCDATETIME(), NEWID(), CONVERT(binary(32), 0x0C));
    THROW 51110, N'I10 aceptó segunda receta vigente.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
    PRINT N'I10 rechazo segunda Vigente: 2601/2627';
END CATCH;

/* I11: índice UNIQUE filtrado: misma EntregaDetalle con otro movimiento.
   @Movimiento3 quedó libre porque I07 fue rechazado. Esperado 2601/2627. */
BEGIN TRY
    INSERT dbo.SalidaClinica(IdMovimiento, IdEntregaDetalle)
    VALUES (@Movimiento3, @Detalle);
    THROW 51111, N'I11 aceptó segunda salida de detalle.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() NOT IN (2601, 2627) THROW;
    PRINT N'I11 rechazo segunda salida de detalle: 2601/2627';
END CATCH;

/* I12: FK compuesta impide atribuir salida a una administración de otro origen.
   @AdministracionSinSalida es InventarioDirecto; se declara EntregaPrevia.
   Esperado 547. */
BEGIN TRY
    INSERT dbo.SalidaClinica(IdMovimiento, IdAdministracion, OrigenAdministracion)
    VALUES (@Movimiento3, @AdministracionSinSalida, N'EntregaPrevia');
    THROW 51112, N'I12 aceptó salida de origen incorrecto.', 1;
END TRY BEGIN CATCH
    IF ERROR_NUMBER() <> 547 THROW;
    PRINT N'I12 rechazo origen incorrecto: 547';
END CATCH;

/* I13: regla NO protegida por las FK actuales — lote de otro medicamento.
   Preparar observación en entorno aislado; no interpretar aceptación como válida.
   Su ejecución aún no se habilita por falta de política y servicio C#.
   El informe deberá registrar que esta igualdad no la garantiza el DDL. */

ROLLBACK TRANSACTION;
PRINT N'Fixture sintético revertido; no se conservaron filas de prueba.';
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
