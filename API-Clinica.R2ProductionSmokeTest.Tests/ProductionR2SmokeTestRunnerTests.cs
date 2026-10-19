using System.Net;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using API_Clinica.R2ProductionSmokeTest;
using SkiaSharp;

namespace API_Clinica.R2ProductionSmokeTest.Tests;

public sealed class ProductionR2SmokeTestRunnerTests
{
    private const string SyntheticKey =
        "api-clinica-integration/0123456789abcdef0123456789abcdef/foto.webp";

    [Fact]
    public async Task ListadoVacioConColeccionNulaNoProduceNullReferenceNiPut()
    {
        var fake = new FakeR2ObjectClient
        {
            ListHandler = (_, _) => Task.FromResult<ListObjectsV2Response?>(EmptyListWithNullCollection()),
            MetadataHandler = (_, _) => Task.FromException<GetObjectMetadataResponse?>(NotFound())
        };
        var (runner, _, error) = CreateRunner(fake, _ => throw new ImageGenerationException());

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Equal(0, fake.PutCalls);
        Assert.Equal(0, fake.DeleteCalls);
        Assert.Contains("etapa=Generación WebP A", error.ToString());
        Assert.Contains("tipo=ImageGenerationException", error.ToString());
        Assert.Contains("solicitud-escritura-potencial=False", error.ToString());
        Assert.DoesNotContain("NullReferenceException", error.ToString());
    }

    [Fact]
    public async Task RespuestaListObjectsNulaSeTraduceEnDiagnosticoSeguro()
    {
        var fake = new FakeR2ObjectClient
        {
            ListHandler = (_, _) => Task.FromResult<ListObjectsV2Response?>(null)
        };
        var (runner, _, error) = CreateRunner(fake);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Equal(0, fake.PutCalls);
        Assert.Contains("etapa=Lectura inicial del prefijo", error.ToString());
        Assert.Contains("tipo=InvalidOperationException", error.ToString());
        Assert.Contains("ubicación=ProductionR2SmokeTestRunner.cs:", error.ToString());
    }

    [Fact]
    public async Task ETagNuloSeRechazaYSeReconciliaSinReintentarPut()
    {
        var fake = CreateBeforePutReadyFake();
        fake.PutHandler = (_, _) => Task.FromResult<PutObjectResponse?>(new PutObjectResponse { ETag = null });
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        fake.ListResponses.Enqueue(() => EmptyListWithNullCollection());
        var (runner, output, error) = CreateRunner(fake);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Equal(1, fake.PutCalls);
        Assert.Equal(0, fake.DeleteCalls);
        Assert.Contains("tipo=InvalidOperationException", error.ToString());
        Assert.Contains("Limpieza de contingencia: verificada", output.ToString());
        Assert.Contains("Objetos restantes confirmados: 0", output.ToString());
    }

    [Fact]
    public async Task ErrorDeImagenOcurreAntesDelPrimerPut()
    {
        var fake = CreateBeforePutReadyFake();
        var (runner, _, error) = CreateRunner(fake, _ => throw new ImageGenerationException());

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Equal(0, fake.PutCalls);
        Assert.Equal(0, fake.DeleteCalls);
        Assert.Contains("estado-remoto=SIN_ESCRITURAS", error.ToString());
    }

    [Fact]
    public async Task FalloTrasPutPotencialConsultaEstadoYLimpiaUnaSolaVez()
    {
        var fake = CreateBeforePutReadyFake();
        fake.PutHandler = (_, _) => Task.FromException<PutObjectResponse?>(new OperationCanceledException());
        fake.MetadataResponses.Enqueue(() => new GetObjectMetadataResponse { ETag = "\"etag-a\"" });
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        fake.DeleteHandler = (_, _) => Task.FromResult<DeleteObjectResponse?>(new DeleteObjectResponse());
        fake.ListResponses.Enqueue(() => EmptyListWithNullCollection());
        var (runner, output, error) = CreateRunner(fake);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Equal(1, fake.PutCalls);
        Assert.Equal(1, fake.DeleteCalls);
        Assert.Contains("solicitud-escritura-potencial=True", error.ToString());
        Assert.Contains("Limpieza de contingencia: verificada", output.ToString());
        Assert.Contains("Objetos restantes confirmados: 0", output.ToString());
    }

