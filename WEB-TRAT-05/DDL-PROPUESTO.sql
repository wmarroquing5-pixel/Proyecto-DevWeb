/* WEB-TRAT-05 — BORRADOR PARA REVISION; NO EJECUTAR.
   No es una migracion ni autoriza cambiar Azure SQL. No contiene USE ni conexion.
   La barrera siguiente impide ejecucion accidental aun si se abre en SSMS.
   Solo una autorizacion posterior para SQL Server Express aislado podra producir
   una copia ejecutable, tras cotejar nombres/tipos reales y aprobar decisiones.
   Requiere las tablas dbo.Tratamiento, Diagnostico, Usuario, Medicamento,
   LoteMedicamento y MovimientoInventario de un esquema sintetico aislado.
   FK compuestas propuestas protegen receta/linea/detalle/origen directo.
   La misma consulta para tratamiento/diagnostico y el medicamento de lote
   aun requieren servicio transaccional: ver MATRIZ-INTEGRIDAD.md.
*/
THROW 51000, N'WEB-TRAT-05 es un DDL de revision. Ejecucion no autorizada.', 1;

CREATE TABLE dbo.RecetaClinica (
    IdReceta int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RecetaClinica PRIMARY KEY,
    IdTratamiento int NOT NULL,
    IdDiagnostico int NOT NULL,
    IdUsuarioPrescriptor int NOT NULL,
    IdRecetaAnterior int NULL,
    NumeroVersion int NOT NULL,
    Estado nvarchar(20) NOT NULL,
    FechaPrescripcionUtc datetime2(3) NOT NULL,
    ClaveOperacion uniqueidentifier NOT NULL,
    HashSolicitud binary(32) NOT NULL,
    CONSTRAINT FK_RecetaClinica_Tratamiento FOREIGN KEY (IdTratamiento) REFERENCES dbo.Tratamiento(IdTratamiento),
    CONSTRAINT FK_RecetaClinica_Diagnostico FOREIGN KEY (IdDiagnostico) REFERENCES dbo.Diagnostico(IdDiagnostico),
    CONSTRAINT FK_RecetaClinica_Usuario FOREIGN KEY (IdUsuarioPrescriptor) REFERENCES dbo.Usuario(IdUsuario),
    CONSTRAINT FK_RecetaClinica_Anterior FOREIGN KEY (IdRecetaAnterior) REFERENCES dbo.RecetaClinica(IdReceta),
    CONSTRAINT CK_RecetaClinica_Version CHECK (NumeroVersion >= 1),
    CONSTRAINT CK_RecetaClinica_Estado CHECK (Estado IN (N'Vigente', N'Sustituida', N'Anulada')),
    CONSTRAINT CK_RecetaClinica_Anterior CHECK (IdRecetaAnterior IS NULL OR IdRecetaAnterior <> IdReceta),
    CONSTRAINT UQ_RecetaClinica_Clave UNIQUE (ClaveOperacion),
    CONSTRAINT UQ_RecetaClinica_TratamientoVersion UNIQUE (IdTratamiento, NumeroVersion)
);
CREATE UNIQUE INDEX UX_RecetaClinica_Vigente ON dbo.RecetaClinica(IdTratamiento)
    WHERE Estado = N'Vigente';
CREATE UNIQUE INDEX UX_RecetaClinica_Anterior ON dbo.RecetaClinica(IdRecetaAnterior)
    WHERE IdRecetaAnterior IS NOT NULL;
CREATE INDEX IX_RecetaClinica_DiagnosticoFecha ON dbo.RecetaClinica(IdDiagnostico, FechaPrescripcionUtc);

