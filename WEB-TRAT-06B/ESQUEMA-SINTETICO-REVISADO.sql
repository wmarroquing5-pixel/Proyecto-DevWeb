/* WEB-TRAT-06B-4 — PROPUESTA DE ESQUEMA SINTÉTICO; NO EJECUTAR.
   Primera instrucción SQL: barrera permanente de esta copia. No hay GO.
   Únicamente una futura copia nueva con autorización específica podría
   ejecutarse contra ClinicaTratamiento_Aislado_06B. Nunca usar script.sql.
   Catorce tablas: siete bases funcionales + siete padres mínimos de FK.
   No contiene pacientes, credenciales, datos ni permisos. */
THROW 51070, N'Esquema sintético revisado: ejecución no autorizada.', 1;

DECLARE @AprovisionadorAprobado sysname = N'__IDENTIDAD_DDL_PENDIENTE__';
IF COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), N'') <> N'DESKTOP-QTDJOHF'
   OR COALESCE(CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), N'') <> N'SQLEXPRESS'
   OR COALESCE(CONVERT(int, SERVERPROPERTY('EngineEdition')), -1) <> 4
   OR DB_NAME() <> N'ClinicaTratamiento_Aislado_06B'
   OR @AprovisionadorAprobado = N'__IDENTIDAD_DDL_PENDIENTE__'
   OR ORIGINAL_LOGIN() <> @AprovisionadorAprobado
   OR EXISTS (SELECT 1 FROM sys.tables WHERE is_ms_shipped = 0)
    THROW 51071, N'Entorno, identidad o base vacía no aprobados.', 1;

/* Padres auxiliares: solo PK y columnas necesarias para las FK consideradas.
   No sustituyen las tablas productivas ni soportan ejecutar la API completa. */
CREATE TABLE dbo.Sucursal (
    IdSucursal int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Sucursal PRIMARY KEY
);
CREATE TABLE dbo.Paciente (
    IdPaciente int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Paciente PRIMARY KEY
);
CREATE TABLE dbo.Empleado (
    IdEmpleado int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Empleado PRIMARY KEY,
    IdSucursal int NOT NULL,
    CONSTRAINT FK_Test_Empleado_Sucursal FOREIGN KEY (IdSucursal)
        REFERENCES dbo.Sucursal(IdSucursal)
);
CREATE TABLE dbo.Clinica (
    IdClinica int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Clinica PRIMARY KEY,
    IdSucursal int NOT NULL,
    CONSTRAINT FK_Test_Clinica_Sucursal FOREIGN KEY (IdSucursal)
        REFERENCES dbo.Sucursal(IdSucursal)
);
CREATE TABLE dbo.Rol (
    IdRol int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Rol PRIMARY KEY
);
CREATE TABLE dbo.Categoria (
    IdCategoria int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Categoria PRIMARY KEY
);
CREATE TABLE dbo.Marca (
    IdMarca int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Marca PRIMARY KEY
);

/* Siete estructuras base, con tipos de columnas relevantes cotejados con
   script.sql y ClinicaDbContext. Solo se incluyen FK del alcance probado. */
