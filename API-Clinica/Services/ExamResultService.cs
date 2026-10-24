using System.Security.Claims;
using System.Text;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.EntityFrameworkCore;
using SkiaSharp;

namespace API_Clinica.Services;

public sealed class ExamResultService(
    IAccesoActualService access,
    IExamResultStorage storage,
    ILogger<ExamResultService> logger,
    TimeProvider clock,
    ConsultaLecturaScope lecturaScope) : IExamResultService
{
    // Coordina las cargas de esta instancia; R2 conserva claves únicas y escrituras condicionales.
    private static readonly SemaphoreSlim UploadGate = new(1, 1);
    internal const int MaxFilesPerRequest = 4;
    internal const int MaxFileBytes = 5 * 1024 * 1024;
    internal const int MaxRequestBytes = MaxFilesPerRequest * MaxFileBytes;

    public async Task<IReadOnlyList<ExamResultFileDto>> ListAsync(int examId,
        ClaimsPrincipal user, CancellationToken ct)
    {
        await EnsureAccessAsync(examId, user, ct);
        return await storage.ListAsync(examId, ct);
    }

    public async Task<IReadOnlyList<ExamResultFileDto>> UploadAsync(int examId,
        IReadOnlyList<IFormFile>? files, ClaimsPrincipal user, CancellationToken ct)
    {
        var userId = await EnsureAccessAsync(examId, user, ct);
        if (files is null || files.Count is < 1 or > MaxFilesPerRequest)
            throw Invalid("Archivos", $"Seleccione entre 1 y {MaxFilesPerRequest} archivos.");
        if (files.Any(file => file.Length > MaxFileBytes) ||
            files.Sum(file => file.Length) > MaxRequestBytes)
            throw new PayloadTooLargeException("Cada archivo admite hasta 5 MB y la solicitud hasta 20 MB.");

        // Se validan todos los archivos antes de la primera escritura R2.
        var prepared = new List<(byte[] Content, string ContentType, string Name)>(files.Count);
        foreach (var file in files)
        {
            if (file.Length < 1) throw Invalid("Archivos", "No se permiten archivos vacíos.");
            var name = CleanFileName(file.FileName);
            await using var input = file.OpenReadStream();
            await using var buffer = new MemoryStream();
            var block = new byte[81_920];
            int read;
            while ((read = await input.ReadAsync(block, ct)) > 0)
            {
                if (buffer.Length + read > MaxFileBytes)
                    throw new PayloadTooLargeException("El archivo supera 5 MB.");
                await buffer.WriteAsync(block.AsMemory(0, read), ct);
            }
            if (buffer.Length != file.Length)
                throw Invalid("Archivos", "El tamaño recibido no coincide con el archivo declarado.");
            var content = buffer.ToArray();
            prepared.Add((content, DetectAndValidate(content, name), name));
        }

        await UploadGate.WaitAsync(ct);
        try
        {
            if ((await storage.ListAsync(examId, ct)).Count > 0)
                throw new ConflictException("El examen ya tiene resultados adjuntos.");

            var saved = new List<ExamResultFileDto>(prepared.Count);
            try
            {
                foreach (var file in prepared)
                {
                    var id = Guid.NewGuid().ToString("N");
                    saved.Add(await storage.SaveAsync(examId, id, file.Content, file.ContentType,
                        file.Name, userId, clock.GetUtcNow(), ct));
                }
            }
            catch (ExternalDependencyException)
            {
                if (saved.Count > 0)
                    logger.LogWarning("Carga parcial de resultados de examen. Se conservaron {Count} objetos autodescriptivos para conciliación.",
                        saved.Count);
                throw;
            }
            return saved;
        }
        finally
        {
            UploadGate.Release();
        }
    }

    public async Task<StoredExamResult> DownloadAsync(int examId, string fileId,
        ClaimsPrincipal user, CancellationToken ct)
    {
        await EnsureAccessAsync(examId, user, ct);
        ValidateFileId(fileId);
        return await storage.GetAsync(examId, fileId, ct)
            ?? throw new NotFoundException("Archivo de resultado no encontrado.");
    }

    public async Task DeleteAsync(int examId, string fileId, ClaimsPrincipal user,
        CancellationToken ct)
    {
        await EnsureAccessAsync(examId, user, ct);
        ValidateFileId(fileId);
        var existing = await storage.GetAsync(examId, fileId, ct)
            ?? throw new NotFoundException("Archivo de resultado no encontrado.");
        await storage.DeleteAsync(examId, fileId, existing.EntityTag, ct);
    }

    private async Task<int> EnsureAccessAsync(int examId, ClaimsPrincipal principal,
        CancellationToken ct)
    {
        if (examId <= 0) throw new NotFoundException("Examen no encontrado.");
        var user = await access.ObtenerUsuarioActivoAsync(principal, ct)
            ?? throw new ForbiddenException("Acceso denegado.");
        var idMedico = await lecturaScope.ObtenerMedicoAsync(user, ct);
        if (!await lecturaScope.ExamenesVisibles(idMedico)
            .AnyAsync(item => item.IdExamen == examId, ct))
            throw new NotFoundException("Examen no encontrado.");
        return user.IdUsuario;
    }

    internal static string DetectAndValidate(byte[] content, string name)
    {
        var extension = Path.GetExtension(name).ToLowerInvariant();
        if (content.Length >= 8 && content.AsSpan(0, 8).SequenceEqual(
            new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
            return ValidateImage(content, extension, "image/png", SKEncodedImageFormat.Png);
        if (content.Length >= 3 && content[0] == 0xFF && content[1] == 0xD8 && content[2] == 0xFF)
            return ValidateImage(content, extension, "image/jpeg", SKEncodedImageFormat.Jpeg);
        if (content.Length >= 12 && content.AsSpan(0, 4).SequenceEqual("RIFF"u8)
            && content.AsSpan(8, 4).SequenceEqual("WEBP"u8))
            return ValidateImage(content, extension, "image/webp", SKEncodedImageFormat.Webp);
        if (content.Length >= 8 && content.AsSpan(0, 5).SequenceEqual("%PDF-"u8))
        {
            if (extension != ".pdf" || !LooksLikeCompletePdf(content))
                throw Invalid("Archivos", "El PDF está malformado o su extensión no coincide.");
            return "application/pdf";
        }
        throw Invalid("Archivos", "Formato de archivo no permitido o contenido inválido.");
    }

    private static string ValidateImage(byte[] content, string extension, string mime,
        SKEncodedImageFormat expected)
    {
        if ((expected == SKEncodedImageFormat.Jpeg && extension is not (".jpg" or ".jpeg"))
            || (expected == SKEncodedImageFormat.Png && extension != ".png")
            || (expected == SKEncodedImageFormat.Webp && extension != ".webp"))
            throw Invalid("Archivos", "La extensión no coincide con el contenido de la imagen.");
        using var stream = new MemoryStream(content, writable: false);
        using var codec = SKCodec.Create(stream);
        if (codec is null || codec.EncodedFormat != expected || codec.Info.Width < 1
            || codec.Info.Height < 1 || codec.Info.Width > 10_000
            || codec.Info.Height > 10_000 || (long)codec.Info.Width * codec.Info.Height > 40_000_000)
            throw Invalid("Archivos", "La imagen está dañada o supera el límite de dimensiones.");
        using var bitmap = SKBitmap.Decode(content);
        if (bitmap is null || bitmap.Width != codec.Info.Width || bitmap.Height != codec.Info.Height)
            throw Invalid("Archivos", "No fue posible decodificar la imagen completa.");
        return mime;
    }

    // Valida estructura básica, tabla de referencias y fin de archivo. No equivale
    // a un análisis antimalware ni a la interpretación clínica del documento.
    private static bool LooksLikeCompletePdf(byte[] content)
    {
        if (content.Length < 40 || content.Length > MaxFileBytes) return false;
        var text = Encoding.Latin1.GetString(content);
        if (!text.StartsWith("%PDF-1.", StringComparison.Ordinal)
            && !text.StartsWith("%PDF-2.", StringComparison.Ordinal)) return false;
        var eof = text.LastIndexOf("%%EOF", StringComparison.Ordinal);
        if (eof < 0 || text[(eof + 5)..].Any(c => !char.IsWhiteSpace(c))) return false;
        var start = text.LastIndexOf("startxref", eof, StringComparison.Ordinal);
        if (start < 0) return false;
        var value = text[(start + "startxref".Length)..eof].Trim();
        if (!long.TryParse(value, out var offset) || offset < 0 || offset >= start) return false;
        var location = text[(int)offset..Math.Min(content.Length, (int)offset + 60)];
        if (!text[(int)offset..start].Contains("/Root", StringComparison.Ordinal)) return false;
        return location.StartsWith("xref", StringComparison.Ordinal)
            || System.Text.RegularExpressions.Regex.IsMatch(location, @"^\d+\s+\d+\s+obj\b");
    }

    private static string CleanFileName(string value)
    {
        try { return CloudflareR2ExamResultStorage.CleanName(value); }
        catch (ArgumentException) { throw Invalid("Archivos", "El nombre del archivo no es válido."); }
    }

    private static void ValidateFileId(string id)
    {
        if (!CloudflareR2ExamResultStorage.ValidFileId(id))
            throw new NotFoundException("Archivo de resultado no encontrado.");
    }

    private static AppValidationException Invalid(string field, string message) =>
        new("Archivo de resultado no válido.", new Dictionary<string, string[]> { [field] = [message] });
}
