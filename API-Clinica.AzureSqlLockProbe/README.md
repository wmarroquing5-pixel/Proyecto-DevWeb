# API-12G5 Azure SQL lock probe

Esta utilidad verifica de forma aislada la exclusividad de bloqueos de aplicación
con dos conexiones independientes. No consulta datos clínicos ni ejecuta
operaciones DML o DDL.

La ejecución remota está deshabilitada por defecto. Requiere simultáneamente:

- el argumento `--execute-production-lock-probe`;
- la variable temporal `AZURESQL_LOCK_PROBE_AUTHORIZATION` con el valor exacto
  `API-12G5-AUTHORIZED`;
- `ConnectionStrings:DefaultConnection` en el mismo almacén de User Secrets de
  la API, o `ConnectionStrings__DefaultConnection` en el entorno.

La utilidad rechaza destinos distintos de
`tcp:srwemg.database.windows.net,1433` / `db_Clinica`, exige cifrado con
validación de certificado y deshabilita reintentos automáticos.

No debe ejecutarse contra producción hasta recibir autorización expresa para
invocar `sys.sp_getapplock` y `sys.sp_releaseapplock`.
