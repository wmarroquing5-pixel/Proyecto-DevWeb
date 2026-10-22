using System.Buffers.Binary;
using System.Text;
using API_Clinica.Exceptions;
using API_Clinica.Services;
using Microsoft.AspNetCore.Http;
using SkiaSharp;

namespace API_Clinica.Tests;

public sealed class PhotoImageProcessorTests
{
    private readonly PhotoImageProcessor processor = new();

    [Theory]
    [InlineData(SKEncodedImageFormat.Jpeg, "image/jpeg")]
    [InlineData(SKEncodedImageFormat.Png, "image/png")]
    [InlineData(SKEncodedImageFormat.Webp, "image/webp")]
    public async Task ProcesaImagenValidaYLaNormalizaAWebp(
        SKEncodedImageFormat format, string mime)
    {
        var bytes = Encode(40, 24, format);
        using var stream = new MemoryStream(bytes);
        var result = await processor.ProcessAsync(Form(stream, mime), CancellationToken.None);

        Assert.Equal("image/webp", result.ContentType);
        using var data = SKData.CreateCopy(result.Content);
        using var codec = SKCodec.Create(data);
        Assert.NotNull(codec);
        Assert.Equal(SKEncodedImageFormat.Webp, codec.EncodedFormat);
        Assert.Equal(40, codec.Info.Width);
        Assert.Equal(24, codec.Info.Height);
    }