CREATE TABLE dbo.Usuario (
    IdUsuario int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Usuario PRIMARY KEY,
    IdRol int NOT NULL,
    IdEmpleado int NULL,
    Username nvarchar(50) NOT NULL,
    PasswordHash nvarchar(max) NOT NULL,
    Activo bit NOT NULL CONSTRAINT DF_Test_Usuario_Activo DEFAULT (1),
    CONSTRAINT UQ_Test_Usuario_Username UNIQUE (Username),
    CONSTRAINT FK_Test_Usuario_Rol FOREIGN KEY (IdRol) REFERENCES dbo.Rol(IdRol),
    CONSTRAINT FK_Test_Usuario_Empleado FOREIGN KEY (IdEmpleado) REFERENCES dbo.Empleado(IdEmpleado)
);
CREATE TABLE dbo.Consulta (
    IdConsulta int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Consulta PRIMARY KEY,
    IdPaciente int NOT NULL,
    IdMedico int NOT NULL,
    IdSucursal int NOT NULL,
    IdClinica int NULL,
    FechaConsulta datetime2(7) NOT NULL,
    MotivoConsulta nvarchar(300) NULL,
    Sintomas nvarchar(300) NULL,
    Observaciones nvarchar(300) NULL,
    PesoLb float NULL,
    PresionDiastolica float NULL,
    PresionSistolica float NULL,
    AlturaCm int NULL,
    EstadoConsulta nvarchar(30) NULL,
    TemperaturaC decimal(4,1) NULL,
    FrecuenciaCardiaca smallint NULL,
    CONSTRAINT FK_Test_Consulta_Paciente FOREIGN KEY (IdPaciente) REFERENCES dbo.Paciente(IdPaciente),
    CONSTRAINT FK_Test_Consulta_Medico FOREIGN KEY (IdMedico) REFERENCES dbo.Empleado(IdEmpleado),
    CONSTRAINT FK_Test_Consulta_Sucursal FOREIGN KEY (IdSucursal) REFERENCES dbo.Sucursal(IdSucursal),
    CONSTRAINT FK_Test_Consulta_Clinica FOREIGN KEY (IdClinica) REFERENCES dbo.Clinica(IdClinica)
);
CREATE TABLE dbo.Diagnostico (
    IdDiagnostico int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Diagnostico PRIMARY KEY,
    IdConsulta int NOT NULL,
    Descripcion nvarchar(300) NOT NULL,
    FechaRegistro datetime2(7) NOT NULL CONSTRAINT DF_Test_Diagnostico_Fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_Test_Diagnostico_Consulta FOREIGN KEY (IdConsulta) REFERENCES dbo.Consulta(IdConsulta)
);
CREATE TABLE dbo.Medicamento (
    IdMedicamento int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Medicamento PRIMARY KEY,
    IdCategoria int NOT NULL,
    IdMarca int NOT NULL,
    Codigo nvarchar(50) NOT NULL,
    Nombre nvarchar(150) NOT NULL,
    Descripcion nvarchar(500) NULL,
    PrecioVenta decimal(18,2) NOT NULL,
    ImagenURL nvarchar(500) NULL,
    Activo bit NOT NULL CONSTRAINT DF_Test_Medicamento_Activo DEFAULT (1),
    Presentacion nvarchar(100) NULL,
    CONSTRAINT UQ_Test_Medicamento_Codigo UNIQUE (Codigo),
    CONSTRAINT CK_Test_Medicamento_Precio CHECK (PrecioVenta > 0),
    CONSTRAINT FK_Test_Medicamento_Categoria FOREIGN KEY (IdCategoria) REFERENCES dbo.Categoria(IdCategoria),
    CONSTRAINT FK_Test_Medicamento_Marca FOREIGN KEY (IdMarca) REFERENCES dbo.Marca(IdMarca)
);
CREATE TABLE dbo.LoteMedicamento (
    IdLote int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_LoteMedicamento PRIMARY KEY,
    IdMedicamento int NOT NULL,
    NumeroLote nvarchar(50) NOT NULL,
    FechaIngreso date NOT NULL,
    FechaVencimiento date NOT NULL,
    CantidadDisponible int NOT NULL,
    CONSTRAINT CK_Test_Lote_Cantidad CHECK (CantidadDisponible >= 0),
    CONSTRAINT FK_Test_Lote_Medicamento FOREIGN KEY (IdMedicamento) REFERENCES dbo.Medicamento(IdMedicamento)
);
CREATE TABLE dbo.Tratamiento (
    IdTratamiento int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Tratamiento PRIMARY KEY,
    IdConsulta int NOT NULL,
    Descripcion nvarchar(300) NOT NULL,
    Indicaciones nvarchar(300) NULL,
    FechaInicio date NOT NULL,
    FechaFin date NULL,
    IdLote int NULL,
    Cantidad smallint NULL,
    CONSTRAINT FK_Test_Tratamiento_Consulta FOREIGN KEY (IdConsulta) REFERENCES dbo.Consulta(IdConsulta),
    CONSTRAINT FK_Test_Tratamiento_Lote FOREIGN KEY (IdLote) REFERENCES dbo.LoteMedicamento(IdLote)
);
CREATE TABLE dbo.MovimientoInventario (
    IdMovimiento int IDENTITY(1,1) NOT NULL CONSTRAINT PK_Test_Movimiento PRIMARY KEY,
    IdLote int NOT NULL,
    IdUsuario int NOT NULL,
    IdSucursal int NOT NULL,
    TipoMovimiento nvarchar(30) NOT NULL,
    Cantidad int NOT NULL,
    FechaMovimiento datetime2(7) NOT NULL CONSTRAINT DF_Test_Movimiento_Fecha DEFAULT (SYSUTCDATETIME()),
    Observaciones nvarchar(300) NULL,
    CONSTRAINT FK_Test_Movimiento_Lote FOREIGN KEY (IdLote) REFERENCES dbo.LoteMedicamento(IdLote),
    CONSTRAINT FK_Test_Movimiento_Usuario FOREIGN KEY (IdUsuario) REFERENCES dbo.Usuario(IdUsuario),
    CONSTRAINT FK_Test_Movimiento_Sucursal FOREIGN KEY (IdSucursal) REFERENCES dbo.Sucursal(IdSucursal),
    CONSTRAINT CK_Test_Movimiento_Tipo CHECK (TipoMovimiento IN
        (N'Entrada', N'Venta Publica', N'Uso Interno', N'Ajuste', N'Vencimiento'))
);

/* No INSERT, UPDATE, DELETE, migración, USE, CREATE DATABASE ni credenciales.
   El DDL de las siete tablas nuevas vive separado y permanece bloqueado. */
