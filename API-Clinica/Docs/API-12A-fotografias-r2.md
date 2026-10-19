# API-12A — Fotografías privadas en Cloudflare R2

## Diseño

- El bucket permanece privado y la API es el único intermediario para carga, lectura y eliminación.
- `Paciente.UrlFoto` y `Medicamento.ImagenURL` guardan únicamente la ruta relativa estable de la API.
- Las claves R2 se generan en el servidor:
  - `pacientes/{id}/foto.webp`
  - `medicamentos/{id}/foto.webp`
- Los clientes no proporcionan nombres de objeto, rutas R2, URL públicas ni precios o datos de inventario.

## Endpoints

| Método | Ruta | Permiso dinámico |
| --- | --- | --- |
| POST | `/api/pacientes/{id}/foto` | `Pacientes/Modificar` |
| GET | `/api/pacientes/{id}/foto` | `Pacientes/Consultar` |
| DELETE | `/api/pacientes/{id}/foto` | `Pacientes/Modificar` |
| POST | `/api/medicamentos/{id}/foto` | `Medicamentos/Modificar` |
| GET | `/api/medicamentos/{id}/foto` | `Medicamentos/Consultar` |
| DELETE | `/api/medicamentos/{id}/foto` | `Medicamentos/Modificar` |

Todos requieren JWT. El manejador RBAC existente vuelve a validar que el usuario y el rol estén activos y consulta el permiso actual en la base de datos.

La política provisional aprobada permite a cualquier identidad que ya tenga `Pacientes/Consultar` leer la fotografía de cualquier paciente. No concede el permiso a usuarios nuevos. Sigue pendiente una política por paciente o relación clínica; hasta definirla, ese permiso debe asignarse solamente a personal autorizado para consultar fotografías de toda la población de pacientes.

## Contrato de carga

- `Content-Type`: `multipart/form-data`.
- Campo: `foto`.
- Formatos de entrada: JPEG, PNG o WebP.
- Tamaño máximo: 5 MB.
- La API comprueba el MIME declarado y el formato real, rechaza contenido vacío, animado o malformado y limita dimensiones y píxeles descomprimidos.
- La salida siempre se vuelve a codificar como WebP, con dimensión máxima de 2048 px. La recodificación desde píxeles elimina EXIF, GPS y otros metadatos del archivo original.
- La respuesta de carga contiene una ruta relativa, por ejemplo `{ "url": "/api/pacientes/15/foto" }`.
- GET devuelve bytes `image/webp`. Pacientes usa `Cache-Control: private, no-store`; medicamentos usa caché privada corta. Ambas respuestas incluyen `X-Content-Type-Options: nosniff`.

## Configuración

No se almacenan credenciales en archivos versionados. En desarrollo:

```powershell
dotnet user-secrets --project API-Clinica/API-Clinica.csproj set "R2:AccountId" "<account-id>"
dotnet user-secrets --project API-Clinica/API-Clinica.csproj set "R2:AccessKeyId" "<access-key-id>"
dotnet user-secrets --project API-Clinica/API-Clinica.csproj set "R2:SecretAccessKey" "<secret-access-key>"
dotnet user-secrets --project API-Clinica/API-Clinica.csproj set "R2:BucketName" "clinica-fotos"
```

En Azure App Service, crear Application Settings con los nombres:

- `R2__AccountId`
- `R2__AccessKeyId`
- `R2__SecretAccessKey`
- `R2__BucketName=clinica-fotos`

La URL S3 se construye como `https://{AccountId}.r2.cloudflarestorage.com`; no se acepta un endpoint arbitrario. Una configuración parcial o un bucket distinto impiden iniciar la aplicación. Si toda la sección está vacía, las demás funciones pueden iniciar y las operaciones fotográficas devuelven ProblemDetails HTTP 503 sin intentar otro almacenamiento.

Las credenciales R2 deben limitarse al bucket `clinica-fotos` y a las operaciones de objeto requeridas. El bucket y sus objetos no deben permitir acceso público.

El cliente usa firma SigV4 con región de autenticación `auto`, direccionamiento por ruta y un tiempo límite de 30 segundos por operación. Las cargas usan longitud conocida, no usan `aws-chunked` y limitan los checksums flexibles del SDK a `WHEN_REQUIRED`; un `Content-MD5` explícito, la firma del payload y HTTPS conservan la verificación de integridad compatible con R2. `MaxErrorRetry` y `MaxStaleConnectionRetries` se fijan en cero para que el SDK no repita automáticamente escrituras cuyo resultado podría ser ambiguo. La cancelación de la solicitud HTTP se propaga al SDK; un vencimiento interno se traduce a HTTP 503 sin exponer detalles del proveedor.