CREATE TABLE dbo.RecetaLinea (
    IdRecetaLinea int IDENTITY(1,1) NOT NULL CONSTRAINT PK_RecetaLinea PRIMARY KEY,
    IdReceta int NOT NULL,
    IdMedicamento int NOT NULL,
    Orden smallint NOT NULL,
    CantidadPrescritaUnidades int NOT NULL,
    UnidadInventario nvarchar(30) NOT NULL,
    Dosis decimal(12,3) NOT NULL,
    UnidadDosis nvarchar(30) NOT NULL,
    Via nvarchar(40) NOT NULL,
    Frecuencia nvarchar(100) NOT NULL,
    DuracionDias smallint NOT NULL,
    Indicaciones nvarchar(500) NULL,
    /* Instantanea propuesta, pendiente de aprobacion de farmacia/clinica.
       NULL = equivalencia NO demostrada; la API debe bloquear el producto.
       No derivar estos valores de Medicamento.Presentacion. */
    ContenidoPorUnidad decimal(18,6) NULL,
    UnidadContenido nvarchar(30) NULL,
    FuenteEquivalencia nvarchar(200) NULL,
    VersionEquivalencia nvarchar(50) NULL,
    IdUsuarioValidador int NULL,
    FechaValidacionUtc datetime2(3) NULL,
    CONSTRAINT FK_RecetaLinea_Receta FOREIGN KEY (IdReceta) REFERENCES dbo.RecetaClinica(IdReceta),
    CONSTRAINT FK_RecetaLinea_Medicamento FOREIGN KEY (IdMedicamento) REFERENCES dbo.Medicamento(IdMedicamento),
    CONSTRAINT FK_RecetaLinea_Validador FOREIGN KEY (IdUsuarioValidador) REFERENCES dbo.Usuario(IdUsuario),
    CONSTRAINT CK_RecetaLinea_Cantidades CHECK (Orden > 0 AND CantidadPrescritaUnidades > 0
        AND Dosis > 0 AND DuracionDias > 0),
    CONSTRAINT CK_RecetaLinea_Texto CHECK (LEN(TRIM(UnidadInventario)) > 0
        AND LEN(TRIM(UnidadDosis)) > 0 AND LEN(TRIM(Via)) > 0
        AND LEN(TRIM(Frecuencia)) > 0),
    CONSTRAINT CK_RecetaLinea_Equivalencia CHECK (
        (ContenidoPorUnidad IS NULL AND UnidadContenido IS NULL AND FuenteEquivalencia IS NULL
         AND VersionEquivalencia IS NULL AND IdUsuarioValidador IS NULL AND FechaValidacionUtc IS NULL)
        OR
        (ContenidoPorUnidad IS NOT NULL AND ContenidoPorUnidad > 0
         AND UnidadContenido IS NOT NULL AND LEN(TRIM(UnidadContenido)) > 0
         AND FuenteEquivalencia IS NOT NULL AND LEN(TRIM(FuenteEquivalencia)) > 0
         AND VersionEquivalencia IS NOT NULL AND LEN(TRIM(VersionEquivalencia)) > 0
         AND IdUsuarioValidador IS NOT NULL AND FechaValidacionUtc IS NOT NULL)
    ),
    CONSTRAINT UQ_RecetaLinea_Orden UNIQUE (IdReceta, Orden),
    CONSTRAINT UQ_RecetaLinea_IdReceta UNIQUE (IdRecetaLinea, IdReceta)
);
CREATE INDEX IX_RecetaLinea_Medicamento ON dbo.RecetaLinea(IdMedicamento);

CREATE TABLE dbo.EntregaFarmacia (
    IdEntrega int IDENTITY(1,1) NOT NULL CONSTRAINT PK_EntregaFarmacia PRIMARY KEY,
    IdReceta int NOT NULL,
    IdUsuarioResponsable int NOT NULL,
    FechaConfirmacionUtc datetime2(3) NOT NULL,
    ClaveOperacion uniqueidentifier NOT NULL,
    HashSolicitud binary(32) NOT NULL,
    CONSTRAINT FK_EntregaFarmacia_Receta FOREIGN KEY (IdReceta) REFERENCES dbo.RecetaClinica(IdReceta),
    CONSTRAINT FK_EntregaFarmacia_Usuario FOREIGN KEY (IdUsuarioResponsable) REFERENCES dbo.Usuario(IdUsuario),
    CONSTRAINT UQ_EntregaFarmacia_Clave UNIQUE (ClaveOperacion),
    CONSTRAINT UQ_EntregaFarmacia_IdReceta UNIQUE (IdEntrega, IdReceta)
);
CREATE INDEX IX_EntregaFarmacia_RecetaFecha ON dbo.EntregaFarmacia(IdReceta, FechaConfirmacionUtc);

