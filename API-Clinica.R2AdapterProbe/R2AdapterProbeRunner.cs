using System.Security.Cryptography;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using SkiaSharp;

namespace API_Clinica.R2AdapterProbe;

internal sealed class R2AdapterProbeRunner(
    IPhotoStorageService storage,
    Func<SKColor, byte[]>? imageFactory = null,
    TextWriter? output = null,
    TextWriter? error = null)
{
    private const string RootPrefix = "api-clinica-integration/";
    private readonly IPhotoStorageService storage =
        storage ?? throw new ArgumentNullException(nameof(storage));
    private readonly Func<SKColor, byte[]> imageFactory =
        imageFactory ?? CreateSyntheticWebP;
    private readonly TextWriter output = output ?? Console.Out;
    private readonly TextWriter error = error ?? Console.Error;

    internal async Task<int> RunAsync(CancellationToken cancellationToken)
    {
        var runId = Guid.NewGuid().ToString("N");
        var key = $"{RootPrefix}{runId}/foto.webp";
        EnsureSyntheticKey(key, runId);

        var knownHashes = new HashSet<string>(StringComparer.Ordinal);
        var clean = false;
        var stage = "inicialización";

        output.WriteLine($"run-id={runId}; alcance=un-objeto-webp-sintetico; adaptador=productivo");

        try
        {
            stage = "verificación inicial";
            if (await GetScopedAsync(key, runId, cancellationToken) is not null)
                throw new InvalidOperationException("La clave sintética ya existe.");

            stage = "generación de WebP sintético";
            var versionA = CreatePhoto(SKColors.CornflowerBlue, knownHashes);
            var versionB = CreatePhoto(SKColors.OrangeRed, knownHashes);

            stage = "carga condicional";
            var entityTagA = await SaveScopedAsync(
                key, runId, versionA, PhotoWriteCondition.ForNewObject, cancellationToken);
            EnsureEntityTag(entityTagA);

            stage = "recuperación de versión A";
            await VerifyContentAsync(key, runId, versionA.Content, cancellationToken);

            stage = "reemplazo condicional";
            var entityTagB = await SaveScopedAsync(
                key, runId, versionB,
                PhotoWriteCondition.ForReplacement(entityTagA), cancellationToken);
            EnsureEntityTag(entityTagB);

            stage = "recuperación de versión B";
            await VerifyContentAsync(key, runId, versionB.Content, cancellationToken);

            stage = "rechazo de ETag obsoleto";
            try
            {
                await SaveScopedAsync(
                    key, runId, versionA,
                    PhotoWriteCondition.ForReplacement(entityTagA), cancellationToken);
                throw new InvalidOperationException("R2 aceptó un ETag obsoleto.");
            }
            catch (ConflictException)
            {
                // Resultado requerido: la versión B debe permanecer vigente.
            }

            await VerifyContentAsync(key, runId, versionB.Content, cancellationToken);

            stage = "eliminación controlada";
            await DeleteScopedAsync(key, runId, entityTagB, cancellationToken);

            stage = "verificación final";
            clean = await GetScopedAsync(key, runId, cancellationToken) is null;
            if (!clean)
                throw new InvalidOperationException("El objeto sintético continúa presente.");

            output.WriteLine(
                "status=SUCCEEDED; put-condicional=ok; sha256=ok; etag-obsoleto=rechazado; limpieza=ok");
            return 0;
        }
        catch (Exception exception)
        {
            error.WriteLine(
                $"status=FAILED; etapa={stage}; tipo={exception.GetType().Name}; " +
                "estado-remoto=requiere-conciliacion");
            return await ReconcileAsync(
                key, runId, knownHashes, clean, cancellationToken);
        }
    }

    private async Task<int> ReconcileAsync(
        string key,
        string runId,
        HashSet<string> knownHashes,
        bool alreadyClean,
        CancellationToken cancellationToken)
    {
        if (alreadyClean)
            return 6;

        try
        {
            var current = await GetScopedAsync(key, runId, cancellationToken);
            if (current is null)
            {
                error.WriteLine("conciliacion=limpio; objeto-presente=false");
                return 6;
            }

            var currentHash = Convert.ToHexString(SHA256.HashData(current.Content));
            if (!knownHashes.Contains(currentHash) ||
                string.IsNullOrWhiteSpace(current.EntityTag))
            {
                error.WriteLine(
                    "conciliacion=indeterminada; limpieza-automatica=bloqueada; " +
                    "motivo=contenido-o-version-no-reconocidos");
                return 7;
            }

            await DeleteScopedAsync(
                key, runId, current.EntityTag, cancellationToken);
            var removed = await GetScopedAsync(key, runId, cancellationToken) is null;
            error.WriteLine(
                removed
                    ? "conciliacion=limpio; objeto-presente=false"
                    : "conciliacion=indeterminada; objeto-presente=true");
            return removed ? 6 : 7;
        }
        catch (Exception exception)
        {
            error.WriteLine(
                $"conciliacion=indeterminada; tipo={exception.GetType().Name}; " +
                "no-reintentar-automaticamente=true");
            return 7;
        }
    }

    private ProcessedPhoto CreatePhoto(SKColor color, HashSet<string> knownHashes)
    {
        var content = imageFactory(color)
            ?? throw new InvalidOperationException("La generación WebP devolvió contenido nulo.");
        if (content.Length == 0)
            throw new InvalidOperationException("La generación WebP devolvió contenido vacío.");
        knownHashes.Add(Convert.ToHexString(SHA256.HashData(content)));
        return new ProcessedPhoto(content, "image/webp");
    }

    private async Task VerifyContentAsync(
        string key,
        string runId,
        byte[] expected,
        CancellationToken cancellationToken)
    {
        var stored = await GetScopedAsync(key, runId, cancellationToken)
            ?? throw new InvalidOperationException("El objeto esperado no existe.");
        if (!CryptographicOperations.FixedTimeEquals(
                SHA256.HashData(stored.Content), SHA256.HashData(expected)))
            throw new InvalidOperationException("El SHA-256 recuperado no coincide.");
        EnsureEntityTag(stored.EntityTag);
    }

    private Task<StoredPhoto?> GetScopedAsync(
        string key, string runId, CancellationToken cancellationToken)
    {
        EnsureSyntheticKey(key, runId);
        return storage.GetAsync(key, cancellationToken);
    }

    private Task<string> SaveScopedAsync(
        string key,
        string runId,
        ProcessedPhoto photo,
        PhotoWriteCondition condition,
        CancellationToken cancellationToken)
    {
        EnsureSyntheticKey(key, runId);
        return storage.SaveAsync(key, photo, condition, cancellationToken);
    }

    private Task DeleteScopedAsync(
        string key,
        string runId,
        string entityTag,
        CancellationToken cancellationToken)
    {
        EnsureSyntheticKey(key, runId);
        return storage.DeleteAsync(key, entityTag, cancellationToken);
    }

    internal static void EnsureSyntheticKey(string key, string runId)
    {
        var expected = $"{RootPrefix}{runId}/foto.webp";
        if (runId.Length != 32 || !Guid.TryParseExact(runId, "N", out _) ||
            !string.Equals(key, expected, StringComparison.Ordinal))
            throw new InvalidOperationException(
                "La clave está fuera del prefijo sintético autorizado.");
    }

    private static void EnsureEntityTag(string entityTag)
    {
        if (string.IsNullOrWhiteSpace(entityTag))
            throw new InvalidOperationException("R2 no devolvió una versión válida.");
    }

    private static byte[] CreateSyntheticWebP(SKColor color)
    {
        using var bitmap = new SKBitmap(16, 16);
        bitmap.Erase(color);
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(SKEncodedImageFormat.Webp, 90)
            ?? throw new InvalidOperationException("No se pudo generar la imagen WebP sintética.");
        return data.ToArray();
    }
}
