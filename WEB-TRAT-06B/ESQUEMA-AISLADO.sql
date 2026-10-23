/* WEB-TRAT-06B-1 — PREPARADO, NO EJECUTAR.
   Soporte MINIMO para pruebas de FK en una futura base local nueva.
   No replica el esquema clínico completo ni valida reglas de negocio.
   Requiere aprobación expresa y revisión DBA. Nunca usar script.sql ni db_Clinica.
   El THROW es la primera instrucción SQL y no hay separadores GO. */
THROW 51010, N'Esquema aislado preparado; falta autorización de ejecución.', 1;

DECLARE @IdentidadAprobada sysname = N'__IDENTIDAD_DDL_AUN_NO_APROBADA__';
IF DB_NAME() <> N'ClinicaTratamiento_Aislado_06B'
   OR CONVERT(int, SERVERPROPERTY('EngineEdition')) <> 4
   OR CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) <> N'DESKTOP-QTDJOHF'
   OR CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) <> N'SQLEXPRESS'
   OR @IdentidadAprobada = N'__IDENTIDAD_DDL_AUN_NO_APROBADA__'
   OR ORIGINAL_LOGIN() <> @IdentidadAprobada
    THROW 51011, N'Destino SQL no coincide con el entorno aislado aprobado.', 1;

/* STUBS sintéticos: únicamente claves/tipos y restricciones relevantes.
   No sustituyen el cotejo futuro del esquema real ni admiten datos clínicos. */
CREATE TABLE dbo.Usuario (
    IdUsuario int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Usuario PRIMARY KEY
);
CREATE TABLE dbo.Consulta (
    IdConsulta int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Consulta PRIMARY KEY,
    IdPaciente int NOT NULL,
    IdMedico int NOT NULL,
    IdSucursal int NOT NULL
);
CREATE TABLE dbo.Diagnostico (
    IdDiagnostico int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Diagnostico PRIMARY KEY,
    IdConsulta int NOT NULL,
    Descripcion nvarchar(300) NOT NULL,
    CONSTRAINT FK_Test_Diagnostico_Consulta FOREIGN KEY (IdConsulta) REFERENCES dbo.Consulta(IdConsulta)
);
CREATE TABLE dbo.Tratamiento (
    IdTratamiento int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Tratamiento PRIMARY KEY,
    IdConsulta int NOT NULL,
    IdLote int NULL,
    Cantidad smallint NULL,
    CONSTRAINT FK_Test_Tratamiento_Consulta FOREIGN KEY (IdConsulta) REFERENCES dbo.Consulta(IdConsulta)
);
CREATE TABLE dbo.Medicamento (
    IdMedicamento int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Medicamento PRIMARY KEY,
    Presentacion nvarchar(100) NULL
);
CREATE TABLE dbo.LoteMedicamento (
    IdLote int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Lote PRIMARY KEY,
    IdMedicamento int NOT NULL,
    CantidadDisponible int NOT NULL,
    CONSTRAINT FK_Test_Lote_Medicamento FOREIGN KEY (IdMedicamento) REFERENCES dbo.Medicamento(IdMedicamento),
    CONSTRAINT CK_Test_Lote_Cantidad CHECK (CantidadDisponible >= 0)
);
CREATE TABLE dbo.MovimientoInventario (
    IdMovimiento int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Movimiento PRIMARY KEY,
    IdLote int NOT NULL,
    IdUsuario int NOT NULL,
    IdSucursal int NOT NULL,
    TipoMovimiento nvarchar(30) NOT NULL,
    Cantidad int NOT NULL,
    CONSTRAINT FK_Test_Movimiento_Lote FOREIGN KEY (IdLote) REFERENCES dbo.LoteMedicamento(IdLote),
    CONSTRAINT FK_Test_Movimiento_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario),
    CONSTRAINT CK_Test_Movimiento_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Test_Movimiento_Tipo CHECK (TipoMovimiento IN
        (N'Entrada', N'Venta Publica', N'Uso Interno', N'Ajuste', N'Vencimiento'))
);

/* No CREATE DATABASE, USE, datos reales ni cambios de tablas existentes. */
