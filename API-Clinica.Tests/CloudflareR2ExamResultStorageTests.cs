using System.Net;
using System.Text;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;
using API_Clinica.Common;
using API_Clinica.Exceptions;
using API_Clinica.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace API_Clinica.Tests;

public sealed class CloudflareR2ExamResultStorageTests
{
    private const string FileId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

    [Fact]
    public async Task ListadoVacioDelSdkCuatroEsUnaListaVacia()
    {
        using var client = new StubS3();
        Assert.Null(client.Page.S3Objects);
        using var storage = CreateStorage(client);

        var result = await storage.ListAsync(4, CancellationToken.None);

        Assert.Empty(result);
        Assert.Equal("examenes/4/", client.LastPrefix);
    }

    [Fact]
    public async Task ListaDocumentoConMetadatosPersistentes()
    {
        using var client = new StubS3();
        client.Page.S3Objects = [new S3Object { Key = $"examenes/4/{FileId}" }];
        using var storage = CreateStorage(client);

        var result = Assert.Single(await storage.ListAsync(4, CancellationToken.None));

        Assert.Equal(FileId, result.ArchivoId);
        Assert.Equal("resultado.pdf", result.NombreOriginal);
        Assert.Equal(123, result.TamanoBytes);
        Assert.Equal(new DateTimeOffset(2026, 10, 22, 0, 0, 0, TimeSpan.Zero), result.FechaCargaUtc);
    }

    [Fact]
    public async Task MetadatosCorruptosNoSeConfundenConExamenVacio()
    {
        using var client = new StubS3 { CorruptMetadata = true };
        client.Page.S3Objects = [new S3Object { Key = $"examenes/4/{FileId}" }];
        using var storage = CreateStorage(client);

        await Assert.ThrowsAsync<ExternalDependencyException>(() =>
            storage.ListAsync(4, CancellationToken.None));
    }

    [Fact]
    public async Task ErrorDeR2NoSeConvierteEnListaVacia()
    {
        using var client = new StubS3 { Unavailable = true };
        using var storage = CreateStorage(client);

        await Assert.ThrowsAsync<ExternalDependencyException>(() =>
            storage.ListAsync(4, CancellationToken.None));
    }

    private static CloudflareR2ExamResultStorage CreateStorage(IAmazonS3 client) =>
        new(Options.Create(new R2Options
        {
            AccountId = "testaccount", AccessKeyId = "testkey",
            SecretAccessKey = "testsecret", BucketName = R2Options.ExpectedBucketName
        }), NullLogger<CloudflareR2ExamResultStorage>.Instance, client);

    private sealed class StubS3 : AmazonS3Client
    {
        public ListObjectsV2Response Page { get; } = new();
        public string? LastPrefix { get; private set; }
        public bool CorruptMetadata { get; init; }
        public bool Unavailable { get; init; }

        public StubS3() : base(new BasicAWSCredentials("testkey", "testsecret"),
            new AmazonS3Config { ServiceURL = "http://127.0.0.1", ForcePathStyle = true }) { }

        public override Task<ListObjectsV2Response> ListObjectsV2Async(
            ListObjectsV2Request request, CancellationToken cancellationToken = default)
        {
            LastPrefix = request.Prefix;
            if (Unavailable)
                throw new AmazonS3Exception("No disponible") { StatusCode = HttpStatusCode.ServiceUnavailable };
            return Task.FromResult(Page);
        }

        public override Task<GetObjectMetadataResponse> GetObjectMetadataAsync(
            string bucketName, string key, CancellationToken cancellationToken = default)
        {
            var response = new GetObjectMetadataResponse { ContentLength = 123 };
            response.Headers.ContentType = "application/pdf";
            if (!CorruptMetadata)
            {
                response.Metadata["name64"] = Convert.ToBase64String(Encoding.UTF8.GetBytes("resultado.pdf"));
                response.Metadata["uploadedby"] = "1";
                response.Metadata["uploadedatutc"] = "2026-10-22T00:00:00.0000000+00:00";
                response.Metadata["sha256"] = new string('a', 64);
            }
            return Task.FromResult(response);
        }
    }
}
