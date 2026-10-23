# WEB-TRAT-05 — Configuración prevista de SQL Server Express aislado

**Nada de esta página se ejecutó.** La configuración es una guía para WEB-TRAT-06, no una autorización de conexión o DDL. No reutilizar `DefaultConnection`, `db_Clinica`, un backup con pacientes reales ni la identidad `aud_empresa` para pruebas de escritura.

## Perfil futuro

- Instancia local instalada y administrada para pruebas: `localhost\SQLEXPRESS` o `(local)\SQLEXPRESS`, tras verificar físicamente que apunta a este equipo. No usar IP pública, túnel ni `*.database.windows.net`.
- Base nueva sintética con nombre `ClinicaTratamiento_Aislado_<sufijo>`. Inicialmente vacía, con esquema base construido **solo** tras autorización de WEB-TRAT-06 y datos ficticios. SQL Server Express, no Azure SQL.
- Cadena de conexión de prueba mediante configuración externa/secretos locales, nunca en Git. Esquema de ejemplo **sin credenciales**: `Server=localhost\SQLEXPRESS;Database=ClinicaTratamiento_Aislado_<sufijo>;Integrated Security=True;Encrypt=True;TrustServerCertificate=True`. La confianza de certificado se limita a la instancia local; el DBA definirá el perfil definitivo.
- Identidades separadas: una de aprovisionamiento aislado para el DDL aprobado y otra de aplicación/pruebas con mínimo privilegio. Denegar conexiones de prueba a producción; no copiar permisos productivos ni asignar automáticamente RBAC clínico.

## Puertas antes de cualquier ejecución futura

1. Confirmar en el gestor de conexiones y en la salida de metadatos el servidor físico, edición Express, base y principal. La mera etiqueta de perfil no basta.
2. Confirmar `DB_NAME()` con prefijo aislado y distinto de `db_Clinica`; `SERVERPROPERTY('Edition')` debe indicar Express y `SERVERPROPERTY('ServerName')` la instancia local esperada. Cualquier diferencia detiene la prueba.
3. Confirmar que la base no tiene filas clínicas reales ni sincronización/enlace con Azure. Revisar cadena efectiva **sin imprimirla**; registrar solo servidor/base/identidad no secreta.
4. Inspeccionar `sys.tables` para evitar colisión de las siete tablas y confirmar tablas base/FK. Verificar hash de scripts revisados y autorización. `DDL-PROPUESTO.sql` seguirá bloqueado por `THROW`; crear copia ejecutable separada únicamente después de aprobación.
5. Configurar el ejecutor para abortar ante error, transacciones de prueba y cleanup de datos **solo dentro de la base aislada**, sin `DROP` de recursos ajenos. No preparar automatismos de limpieza en esta fase.

## Consultas de preflight previstas, de solo lectura (NO ejecutadas)

```sql
SELECT DB_NAME() AS BaseActual,
       CONVERT(nvarchar(128), SERVERPROPERTY('ServerName')) AS Instancia,
       CONVERT(nvarchar(128), SERVERPROPERTY('Edition')) AS Edicion,
       CONVERT(int, SERVERPROPERTY('EngineEdition')) AS EdicionMotor,
       ORIGINAL_LOGIN() AS IdentidadConexion,
       USER_NAME() AS UsuarioBase;

SELECT s.name AS Esquema, t.name AS Tabla
FROM sys.tables AS t
JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
  AND t.name IN (N'Consulta', N'Diagnostico', N'Tratamiento', N'Usuario',
                 N'Medicamento', N'LoteMedicamento', N'MovimientoInventario',
                 N'RecetaClinica', N'RecetaLinea', N'EntregaFarmacia',
                 N'EntregaDetalle', N'AdministracionClinica', N'SalidaClinica',
                 N'CorreccionClinica')
ORDER BY t.name;
```

**Regla de abortar de la futura herramienta de pruebas:** aceptar solo `EngineEdition = 4` (SQL Server Express), instancia local expresamente aprobada y base con el prefijo exacto; rechazar cualquier host Azure o base productiva antes de abrir una transacción o cargar datos. Revalidar en cada ejecución, no solo durante la instalación. La consulta anterior por sí sola no autoriza DDL.

`script.sql` local comienza con `USE [db_Clinica]`. **Jamás ejecutarlo tal cual** como preparación: una copia de esquema mínima para SQL Express deberá tener contexto aislado fijo, revisión DBA y hash nuevo. No se crea esa copia operativa ni se instala SQL Server Express en WEB-TRAT-05.
