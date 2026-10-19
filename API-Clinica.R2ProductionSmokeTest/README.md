# Prueba controlada de R2 productivo

Ejecutor independiente para operar sobre un único WebP sintético en `clinica-fotos`. No referencia la Web API, Entity Framework ni Azure SQL.

## Modo seguro predeterminado

Sin indicador de ejecución, valida la configuración y termina sin crear cliente S3 ni realizar conexiones remotas:

```powershell
dotnet run --project API-Clinica.R2ProductionSmokeTest/API-Clinica.R2ProductionSmokeTest.csproj --configuration Release
```

## Ejecución real autorizada

Requiere que la misma terminal contenga `R2__AccountId`, `R2__AccessKeyId`, `R2__SecretAccessKey` y `R2__BucketName=clinica-fotos`:

```powershell
dotnet run --project API-Clinica.R2ProductionSmokeTest/API-Clinica.R2ProductionSmokeTest.csproj --configuration Release -- --execute-production-smoke-test
```

El flujo primero exige una lectura HTTP 200 limitada al prefijo criptográfico de la ejecución. Después crea una sola clave `api-clinica-integration/{run-id}/foto.webp`, valida carga, recuperación, SHA-256, reemplazo y precondiciones ETag, y finalmente elimina y verifica la ausencia del objeto.

No repita automáticamente el comando después de un timeout o estado indeterminado. Use el `run-id` sanitizado de la salida para revisar manualmente la única clave posible.

## Códigos de salida

| Código | Resultado |
| --- | --- |
| 0 | Prueba exitosa; ETag obsoleto protegido también en DELETE |
| 2 | Configuración ausente, inválida o ejecución no preparada |
| 3 | Prueba exitosa con hallazgo: DELETE no protegió mediante ETag obsoleto |
| 4 | Autenticación o autorización insuficiente |
| 6 | Fallo de integridad u operación inesperada, con limpieza verificada cuando fue posible |
| 7 | Estado final indeterminado; requiere revisión manual del run-id |
