using System.Net;
using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using SkiaSharp;

namespace API_Clinica.R2ProductionSmokeTest;

internal sealed class ProductionR2SmokeTestRunner : IDisposable
{
    private const string RootPrefix = "api-clinica-integration/";
    private const string ContentType = "image/webp";
    private static readonly TimeSpan OperationTimeout = TimeSpan.FromSeconds(30);

    private readonly ProductionR2Options options;
    private readonly IR2ObjectClient client;
    private readonly Func<SKColor, byte[]> imageFactory;
    private readonly TextWriter output;
    private readonly TextWriter error;
    private string stage = "Inicialización";
    private bool anyRemoteRequestSubmitted;
    private bool lastResponseReceived;
    private bool anyWriteRequestSubmitted;
    private string lastRemoteMethod = "NINGUNO";
    private string lastSafeHeaders = "NINGUNA";

    public ProductionR2SmokeTestRunner(ProductionR2Options options)
        : this(options, new AmazonR2ObjectClient(CreateClient(options)), CreateSyntheticWebP,
            Console.Out, Console.Error)
    {
    }

    internal ProductionR2SmokeTestRunner(
        ProductionR2Options options,
        IR2ObjectClient client,
        Func<SKColor, byte[]> imageFactory,
        TextWriter output,
        TextWriter error)
    {
        this.options = options ?? throw new ArgumentNullException(nameof(options));
        this.client = client ?? throw new ArgumentNullException(nameof(client));
        this.imageFactory = imageFactory ?? throw new ArgumentNullException(nameof(imageFactory));
        this.output = output ?? throw new ArgumentNullException(nameof(output));
        this.error = error ?? throw new ArgumentNullException(nameof(error));
    }

    public async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        var runId = Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();
        var runPrefix = $"{RootPrefix}{runId}/";
        var key = $"{runPrefix}foto.webp";
        EnsureRunPrefix(runPrefix, runId);
        EnsureRunKey(key, runId);

        var writeAttempted = false;
        var finalStateVerifiedClean = false;
        var objectsCreated = 0;
        var result = 6;

        output.WriteLine($"Run ID sintético: {runId}.");
        output.WriteLine("Alcance: una sola clave bajo api-clinica-integration/{run-id}/foto.webp.");
        output.WriteLine("No se registrarán credenciales, claves completas, contenido binario ni ETag completos.");

