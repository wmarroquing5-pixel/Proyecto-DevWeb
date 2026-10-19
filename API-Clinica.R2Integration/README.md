# Ejecutor aislado de integración R2

Esta utilidad comprueba la API S3 de Cloudflare R2 sin cargar la Web API, Entity Framework ni `ClinicaDbContext`.

## Seguridad

- El modo predeterminado no crea el cliente S3 ni realiza conexiones remotas.
- Solo lee variables `R2TEST__*`.
- Rechaza expresamente el bucket `clinica-fotos`.
- Todas las claves se generan bajo `api-clinica-integration/{run-id}/`.
- Genera dos imágenes WebP sintéticas en memoria.
- No registra nombres de bucket, claves de objeto, credenciales ni ETag.
- El SDK tiene reintentos automáticos desactivados y un timeout de 30 segundos.

## Preparación local

```powershell
dotnet run --project API-Clinica.R2Integration/API-Clinica.R2Integration.csproj
```

Sin argumentos, el proceso solamente informa si la configuración está ausente, incompleta o lista.

## Variables para una ejecución futura

```text
R2TEST__AccountId
R2TEST__AccessKeyId
R2TEST__SecretAccessKey
R2TEST__BucketName
```

Las credenciales deben tener permiso `Object Read & Write` únicamente sobre un bucket privado de pruebas. No deben almacenarse en el repositorio ni pasarse como argumentos.

## Ejecución real

La siguiente orden está reservada para una fase posterior con autorización expresa:

```powershell
dotnet run --project API-Clinica.R2Integration/API-Clinica.R2Integration.csproj -- --execute-real-r2
```

El flujo crea un único objeto sintético, valida carga, lectura, SHA-256, reemplazo y precondiciones ETag, comprueba experimentalmente `DeleteObject` con un ETag obsoleto y elimina el objeto al finalizar.
