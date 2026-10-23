using System.Globalization;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.Extensions.Options;

namespace API_Clinica.Services;

// Cada objeto lleva sus metadatos de forma atómica. No existe un índice separado
// que pueda quedar desincronizado cuando dos cargas ocurren simultáneamente.
public sealed class CloudflareR2ExamResultStorage : IExamResultStorage, IDisposable
{
    private const long MaxFileBytes = 5 * 1024 * 1024;
    private const int MaxListedFiles = 1000;
    private readonly R2Options options;
    private readonly ILogger<CloudflareR2ExamResultStorage> logger;
    private readonly Lazy<IAmazonS3> client;

    public CloudflareR2ExamResultStorage(IOptions<R2Options> options,
        ILogger<CloudflareR2ExamResultStorage> logger)
    {
        this.options = options.Value;
        this.logger = logger;
        client = new Lazy<IAmazonS3>(() => new AmazonS3Client(
            new BasicAWSCredentials(this.options.AccessKeyId, this.options.SecretAccessKey),
            CloudflareR2PhotoStorageService.BuildConfiguration(this.options)),
            LazyThreadSafetyMode.ExecutionAndPublication);
    }

    internal CloudflareR2ExamResultStorage(IOptions<R2Options> options,
        ILogger<CloudflareR2ExamResultStorage> logger, IAmazonS3 storageClient)
    {
        this.options = options.Value;
        this.logger = logger;
        client = new Lazy<IAmazonS3>(() => storageClient,
            LazyThreadSafetyMode.ExecutionAndPublication);
    }

    public async Task<IReadOnlyList<ExamResultFileDto>> ListAsync(int examId, CancellationToken ct)
    {
        EnsureConfigured();
        var prefix = Prefix(examId);
        var files = new List<ExamResultFileDto>();
        using var timeout = Timed(ct);
        try
        {
            string? continuation = null;
            do
            {
                var page = await client.Value.ListObjectsV2Async(new ListObjectsV2Request
                {
                    BucketName = options.BucketName,
                    Prefix = prefix,
                    ContinuationToken = continuation,
                    MaxKeys = 1000
                }, timeout.Token);
                foreach (var item in page.S3Objects ?? [])
                {
                    if (!item.Key.StartsWith(prefix, StringComparison.Ordinal)) continue;
                    var id = item.Key[prefix.Length..];
                    if (!ValidFileId(id)) continue;
                    try
                    {
                        var head = await client.Value.GetObjectMetadataAsync(options.BucketName,
                            item.Key, timeout.Token);
                        files.Add(ReadMetadata(id, head.Metadata, head.Headers.ContentType,
                            head.ContentLength));
                    }
                    catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
                    {
                        // Otro cliente eliminó el objeto después del LIST.
                    }
                    if (files.Count > MaxListedFiles)
                        throw new ExternalDependencyException(
                            "El examen supera el límite de archivos que puede enumerarse con seguridad.");
                }
                continuation = page.IsTruncated == true ? page.NextContinuationToken : null;
                if (page.IsTruncated == true && string.IsNullOrWhiteSpace(continuation))
                    throw new ExternalDependencyException("R2 devolvió una paginación incompleta.");
            } while (continuation is not null);
            return files.OrderBy(file => file.FechaCargaUtc)
                .ThenBy(file => file.ArchivoId, StringComparer.Ordinal).ToArray();
        }
        catch (AmazonS3Exception ex)
        {
            LogFailure("enumerar", ex);
            throw Unavailable();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw Unavailable();
        }
    }