        try
        {
            stage = "Lectura inicial del prefijo";
            await VerifyReadAccessAndAbsenceAsync(runPrefix, key, cancellationToken);
            output.WriteLine("1/9 CONEXION: HTTP 200, HTTPS, SigV4 y lectura limitada al prefijo aprobados.");

            stage = "Generación WebP A";
            var versionA = imageFactory(SKColors.CornflowerBlue)
                ?? throw new InvalidOperationException("La generación WebP A devolvió contenido nulo.");
            stage = "Generación WebP B";
            var versionB = imageFactory(SKColors.OrangeRed)
                ?? throw new InvalidOperationException("La generación WebP B devolvió contenido nulo.");
            output.WriteLine($"SHA-256 A={SummarizeHash(versionA)}; SHA-256 B={SummarizeHash(versionB)}.");

            writeAttempted = true;
            stage = "Carga condicional de versión A";
            var entityTagA = await PutAsync(key, versionA, ifNoneMatch: "*", ifMatch: null, cancellationToken);
            objectsCreated = 1;
            stage = "Verificación posterior a carga A";
            await EnsureOnlyExpectedObjectAsync(runPrefix, key, expectedCount: 1, cancellationToken);
            output.WriteLine($"2/9 CARGA A: aprobada; ETag={SummarizeEntityTag(entityTagA)}.");

            stage = "Recuperación de versión A";
            await GetAndValidateAsync(key, versionA, cancellationToken);
            output.WriteLine("3/9 RECUPERACION A: Content-Type, tamaño y SHA-256 aprobados.");

            stage = "Reemplazo condicional por versión B";
            var entityTagB = await PutAsync(key, versionB, ifNoneMatch: null, ifMatch: entityTagA, cancellationToken);
            if (string.Equals(entityTagA, entityTagB, StringComparison.Ordinal))
                throw new InvalidOperationException("R2 devolvió el mismo ETag después del reemplazo.");
            stage = "Verificación posterior a reemplazo B";
            await EnsureOnlyExpectedObjectAsync(runPrefix, key, expectedCount: 1, cancellationToken);
            await GetAndValidateAsync(key, versionB, cancellationToken);
            output.WriteLine($"4/9 REEMPLAZO B: aprobado; ETag={SummarizeEntityTag(entityTagB)}.");

            stage = "PUT con ETag obsoleto";
            var stalePutRejected = await TryStalePutAsync(key, versionA, entityTagA, cancellationToken);
            if (!stalePutRejected)
                throw new StaleWriteAcceptedException();
            await GetAndValidateAsync(key, versionB, cancellationToken);
            output.WriteLine("5/9 ETAG OBSOLETO PUT: HTTP 412 y contenido B conservado.");

            stage = "DELETE con ETag obsoleto";
            var staleDeleteRejected = await TryStaleDeleteAsync(key, entityTagA, cancellationToken);
            if (staleDeleteRejected)
            {
                await GetAndValidateAsync(key, versionB, cancellationToken);
                output.WriteLine("6/9 ETAG OBSOLETO DELETE: HTTP 412; condición respetada.");
                stage = "Eliminación final condicionada";
                await DeleteAsync(key, entityTagB, cancellationToken);
            }
            else
            {
                var state = await ReadObjectStateAsync(key, cancellationToken);
                if (state.Exists)
                    throw new InvalidOperationException("DeleteObject aceptó la solicitud, pero el estado posterior es inesperado.");
                output.WriteLine("6/9 ETAG OBSOLETO DELETE: aceptado; la condición no protegió el objeto.");
            }

            stage = "Verificación final de limpieza";
            await EnsureObjectMissingAsync(key, cancellationToken);
            await EnsureOnlyExpectedObjectAsync(runPrefix, key, expectedCount: 0, cancellationToken);
            finalStateVerifiedClean = true;
            output.WriteLine("7/9 LIMPIEZA: objeto ausente.");
            output.WriteLine("8/9 PREFIJO: vacío.");
            output.WriteLine("9/9 AISLAMIENTO: exactamente una clave sintética creada; ningún objeto ajeno operado.");
            result = staleDeleteRejected ? 0 : 3;
        }
        catch (StaleWriteAcceptedException exception)
        {
            WriteDiagnostic(exception, "FALLO_CRITICO: R2 aceptó PutObject con un ETag obsoleto.");
            result = 6;
        }
        catch (AmazonS3Exception exception) when (IsAuthenticationFailure(exception))
        {
            WriteDiagnostic(exception, $"AUTENTICACION_FALLIDA: HTTP {(int)exception.StatusCode}; código={SafeCode(exception.ErrorCode)}.");
            result = 4;
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.Forbidden)
        {
            WriteDiagnostic(exception, $"AUTORIZACION_DENEGADA: HTTP 403; código={SafeCode(exception.ErrorCode)}.");
            result = 4;
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotImplemented)
        {
            WriteDiagnostic(exception,
                $"R2_NO_IMPLEMENTADO: HTTP 501; código={SafeCode(exception.ErrorCode)}; " +
                "checksum-solicitud=WHEN_REQUIRED; chunked=False; firma-payload-SigV4=True");
            result = 6;
        }
        catch (AmazonS3Exception exception)
        {
            WriteDiagnostic(exception, $"R2_ERROR: HTTP {(int)exception.StatusCode}; código={SafeCode(exception.ErrorCode)}.");
            result = 6;
        }
        catch (OperationCanceledException exception)
        {
            WriteDiagnostic(exception,
                "TIMEOUT_O_CANCELACION: no se repetirá automáticamente ninguna escritura.");
            result = 6;
        }
        catch (Exception exception)
        {
            WriteDiagnostic(exception, "PRUEBA_FALLIDA");
            result = 6;
        }
        finally
        {
            if (writeAttempted && !finalStateVerifiedClean)
            {
                finalStateVerifiedClean = await ReconcileAndCleanupOnceAsync(runId, runPrefix, key);
                if (!finalStateVerifiedClean)
                    result = 7;
            }

            if (!writeAttempted)
                finalStateVerifiedClean = true;
            output.WriteLine($"Objetos creados por esta ejecución: {objectsCreated}.");
            output.WriteLine($"Objetos restantes confirmados: {(finalStateVerifiedClean ? 0 : "no-verificable")}.");
        }

