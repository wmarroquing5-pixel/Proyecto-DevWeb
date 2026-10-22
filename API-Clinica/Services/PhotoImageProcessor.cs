using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using SkiaSharp;

namespace API_Clinica.Services;

public sealed class PhotoImageProcessor : IPhotoImageProcessor
{
    public const long MaximumInputBytes = 5 * 1024 * 1024;
    public const long MultipartBodyLimit = MaximumInputBytes + (256 * 1024);

    private const int MaximumSourceDimension = 10_000;
    private const long MaximumSourcePixels = 40_000_000;
    private const int MaximumOutputDimension = 2_048;

    private static readonly IReadOnlyDictionary<SKEncodedImageFormat, string> Formats =
        new Dictionary<SKEncodedImageFormat, string>
        {
            [SKEncodedImageFormat.Jpeg] = "image/jpeg",
            [SKEncodedImageFormat.Png] = "image/png",
            [SKEncodedImageFormat.Webp] = "image/webp"
        };

    public async Task<ProcessedPhoto> ProcessAsync(
        IFormFile? file, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (file is null || file.Length == 0)
            throw Invalid("Foto", "Debe proporcionar una fotografía no vacía.");
        if (file.Length > MaximumInputBytes)
            throw new PayloadTooLargeException("La fotografía no puede superar 5 MB.");
        if (!Formats.Values.Contains(file.ContentType, StringComparer.OrdinalIgnoreCase))
            throw new UnsupportedMediaTypeException(
                "Solo se admiten imágenes JPEG, PNG o WebP.");

        using var input = file.OpenReadStream();
        using var buffer = new MemoryStream((int)file.Length);
        var chunk = new byte[81_920];
        long total = 0;
        int read;
        while ((read = await input.ReadAsync(chunk, cancellationToken)) > 0)
        {
            total += read;
            if (total > MaximumInputBytes)
                throw new PayloadTooLargeException("La fotografía no puede superar 5 MB.");
            buffer.Write(chunk, 0, read);
        }
        if (total != file.Length)
            throw Invalid("Foto", "El contenido de la fotografía está malformado.");

        var source = buffer.ToArray();
        if (IsAvif(source))
            throw new UnsupportedMediaTypeException(
                "La fotografía es AVIF; conviértala a JPEG, PNG o WebP antes de subirla.");

        using var data = SKData.CreateCopy(source);
        using var codec = SKCodec.Create(data)
            ?? throw Invalid("Foto", "El contenido de la fotografía está malformado.");
        if (!Formats.TryGetValue(codec.EncodedFormat, out var actualContentType))
            throw new UnsupportedMediaTypeException("Solo se admiten imágenes JPEG, PNG o WebP.");
        if (!string.Equals(actualContentType, file.ContentType, StringComparison.OrdinalIgnoreCase))
            throw new UnsupportedMediaTypeException(
                "El tipo MIME declarado no coincide con el contenido de la imagen.");
        if (codec.FrameCount > 1)
            throw Invalid("Foto", "No se admiten imágenes animadas.");

        ValidateDimensions(codec.Info.Width, codec.Info.Height);
        using var decoded = SKBitmap.Decode(data)
            ?? throw Invalid("Foto", "No fue posible decodificar la fotografía.");
        cancellationToken.ThrowIfCancellationRequested();

        using var oriented = ApplyOrientation(decoded, codec.EncodedOrigin);
        using var resized = Resize(oriented);
        using var image = SKImage.FromBitmap(resized);
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, 82)
            ?? throw Invalid("Foto", "No fue posible normalizar la fotografía.");
        var content = encoded.ToArray();
        if (content.Length == 0 || content.Length > MaximumInputBytes)
            throw new PayloadTooLargeException(
                "La fotografía procesada no cumple el límite de 5 MB.");

        return new ProcessedPhoto(content, "image/webp");
    }

    private static bool IsAvif(ReadOnlySpan<byte> content) =>
        content.Length >= 12 && content.Slice(4, 4).SequenceEqual("ftyp"u8) &&
        (content.Slice(8, 4).SequenceEqual("avif"u8) ||
         content.Slice(8, 4).SequenceEqual("avis"u8));

    private static SKBitmap ApplyOrientation(SKBitmap source, SKEncodedOrigin origin)
    {
        if (origin == SKEncodedOrigin.TopLeft)
            return source.Copy();

        var swapsDimensions = origin is SKEncodedOrigin.LeftTop or SKEncodedOrigin.RightTop or
            SKEncodedOrigin.RightBottom or SKEncodedOrigin.LeftBottom;
        var target = new SKBitmap(
            swapsDimensions ? source.Height : source.Width,
            swapsDimensions ? source.Width : source.Height,
            source.ColorType,
            source.AlphaType);
        using var canvas = new SKCanvas(target);
        switch (origin)
        {
            case SKEncodedOrigin.TopRight:
                canvas.Translate(source.Width, 0);
                canvas.Scale(-1, 1);
                break;
            case SKEncodedOrigin.BottomRight:
                canvas.Translate(source.Width, source.Height);
                canvas.RotateDegrees(180);
                break;
            case SKEncodedOrigin.BottomLeft:
                canvas.Translate(0, source.Height);
                canvas.Scale(1, -1);
                break;
            case SKEncodedOrigin.LeftTop:
                canvas.RotateDegrees(90);
                canvas.Scale(1, -1);
                break;
            case SKEncodedOrigin.RightTop:
                canvas.Translate(source.Height, 0);
                canvas.RotateDegrees(90);
                break;
            case SKEncodedOrigin.RightBottom:
                canvas.Translate(source.Height, source.Width);
                canvas.RotateDegrees(90);
                canvas.Scale(-1, 1);
                break;
            case SKEncodedOrigin.LeftBottom:
                canvas.Translate(0, source.Width);
                canvas.RotateDegrees(-90);
                break;
        }
        canvas.DrawBitmap(source, 0, 0, new SKSamplingOptions());
        return target;
    }

    private static SKBitmap Resize(SKBitmap source)
    {
        var scale = Math.Min(1d, Math.Min(
            (double)MaximumOutputDimension / source.Width,
            (double)MaximumOutputDimension / source.Height));
        if (scale >= 1d)
            return source.Copy();

        var info = new SKImageInfo(
            Math.Max(1, (int)Math.Round(source.Width * scale)),
            Math.Max(1, (int)Math.Round(source.Height * scale)),
            source.ColorType,
            source.AlphaType);
        return source.Resize(info, new SKSamplingOptions(SKCubicResampler.Mitchell))
            ?? throw Invalid("Foto", "No fue posible redimensionar la fotografía.");
    }

    private static void ValidateDimensions(int width, int height)
    {
        if (width <= 0 || height <= 0 || width > MaximumSourceDimension ||
            height > MaximumSourceDimension || (long)width * height > MaximumSourcePixels)
            throw Invalid("Foto", "Las dimensiones de la fotografía exceden los límites permitidos.");
    }

    private static AppValidationException Invalid(string field, string message) =>
        new("Fotografía inválida.", new Dictionary<string, string[]> { [field] = [message] });
}
