# DB-REC-SIMPLE-06 — Requisitos para solicitar el cambio de `dbo.RecetaLinea`

**Dictamen: NO-GO · 23/10/2026.** Se verificaron artefactos locales; no se conectó a Azure SQL ni se ejecutó SQL, DDL, DML, migración, restauración, reinicio o despliegue. `RECETA_SIMPLE_WRITE_ENABLED` permanece en `false`. Fuente de partida: [DB-REC-SIMPLE-05](../DB-REC-SIMPLE-05/GO-NOGO.md).

## A. SQL: bloqueo y consulta única para el DBA

Las cuatro variables `SQLCMD_*` de conexión no están disponibles en este proceso. No se buscaron credenciales en archivos. El estado Azure **actual** sigue sin verificarse; la auditoría anterior registró seis columnas `NOT NULL`, tres CHECK, tres FK y cuatro índices. El DBA debe ejecutar la siguiente **única instrucción SELECT** con `aud_empresa`. La primera fila identifica la sesión; si `AccesoEsperado=0` o falta la tabla, detener el cotejo. Ninguna rama lee filas clínicas. Revisar definiciones completas, no solo recuentos.

```sql
WITH alcance AS (
    SELECT DB_NAME() AS BaseActual, USER_NAME() AS UsuarioActual,
           CASE WHEN DB_NAME() COLLATE Latin1_General_100_BIN2 = N'db_Clinica'
                      AND USER_NAME() COLLATE Latin1_General_100_BIN2 = N'aud_empresa'
                THEN 1 ELSE 0 END AS AccesoEsperado
), objetivo AS (
    SELECT OBJECT_ID(N'dbo.RecetaLinea', N'U') AS IdTabla
)
SELECT Categoria, Objeto, Detalle
FROM (
    SELECT N'IDENTIDAD' AS Categoria, CONVERT(nvarchar(128), N'Sesion') AS Objeto,
           CONVERT(nvarchar(max), CONCAT(N'Base=', a.BaseActual,
               N'; Usuario=', a.UsuarioActual, N'; AccesoEsperado=', a.AccesoEsperado)) AS Detalle
    FROM alcance AS a
    UNION ALL
    SELECT N'TABLA', N'dbo.RecetaLinea',
           CONVERT(nvarchar(max), CASE WHEN o.IdTabla IS NULL THEN N'NO EXISTE' ELSE N'EXISTE' END)
    FROM alcance AS a CROSS JOIN objetivo AS o WHERE a.AccesoEsperado = 1
    UNION ALL
    SELECT N'RECUENTO', N'dbo.RecetaLinea', CONVERT(nvarchar(max), CONCAT(
           N'Columnas=', (SELECT COUNT(*) FROM sys.columns AS c WHERE c.object_id = o.IdTabla),
           N'; SeisObjetivo=', (SELECT COUNT(*) FROM sys.columns AS c WHERE c.object_id = o.IdTabla
             AND c.name IN (N'UnidadInventario',N'Dosis',N'UnidadDosis',N'Via',N'Frecuencia',N'DuracionDias')),
           N'; CHECK=', (SELECT COUNT(*) FROM sys.check_constraints AS k WHERE k.parent_object_id = o.IdTabla),
           N'; FK=', (SELECT COUNT(*) FROM sys.foreign_keys AS f WHERE f.parent_object_id = o.IdTabla),
           N'; Indices=', (SELECT COUNT(*) FROM sys.indexes AS i WHERE i.object_id = o.IdTabla AND i.index_id > 0)))
    FROM alcance AS a CROSS JOIN objetivo AS o WHERE a.AccesoEsperado = 1
    UNION ALL
    SELECT N'COLUMNA', c.name, CONVERT(nvarchar(max), CONCAT(
           N'Tipo=', ty.name, N'; LongitudBytes=', c.max_length,
           N'; Precision=', c.precision, N'; Escala=', c.scale,
           N'; Nullable=', c.is_nullable, N'; Identidad=', c.is_identity,
           N'; Colacion=', COALESCE(c.collation_name,N'<no aplica>')))
    FROM alcance AS a CROSS JOIN objetivo AS o
    JOIN sys.columns AS c ON c.object_id = o.IdTabla
    JOIN sys.types AS ty ON ty.user_type_id = c.user_type_id
    WHERE a.AccesoEsperado = 1 AND c.name IN
       (N'UnidadInventario',N'Dosis',N'UnidadDosis',N'Via',N'Frecuencia',N'DuracionDias')
    UNION ALL
    SELECT N'CHECK', k.name, CONVERT(nvarchar(max), CONCAT(
           N'Deshabilitado=', k.is_disabled, N'; NoConfiable=', k.is_not_trusted,
           N'; Definicion=', k.definition))
    FROM alcance AS a CROSS JOIN objetivo AS o
    JOIN sys.check_constraints AS k ON k.parent_object_id = o.IdTabla
    WHERE a.AccesoEsperado = 1
    UNION ALL
    SELECT N'FK', f.name, CONVERT(nvarchar(max), CONCAT(
           N'Origen=', pc.name, N'; Destino=', OBJECT_SCHEMA_NAME(f.referenced_object_id),
           N'.', OBJECT_NAME(f.referenced_object_id), N'.', rc.name,
           N'; Deshabilitada=', f.is_disabled, N'; NoConfiable=', f.is_not_trusted,
           N'; Borrado=', f.delete_referential_action_desc))
    FROM alcance AS a CROSS JOIN objetivo AS o
    JOIN sys.foreign_keys AS f ON f.parent_object_id = o.IdTabla
    JOIN sys.foreign_key_columns AS fc ON fc.constraint_object_id = f.object_id
    JOIN sys.columns AS pc ON pc.object_id = fc.parent_object_id AND pc.column_id = fc.parent_column_id
    JOIN sys.columns AS rc ON rc.object_id = fc.referenced_object_id AND rc.column_id = fc.referenced_column_id
    WHERE a.AccesoEsperado = 1
    UNION ALL
    SELECT N'INDICE', i.name, CONVERT(nvarchar(max), CONCAT(
           N'Columna=', c.name, N'; OrdenClave=', ic.key_ordinal,
           N'; Incluida=', ic.is_included_column, N'; Descendente=', ic.is_descending_key,
           N'; Unico=', i.is_unique, N'; PK=', i.is_primary_key,
           N'; RestriccionUnica=', i.is_unique_constraint,
           N'; Deshabilitado=', i.is_disabled,
           N'; Filtro=', COALESCE(i.filter_definition,N'<sin filtro>')))
    FROM alcance AS a CROSS JOIN objetivo AS o
    JOIN sys.indexes AS i ON i.object_id = o.IdTabla AND i.index_id > 0
    JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
    JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
    WHERE a.AccesoEsperado = 1
    UNION ALL
    SELECT N'DEPENDENCIA_SQL', CONVERT(nvarchar(128), OBJECT_SCHEMA_NAME(d.referencing_id)
           + N'.' + OBJECT_NAME(d.referencing_id)), CONVERT(nvarchar(max), CONCAT(
           N'Referencia=', COALESCE(d.referenced_schema_name,N'?'), N'.',
           COALESCE(d.referenced_entity_name,N'?'), N'.',
           COALESCE(COL_NAME(d.referenced_id,d.referenced_minor_id),N'<objeto>')))
    FROM alcance AS a CROSS JOIN objetivo AS o
    JOIN sys.sql_expression_dependencies AS d ON d.referenced_id = o.IdTabla
       OR (d.referenced_schema_name = N'dbo' AND d.referenced_entity_name = N'RecetaLinea')
    WHERE a.AccesoEsperado = 1
    UNION ALL
    SELECT N'FK_ENTRANTE', f.name, CONVERT(nvarchar(max), CONCAT(
           N'Desde=', OBJECT_SCHEMA_NAME(f.parent_object_id), N'.',
           OBJECT_NAME(f.parent_object_id), N'.', pc.name,
           N'; Hacia=', rc.name, N'; Deshabilitada=', f.is_disabled))
    FROM alcance AS a CROSS JOIN objetivo AS o
    JOIN sys.foreign_keys AS f ON f.referenced_object_id = o.IdTabla
    JOIN sys.foreign_key_columns AS fc ON fc.constraint_object_id = f.object_id
    JOIN sys.columns AS pc ON pc.object_id = fc.parent_object_id AND pc.column_id = fc.parent_column_id
    JOIN sys.columns AS rc ON rc.object_id = fc.referenced_object_id AND rc.column_id = fc.referenced_column_id
    WHERE a.AccesoEsperado = 1
) AS resultado
ORDER BY Categoria, Objeto, Detalle;
```