        return result;
    }

    private async Task VerifyReadAccessAndAbsenceAsync(
        string runPrefix,
        string key,
        CancellationToken cancellationToken)
    {
        await EnsureOnlyExpectedObjectAsync(runPrefix, key, expectedCount: 0, cancellationToken);
        var state = await ReadObjectStateAsync(key, cancellationToken);
        if (state.Exists)
            throw new InvalidOperationException("La clave sintética ya existe.");
    }

    private async Task EnsureOnlyExpectedObjectAsync(
        string runPrefix,
        string key,
        int expectedCount,
        CancellationToken cancellationToken)
    {
        EnsureRunPrefix(runPrefix, ExtractRunId(runPrefix));
        EnsureRunKey(key, ExtractRunId(runPrefix));
        BeforeRemoteRequest(isWrite: false, method: "GET", safeHeaders: "NINGUNA");
        var response = await WithTimeoutAsync(token => client.ListObjectsV2Async(
            new ListObjectsV2Request
            {
                BucketName = options.BucketName,
                Prefix = runPrefix,
                MaxKeys = 1
            }, token), cancellationToken);
        MarkResponse(response);

        if (response is null)
            throw new InvalidOperationException("ListObjectsV2 devolvió una respuesta nula.");
        if (response.HttpStatusCode != HttpStatusCode.OK)
            throw new InvalidOperationException("ListObjectsV2 no devolvió HTTP 200.");
        var objects = response.S3Objects ?? [];
        if (objects.Count != expectedCount)
            throw new InvalidOperationException("El prefijo contiene una cantidad inesperada de objetos.");
        if (expectedCount == 1 && !string.Equals(objects[0]?.Key, key, StringComparison.Ordinal))
            throw new InvalidOperationException("El prefijo contiene una clave distinta de la autorizada.");
        if (response.IsTruncated == true)
            throw new InvalidOperationException("El prefijo contiene más objetos de los permitidos.");
    }

    private async Task<string> PutAsync(
        string key,
        byte[] content,
        string? ifNoneMatch,
        string? ifMatch,
        CancellationToken cancellationToken)
    {
        EnsureKnownKey(key);
        await using var stream = new MemoryStream(content, writable: false);
        var request = BuildPutObjectRequest(
            options.BucketName,
            key,
            stream,
            content.LongLength,
            ifNoneMatch,
            ifMatch);
        var conditionalHeader = ifNoneMatch is not null ? "If-None-Match" : "If-Match";
        output.WriteLine(
            $"PERFIL PUT: método=PUT; cabeceras=Content-Type,Content-Length,Cache-Control,{conditionalHeader}; " +
            "checksum-solicitud=WHEN_REQUIRED; chunked=False; firma-payload-SigV4=True.");
        BeforeRemoteRequest(
            isWrite: true,
            method: "PUT",
            safeHeaders: $"Content-Type,Content-Length,Cache-Control,{conditionalHeader}");
        var response = await WithTimeoutAsync(
            token => client.PutObjectAsync(request, token), cancellationToken);
        MarkResponse(response);
        if (response is null)
            throw new InvalidOperationException("PutObject devolvió una respuesta nula.");
        return NormalizeEntityTag(response.ETag);
    }

    internal static PutObjectRequest BuildPutObjectRequest(
        string bucketName,
        string key,
        Stream content,
        long contentLength,
        string? ifNoneMatch,
        string? ifMatch)
    {
        EnsureKnownKey(key);
        var request = new PutObjectRequest
        {
            BucketName = bucketName,
            Key = key,
            InputStream = content,
            AutoCloseStream = false,
            ContentType = ContentType,
            DisablePayloadSigning = false,
            DisableDefaultChecksumValidation = true,
            UseChunkEncoding = false,
            IfNoneMatch = ifNoneMatch,
            IfMatch = ifMatch
        };
        request.Headers.CacheControl = "private, no-store";
        request.Headers.ContentLength = contentLength;
        return request;
    }

    private async Task GetAndValidateAsync(
        string key,
        byte[] expected,
        CancellationToken cancellationToken)
    {
        EnsureKnownKey(key);
        BeforeRemoteRequest(isWrite: false, method: "GET", safeHeaders: "NINGUNA");
        using var response = await WithTimeoutAsync(
            token => client.GetObjectAsync(options.BucketName, key, token), cancellationToken);
        MarkResponse(response);
        if (response is null)
            throw new InvalidOperationException("GetObject devolvió una respuesta nula.");
        if (!string.Equals(response.Headers?.ContentType, ContentType, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("El Content-Type recuperado no es image/webp.");
        if (response.ContentLength != expected.LongLength)
            throw new InvalidOperationException("El tamaño recuperado no coincide con el enviado.");

        await using var content = new MemoryStream();
        if (response.ResponseStream is null)
            throw new InvalidOperationException("GetObject devolvió un contenido nulo.");
        await response.ResponseStream.CopyToAsync(content, cancellationToken);
        if (!CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(expected), SHA256.HashData(content.ToArray())))
            throw new InvalidOperationException("El SHA-256 recuperado no coincide.");
    }

    private async Task<bool> TryStalePutAsync(
        string key,
        byte[] content,
        string staleEntityTag,
        CancellationToken cancellationToken)
    {
        try
        {
            _ = await PutAsync(key, content, ifNoneMatch: null, ifMatch: staleEntityTag, cancellationToken);
            return false;
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.PreconditionFailed)
        {
            return true;
        }
    }

    private async Task<bool> TryStaleDeleteAsync(
        string key,
        string staleEntityTag,
        CancellationToken cancellationToken)
    {
        try
        {
            await DeleteAsync(key, staleEntityTag, cancellationToken);
            return false;
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.PreconditionFailed)
        {
            return true;
        }
    }

    private async Task DeleteAsync(
        string key,
        string expectedEntityTag,
        CancellationToken cancellationToken)
    {
        EnsureKnownKey(key);
        BeforeRemoteRequest(isWrite: true, method: "DELETE", safeHeaders: "If-Match");
        var response = await WithTimeoutAsync(token => client.DeleteObjectAsync(
            new DeleteObjectRequest
            {
                BucketName = options.BucketName,
                Key = key,
                IfMatch = expectedEntityTag
            }, token), cancellationToken);
        MarkResponse(response);
        if (response is null)
            throw new InvalidOperationException("DeleteObject devolvió una respuesta nula.");
    }

    private async Task<ObjectState> ReadObjectStateAsync(
        string key,
        CancellationToken cancellationToken)
    {
        EnsureKnownKey(key);
        try
        {
            BeforeRemoteRequest(isWrite: false, method: "HEAD", safeHeaders: "NINGUNA");
            var response = await WithTimeoutAsync(token => client.GetObjectMetadataAsync(
                new GetObjectMetadataRequest
                {
                    BucketName = options.BucketName,
                    Key = key
                }, token), cancellationToken);
            MarkResponse(response);
            if (response is null)
                throw new InvalidOperationException("GetObjectMetadata devolvió una respuesta nula.");
            return new(true, NormalizeEntityTag(response.ETag));
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            return new(false, string.Empty);
        }
    }

    private async Task EnsureObjectMissingAsync(string key, CancellationToken cancellationToken)
    {
        if ((await ReadObjectStateAsync(key, cancellationToken)).Exists)
            throw new InvalidOperationException("El objeto sintético continúa disponible.");
    }

    private async Task<bool> ReconcileAndCleanupOnceAsync(string runId, string runPrefix, string key)
    {
        try
        {
            using var timeout = new CancellationTokenSource(OperationTimeout);
            var state = await ReadObjectStateAsync(key, timeout.Token);
            if (state.Exists)
            {
                if (string.IsNullOrWhiteSpace(state.EntityTag))
                    throw new InvalidOperationException("No se obtuvo ETag para la limpieza.");
                await DeleteAsync(key, state.EntityTag, timeout.Token);
            }

            await EnsureObjectMissingAsync(key, timeout.Token);
            await EnsureOnlyExpectedObjectAsync(runPrefix, key, expectedCount: 0, timeout.Token);
            output.WriteLine("Limpieza de contingencia: verificada.");
            return true;
        }
        catch (Exception exception)
        {
            var location = GetSafeLocation(exception);
            error.WriteLine($"LIMPIEZA_INDETERMINADA: run-id={runId}; tipo={exception.GetType().Name}; ubicación={location}.");
            return false;
        }
    }

    private static IAmazonS3 CreateClient(ProductionR2Options options) =>
        new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey),
            BuildClientConfiguration(options));

    internal static AmazonS3Config BuildClientConfiguration(ProductionR2Options options) =>
        new()
        {
            ServiceURL = options.GetServiceUrl(),
            ForcePathStyle = true,
            AuthenticationRegion = "auto",
            MaxErrorRetry = 0,
            MaxStaleConnectionRetries = 0,
            Timeout = OperationTimeout,
            RequestChecksumCalculation = RequestChecksumCalculation.WHEN_REQUIRED
        };

    private static async Task<T> WithTimeoutAsync<T>(
        Func<CancellationToken, Task<T>> operation,
        CancellationToken cancellationToken)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(OperationTimeout);
        return await operation(timeout.Token);
    }

    private void BeforeRemoteRequest(bool isWrite, string method, string safeHeaders)
    {
        anyRemoteRequestSubmitted = true;
        lastResponseReceived = false;
        lastRemoteMethod = method;
        lastSafeHeaders = safeHeaders;
        if (isWrite)
            anyWriteRequestSubmitted = true;
    }

    private void MarkResponse(object? response) =>
        lastResponseReceived = response is not null;

    private void WriteDiagnostic(Exception exception, string message)
    {
        var remoteState = anyWriteRequestSubmitted ? "INDETERMINADO_HASTA_RECONCILIAR" : "SIN_ESCRITURAS";
        error.WriteLine(
            $"{message}; etapa={stage}; tipo={exception.GetType().Name}; ubicación={GetSafeLocation(exception)}; " +
            $"método={lastRemoteMethod}; cabeceras={lastSafeHeaders}; " +
            $"solicitud-remota-enviada={anyRemoteRequestSubmitted}; respuesta-recibida={lastResponseReceived}; " +
            $"solicitud-escritura-potencial={anyWriteRequestSubmitted}; estado-remoto={remoteState}.");
    }

    private static string GetSafeLocation(Exception exception)
    {
        var frame = new StackTrace(exception, true).GetFrames()?
            .FirstOrDefault(candidate => candidate.GetFileLineNumber() > 0);
        if (frame is null)
            return "no-disponible";
        return $"{Path.GetFileName(frame.GetFileName())}:{frame.GetFileLineNumber()}";
    }

    private static byte[] CreateSyntheticWebP(SKColor color)
    {
        using var bitmap = new SKBitmap(16, 16);
        bitmap.Erase(color);
        using var image = SKImage.FromBitmap(bitmap)
            ?? throw new InvalidOperationException("No fue posible crear la imagen sintética.");
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, 85)
            ?? throw new InvalidOperationException("No fue posible crear la imagen WebP sintética.");
        return encoded.ToArray();
    }

    private static string SummarizeHash(byte[] content) =>
        Convert.ToHexString(SHA256.HashData(content))[..12].ToLowerInvariant();

    private static string SummarizeEntityTag(string entityTag) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(entityTag)))[..12].ToLowerInvariant();

    private static string NormalizeEntityTag(string? entityTag) =>
        !string.IsNullOrWhiteSpace(entityTag)
            ? entityTag.Trim()
            : throw new InvalidOperationException("R2 no devolvió ETag.");

    private static bool IsAuthenticationFailure(AmazonS3Exception exception) =>
        exception.StatusCode == HttpStatusCode.Unauthorized ||
        exception.ErrorCode is "InvalidAccessKeyId" or "SignatureDoesNotMatch" or "InvalidToken";

    private static string SafeCode(string? code) =>
        string.IsNullOrWhiteSpace(code) ? "no-disponible" : code;

    private static void EnsureRunPrefix(string prefix, string runId)
    {
        if (!string.Equals(prefix, $"{RootPrefix}{runId}/", StringComparison.Ordinal) ||
            prefix.Contains("..", StringComparison.Ordinal) || prefix.Contains('\\'))
            throw new InvalidOperationException("El prefijo de integración no es válido.");
    }

    private static void EnsureRunKey(string key, string runId)
    {
        if (!string.Equals(key, $"{RootPrefix}{runId}/foto.webp", StringComparison.Ordinal))
            throw new InvalidOperationException("La clave de integración no es válida.");
        EnsureKnownKey(key);
    }

    private static void EnsureKnownKey(string key)
    {
        if (!key.StartsWith(RootPrefix, StringComparison.Ordinal) ||
            key.Contains("..", StringComparison.Ordinal) || key.Contains('\\') ||
            !key.EndsWith("/foto.webp", StringComparison.Ordinal) ||
            key.StartsWith("pacientes/", StringComparison.Ordinal) ||
            key.StartsWith("medicamentos/", StringComparison.Ordinal))
            throw new InvalidOperationException("La clave solicitada está fuera del alcance autorizado.");
    }

    private static string ExtractRunId(string runPrefix)
    {
        if (!runPrefix.StartsWith(RootPrefix, StringComparison.Ordinal) || !runPrefix.EndsWith('/'))
            throw new InvalidOperationException("El prefijo no contiene un run-id válido.");
        var runId = runPrefix[RootPrefix.Length..^1];
        if (runId.Length != 32 || runId.Any(character => !Uri.IsHexDigit(character)))
            throw new InvalidOperationException("El run-id no tiene el formato criptográfico esperado.");
        return runId;
    }

    public void Dispose() => client.Dispose();

    private sealed record ObjectState(bool Exists, string EntityTag);

    private sealed class StaleWriteAcceptedException : Exception;
}