    [Fact]
    public async Task LimpiezaFallidaQuedaIndeterminadaSinReintentos()
    {
        var fake = CreateBeforePutReadyFake();
        fake.PutHandler = (_, _) => Task.FromException<PutObjectResponse?>(new OperationCanceledException());
        fake.MetadataResponses.Enqueue(() => new GetObjectMetadataResponse { ETag = "\"etag-a\"" });
        fake.DeleteHandler = (_, _) => Task.FromException<DeleteObjectResponse?>(new IOException("simulado"));
        var (runner, output, error) = CreateRunner(fake);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(7, result);
        Assert.Equal(1, fake.PutCalls);
        Assert.Equal(1, fake.DeleteCalls);
        Assert.Contains("LIMPIEZA_INDETERMINADA", error.ToString());
        Assert.Contains("Objetos restantes confirmados: no-verificable", output.ToString());
    }

    [Fact]
    public async Task RespuestaPutNulaNoProduceNullReference()
    {
        var fake = CreateBeforePutReadyFake();
        fake.PutHandler = (_, _) => Task.FromResult<PutObjectResponse?>(null);
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        fake.ListResponses.Enqueue(() => EmptyListWithNullCollection());
        var (runner, _, error) = CreateRunner(fake);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Equal(1, fake.PutCalls);
        Assert.DoesNotContain("NullReferenceException", error.ToString());
        Assert.Contains("tipo=InvalidOperationException", error.ToString());
    }

    [Fact]
    public void ConfiguracionDesactivaChecksumOpcionalYReintentos()
    {
        var configuration = ProductionR2SmokeTestRunner.BuildClientConfiguration(CreateOptions());

        Assert.Equal(RequestChecksumCalculation.WHEN_REQUIRED, configuration.RequestChecksumCalculation);
        Assert.Equal(0, configuration.MaxErrorRetry);
        Assert.Equal(0, configuration.MaxStaleConnectionRetries);
        Assert.True(configuration.ForcePathStyle);
        Assert.Equal("auto", configuration.AuthenticationRegion);
    }

    [Fact]
    public void PutInicialConservaIfNoneMatchYUsaLongitudFijaSinChunked()
    {
        using var content = new MemoryStream([1, 2, 3]);

        var request = ProductionR2SmokeTestRunner.BuildPutObjectRequest(
            ProductionR2Options.RequiredBucketName,
            SyntheticKey,
            content,
            content.Length,
            ifNoneMatch: "*",
            ifMatch: null);

        Assert.Equal("*", request.IfNoneMatch);
        Assert.Null(request.IfMatch);
        Assert.False(request.UseChunkEncoding);
        Assert.False(request.DisablePayloadSigning);
        Assert.True(request.DisableDefaultChecksumValidation);
        Assert.Null(request.ChecksumAlgorithm);
        Assert.Equal(3, request.Headers.ContentLength);
        Assert.Equal("image/webp", request.ContentType);
    }

    [Fact]
    public void ReemplazoConservaIfMatchYNoAgregaChecksumDeOperacion()
    {
        using var content = new MemoryStream([4, 5, 6]);

        var request = ProductionR2SmokeTestRunner.BuildPutObjectRequest(
            ProductionR2Options.RequiredBucketName,
            SyntheticKey,
            content,
            content.Length,
            ifNoneMatch: null,
            ifMatch: "\"etag-a\"");

        Assert.Null(request.IfNoneMatch);
        Assert.Equal("\"etag-a\"", request.IfMatch);
        Assert.False(request.UseChunkEncoding);
        Assert.False(request.DisablePayloadSigning);
        Assert.True(request.DisableDefaultChecksumValidation);
        Assert.Null(request.ChecksumAlgorithm);
    }

    [Fact]
    public async Task Http501RegistraPerfilSanitizadoYNoReintenta()
    {
        var fake = CreateBeforePutReadyFake();
        fake.PutHandler = (_, _) => Task.FromException<PutObjectResponse?>(NotImplemented());
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        fake.ListResponses.Enqueue(() => EmptyListWithNullCollection());
        var (runner, output, error) = CreateRunner(fake);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Equal(1, fake.PutCalls);
        Assert.Contains("R2_NO_IMPLEMENTADO: HTTP 501", error.ToString());
        Assert.Contains("método=PUT", error.ToString());
        Assert.Contains("Content-Type,Content-Length,Cache-Control,If-None-Match", error.ToString());
        Assert.Contains("checksum-solicitud=WHEN_REQUIRED", error.ToString());
        Assert.Contains("chunked=False", error.ToString());
        Assert.Contains("firma-payload-SigV4=True", error.ToString());
        Assert.DoesNotContain("synthetic", output.ToString() + error.ToString());
        Assert.DoesNotContain("Authorization", output.ToString() + error.ToString());
    }