    public async Task<ExamResultFileDto> SaveAsync(int examId, string fileId, byte[] content,
        string contentType, string originalName, int userId, DateTimeOffset uploadedAt,
        CancellationToken ct)
    {
        EnsureConfigured();
        var key = Key(examId, fileId);
        if (content.LongLength is < 1 or > MaxFileBytes)
            throw new ArgumentException("El archivo excede el límite permitido.", nameof(content));
        var hash = Convert.ToHexString(SHA256.HashData(content));
        var safeName = CleanName(originalName);
        await using var stream = new MemoryStream(content, writable: false);
        var request = new PutObjectRequest
        {
            BucketName = options.BucketName,
            Key = key,
            InputStream = stream,
            ContentType = contentType,
            AutoCloseStream = false,
            DisablePayloadSigning = false,
            DisableDefaultChecksumValidation = true,
            UseChunkEncoding = false,
            MD5Digest = Convert.ToBase64String(MD5.HashData(content)),
            IfNoneMatch = "*"
        };
        request.Headers.ContentLength = content.LongLength;
        request.Headers.CacheControl = "private, no-store";
        request.Metadata["name64"] = Convert.ToBase64String(Encoding.UTF8.GetBytes(safeName));
        request.Metadata["sha256"] = hash;
        request.Metadata["uploadedby"] = userId.ToString(CultureInfo.InvariantCulture);
        request.Metadata["uploadedatutc"] = uploadedAt.ToUniversalTime().ToString("O", CultureInfo.InvariantCulture);
        using var timeout = Timed(ct);
        try
        {
            await client.Value.PutObjectAsync(request, timeout.Token);
            return new ExamResultFileDto(fileId, safeName, contentType, content.LongLength,
                uploadedAt.ToUniversalTime(), userId);
        }
        catch (AmazonS3Exception ex) when (IsConflict(ex))
        {
            throw new ConflictException("Ya existe un archivo con ese identificador.");
        }
        catch (AmazonS3Exception ex)
        {
            LogFailure("guardar", ex);
            throw Unavailable();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw Unavailable();
        }
    }

