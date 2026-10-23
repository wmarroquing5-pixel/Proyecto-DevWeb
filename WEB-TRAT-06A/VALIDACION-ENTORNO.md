# WEB-TRAT-06A — Puerta de seguridad del entorno aislado

**Estado:** procedimiento documental. No se instaló SQL Server Express, no se creó base ni se abrió conexión. Complementa `WEB-TRAT-05/CONFIGURACION-AISLADA.md`; nunca reutilizar `DefaultConnection`, el usuario `aud_empresa`, datos clínicos reales ni el `script.sql` que comienza con `USE [db_Clinica]`.

## Identidad del destino antes de permitir una escritura futura

1. El DBA designa una instancia local Express y una base nueva sintética con prefijo fijo `ClinicaTratamiento_Aislado_`. Configuración externa, sin contraseña en repositorio ni salida de terminal. Perfil de aprovisionamiento separado del perfil de pruebas; privilegios mínimos.
2. Fuera de SQL, verificar que el host indicado es loopback/instancia local, sin alias DNS, túnel, redirección, réplica o vínculo a Azure. Inspeccionar configuración efectiva sin imprimir cadena completa. Rechazar cualquier `*.database.windows.net`, `db_Clinica` o instancia desconocida.
3. Solo **después de autorización de conexión** ejecutar consultas de metadatos: `DB_NAME()`, `SERVERPROPERTY('ServerName')`, `SERVERPROPERTY('Edition')`, `SERVERPROPERTY('EngineEdition')`, `ORIGINAL_LOGIN()`, `USER_NAME()` y `sys.tables`. Exigir edición Express (`EngineEdition = 4`), nombre de base exacto aprobado y servidor físico esperado; un nombre de perfil no es prueba.
4. El DBA demuestra por procedimiento de creación que la base está vacía de datos clínicos y que no deriva de respaldo productivo. No inspeccionar filas clínicas. Confirmar que no hay linked servers/sincronización/credenciales productivas usadas por el arnés de pruebas.
5. Registrar hash del esquema base **sanitizado** y del DDL aprobado, PK/FK/tipos/índices requeridos, versión y compatibility level del motor. Verificar permisos de la identidad de pruebas: DML solo en base aislada, sin `db_owner` ni acceso a otros destinos. Una identidad de aprovisionamiento podría tener DDL únicamente durante la ejecución separadamente autorizada.
6. Ejecutar prueba de conexión de solo metadatos antes de cualquier DDL; si cualquier dato no coincide, cerrar conexión y bloquear la batería. Revalidar la identidad en **cada ejecución**, no solo una vez. Registrar servidor/base/edición/usuario sin secretos.

## Consultas de preflight preparadas, NO ejecutadas

```sql
SELECT DB_NAME() AS BaseActual,
       CONVERT(nvarchar(128), SERVERPROPERTY('ServerName')) AS Instancia,
       CONVERT(nvarchar(128), SERVERPROPERTY('Edition')) AS Edicion,
       CONVERT(int, SERVERPROPERTY('EngineEdition')) AS EdicionMotor,
       ORIGINAL_LOGIN() AS LoginOriginal,
       USER_NAME() AS UsuarioBase;

SELECT s.name AS Esquema, t.name AS Tabla
FROM sys.tables AS t JOIN sys.schemas AS s ON s.schema_id = t.schema_id
WHERE s.name = N'dbo'
ORDER BY t.name;
```

Estos SELECT no crean base ni prueban que no existen datos reales; deben complementarse con evidencia administrativa de aprovisionamiento. El DDL revisado mantiene `THROW` inicial y **no puede ejecutarse como paquete de instalación**. No se redactó un sustituto ejecutable de `script.sql` ni se autorizó quitar la barrera.

## Parada obligatoria y evidencia futura

Si falta instancia Express local, el servidor/base no coincide, la conexión alcanza Azure, hay datos reales, perfiles excesivos, dependencias SQL incompatibles o no existe autorización separada para ejecución, detenerse sin DDL ni DML. La fase futura debe conservar salida de preflight, hashes, autorizaciones, versión de motor, resultados de pruebas sintéticas y prueba de cero conexiones a producción; WEB-TRAT-06A no produce esas evidencias de ejecución.
