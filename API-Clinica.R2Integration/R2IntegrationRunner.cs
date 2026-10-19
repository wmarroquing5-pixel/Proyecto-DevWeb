using System.Net;
using System.Security.Cryptography;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using SkiaSharp;

namespace API_Clinica.R2Integration;

internal sealed class R2IntegrationRunner(R2TestOptions options) : IDisposable
{
    private const string TestRootPrefix = "api-clinica-integration/";
    private static readonly TimeSpan OperationTimeout = TimeSpan.FromSeconds(30);
    private readonly IAmazonS3 client = CreateClient(options);

    public async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        var runId = $"{DateTime.UtcNow:yyyyMMddTHHmmssZ}-{Guid.NewGuid():N}";
        var runPrefix = $"{TestRootPrefix}{runId}/";
        var key = $"{runPrefix}foto.webp";
        EnsureTestPrefix(runPrefix);
        EnsureTestKey(key);

        var objectMayExist = false;
        var conditionalDeleteSupported = true;
        Console.WriteLine("Ejecución real autorizada: iniciando prueba sobre objeto sintético.");
        Console.WriteLine("El nombre del bucket, las credenciales, la clave y los ETag no se registrarán.");

        try
        {
            await EnsurePrefixEmptyAsync(runPrefix, cancellationToken);

            var firstContent = CreateSyntheticWebP(SKColors.CornflowerBlue);
            var firstEntityTag = await PutAsync(
                key, firstContent, ifNoneMatch: "*", ifMatch: null, cancellationToken);
            objectMayExist = true;
            Console.WriteLine("1/8 Carga condicional: APROBADA.");

            var downloadedFirst = await GetAsync(key, cancellationToken);
            EnsureSameContent(firstContent, downloadedFirst);
            Console.WriteLine("2/8 Recuperación y SHA-256: APROBADA.");

            var secondContent = CreateSyntheticWebP(SKColors.OrangeRed);
            var secondEntityTag = await PutAsync(
                key, secondContent, ifNoneMatch: null, ifMatch: firstEntityTag, cancellationToken);
            if (string.Equals(firstEntityTag, secondEntityTag, StringComparison.Ordinal))
                throw new InvalidOperationException("R2 devolvió el mismo ETag después del reemplazo.");
            Console.WriteLine("3/8 Reemplazo condicionado: APROBADO.");

            await ExpectPreconditionFailureAsync(() => PutAsync(
                key, firstContent, ifNoneMatch: null, ifMatch: firstEntityTag, cancellationToken));
            Console.WriteLine("4/8 Rechazo de ETag obsoleto en PutObject: APROBADO.");

            var downloadedSecond = await GetAsync(key, cancellationToken);
            EnsureSameContent(secondContent, downloadedSecond);
            Console.WriteLine("5/8 Contenido vigente: APROBADO.");

            try
            {
                await DeleteAsync(key, firstEntityTag, cancellationToken);
                objectMayExist = false;
                conditionalDeleteSupported = false;
                Console.WriteLine(
                    "6/8 DeleteObject con ETag obsoleto fue aceptado: HALLAZGO, la precondición no protegió el objeto.");
            }
            catch (AmazonS3Exception exception) when (
                exception.StatusCode == HttpStatusCode.PreconditionFailed)
            {
                Console.WriteLine("6/8 DeleteObject rechazó el ETag obsoleto: APROBADO.");
            }

            if (objectMayExist)
            {
                await DeleteAsync(key, secondEntityTag, cancellationToken);
                objectMayExist = false;
            }
            Console.WriteLine("7/8 Eliminación del objeto sintético: APROBADA.");

            await EnsureObjectMissingAsync(key, cancellationToken);
            await EnsurePrefixEmptyAsync(runPrefix, cancellationToken);
            Console.WriteLine("8/8 Prefijo final vacío: APROBADO.");
            return conditionalDeleteSupported ? 0 : 3;
        }
        catch (AmazonS3Exception exception)
        {
            Console.Error.WriteLine(
                $"R2 rechazó la operación. HTTP={(int)exception.StatusCode}; código={exception.ErrorCode ?? "no-disponible"}.");
            return 4;
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("La prueba fue cancelada o excedió el tiempo límite.");
            return 5;
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine($"La prueba falló. Tipo={exception.GetType().Name}.");
            return 6;
        }
        finally
        {
            if (objectMayExist)
                await ReconcileAndCleanupAsync(key);
        }
    }

    private async Task EnsurePrefixEmptyAsync(string prefix, CancellationToken cancellationToken)
    {
        EnsureTestPrefix(prefix);
        var response = await WithTimeoutAsync(token => client.ListObjectsV2Async(
            new ListObjectsV2Request
            {
                BucketName = options.BucketName,
                Prefix = prefix,
                MaxKeys = 1
            }, token), cancellationToken);
        if (response.S3Objects.Count != 0)
            throw new InvalidOperationException("El prefijo aislado no está vacío.");
    }

    private async Task<string> PutAsync(
        string key,
        byte[] content,
        string? ifNoneMatch,
        string? ifMatch,
        CancellationToken cancellationToken)
    {
        EnsureTestKey(key);
        await using var stream = new MemoryStream(content, writable: false);
        var response = await WithTimeoutAsync(token => client.PutObjectAsync(
            new PutObjectRequest
            {
                BucketName = options.BucketName,
                Key = key,
                InputStream = stream,
                AutoCloseStream = false,
                ContentType = "image/webp",
                DisablePayloadSigning = false,
                IfNoneMatch = ifNoneMatch,
                IfMatch = ifMatch
            }, token), cancellationToken);
        var entityTag = response.ETag?.Trim();
        return !string.IsNullOrWhiteSpace(entityTag)
            ? entityTag
            : throw new InvalidOperationException("R2 no devolvió ETag.");
    }

    private async Task<byte[]> GetAsync(string key, CancellationToken cancellationToken)
    {
        EnsureTestKey(key);
        using var response = await WithTimeoutAsync(
            token => client.GetObjectAsync(options.BucketName, key, token), cancellationToken);
        await using var destination = new MemoryStream();
        await response.ResponseStream.CopyToAsync(destination, cancellationToken);
        return destination.ToArray();
    }

    private async Task DeleteAsync(
        string key, string expectedEntityTag, CancellationToken cancellationToken)
    {
        EnsureTestKey(key);
        await WithTimeoutAsync(token => client.DeleteObjectAsync(
            new DeleteObjectRequest
            {
                BucketName = options.BucketName,
                Key = key,
                IfMatch = expectedEntityTag
            }, token), cancellationToken);
    }

    private async Task EnsureObjectMissingAsync(string key, CancellationToken cancellationToken)
    {
        try
        {
            _ = await GetAsync(key, cancellationToken);
            throw new InvalidOperationException("El objeto sintético continúa disponible.");
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
        }
    }

    private static async Task ExpectPreconditionFailureAsync(Func<Task<string>> operation)
    {
        try
        {
            _ = await operation();
            throw new InvalidOperationException("R2 aceptó una precondición ETag obsoleta.");
        }
        catch (AmazonS3Exception exception) when (
            exception.StatusCode == HttpStatusCode.PreconditionFailed)
        {
        }
    }

    private async Task ReconcileAndCleanupAsync(string key)
    {
        try
        {
            using var timeout = new CancellationTokenSource(OperationTimeout);
            await WithTimeoutAsync(token => client.DeleteObjectAsync(
                new DeleteObjectRequest
                {
                    BucketName = options.BucketName,
                    Key = key
                }, token), timeout.Token);
            Console.WriteLine("Limpieza de contingencia: completada.");
        }
        catch (Exception exception)
        {
            Console.Error.WriteLine(
                $"Limpieza de contingencia pendiente. Tipo={exception.GetType().Name}.");
        }
    }

    private static IAmazonS3 CreateClient(R2TestOptions options) =>
        new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey),
            new AmazonS3Config
            {
                ServiceURL = options.GetServiceUrl(),
                ForcePathStyle = true,
                AuthenticationRegion = "auto",
                MaxErrorRetry = 0,
                MaxStaleConnectionRetries = 0,
                Timeout = OperationTimeout
            });

    private static async Task<T> WithTimeoutAsync<T>(
        Func<CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(OperationTimeout);
        return await operation(timeout.Token);
    }

    private static byte[] CreateSyntheticWebP(SKColor color)
    {
        using var bitmap = new SKBitmap(16, 16);
        bitmap.Erase(color);
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, 85)
            ?? throw new InvalidOperationException("No fue posible crear la imagen sintética.");
        return encoded.ToArray();
    }

    private static void EnsureSameContent(byte[] expected, byte[] actual)
    {
        var expectedHash = SHA256.HashData(expected);
        var actualHash = SHA256.HashData(actual);
        if (!CryptographicOperations.FixedTimeEquals(expectedHash, actualHash))
            throw new InvalidOperationException("El contenido recuperado no coincide con el enviado.");
    }

    private static void EnsureTestPrefix(string prefix)
    {
        if (!prefix.StartsWith(TestRootPrefix, StringComparison.Ordinal) ||
            prefix.Contains("..", StringComparison.Ordinal) ||
            !prefix.EndsWith('/'))
            throw new InvalidOperationException("El prefijo de prueba no está permitido.");
    }

    private static void EnsureTestKey(string key)
    {
        if (!key.StartsWith(TestRootPrefix, StringComparison.Ordinal) ||
            key.Contains("..", StringComparison.Ordinal) ||
            key.Contains('\\') ||
            !key.EndsWith("/foto.webp", StringComparison.Ordinal))
            throw new InvalidOperationException("La clave de prueba no está permitida.");
    }

    public void Dispose() => client.Dispose();
}
