using System.Net;
using System.Security.Cryptography;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.Extensions.Options;

namespace API_Clinica.Services;

public sealed class CloudflareR2PhotoStorageService : IPhotoStorageService, IDisposable
{
    private const long MaximumStoredPhotoBytes = PhotoImageProcessor.MaximumInputBytes;
    internal static readonly TimeSpan OperationTimeout = TimeSpan.FromSeconds(30);
    private readonly R2Options options;
    private readonly ILogger<CloudflareR2PhotoStorageService> logger;
    private readonly Lazy<IAmazonS3> client;

    public CloudflareR2PhotoStorageService(
        IOptions<R2Options> options,
        ILogger<CloudflareR2PhotoStorageService> logger)
    {
        this.options = options.Value;
        this.logger = logger;
        client = new Lazy<IAmazonS3>(CreateClient, LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public async Task<StoredPhoto?> GetAsync(string key, CancellationToken cancellationToken)
    {
        ValidateKey(key);
        EnsureConfigured();
        using var timeout = CreateOperationTimeout(cancellationToken);
        try
        {
            using var response = await client.Value.GetObjectAsync(
                options.BucketName, key, timeout.Token);
            if (response.ContentLength is < 1 or > MaximumStoredPhotoBytes)
                throw new ExternalDependencyException(
                    "La fotografía almacenada no cumple los límites de seguridad.");
            await using var content = new MemoryStream();
            await CopyWithLimitAsync(response.ResponseStream, content, timeout.Token);
            return new StoredPhoto(content.ToArray(),
                string.IsNullOrWhiteSpace(response.Headers.ContentType)
                    ? "image/webp"
                    : response.Headers.ContentType,
                NormalizeEntityTag(response.ETag));
        }
        catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        catch (AmazonS3Exception exception) when (IsPreconditionFailure(exception))
        {
            throw new ConflictException("La fotografía fue modificada por otra solicitud.");
        }
        catch (AmazonS3Exception exception)
        {
            LogFailure("obtener", key, exception);
            throw Unavailable();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            LogTimeout("obtener", key);
            throw Unavailable();
        }
    }

    public async Task<string> SaveAsync(
        string key,
        ProcessedPhoto photo,
        PhotoWriteCondition condition,
        CancellationToken cancellationToken)
    {
        ValidateKey(key);
        EnsureConfigured();
        ArgumentNullException.ThrowIfNull(photo);
        if (photo.Content.Length == 0 || photo.ContentType != "image/webp")
            throw new ArgumentException("La fotografía normalizada no es válida.", nameof(photo));

        using var timeout = CreateOperationTimeout(cancellationToken);
        try
        {
            await using var content = new MemoryStream(photo.Content, writable: false);
            var request = BuildPutObjectRequest(
                options.BucketName, key, content, photo.Content.LongLength,
                Convert.ToBase64String(MD5.HashData(photo.Content)), condition);
            var response = await client.Value.PutObjectAsync(request, timeout.Token);
            var entityTag = NormalizeEntityTag(response.ETag);
            if (string.IsNullOrWhiteSpace(entityTag))
                throw new AmazonS3Exception("R2 no devolvió un identificador de versión para el objeto.");
            return entityTag;
        }
        catch (AmazonS3Exception exception) when (IsPreconditionFailure(exception))
        {
            throw new ConflictException("La fotografía fue modificada por otra solicitud.");
        }
        catch (AmazonS3Exception exception)
        {
            LogFailure("guardar", key, exception);
            throw Unavailable();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            LogTimeout("guardar", key);
            throw Unavailable();
        }
    }

    public async Task DeleteAsync(
        string key,
        string expectedEntityTag,
        CancellationToken cancellationToken)
    {
        ValidateKey(key);
        EnsureConfigured();
        if (string.IsNullOrWhiteSpace(expectedEntityTag))
            throw new ArgumentException("Se requiere la versión esperada del objeto.", nameof(expectedEntityTag));

        using var timeout = CreateOperationTimeout(cancellationToken);
        try
        {
            await client.Value.DeleteObjectAsync(new DeleteObjectRequest
            {
                BucketName = options.BucketName,
                Key = key,
                IfMatch = expectedEntityTag
            }, timeout.Token);
        }
        catch (AmazonS3Exception exception) when (IsPreconditionFailure(exception))
        {
            throw new ConflictException("La fotografía fue modificada por otra solicitud.");
        }
        catch (AmazonS3Exception exception)
        {
            LogFailure("eliminar", key, exception);
            throw Unavailable();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            LogTimeout("eliminar", key);
            throw Unavailable();
        }
    }

    private IAmazonS3 CreateClient()
    {
        EnsureConfigured();
        return new AmazonS3Client(
            new BasicAWSCredentials(options.AccessKeyId, options.SecretAccessKey),
            BuildConfiguration(options));
    }

    internal static AmazonS3Config BuildConfiguration(R2Options options) =>
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

    internal static PutObjectRequest BuildPutObjectRequest(
        string bucketName,
        string key,
        Stream content,
        long contentLength,
        string contentMd5,
        PhotoWriteCondition condition)
    {
        ValidateKey(key);
        ArgumentNullException.ThrowIfNull(condition);
        var request = new PutObjectRequest
        {
            BucketName = bucketName,
            Key = key,
            InputStream = content,
            ContentType = "image/webp",
            AutoCloseStream = false,
            DisablePayloadSigning = false,
            DisableDefaultChecksumValidation = true,
            UseChunkEncoding = false,
            MD5Digest = contentMd5,
            IfNoneMatch = condition.MustNotExist ? "*" : null,
            IfMatch = condition.ExpectedEntityTag
        };
        request.Headers.CacheControl = "private, no-store";
        request.Headers.ContentLength = contentLength;
        return request;
    }

    private void EnsureConfigured()
    {
        if (!options.IsConfigured || !options.IsValid())
            throw new ExternalDependencyException(
                "El almacenamiento de fotografías no está configurado.");
    }

    private static void ValidateKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Contains("..", StringComparison.Ordinal) ||
            key.StartsWith('/') || key.Contains('\\'))
            throw new ArgumentException("La clave de almacenamiento no es válida.", nameof(key));
    }