    [Fact]
    public async Task RechazaAvifAunqueElNombreYElMimeIndiquenPng()
    {
        byte[] avifHeader = [0, 0, 0, 16, (byte)'f', (byte)'t', (byte)'y', (byte)'p',
            (byte)'a', (byte)'v', (byte)'i', (byte)'f', 0, 0, 0, 0];
        using var stream = new MemoryStream(avifHeader);

        var error = await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() =>
            processor.ProcessAsync(Form(stream, "image/png"), CancellationToken.None));
        Assert.Contains("AVIF", error.Message);
    }

    [Fact]
    public async Task RechazaArchivoCorruptoYNoOcultaErroresDeFormato()
    {
        using var corrupt = new MemoryStream([1, 2, 3]);
        var error = await Assert.ThrowsAsync<AppValidationException>(() =>
            processor.ProcessAsync(Form(corrupt, "image/png"), CancellationToken.None));
        Assert.Equal("El contenido de la fotografía está malformado.", error.Errors["Foto"][0]);

        using var png = new MemoryStream(Encode(4, 4, SKEncodedImageFormat.Png));
        await Assert.ThrowsAsync<UnsupportedMediaTypeException>(() =>
            processor.ProcessAsync(Form(png, "image/jpeg"), CancellationToken.None));
    }

    [Fact]
    public async Task RechazaArchivoVacioYOversize()
    {
        using var empty = new MemoryStream();
        await Assert.ThrowsAsync<AppValidationException>(() =>
            processor.ProcessAsync(Form(empty, "image/png"), CancellationToken.None));

        using var oversized = new MemoryStream(new byte[PhotoImageProcessor.MaximumInputBytes + 1]);
        await Assert.ThrowsAsync<PayloadTooLargeException>(() =>
            processor.ProcessAsync(Form(oversized, "image/png"), CancellationToken.None));
    }

    [Fact]
    public async Task RechazaUnFlujoIncompletoRespectoAlTamanoDeclarado()
    {
        using var input = new MemoryStream([1, 2, 3]);
        var file = new FormFile(input, 0, 10, "foto", "imagen.png")
        {
            Headers = new HeaderDictionary(),
            ContentType = "image/png"
        };

        var error = await Assert.ThrowsAsync<AppValidationException>(() =>
            processor.ProcessAsync(file, CancellationToken.None));
        Assert.Equal("El contenido de la fotografía está malformado.", error.Errors["Foto"][0]);
    }

    [Fact]
    public async Task RechazaImagenAnimadaYDimensionesExcesivas()
    {
        var animated = AnimatedWebp();
        using (var data = SKData.CreateCopy(animated))
        using (var codec = SKCodec.Create(data))
        {
            Assert.NotNull(codec);
            Assert.True(codec.FrameCount > 1);
        }
        using var animationStream = new MemoryStream(animated);
        var animationError = await Assert.ThrowsAsync<AppValidationException>(() =>
            processor.ProcessAsync(Form(animationStream, "image/webp"), CancellationToken.None));
        Assert.Contains("animadas", animationError.Errors["Foto"][0]);

        using var largeDimension = new MemoryStream(Encode(10_001, 1, SKEncodedImageFormat.Png));
        var dimensionError = await Assert.ThrowsAsync<AppValidationException>(() =>
            processor.ProcessAsync(Form(largeDimension, "image/png"), CancellationToken.None));
        Assert.Contains("dimensiones", dimensionError.Errors["Foto"][0]);
    }

    [Fact]
    public async Task AplicaOrientacionExifYLimitaDimensionesDeSalida()
    {
        using var orientedInput = new MemoryStream(WithExifOrientationSix(
            Encode(40, 20, SKEncodedImageFormat.Jpeg)));
        var oriented = await processor.ProcessAsync(
            Form(orientedInput, "image/jpeg"), CancellationToken.None);
        using (var data = SKData.CreateCopy(oriented.Content))
        using (var codec = SKCodec.Create(data))
        {
            Assert.NotNull(codec);
            Assert.Equal(20, codec.Info.Width);
            Assert.Equal(40, codec.Info.Height);
        }

        using var oversizedInput = new MemoryStream(Encode(3_000, 1_000, SKEncodedImageFormat.Png));
        var resized = await processor.ProcessAsync(
            Form(oversizedInput, "image/png"), CancellationToken.None);
        using var resizedData = SKData.CreateCopy(resized.Content);
        using var resizedCodec = SKCodec.Create(resizedData);
        Assert.NotNull(resizedCodec);
        Assert.Equal(2_048, resizedCodec.Info.Width);
        Assert.InRange(resizedCodec.Info.Height, 682, 683);
    }

    private static FormFile Form(Stream stream, string mime) =>
        new(stream, 0, stream.Length, "foto", "imagen.png")
        {
            Headers = new HeaderDictionary(),
            ContentType = mime
        };

    private static byte[] Encode(int width, int height, SKEncodedImageFormat format)
    {
        using var bitmap = new SKBitmap(width, height);
        bitmap.Erase(SKColors.CornflowerBlue);
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(format, 90);
        return encoded.ToArray();
    }

    private static byte[] WithExifOrientationSix(byte[] jpeg)
    {
        byte[] exif = [
            (byte)'E', (byte)'x', (byte)'i', (byte)'f', 0, 0,
            (byte)'I', (byte)'I', 42, 0, 8, 0, 0, 0,
            1, 0, 18, 1, 3, 0, 1, 0, 0, 0, 6, 0, 0, 0,
            0, 0, 0, 0
        ];
        var result = new byte[jpeg.Length + exif.Length + 4];
        jpeg.AsSpan(0, 2).CopyTo(result);
        result[2] = 0xff;
        result[3] = 0xe1;
        BinaryPrimitives.WriteUInt16BigEndian(result.AsSpan(4, 2), (ushort)(exif.Length + 2));
        exif.CopyTo(result, 6);
        jpeg.AsSpan(2).CopyTo(result.AsSpan(6 + exif.Length));
        return result;
    }

    private static byte[] AnimatedWebp()
    {
        var staticWebp = Encode(2, 2, SKEncodedImageFormat.Webp);
        var frameContent = staticWebp.AsSpan(12).ToArray();
        var vp8x = new byte[10];
        vp8x[0] = 0x02;
        vp8x[4] = vp8x[7] = 1;
        var frame = new byte[16 + frameContent.Length];
        frame[6] = frame[9] = 1;
        frame[12] = 100;
        frameContent.CopyTo(frame, 16);
        var chunks = Chunk("VP8X", vp8x)
            .Concat(Chunk("ANIM", new byte[6]))
            .Concat(Chunk("ANMF", frame))
            .Concat(Chunk("ANMF", frame))
            .ToArray();
        var result = new byte[12 + chunks.Length];
        Encoding.ASCII.GetBytes("RIFF").CopyTo(result, 0);
        BinaryPrimitives.WriteInt32LittleEndian(result.AsSpan(4, 4), result.Length - 8);
        Encoding.ASCII.GetBytes("WEBP").CopyTo(result, 8);
        chunks.CopyTo(result, 12);
        return result;
    }

    private static byte[] Chunk(string fourCc, byte[] content)
    {
        var chunk = new byte[8 + content.Length + (content.Length % 2)];
        Encoding.ASCII.GetBytes(fourCc).CopyTo(chunk, 0);
        BinaryPrimitives.WriteInt32LittleEndian(chunk.AsSpan(4, 4), content.Length);
        content.CopyTo(chunk, 8);
        return chunk;
    }
}