CREATE TABLE dbo.EntregaDetalle (
    IdEntregaDetalle int IDENTITY(1,1) NOT NULL CONSTRAINT PK_EntregaDetalle PRIMARY KEY,
    IdEntrega int NOT NULL,
    IdReceta int NOT NULL,
    IdRecetaLinea int NOT NULL,
    IdLote int NOT NULL,
    CantidadEntregadaUnidades int NOT NULL,
    CONSTRAINT FK_EntregaDetalle_EntregaReceta FOREIGN KEY (IdEntrega, IdReceta)
        REFERENCES dbo.EntregaFarmacia(IdEntrega, IdReceta),
    CONSTRAINT FK_EntregaDetalle_LineaReceta FOREIGN KEY (IdRecetaLinea, IdReceta)
        REFERENCES dbo.RecetaLinea(IdRecetaLinea, IdReceta),
    CONSTRAINT FK_EntregaDetalle_Lote FOREIGN KEY (IdLote) REFERENCES dbo.LoteMedicamento(IdLote),
    CONSTRAINT CK_EntregaDetalle_Cantidad CHECK (CantidadEntregadaUnidades > 0),
    CONSTRAINT UQ_EntregaDetalle_EntregaLineaLote UNIQUE (IdEntrega, IdRecetaLinea, IdLote),
    CONSTRAINT UQ_EntregaDetalle_IdLinea UNIQUE (IdEntregaDetalle, IdRecetaLinea)
);
CREATE INDEX IX_EntregaDetalle_LineaLote ON dbo.EntregaDetalle(IdRecetaLinea, IdLote);

CREATE TABLE dbo.AdministracionClinica (
    IdAdministracion int IDENTITY(1,1) NOT NULL CONSTRAINT PK_AdministracionClinica PRIMARY KEY,
    IdRecetaLinea int NOT NULL,
    IdUsuarioResponsable int NOT NULL,
    Origen nvarchar(20) NOT NULL,
    IdEntregaDetalle int NULL,
    IdLote int NULL,
    CantidadUnidades int NOT NULL,
    DosisAplicada decimal(12,3) NOT NULL,
    UnidadDosis nvarchar(30) NOT NULL,
    Via nvarchar(40) NOT NULL,
    FechaAdministracionUtc datetime2(3) NOT NULL,
    ClaveOperacion uniqueidentifier NOT NULL,
    HashSolicitud binary(32) NOT NULL,
    Observaciones nvarchar(500) NULL,
    CONSTRAINT FK_Administracion_Linea FOREIGN KEY (IdRecetaLinea) REFERENCES dbo.RecetaLinea(IdRecetaLinea),
    CONSTRAINT FK_Administracion_Usuario FOREIGN KEY (IdUsuarioResponsable) REFERENCES dbo.Usuario(IdUsuario),
    CONSTRAINT FK_Administracion_EntregaDetalleLinea FOREIGN KEY (IdEntregaDetalle, IdRecetaLinea)
        REFERENCES dbo.EntregaDetalle(IdEntregaDetalle, IdRecetaLinea),
    CONSTRAINT FK_Administracion_Lote FOREIGN KEY (IdLote) REFERENCES dbo.LoteMedicamento(IdLote),
    CONSTRAINT CK_Administracion_Origen CHECK (
        (Origen = N'InventarioDirecto' AND IdLote IS NOT NULL AND IdEntregaDetalle IS NULL)
        OR (Origen = N'EntregaPrevia' AND IdEntregaDetalle IS NOT NULL AND IdLote IS NULL)
        OR (Origen = N'Externo' AND IdLote IS NULL AND IdEntregaDetalle IS NULL)
    ),
    CONSTRAINT CK_Administracion_Cantidades CHECK (CantidadUnidades > 0 AND DosisAplicada > 0),
    CONSTRAINT CK_Administracion_Texto CHECK (LEN(TRIM(UnidadDosis)) > 0 AND LEN(TRIM(Via)) > 0),
    CONSTRAINT UQ_Administracion_Clave UNIQUE (ClaveOperacion),
    CONSTRAINT UQ_Administracion_IdOrigen UNIQUE (IdAdministracion, Origen)
);
CREATE INDEX IX_Administracion_LineaFecha ON dbo.AdministracionClinica(IdRecetaLinea, FechaAdministracionUtc);
CREATE INDEX IX_Administracion_EntregaDetalle ON dbo.AdministracionClinica(IdEntregaDetalle)
    WHERE IdEntregaDetalle IS NOT NULL;