Esperado según evidencia anterior: 18 columnas totales; las seis presentes con `Nullable=0`, `nvarchar` con longitud **en bytes** 60/60/80/200, `decimal(12,3)` y `smallint`; tres CHECK habilitados/confiables, tres FK y cuatro índices. La consulta lista también las definiciones necesarias para detectar deriva. Si los permisos ocultan metadatos, el resultado **no** acredita ausencia de objetos.

## B. Recuperación: verificaciones concretas del DBA

Antes de solicitar DDL, el DBA designado debe dejar evidencia de: (1) recurso lógico, servidor, suscripción y `db_Clinica` correctos; (2) retención PITR **real** de esa base y ventana restaurable; (3) punto de recuperación anterior al cambio, expresado en UTC; (4) identidad con permisos para restaurar, distinta de `aud_empresa`; (5) capacidad/cuota para crear y aislar la base restaurada; (6) pasos y responsables para reconciliar operaciones posteriores al punto de restauración, incluidos los identificadores de receta y claves idempotentes. Azure SQL documenta que PITR usa copias administradas y restaura a una base nueva, sin sobrescribir la original: [copias automáticas](https://learn.microsoft.com/en-us/azure/azure-sql/database/automated-backups-overview?view=azuresql), [restauración](https://learn.microsoft.com/en-us/azure/azure-sql/database/recovery-using-backups?view=azuresql). **No hay evidencia local de responsable nominal, retención configurada o ensayo de recuperación.** No se creó ni restauró recurso alguno.

## C. Artefactos locales verificados

| Verificación | Resultado |
|---|---|
| API Release | `dotnet restore API-Clinica.Tests/API-Clinica.Tests.csproj` y `dotnet build API-Clinica/API-Clinica.csproj --configuration Release --no-restore`: correctos, 0 advertencias/errores. |
| .NET focalizado sin SQL | 33/33: `RecetaClinicaPreparadorTests`, `RecetaJsonHttpTests`, `RecetasClinicasControllerTests`. El primer testhost no conectó dentro del sandbox; repetición autorizada fuera de él aprobada. No prueba persistencia. |
| SQL aislado | `RecetaSqlIntegrationTests` y fixture disponibles, detrás de `CLINICA_SQL_INTEGRATION=1` (ausente). **No ejecutados**: crearían/escribirían una base temporal, prohibido en este corte. Los 16 controles de DB-REC-SIMPLE-03 son evidencia anterior. |
| Angular | `npm run build -- --configuration production`: correcto. Pruebas focalizadas de formulario/servicio: 45/45; ChromeHeadless falló inicialmente dentro del sandbox y pasó fuera con `CHROME_BIN` explícito. |
| Barrera y URL | `RECETA_SIMPLE_WRITE_ENABLED` tiene factory `false`; solo las pruebas lo proveen como `true`. El botón y `confirmar()` impiden el POST. `angular.json` no reemplaza `environment.ts` en producción; `environment.apiUrl` es `http://localhost:5293/api` y el bundle producido contiene esa URL. **El build no es apto para otro destino sin configurar la URL autorizada.** |
| Git | HEAD `969812ad63c5549c853f004a21a361676982cbcf`; cambios locales previos sin commit en servicio, pruebas y frontend, más directorios documentales sin seguimiento. Ningún artefacto aquí acredita lo que ejecuta una instancia activa. |

SHA256 de archivos **generados localmente** después de las verificaciones:

| Artefacto | SHA256 |
|---|---|
| `API-Clinica/bin/Release/net10.0/API-Clinica.dll` | `CD39024955EC2B64761BC58EEFF88E903E6B7EC065DCC0806EEDB808F1562379` |
| `API-Clinica.Tests/bin/Release/net10.0/API-Clinica.Tests.dll` | `CF179D66FAFAA10D34A161879B50326CA2B5584B34E78A36A5BC8E88D8288D58` |
| `WebClinica/dist/web-clinica/browser/index.html` | `52C173F19C4DF28BEF2143CF61A328ED1DA07199831EAB3B70C04ABD7A207E4C` |
| `WebClinica/dist/web-clinica/browser/main-SRB46BC6.js` | `03326BB57FE845A9A20E90E9976AF263AAD62740411FC0BFF6603A91460E0AA9` |
| `WebClinica/dist/web-clinica/browser/chunk-645ZQLXC.js` (URL API) | `8273F7B211DA7279406B01DD5D605CEE8EFE8D5F0E7CB603C5DEC15C2BCEA8F7` |
| `WebClinica/dist/web-clinica/browser/polyfills-5CFQRCPP.js` | `15C6F58707B9B19116FDE3A3F6A0CE9CF83427D64A91E95CB91FE1056C3DA616` |
| `WebClinica/dist/web-clinica/browser/styles-GBJC2ZEH.css` | `8711378B37A0BE3A7222A8E9826164480030D1C40CEE0BEA3024E19B85EE10FA` |

El bundle Angular contiene 67 archivos. Digest SHA256 reproducible de su manifiesto completo: `9905112F6D2FB359D97163C7247DE251A88838F6497302A98B128AD1C22D3E24`. Se calcula ordenando rutas relativas, concatenando por archivo `<ruta con /> <SHA256>` con LF UTF-8 sin LF final, y aplicando SHA256 al texto resultante. Los hashes identifican salidas locales, **no** artefactos desplegados.

## D. Suspensión reversible del POST

No se encontró configuración de proxy/ingress por ruta en el repositorio; la barrera Angular no cubre clientes directos. **Mecanismo propuesto de menor impacto si el punto de entrada real lo soporta:** regla temporal en el gateway/reverse proxy que responda `503` y `Retry-After` a todo `POST` cuyo camino normalizado coincida con `/api/consultas/{idConsulta:int}/recetas`, incluidos cambios de mayúsculas, barra final y codificación aceptados por el enrutador. Dejar `GET` y otras rutas intactos. Registrar ID, propietario, ámbito, hora y prueba de que ningún cliente puede eludir el gateway; ensayar en entorno no productivo. Reversión: retirar **esa única regla**, comprobar POST autorizado en prueba aislada y conservar el token Angular en `false` hasta la habilitación aprobada.

**No hay evidencia de que dicho gateway exista o sea el único ingreso a la API.** Si no existe, se necesita una barrera de servidor específica (por ejemplo, un feature flag backend con respuesta 503), que sería otro cambio de código/despliegue sujeto a autorización. No se bloqueó ningún endpoint en esta fase.

## E. Pendientes y F. dictamen

**NO-GO.** Faltan: resultado remoto de la consulta única con `aud_empresa`; evidencia DBA de PITR/recuperación; punto de entrada único y mecanismo probado de suspensión del POST; URL de API correcta para el destino; artefactos/versiones efectivamente desplegables; aprobación específica que exceptúe la regla actual de BD inmutable y delimite el cambio de las seis nulabilidades. El script [DB-REC-SIMPLE-02](../DB-REC-SIMPLE-02/ALTER-RECETA-LINEA.sql) sigue bloqueado y el botón no debe activarse. Ninguna prueba local o hash sustituye esos requisitos.