    private static FakeR2ObjectClient CreateBeforePutReadyFake()
    {
        var fake = new FakeR2ObjectClient();
        fake.ListResponses.Enqueue(() => EmptyListWithNullCollection());
        fake.MetadataResponses.Enqueue(() => throw NotFound());
        return fake;
    }

    private static (ProductionR2SmokeTestRunner Runner, StringWriter Output, StringWriter Error)
        CreateRunner(FakeR2ObjectClient fake, Func<SKColor, byte[]>? imageFactory = null)
    {
        var output = new StringWriter();
        var error = new StringWriter();
        var runner = new ProductionR2SmokeTestRunner(
            CreateOptions(),
            fake,
            imageFactory ?? (_ => [1, 2, 3]),
            output,
            error);
        return (runner, output, error);
    }

    private static ListObjectsV2Response EmptyListWithNullCollection() =>
        new()
        {
            HttpStatusCode = HttpStatusCode.OK,
            S3Objects = null!,
            IsTruncated = false
        };

    private static AmazonS3Exception NotFound() =>
        new("simulado") { StatusCode = HttpStatusCode.NotFound };

    private static AmazonS3Exception NotImplemented() =>
        new("simulado")
        {
            StatusCode = HttpStatusCode.NotImplemented,
            ErrorCode = "NotImplemented"
        };

    private static ProductionR2Options CreateOptions() =>
        new()
        {
            AccountId = "synthetic",
            AccessKeyId = "synthetic",
            SecretAccessKey = "synthetic",
            BucketName = ProductionR2Options.RequiredBucketName
        };

    private sealed class ImageGenerationException : Exception;
}

internal sealed class FakeR2ObjectClient : IR2ObjectClient
{
    public Queue<Func<ListObjectsV2Response?>> ListResponses { get; } = new();
    public Queue<Func<GetObjectMetadataResponse?>> MetadataResponses { get; } = new();

    public Func<ListObjectsV2Request, CancellationToken, Task<ListObjectsV2Response?>>? ListHandler { get; set; }
    public Func<PutObjectRequest, CancellationToken, Task<PutObjectResponse?>>? PutHandler { get; set; }
    public Func<GetObjectMetadataRequest, CancellationToken, Task<GetObjectMetadataResponse?>>? MetadataHandler { get; set; }
    public Func<DeleteObjectRequest, CancellationToken, Task<DeleteObjectResponse?>>? DeleteHandler { get; set; }

    public int PutCalls { get; private set; }
    public int DeleteCalls { get; private set; }

    public Task<ListObjectsV2Response?> ListObjectsV2Async(
        ListObjectsV2Request request,
        CancellationToken cancellationToken)
    {
        if (ListHandler is not null)
            return ListHandler(request, cancellationToken);
        if (ListResponses.TryDequeue(out var response))
            return Invoke(response);
        throw new InvalidOperationException("No se preparó una respuesta ListObjectsV2 simulada.");
    }

    public Task<PutObjectResponse?> PutObjectAsync(
        PutObjectRequest request,
        CancellationToken cancellationToken)
    {
        PutCalls++;
        return PutHandler?.Invoke(request, cancellationToken)
            ?? throw new InvalidOperationException("No se preparó una respuesta PutObject simulada.");
    }

    public Task<GetObjectResponse?> GetObjectAsync(
        string bucketName,
        string key,
        CancellationToken cancellationToken) =>
        throw new InvalidOperationException("GetObject no era esperado en este escenario.");

    public Task<GetObjectMetadataResponse?> GetObjectMetadataAsync(
        GetObjectMetadataRequest request,
        CancellationToken cancellationToken)
    {
        if (MetadataHandler is not null)
            return MetadataHandler(request, cancellationToken);
        if (MetadataResponses.TryDequeue(out var response))
            return Invoke(response);
        throw new InvalidOperationException("No se preparó una respuesta de metadatos simulada.");
    }

    public Task<DeleteObjectResponse?> DeleteObjectAsync(
        DeleteObjectRequest request,
        CancellationToken cancellationToken)
    {
        DeleteCalls++;
        return DeleteHandler?.Invoke(request, cancellationToken)
            ?? throw new InvalidOperationException("No se preparó una respuesta DeleteObject simulada.");
    }

    public void Dispose()
    {
    }

    private static Task<T?> Invoke<T>(Func<T?> response)
    {
        try
        {
            return Task.FromResult(response());
        }
        catch (Exception exception)
        {
            return Task.FromException<T?>(exception);
        }
    }
}