## Dependencias

- `AWSSDK.S3 4.0.101.4`, licencia Apache-2.0. La versión 4 usa firma AWS V4 y se configura con región de autenticación `auto`, endpoint explícito y `ForcePathStyle`.
- `SkiaSharp 4.153.1` y activos nativos Linux, licencia MIT, para validar y normalizar imágenes.
- `SixLabors.ImageSharp 4.1.3` no se incorporó: esa versión exige una clave de licencia Six Labors en tiempo de ejecución. Incorporarla sin una licencia suministrada habría impedido procesar fotografías.

NuGet ofrece `AWSSDK.S3 4.0.104.4` como versión posterior. Se conserva la versión aprobada `4.0.101.4` porque el análisis de NuGet no reporta vulnerabilidades conocidas; se recomienda evaluar la actualización en una fase separada con pruebas de compatibilidad R2.

## Fallos parciales y concurrencia

- Un bloqueo local por clave serializa las pruebas no relacionales. Con SQL Server, `sp_getapplock` mantiene un bloqueo exclusivo de sesión por fotografía desde la revalidación de la entidad hasta la confirmación SQL o la compensación; esto coordina todas las instancias de la API que utilizan la misma base.
- Las condiciones R2 `If-None-Match` e `If-Match` con ETag protegen cargas y reemplazos y convierten colisiones en HTTP 409.
- R2 acepta `DeleteObject` aunque su `If-Match` sea obsoleto. Por ello, el flujo funcional no usa borrado físico: primero limpia la ruta SQL dentro de una transacción asociada a la misma conexión que mantiene `sp_getapplock` y después reemplaza el objeto por un marcador WebP privado mediante `PUT If-Match`.
- Si la conexión propietaria del bloqueo se pierde antes del commit SQL, la transacción se revierte. Si se pierde después, una operación anterior ya no vuelve a escribir SQL y su marcador condicionado no puede sobrescribir una fotografía nueva.
- La fotografía anterior no se elimina antes de guardar la nueva.
- Si R2 falla antes de persistir SQL, la ruta SQL no cambia.
- Si SQL falla después de guardar, la API intenta restaurar el objeto anterior o sustituir el objeto nuevo por el marcador con una precondición ETag y un tiempo límite independiente.
- Si la escritura del marcador falla después de limpiar SQL, la fotografía deja de ser accesible por la API y el objeto pendiente se identifica mediante conciliación operativa; no se restaura una referencia que podría pertenecer a una versión obsoleta.
- Si SQL conserva una ruta pero el objeto ya no existe, DELETE limpia esa referencia obsoleta y responde 204.
- Un fallo de la compensación se registra sin contenido binario, credenciales ni detalle del SDK y requiere conciliación operativa.

R2 y Azure SQL no ofrecen una transacción distribuida. Una interrupción del proceso en la ventana entre ambas confirmaciones puede dejar un objeto o marcador huérfano, pero una referencia SQL eliminada impide que el contenido sea servido por la API. La clave determinista evita exposición de otros objetos y permite una conciliación de solo lectura que compare rutas SQL y objetos R2. La implementación no promete atomicidad distribuida.

## Prueba operativa con R2

La integración real debe ejecutarse únicamente con un bucket de pruebas independiente, credenciales restringidas a ese bucket y objetos sintéticos. El procedimiento debe comprobar carga, lectura, reemplazo condicionado por ETag, rechazo de una precondición obsoleta, eliminación y limpieza final. No debe usar Azure SQL productivo ni fotografías reales.

La configuración de la aplicación acepta deliberadamente solo `clinica-fotos`, por lo que una prueba contra otro bucket debe realizarse con un arnés aislado que instancie el cliente S3 con configuración exclusiva de prueba. No se debe relajar la validación del bucket de la aplicación para ejecutar esa prueba. Ante timeout no se repite automáticamente una carga, reemplazo o eliminación; primero se consulta el estado del objeto por su clave determinista y ETag.

## Consumo desde Angular

- Enviar `FormData` con el archivo bajo la clave `foto`; no establecer manualmente el boundary.
- Enviar el JWT como Bearer en POST, GET y DELETE.
- Tratar GET como blob `image/webp` y crear una URL local de objeto solo durante la vida del componente; revocarla al descartarla.
- Utilizar la ruta relativa retornada por la API. No construir ni almacenar URL de R2.
- Manejar ProblemDetails para 400, 401, 403, 404, 409, 413, 415 y 503.

