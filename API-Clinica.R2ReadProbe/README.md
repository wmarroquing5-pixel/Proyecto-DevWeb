# Comprobación R2 productiva de solo lectura

Utilidad independiente para comprobar autenticación y autorización sobre el bucket privado `clinica-fotos`.

## Garantías

- Lee únicamente `R2__AccountId`, `R2__AccessKeyId`, `R2__SecretAccessKey` y `R2__BucketName`.
- Exige que el bucket coincida exactamente con `clinica-fotos`.
- Solo ejecuta resolución DNS y `ListObjectsV2` con `MaxKeys=1`.
- No muestra nombres de objetos, direcciones IP, credenciales ni tokens.
- No contiene llamadas a `PutObject`, `DeleteObject` ni otras operaciones de escritura.
- No referencia la Web API, Entity Framework o Azure SQL.
- Utiliza HTTPS, región `auto`, firma SigV4, timeout de 30 segundos y cero reintentos automáticos.

## Ejecución desde PowerShell

Después de definir las cuatro variables en la misma terminal:

```powershell
dotnet run --project API-Clinica.R2ReadProbe/API-Clinica.R2ReadProbe.csproj --configuration Release
```

No coloque los secretos dentro del comando ni en archivos versionados.

## Códigos de salida

| Código | Significado |
| --- | --- |
| 0 | Conexión, autenticación y listado correctos |
| 2 | Configuración incompleta, inválida o bucket incorrecto |
| 3 | Fallo de DNS |
| 4 | Credenciales o firma inválidas |
| 5 | Permiso de lectura denegado o bucket inexistente |
| 6 | Fallo TLS |
| 7 | Timeout o cancelación |
| 8 | Fallo de conectividad después de resolver DNS |
| 9 | Error R2 o error no clasificado |
