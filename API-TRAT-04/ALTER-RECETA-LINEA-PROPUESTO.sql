/* API-TRAT-04: PROPUESTA PARA REVISION MANUAL. NO EJECUTAR.
   Eliminar esta barrera solo después de cotejar metadatos en SSMS, confirmar
   que dbo.RecetaLinea está vacía y aprobar explícitamente el cambio. */
THROW 51000, 'Script de revisión: ejecución no autorizada.', 1;

SET XACT_ABORT ON;
BEGIN TRY
    BEGIN TRANSACTION;

    IF DB_NAME() <> N'db_Clinica'
        THROW 51001, 'Base distinta de db_Clinica.', 1;
    IF OBJECT_ID(N'dbo.RecetaLinea', N'U') IS NULL
        THROW 51002, 'No existe dbo.RecetaLinea.', 1;
    IF EXISTS (SELECT 1 FROM dbo.RecetaLinea)
        THROW 51003, 'Hay líneas históricas sin clasificación de destino aprobada.', 1;

    /* Contrato actual: columnas requeridas, tipos y nulabilidad. */
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.RecetaLinea')
               AND name = N'DestinoMedicamento')
        THROW 51004, 'DestinoMedicamento ya existe; revisar manualmente.', 1;
    IF (SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
        WHERE c.object_id=OBJECT_ID(N'dbo.RecetaLinea') AND c.is_nullable=0 AND
        ((c.name=N'Dosis' AND t.name=N'decimal' AND c.precision=12 AND c.scale=3)
        OR (c.name=N'UnidadDosis' AND t.name=N'nvarchar' AND c.max_length=60)
        OR (c.name=N'Via' AND t.name=N'nvarchar' AND c.max_length=80)
        OR (c.name=N'Frecuencia' AND t.name=N'nvarchar' AND c.max_length=200))) <> 4
        THROW 51005, 'Columnas clínicas distintas del contrato verificado.', 1;
    IF (SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id
        WHERE c.object_id=OBJECT_ID(N'dbo.RecetaLinea') AND c.is_nullable=0 AND
        ((c.name=N'IdMedicamento' AND t.name=N'int')
        OR (c.name=N'CantidadPrescritaUnidades' AND t.name=N'int')
        OR (c.name=N'UnidadInventario' AND t.name=N'nvarchar' AND c.max_length=60)
        OR (c.name=N'DuracionDias' AND t.name=N'smallint'))) <> 4
        THROW 51006, 'Columnas obligatorias distintas del contrato verificado.', 1;

    IF (SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.RecetaLinea')
        AND name IN (N'CK_RecetaLinea_Cantidades',N'CK_RecetaLinea_Texto')) <> 2
        THROW 51007, 'Restricciones CHECK distintas del contrato.', 1;
    /* Normalizar solo sintaxis cosmética de sys.check_constraints y exigir
       las cuatro conjunciones originales completas, no coincidencias parciales. */
    DECLARE @cantidad nvarchar(max), @texto nvarchar(max);
    SELECT @cantidad = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        definition,N' ',N''),NCHAR(13),N''),NCHAR(10),N''),N'[',N''),N']',N''),N'(',N''),N')',N''))
    FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.RecetaLinea')
        AND name=N'CK_RecetaLinea_Cantidades';
    SELECT @texto = LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        definition,N' ',N''),NCHAR(13),N''),NCHAR(10),N''),N'[',N''),N']',N''),N'(',N''),N')',N''))
    FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID(N'dbo.RecetaLinea')
        AND name=N'CK_RecetaLinea_Texto';
    IF @cantidad <> N'orden>0andcantidadprescritaunidades>0anddosis>0andduraciondias>0'
        THROW 51008, 'CK_RecetaLinea_Cantidades tiene definición inesperada.', 1;
    IF @texto <> N'lentrimunidadinventario>0andlentrimunidaddosis>0andlentrimvia>0andlentrimfrecuencia>0'
        THROW 51009, 'CK_RecetaLinea_Texto tiene definición inesperada.', 1;

    ALTER TABLE dbo.RecetaLinea DROP CONSTRAINT CK_RecetaLinea_Cantidades;
    ALTER TABLE dbo.RecetaLinea DROP CONSTRAINT CK_RecetaLinea_Texto;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN Dosis decimal(12,3) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN UnidadDosis nvarchar(30) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN Via nvarchar(40) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN Frecuencia nvarchar(100) NULL;
    ALTER TABLE dbo.RecetaLinea ADD DestinoMedicamento nvarchar(20) NOT NULL;
    ALTER TABLE dbo.RecetaLinea WITH CHECK ADD CONSTRAINT CK_RecetaLinea_Cantidades
        CHECK (Orden > 0 AND CantidadPrescritaUnidades > 0 AND DuracionDias > 0
               AND (Dosis IS NULL OR Dosis > 0));
    ALTER TABLE dbo.RecetaLinea WITH CHECK ADD CONSTRAINT CK_RecetaLinea_Texto
        CHECK (LEN(TRIM(UnidadInventario)) > 0
               AND (UnidadDosis IS NULL OR LEN(TRIM(UnidadDosis)) > 0)
               AND (Via IS NULL OR LEN(TRIM(Via)) > 0)
               AND (Frecuencia IS NULL OR LEN(TRIM(Frecuencia)) > 0));
    /* Compilar esta restricción después del ADD de la columna, en el mismo
       alcance transaccional; SQL Server compila el lote estático por adelantado. */
    EXEC(N'ALTER TABLE dbo.RecetaLinea WITH CHECK ADD CONSTRAINT CK_RecetaLinea_Destino
        CHECK (DestinoMedicamento IN (N''Clinica'',N''CompraExterna''))');

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
