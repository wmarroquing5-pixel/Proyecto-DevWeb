/* Solo complemento sintético para pruebas de API-TRAT-03. La aplicación
   de este archivo está limitada a la base temporal creada por el fixture.
   Las seis tablas clínicas provienen sin cambios del DDL cotejado. */
IF CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')) <> N'DESKTOP-QTDJOHF'
   OR CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')) <> N'SQLEXPRESS'
   OR CONVERT(int, SERVERPROPERTY('EngineEdition')) <> 4
   OR DB_NAME() NOT LIKE N'APIClinica[_]TratReceta[_]%'
   THROW 51130, N'API-TRAT-03: destino SQL no autorizado.', 1;

ALTER TABLE dbo.Rol ADD
    Nombre nvarchar(50) NOT NULL CONSTRAINT DF_TratReceta_RolNombre DEFAULT N'Rol sintético',
    Activo bit NOT NULL CONSTRAINT DF_TratReceta_RolActivo DEFAULT (1);

ALTER TABLE dbo.Empleado ADD
    IdEspecialidad int NULL,
    Nombres nvarchar(100) NOT NULL CONSTRAINT DF_TratReceta_EmpleadoNombres DEFAULT N'Médico sintético',
    Apellidos nvarchar(100) NOT NULL CONSTRAINT DF_TratReceta_EmpleadoApellidos DEFAULT N'Prueba',
    DPI nvarchar(20) NOT NULL CONSTRAINT DF_TratReceta_EmpleadoDpi DEFAULT N'SINTETICO',
    TipoEmpleado nvarchar(30) NOT NULL CONSTRAINT DF_TratReceta_EmpleadoTipo DEFAULT N'Medico',
    Activo bit NOT NULL CONSTRAINT DF_TratReceta_EmpleadoActivo DEFAULT (1),
    FechaIngreso date NULL,
    TipoSangre nvarchar(10) NULL,
    IdTurno int NULL,
    Direccion nvarchar(150) NULL,
    Telefono nvarchar(12) NULL,
    CorreoElectronico nvarchar(150) NULL;

CREATE TABLE dbo.Permiso (
    IdPermiso int IDENTITY(1,1) NOT NULL CONSTRAINT PK_TratReceta_Permiso PRIMARY KEY,
    IdRol int NOT NULL,
    Modulo nvarchar(50) NOT NULL,
    PuedeConsultar bit NOT NULL,
    PuedeCrear bit NOT NULL,
    PuedeModificar bit NOT NULL,
    PuedeEliminar bit NOT NULL,
    CONSTRAINT FK_TratReceta_Permiso_Rol FOREIGN KEY (IdRol) REFERENCES dbo.Rol(IdRol),
    CONSTRAINT UQ_TratReceta_Permiso_RolModulo UNIQUE (IdRol, Modulo)
);
