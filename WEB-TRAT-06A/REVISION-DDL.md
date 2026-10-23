# WEB-TRAT-06A — Revisión estática del DDL

**Objeto:** `WEB-TRAT-05/DDL-PROPUESTO.sql` comparado con `DDL-REVISADO.sql`. Solo lectura/análisis; **no** se pasó el archivo a SQL Server. El script base `C:\Users\DESARROLLO\Desktop\script.sql` es documental, comienza con `USE [db_Clinica]` y no puede ejecutarse como preparación aislada. Azure SQL y API no cambiaron.

## Resultado comprobado estáticamente

- El borrador revisado conserva **siete** `CREATE TABLE` solo para las siete estructuras nuevas; orden padre antes de hijo: receta → línea → entrega → detalle → administración → salida → corrección. Las FK a `Tratamiento`, `Diagnostico`, `Usuario`, `Medicamento`, `LoteMedicamento` y `MovimientoInventario` requieren que esos objetos existan previamente en la base sintética y que sus PK/tipos reales coincidan.
- `THROW 51000` sigue siendo la primera instrucción SQL; no hay `GO`, `USE`, conexión, DML, `ALTER` de tablas existentes, trigger ni migración. Ejecutar el archivo completo abortaría antes del primer `CREATE`. Seleccionar manualmente un fragmento en SSMS omitiría la barrera: se prohíbe ejecutar cualquier fragmento en esta fase.
- `IdRecetaLinea/IdReceta`, `IdEntrega/IdReceta`, `IdEntregaDetalle/IdRecetaLinea` e `IdAdministracion/Origen` tienen claves candidatas `UNIQUE` para las FK compuestas del borrador. Índices filtrados sobre valores no nulos evitan que múltiples `NULL` bloqueen eventos independientes. `UQ_...Clave` existe por tipo de operación; la unicidad **no es global entre tipos**.
- `CHECK` de origen en `SalidaClinica` era vulnerable a `UNKNOWN`: con `IdAdministracion` no nulo, `IdEntregaDetalle` nulo y `OrigenAdministracion` nulo, el brazo derecho daba `UNKNOWN`; SQL Server acepta un CHECK que no resulte `FALSE`. El revisado añade `OrigenAdministracion IS NOT NULL` explícito, de modo que esa fila da `FALSE`. La FK compuesta por sí sola omitiría columnas NULL.
- `RecetaLinea` exige instantánea de seis campos completa o ausente, pero **no almacena** presentación validada, concentración, unidades dimensionales y factor con su sentido, fraccionamiento ni redondeo. El DDL revisado no inventa esos valores ni elige la alternativa A/B; la brecha D-U1 sigue abierta. Los estados `Vigente/Sustituida/Anulada` y tipos de corrección siguen siendo **candidatos**, no política aprobada.

## Límites de la revisión

No se confirmó sintaxis mediante motor SQL ni se midieron planes o índices. `TRIM` requiere una versión/compatibilidad de SQL Server que deberá comprobarse en el Express local elegido; tipos `datetime2(3)`, `binary(32)`, `uniqueidentifier` e índices filtrados también se probarán allí. Los CHECK de fila no protegen invariantes agregadas, existencia de al menos un hijo, coincidencia entre medicamento del lote y línea, o tipo/cantidad/lote/sucursal de `MovimientoInventario`. El índice `IX_Bitacora_Tabla_Fecha` figura en EF pero está ausente de Azure según SSMS del usuario; este DDL no lo crea ni lo necesita.

## Puertas para una versión ejecutable futura

1. Aprobar alcance SQL Server Express aislado y base inequívoca; nunca Azure `db_Clinica`.
2. Resolver D-U1 y las políticas de estados/corrección; si se amplía el modelo, emitir revisión nueva con diffs y autorización específica.
3. Cotejar PK, tipos, nulabilidad, compatibilidad y existencia de las seis tablas base en la base sintética; revisar `ANSI_NULLS`, `QUOTED_IDENTIFIER`, `ANSI_PADDING`, `ANSI_WARNINGS`, `CONCAT_NULL_YIELDS_NULL` y `ARITHABORT` al crear índices filtrados.
4. Revisar con DBA el orden, todas las FK y `CHECK` usando un parser/motor aislado **solo en fase posterior autorizada**; probar aceptación/rechazo de `NULL` y duplicados.
5. Producir otra copia explícitamente autorizada para ejecución. **No retirar el `THROW` en WEB-TRAT-06A.**

No se ejecutaron DDL ni pruebas de escritura. Las decisiones pendientes constan en `DECISIONES-PENDIENTES.md`.