    private static bool IsPreconditionFailure(AmazonS3Exception exception) =>
        exception.StatusCode is HttpStatusCode.PreconditionFailed or HttpStatusCode.Conflict;

    private static string NormalizeEntityTag(string? entityTag) =>
        entityTag?.Trim() ?? string.Empty;

    private static async Task CopyWithLimitAsync(
        Stream source, Stream destination, CancellationToken cancellationToken)
    {
        var buffer = new byte[81_920];
        long total = 0;
        int read;
        while ((read = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            total += read;
            if (total > MaximumStoredPhotoBytes)
                throw new ExternalDependencyException(
                    "La fotografía almacenada no cumple los límites de seguridad.");
            await destination.WriteAsync(buffer.AsMemory(0, read), cancellationToken);
        }
    }

    private static ExternalDependencyException Unavailable() =>
        new("El almacenamiento de fotografías no está disponible temporalmente.");

    private static CancellationTokenSource CreateOperationTimeout(
        CancellationToken cancellationToken)
    {
        var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(OperationTimeout);
        return timeout;
    }

    private void LogFailure(string operation, string key, AmazonS3Exception exception) =>
        logger.LogWarning(
            "R2 no pudo {Operation} una fotografía de {PhotoType}. Estado {StatusCode}, código {ErrorCode}.",
            operation, GetPhotoType(key), (int)exception.StatusCode, exception.ErrorCode);

    private void LogTimeout(string operation, string key) =>
        logger.LogWarning(
            "R2 excedió el tiempo límite al {Operation} una fotografía de {PhotoType}.",
            operation, GetPhotoType(key));

    private static string GetPhotoType(string key) =>
        key.StartsWith("pacientes/", StringComparison.Ordinal) ? "paciente" : "medicamento";

    public void Dispose()
    {
        if (client.IsValueCreated)
            client.Value.Dispose();
    }
}
