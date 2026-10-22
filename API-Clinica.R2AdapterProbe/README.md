# API-12I — Prueba operativa del adaptador R2

Esta utilidad invoca el `CloudflareR2PhotoStorageService` real sobre un único
WebP sintético. No referencia `ClinicaDbContext`, no consulta Azure SQL y no
opera sobre rutas de pacientes o medicamentos.

## Modo seguro predeterminado

```powershell
dotnet run --project .\API-Clinica.R2AdapterProbe\API-Clinica.R2AdapterProbe.csproj --configuration Release
```

Sin argumentos, termina antes de leer `R2__*`, crear el cliente S3 o abrir una
conexión remota.

## Condiciones para una ejecución futura

La ejecución remota requiere simultáneamente:

1. evidencia aprobada de la prueba productiva API-12G5;
2. autorización expresa para API-12I;
3. las cuatro variables externas `R2__AccountId`, `R2__AccessKeyId`,
   `R2__SecretAccessKey` y `R2__BucketName=fotos-clinica`;
4. el argumento exacto `--execute-production-r2-adapter-probe`.

El ejecutor acepta exclusivamente la clave
`api-clinica-integration/{run-id}/foto.webp`, donde `run-id` es un GUID aleatorio
de la ejecución. Valida carga condicional, recuperación y SHA-256, reemplazo
condicional, rechazo de un ETag obsoleto y limpieza. Ante un estado ambiguo,
concilia por lectura y solo elimina contenido sintético reconocido.

Después de comprobar y documentar API-12G5, y de recibir autorización expresa
para las escrituras sintéticas de API-12I, el comando será:

```powershell
$env:API12I_R2_ADAPTER_PROBE_AUTHORIZATION = "API-12I-AUTHORIZED"
$env:API12I_API12G5_STATUS = "API-12G5-VERIFIED"
try {
  dotnet run --project .\API-Clinica.R2AdapterProbe\API-Clinica.R2AdapterProbe.csproj --configuration Release --no-build -- --execute-production-r2-adapter-probe
} finally {
  Remove-Item Env:\API12I_R2_ADAPTER_PROBE_AUTHORIZATION -ErrorAction SilentlyContinue
  Remove-Item Env:\API12I_API12G5_STATUS -ErrorAction SilentlyContinue
}
```

Este comando hereda `R2__*` de la terminal. No debe ejecutarse si API-12G5 no
tiene evidencia aprobada o si el propietario no autorizó API-12I por separado.

No repita automáticamente el comando si el resultado es indeterminado.