CREATE TABLE dbo.SalidaClinica (
    IdSalidaClinica int IDENTITY(1,1) NOT NULL CONSTRAINT PK_SalidaClinica PRIMARY KEY,
    IdMovimiento int NOT NULL,
    IdEntregaDetalle int NULL,
    IdAdministracion int NULL,
    OrigenAdministracion nvarchar(20) NULL,
    CONSTRAINT FK_SalidaClinica_Movimiento FOREIGN KEY (IdMovimiento) REFERENCES dbo.MovimientoInventario(IdMovimiento),
    CONSTRAINT FK_SalidaClinica_EntregaDetalle FOREIGN KEY (IdEntregaDetalle) REFERENCES dbo.EntregaDetalle(IdEntregaDetalle),
    CONSTRAINT FK_SalidaClinica_AdministracionDirecta FOREIGN KEY (IdAdministracion, OrigenAdministracion)
        REFERENCES dbo.AdministracionClinica(IdAdministracion, Origen),
    CONSTRAINT CK_SalidaClinica_Origen CHECK (
        (IdEntregaDetalle IS NOT NULL AND IdAdministracion IS NULL AND OrigenAdministracion IS NULL)
        OR (IdEntregaDetalle IS NULL AND IdAdministracion IS NOT NULL
            AND OrigenAdministracion = N'InventarioDirecto')
    ),
    CONSTRAINT UQ_SalidaClinica_Movimiento UNIQUE (IdMovimiento)
);
CREATE UNIQUE INDEX UX_SalidaClinica_EntregaDetalle ON dbo.SalidaClinica(IdEntregaDetalle)
    WHERE IdEntregaDetalle IS NOT NULL;
CREATE UNIQUE INDEX UX_SalidaClinica_Administracion ON dbo.SalidaClinica(IdAdministracion)
    WHERE IdAdministracion IS NOT NULL;

CREATE TABLE dbo.CorreccionClinica (
    IdCorreccion int IDENTITY(1,1) NOT NULL CONSTRAINT PK_CorreccionClinica PRIMARY KEY,
    IdReceta int NULL,
    IdEntregaDetalle int NULL,
    IdAdministracion int NULL,
    TipoCorreccion nvarchar(30) NOT NULL,
    Motivo nvarchar(500) NOT NULL,
    IdUsuarioResponsable int NOT NULL,
    FechaUtc datetime2(3) NOT NULL,
    CantidadAjusteUnidades int NULL,
    IdMovimientoCompensatorio int NULL,
    ClaveOperacion uniqueidentifier NOT NULL,
    HashSolicitud binary(32) NOT NULL,
    CONSTRAINT FK_Correccion_Receta FOREIGN KEY (IdReceta) REFERENCES dbo.RecetaClinica(IdReceta),
    CONSTRAINT FK_Correccion_EntregaDetalle FOREIGN KEY (IdEntregaDetalle) REFERENCES dbo.EntregaDetalle(IdEntregaDetalle),
    CONSTRAINT FK_Correccion_Administracion FOREIGN KEY (IdAdministracion) REFERENCES dbo.AdministracionClinica(IdAdministracion),
    CONSTRAINT FK_Correccion_Usuario FOREIGN KEY (IdUsuarioResponsable) REFERENCES dbo.Usuario(IdUsuario),
    CONSTRAINT FK_Correccion_Movimiento FOREIGN KEY (IdMovimientoCompensatorio) REFERENCES dbo.MovimientoInventario(IdMovimiento),
    CONSTRAINT CK_Correccion_Objetivo CHECK (
        (CASE WHEN IdReceta IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN IdEntregaDetalle IS NULL THEN 0 ELSE 1 END)
        + (CASE WHEN IdAdministracion IS NULL THEN 0 ELSE 1 END) = 1
    ),
    CONSTRAINT CK_Correccion_Tipo CHECK (TipoCorreccion IN
        (N'SustitucionReceta', N'AnulacionEntrega', N'CorreccionAdministracion')),
    CONSTRAINT CK_Correccion_Motivo CHECK (LEN(TRIM(Motivo)) > 0),
    CONSTRAINT CK_Correccion_Cantidad CHECK (CantidadAjusteUnidades IS NULL OR CantidadAjusteUnidades > 0),
    CONSTRAINT UQ_Correccion_Clave UNIQUE (ClaveOperacion)
);
CREATE UNIQUE INDEX UX_Correccion_MovimientoCompensatorio ON dbo.CorreccionClinica(IdMovimientoCompensatorio)
    WHERE IdMovimientoCompensatorio IS NOT NULL;
CREATE INDEX IX_Correccion_Receta ON dbo.CorreccionClinica(IdReceta) WHERE IdReceta IS NOT NULL;
CREATE INDEX IX_Correccion_EntregaDetalle ON dbo.CorreccionClinica(IdEntregaDetalle) WHERE IdEntregaDetalle IS NOT NULL;
CREATE INDEX IX_Correccion_Administracion ON dbo.CorreccionClinica(IdAdministracion) WHERE IdAdministracion IS NOT NULL;

/* FIN DEL BORRADOR. No hay INSERT/UPDATE/DELETE, ALTER de tablas existentes,
   triggers, migraciones ni instrucciones de conexion. Las correcciones con
   reintegro NO se habilitan mientras su politica y TipoMovimiento sigan pendientes. */
