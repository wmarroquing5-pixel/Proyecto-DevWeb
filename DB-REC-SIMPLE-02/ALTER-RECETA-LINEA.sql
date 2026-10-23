/* DB-REC-SIMPLE-02. PROPUESTA; NO EJECUTAR EN AZURE SQL.
   Un solo lote, sin GO. Bloqueo intencional: solo una autorización posterior,
   revisión del entorno y pruebas aisladas permiten preparar una copia ejecutable.
   Cambia únicamente la nulabilidad de seis columnas de dbo.RecetaLinea.
   Las dos restricciones CHECK se recrean con su expresión original y WITH CHECK.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @EjecucionAutorizada bit = 0; -- Mantener en 0 en este entregable.

BEGIN TRY
    IF @EjecucionAutorizada <> 1
        THROW 51200, 'DB-REC-SIMPLE-02 bloqueado: falta autorización de ejecución.', 1;

    IF DB_NAME() COLLATE Latin1_General_100_BIN2 <> N'db_Clinica'
        THROW 51201, 'Base incorrecta: se exige db_Clinica.', 1;

    IF OBJECT_ID(N'dbo.RecetaLinea', N'U') IS NULL
        THROW 51202, 'No existe dbo.RecetaLinea.', 1;

    BEGIN TRANSACTION;

    DECLARE @Tabla int = OBJECT_ID(N'dbo.RecetaLinea', N'U');
    DECLARE @ColumnasEsperadas TABLE
    (
        Nombre sysname NOT NULL PRIMARY KEY,
        Tipo sysname NOT NULL,
        LongitudBytes smallint NOT NULL,
        PrecisionValor tinyint NOT NULL,
        Escala tinyint NOT NULL
    );
    INSERT INTO @ColumnasEsperadas (Nombre, Tipo, LongitudBytes, PrecisionValor, Escala)
    VALUES
        (N'UnidadInventario', N'nvarchar', 60, 0, 0),
        (N'Dosis', N'decimal', 9, 12, 3),
        (N'UnidadDosis', N'nvarchar', 60, 0, 0),
        (N'Via', N'nvarchar', 80, 0, 0),
        (N'Frecuencia', N'nvarchar', 200, 0, 0),
        (N'DuracionDias', N'smallint', 2, 0, 0);

    /* SQL Server devuelve precision/scale también para tipos no decimales;
       solo se comparan en Dosis. nvarchar se verifica en bytes (2 por carácter). */
    IF EXISTS
    (
        SELECT 1
        FROM @ColumnasEsperadas AS e
        LEFT JOIN sys.columns AS c ON c.object_id = @Tabla AND c.name = e.Nombre
        LEFT JOIN sys.types AS t ON t.user_type_id = c.user_type_id
        WHERE c.column_id IS NULL OR t.name <> e.Tipo
           OR c.max_length <> e.LongitudBytes
           OR (e.Nombre = N'Dosis' AND (c.precision <> e.PrecisionValor OR c.scale <> e.Escala))
           OR c.is_nullable <> 0 OR c.is_identity <> 0 OR c.is_computed <> 0
    )
        THROW 51203, 'Una columna no coincide en tipo, tamaño o nulabilidad con el contrato auditado.', 1;

    IF EXISTS
    (
        SELECT 1 FROM sys.default_constraints AS d
        JOIN sys.columns AS c ON c.object_id = d.parent_object_id
                             AND c.column_id = d.parent_column_id
        JOIN @ColumnasEsperadas AS e ON e.Nombre = c.name
        WHERE d.parent_object_id = @Tabla
    )
        THROW 51204, 'Hay un DEFAULT inesperado en las seis columnas.', 1;

    /* El ALTER de nvarchar no debe cambiar una colación personalizada. El
       contrato histórico no declara COLLATE, por lo que se exige la colación
       predeterminada de la base antes y después. */
    IF EXISTS
    (
        SELECT 1 FROM sys.columns AS c
        JOIN @ColumnasEsperadas AS e ON e.Nombre = c.name
        WHERE c.object_id = @Tabla AND e.Tipo = N'nvarchar'
          AND (c.collation_name IS NULL OR
               c.collation_name <> CONVERT(nvarchar(128), DATABASEPROPERTYEX(DB_NAME(), 'Collation')))
    )
        THROW 51211, 'Colación no estándar en una columna objetivo; revisión manual requerida.', 1;

    IF EXISTS
    (
        SELECT 1 FROM sys.index_columns AS ic
        JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
        JOIN @ColumnasEsperadas AS e ON e.Nombre = c.name
        WHERE ic.object_id = @Tabla
    )
        THROW 51205, 'Una columna objetivo participa en un índice inesperado.', 1;

    IF (SELECT COUNT(*) FROM sys.columns WHERE object_id = @Tabla) <> 18
       OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = @Tabla) <> 3
       OR (SELECT COUNT(*) FROM sys.indexes WHERE object_id = @Tabla AND index_id > 0) <> 4
       OR EXISTS
       (
           SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = @Tabla
             AND (name NOT IN (N'FK_RecetaLinea_Receta', N'FK_RecetaLinea_Medicamento',
                               N'FK_RecetaLinea_Validador')
                  OR is_disabled = 1 OR is_not_trusted = 1)
       )
       OR EXISTS
       (
           SELECT 1 FROM sys.indexes WHERE object_id = @Tabla AND index_id > 0
             AND (name NOT IN (N'PK_RecetaLinea', N'UQ_RecetaLinea_Orden',
                               N'UQ_RecetaLinea_IdReceta', N'IX_RecetaLinea_Medicamento')
                  OR is_disabled = 1)
       )
        THROW 51206, 'Estructura de RecetaLinea distinta del contrato auditado.', 1;

    IF (SELECT COUNT(*) FROM sys.check_constraints WHERE parent_object_id = @Tabla) <> 3
       OR EXISTS
       (
           SELECT 1 FROM sys.check_constraints
           WHERE parent_object_id = @Tabla
             AND name NOT IN (N'CK_RecetaLinea_Cantidades', N'CK_RecetaLinea_Texto',
                              N'CK_RecetaLinea_Equivalencia')
       )
       OR (SELECT COUNT(*) FROM sys.check_constraints
           WHERE parent_object_id = @Tabla
             AND name IN (N'CK_RecetaLinea_Cantidades', N'CK_RecetaLinea_Texto',
                          N'CK_RecetaLinea_Equivalencia')
             AND is_disabled = 0 AND is_not_trusted = 0) <> 3
        THROW 51207, 'CHECK ausentes, adicionales, deshabilitados o no confiables.', 1;

    /* Admitir solo la normalización cosmética de TRIM a LTRIM/RTRIM.
       Ante otra expresión o diferente orden de términos, detenerse y revisar. */
    DECLARE @Cantidades nvarchar(max), @Texto nvarchar(max);
    SELECT @Cantidades = LOWER(definition) FROM sys.check_constraints
        WHERE parent_object_id = @Tabla AND name = N'CK_RecetaLinea_Cantidades';
    SELECT @Texto = LOWER(definition) FROM sys.check_constraints
        WHERE parent_object_id = @Tabla AND name = N'CK_RecetaLinea_Texto';

    SET @Cantidades = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        @Cantidades, N' ', N''), NCHAR(9), N''), NCHAR(13), N''), NCHAR(10), N''),
        N'[', N''), N']', N''), N'(', N''), N')', N'');
    SET @Texto = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        @Texto, N' ', N''), NCHAR(9), N''), NCHAR(13), N''), NCHAR(10), N''),
        N'[', N''), N']', N''), N'(', N''), N')', N'');
    SET @Texto = REPLACE(REPLACE(@Texto, N'lenltrimrtrim', N'lentrim'),
                                     N'lenrtrimltrim', N'lentrim');

    IF @Cantidades IS NULL OR
       @Cantidades <> N'orden>0andcantidadprescritaunidades>0anddosis>0andduraciondias>0'
        THROW 51208, 'Definición de CK_RecetaLinea_Cantidades inesperada.', 1;
    IF @Texto IS NULL OR
       @Texto <> N'lentrimunidadinventario>0andlentrimunidaddosis>0andlentrimvia>0andlentrimfrecuencia>0'
        THROW 51209, 'Definición de CK_RecetaLinea_Texto inesperada.', 1;

    /* Ambas restricciones referencian las columnas alteradas. La retirada es
       temporal, en la misma transacción; se reponen sin cambiar su expresión. */
    ALTER TABLE dbo.RecetaLinea DROP CONSTRAINT CK_RecetaLinea_Cantidades;
    ALTER TABLE dbo.RecetaLinea DROP CONSTRAINT CK_RecetaLinea_Texto;

    ALTER TABLE dbo.RecetaLinea ALTER COLUMN UnidadInventario nvarchar(30) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN Dosis decimal(12,3) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN UnidadDosis nvarchar(30) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN Via nvarchar(40) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN Frecuencia nvarchar(100) NULL;
    ALTER TABLE dbo.RecetaLinea ALTER COLUMN DuracionDias smallint NULL;

    ALTER TABLE dbo.RecetaLinea WITH CHECK ADD CONSTRAINT CK_RecetaLinea_Cantidades
        CHECK (Orden > 0 AND CantidadPrescritaUnidades > 0
               AND Dosis > 0 AND DuracionDias > 0);
    ALTER TABLE dbo.RecetaLinea WITH CHECK ADD CONSTRAINT CK_RecetaLinea_Texto
        CHECK (LEN(TRIM(UnidadInventario)) > 0
               AND LEN(TRIM(UnidadDosis)) > 0 AND LEN(TRIM(Via)) > 0
               AND LEN(TRIM(Frecuencia)) > 0);

    IF (SELECT COUNT(*) FROM sys.columns AS c JOIN @ColumnasEsperadas AS e ON e.Nombre = c.name
        WHERE c.object_id = @Tabla AND c.is_nullable = 1) <> 6
       OR EXISTS
       (
           SELECT 1 FROM sys.columns AS c JOIN @ColumnasEsperadas AS e ON e.Nombre = c.name
           WHERE c.object_id = @Tabla AND e.Tipo = N'nvarchar'
             AND c.collation_name <> CONVERT(nvarchar(128), DATABASEPROPERTYEX(DB_NAME(), 'Collation'))
       )
       OR (SELECT COUNT(*) FROM sys.check_constraints
           WHERE parent_object_id = @Tabla
             AND name IN (N'CK_RecetaLinea_Cantidades', N'CK_RecetaLinea_Texto',
                          N'CK_RecetaLinea_Equivalencia')
             AND is_disabled = 0 AND is_not_trusted = 0) <> 3
       OR (SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = @Tabla) <> 3
       OR (SELECT COUNT(*) FROM sys.indexes WHERE object_id = @Tabla AND index_id > 0) <> 4
       OR EXISTS
       (
           SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = @Tabla
             AND (is_disabled = 1 OR is_not_trusted = 1)
       )
       OR EXISTS
       (
           SELECT 1 FROM sys.indexes WHERE object_id = @Tabla AND index_id > 0
             AND is_disabled = 1
       )
        THROW 51210, 'Verificación posterior fallida; se revertirá toda la transacción.', 1;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
    THROW;
END CATCH;