    public async Task<StoredExamResult?> GetAsync(int examId, string fileId, CancellationToken ct)
    {
        EnsureConfigured();
        var key = Key(examId, fileId);
        using var timeout = Timed(ct);
        try
        {
            using var response = await client.Value.GetObjectAsync(options.BucketName,
                key, timeout.Token);
            if (response.ContentLength is < 1 or > MaxFileBytes)
                throw new ExternalDependencyException("El archivo almacenado supera el límite permitido.");
            await using var stream = new MemoryStream();
            var buffer = new byte[81_920];
            int read;
            while ((read = await response.ResponseStream.ReadAsync(buffer, timeout.Token)) > 0)
            {
                if (stream.Length + read > MaxFileBytes)
                    throw new ExternalDependencyException("El archivo almacenado supera el límite permitido.");
                await stream.WriteAsync(buffer.AsMemory(0, read), timeout.Token);
            }
            var content = stream.ToArray();
            var metadata = ReadMetadata(fileId, response.Metadata,
                response.Headers.ContentType, content.LongLength);
            var expectedHash = MetadataValue(response.Metadata, "sha256");
            if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(expectedHash),
                Encoding.ASCII.GetBytes(Convert.ToHexString(SHA256.HashData(content)))))
                throw new ExternalDependencyException("Falló la comprobación de integridad del archivo.");
            return new StoredExamResult(metadata, content, response.ETag ?? string.Empty);
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return null;
        }
        catch (AmazonS3Exception ex)
        {
            LogFailure("leer", ex);
            throw Unavailable();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw Unavailable();
        }
    }

    public async Task DeleteAsync(int examId, string fileId, string expectedEntityTag,
        CancellationToken ct)
    {
        EnsureConfigured();
        if (string.IsNullOrWhiteSpace(expectedEntityTag))
            throw new ExternalDependencyException("R2 no proporcionó versión para eliminar el archivo.");
        using var timeout = Timed(ct);
        try
        {
            await client.Value.DeleteObjectAsync(new DeleteObjectRequest
            {
                BucketName = options.BucketName,
                Key = Key(examId, fileId),
                IfMatch = expectedEntityTag
            }, timeout.Token);
        }
        catch (AmazonS3Exception ex) when (IsConflict(ex))
        {
            throw new ConflictException("El archivo cambió antes de poder eliminarlo.");
        }
        catch (AmazonS3Exception ex)
        {
            LogFailure("eliminar", ex);
            throw Unavailable();
        }
        catch (OperationCanceledException) when (!ct.IsCancellationRequested)
        {
            throw Unavailable();
        }
    }

    private static ExamResultFileDto ReadMetadata(string fileId, MetadataCollection metadata,
        string? contentType, long size)
    {
        try
        {
            var originalName = Encoding.UTF8.GetString(Convert.FromBase64String(
                MetadataValue(metadata, "name64")));
            var userId = int.Parse(MetadataValue(metadata, "uploadedby"), CultureInfo.InvariantCulture);
            var uploadedAt = DateTimeOffset.Parse(MetadataValue(metadata, "uploadedatutc"),
                CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);
            var hash = MetadataValue(metadata, "sha256");
            if (userId <= 0 || !ValidFileId(fileId) || size is < 1 or > MaxFileBytes
                || originalName != CleanName(originalName) || hash.Length != 64
                || contentType is not ("application/pdf" or "image/jpeg" or "image/png" or "image/webp"))
                throw new FormatException();
            return new ExamResultFileDto(fileId, originalName, contentType, size,
                uploadedAt.ToUniversalTime(), userId);
        }
        catch (Exception ex) when (ex is FormatException or ArgumentException or OverflowException)
        {
            throw new ExternalDependencyException("Los metadatos del archivo clínico están dañados.");
        }
    }

    private static string MetadataValue(MetadataCollection metadata, string name)
    {
        foreach (string key in metadata.Keys)
            if (key.Equals(name, StringComparison.OrdinalIgnoreCase) ||
                key.Equals("x-amz-meta-" + name, StringComparison.OrdinalIgnoreCase))
                return metadata[key];
        throw new FormatException("Falta un metadato requerido.");
    }

    internal static string CleanName(string name)
    {
        var leaf = name.Replace('\\', '/').Split('/').LastOrDefault() ?? string.Empty;
        var clean = new string(leaf.Where(c => !char.IsControl(c) && c is not '"' and not '<' and not '>')
            .ToArray()).Trim();
        if (clean.Length is < 1 or > 150) throw new ArgumentException("Nombre de archivo inválido.");
        return clean;
    }

    private static string Prefix(int examId) => examId > 0
        ? $"examenes/{examId}/" : throw new ArgumentOutOfRangeException(nameof(examId));

    private static string Key(int examId, string fileId) => ValidFileId(fileId)
        ? Prefix(examId) + fileId : throw new ArgumentException("Identificador inválido.", nameof(fileId));

    internal static bool ValidFileId(string fileId) =>
        fileId.Length == 32 && fileId.All(c => c is >= '0' and <= '9' or >= 'a' and <= 'f');

    private void EnsureConfigured()
    {
        if (!options.IsConfigured || !options.IsValid())
            throw new ExternalDependencyException("El almacenamiento de resultados no está configurado.");
    }

    private static CancellationTokenSource Timed(CancellationToken ct)
    {
        var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(CloudflareR2PhotoStorageService.OperationTimeout);
        return timeout;
    }

    private static bool IsConflict(AmazonS3Exception ex) =>
        ex.StatusCode is HttpStatusCode.PreconditionFailed or HttpStatusCode.Conflict;

    private void LogFailure(string operation, AmazonS3Exception ex) =>
        logger.LogWarning("R2 no pudo {Operation} un resultado de examen. Estado {StatusCode}, código {ErrorCode}.",
            operation, (int)ex.StatusCode, ex.ErrorCode);

    private static ExternalDependencyException Unavailable() =>
        new("El almacenamiento de resultados no está disponible temporalmente.");

    public void Dispose()
    {
        if (client.IsValueCreated) client.Value.Dispose();
    }
}
