using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Amazon.Runtime;
using API_Clinica.Common;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using SkiaSharp;

namespace API_Clinica.Tests;

public sealed class FotografiasTests
{
    [Fact]
    public async Task ConfiguracionR2UsaEndpointSeguroSinReintentosAutomaticos()
    {
        var options = new R2Options
        {
            AccountId = "cuenta123",
            AccessKeyId = "access",
            SecretAccessKey = "secret",
            BucketName = R2Options.ExpectedBucketName
        };

        Assert.True(options.IsValid());
        Assert.False(new R2Options
        {
            AccountId = options.AccountId,
            AccessKeyId = options.AccessKeyId,
            SecretAccessKey = options.SecretAccessKey,
            BucketName = "clinica-fotos"
        }.IsValid());
        Assert.Equal("https://cuenta123.r2.cloudflarestorage.com", options.GetServiceUrl());
        var configuration = CloudflareR2PhotoStorageService.BuildConfiguration(options);
        Assert.True(configuration.ForcePathStyle);
        Assert.Equal("auto", configuration.AuthenticationRegion);
        Assert.Equal(0, configuration.MaxErrorRetry);
        Assert.Equal(0, configuration.MaxStaleConnectionRetries);
        Assert.Equal(TimeSpan.FromSeconds(30), configuration.Timeout);
        Assert.Equal(RequestChecksumCalculation.WHEN_REQUIRED,
            configuration.RequestChecksumCalculation);

        await using var content = new MemoryStream([1, 2, 3]);
        var request = CloudflareR2PhotoStorageService.BuildPutObjectRequest(
            options.BucketName,
            "pacientes/1/foto.webp",
            content,
            content.Length,
            Convert.ToBase64String(MD5.HashData([1, 2, 3])),
            PhotoWriteCondition.ForNewObject);
        Assert.False(request.UseChunkEncoding);
        Assert.False(request.DisablePayloadSigning);
        Assert.True(request.DisableDefaultChecksumValidation);
        Assert.Equal(3, request.Headers.ContentLength);
        Assert.NotEmpty(request.MD5Digest);
        Assert.Equal("*", request.IfNoneMatch);

        await using var replacementContent = new MemoryStream([4, 5, 6]);
        var replacement = CloudflareR2PhotoStorageService.BuildPutObjectRequest(
            options.BucketName,
            "pacientes/1/foto.webp",
            replacementContent,
            replacementContent.Length,
            Convert.ToBase64String(MD5.HashData([4, 5, 6])),
            PhotoWriteCondition.ForReplacement("\"etag-vigente\""));
        Assert.Null(replacement.IfNoneMatch);
        Assert.Equal("\"etag-vigente\"", replacement.IfMatch);
        Assert.False(replacement.UseChunkEncoding);
        Assert.NotEmpty(replacement.MD5Digest);

        var incomplete = new R2Options
        {
            AccountId = options.AccountId,
            AccessKeyId = options.AccessKeyId,
            SecretAccessKey = string.Empty,
            BucketName = options.BucketName
        };
        Assert.False(incomplete.IsValid());
        var storage = new CloudflareR2PhotoStorageService(
            Options.Create(new R2Options()),
            NullLogger<CloudflareR2PhotoStorageService>.Instance);
        await Assert.ThrowsAsync<ExternalDependencyException>(() =>
            storage.GetAsync("pacientes/1/foto.webp", CancellationToken.None));
    }

    [Fact]
    public async Task PacienteCargaConsultaReemplazaYEliminaFotoPrivada()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        var before = await factory.GetPatientSnapshotAsync();

        var created = await UploadAsync(client, "/api/pacientes/1/foto", Png(), "image/png");
        Assert.Equal(HttpStatusCode.OK, created.StatusCode);
        Assert.Equal("/api/pacientes/1/foto",
            (await created.Content.ReadFromJsonAsync<PhotoResponse>())?.Url);
        Assert.True(factory.Storage.Contains("pacientes/1/foto.webp"));
        Assert.Equal("/api/pacientes/1/foto", await factory.GetPatientUrlAsync());

        var downloaded = await client.GetAsync("/api/pacientes/1/foto");
        Assert.Equal(HttpStatusCode.OK, downloaded.StatusCode);
        Assert.Equal("image/webp", downloaded.Content.Headers.ContentType?.MediaType);
        Assert.Contains("no-store", downloaded.Headers.CacheControl?.ToString());
        Assert.Equal("nosniff", downloaded.Headers.GetValues("X-Content-Type-Options").Single());

        var firstContent = await downloaded.Content.ReadAsByteArrayAsync();
        var replaced = await UploadAsync(client, "/api/pacientes/1/foto", Png(SKColors.Blue), "image/png");
        Assert.Equal(HttpStatusCode.OK, replaced.StatusCode);
        var secondContent = await (await client.GetAsync("/api/pacientes/1/foto"))
            .Content.ReadAsByteArrayAsync();
        Assert.NotEqual(firstContent, secondContent);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/pacientes/1/foto")).StatusCode);
        Assert.True(factory.Storage.Contains("pacientes/1/foto.webp"));
        var marker = await factory.Storage.GetAsync(
            "pacientes/1/foto.webp", CancellationToken.None);
        Assert.NotNull(marker);
        using (var markerStream = new MemoryStream(marker.Content))
        using (var markerCodec = SKCodec.Create(markerStream))
            Assert.Equal(SKEncodedImageFormat.Webp, markerCodec?.EncodedFormat);
        Assert.Null(await factory.GetPatientUrlAsync());
        Assert.Equal(before with { PhotoUrl = null }, await factory.GetPatientSnapshotAsync());
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/pacientes/1/foto")).StatusCode);
    }

    [Fact]
    public async Task PacienteAceptaJpegRealEnMultipartYLoNormalizaAWebp()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        using var bitmap = new SKBitmap(32, 24);
        bitmap.Erase(SKColors.CornflowerBlue);
        using var image = SKImage.FromBitmap(bitmap);
        using var jpeg = image.Encode(SKEncodedImageFormat.Jpeg, 90);

        var uploaded = await UploadAsync(client, "/api/pacientes/1/foto", jpeg.ToArray(), "image/jpeg");
        Assert.Equal(HttpStatusCode.OK, uploaded.StatusCode);
        var stored = await factory.Storage.GetAsync("pacientes/1/foto.webp", CancellationToken.None);
        Assert.NotNull(stored);
        Assert.Equal("image/webp", stored.ContentType);
        using var data = SKData.CreateCopy(stored.Content);
        using var codec = SKCodec.Create(data);
        Assert.Equal(SKEncodedImageFormat.Webp, codec?.EncodedFormat);
    }

    [Fact]
    public async Task MedicamentoNuevoUsaSuIdRealParaGuardarYConsultarFoto()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true, create: true);
        var created = await client.PostAsJsonAsync("/api/medicamentos", new GuardarMedicamentoRequest
        {
            IdCategoria = 1, IdMarca = 1, Codigo = "MED-FOTO-2",
            Nombre = "Medicamento sintético", PrecioVenta = 10m
        });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var medicine = await created.Content.ReadFromJsonAsync<MedicamentoResponse>();
        Assert.NotNull(medicine);
        Assert.True(medicine.IdMedicamento > 1);

        var photoPath = $"/api/medicamentos/{medicine.IdMedicamento}/foto";
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(client, photoPath, Png(), "image/png")).StatusCode);
        var saved = await client.GetFromJsonAsync<MedicamentoResponse>(
            $"/api/medicamentos/{medicine.IdMedicamento}");
        Assert.Equal(photoPath, saved?.ImagenURL);
        var photo = await client.GetAsync(photoPath);
        Assert.Equal(HttpStatusCode.OK, photo.StatusCode);
        Assert.Equal("image/webp", photo.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task MedicamentoCargaConsultaYEliminaFotoSinAlterarInventario()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        var before = await factory.GetMedicineSnapshotAsync();

        var uploaded = await UploadAsync(client, "/api/medicamentos/1/foto", Png(), "image/png");
        Assert.Equal(HttpStatusCode.OK, uploaded.StatusCode);
        Assert.Equal("/api/medicamentos/1/foto", await factory.GetMedicineUrlAsync());

        var downloaded = await client.GetAsync("/api/medicamentos/1/foto");
        Assert.Equal(HttpStatusCode.OK, downloaded.StatusCode);
        Assert.Equal("image/webp", downloaded.Content.Headers.ContentType?.MediaType);
        var original = await downloaded.Content.ReadAsByteArrayAsync();
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(client, "/api/medicamentos/1/foto", Png(SKColors.Blue), "image/png")).StatusCode);
        var replacement = await client.GetAsync("/api/medicamentos/1/foto");
        Assert.Equal(HttpStatusCode.OK, replacement.StatusCode);
        Assert.NotEqual(original, await replacement.Content.ReadAsByteArrayAsync());

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/medicamentos/1/foto")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/medicamentos/1/foto")).StatusCode);
        var after = await factory.GetMedicineSnapshotAsync();
        Assert.Equal(before with { ImageUrl = null }, after);
    }

    [Fact]
    public async Task EndpointsExigenJwtYPermisosDinamicos()
    {
        using var factory = new PhotoApiFactory();
        using var anonymous = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync("/api/pacientes/1/foto")).StatusCode);

        anonymous.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "jwt-invalido");
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync("/api/medicamentos/1/foto")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.DeleteAsync("/api/medicamentos/1/foto")).StatusCode);

        using var withoutPermissions = await factory.CreateAuthenticatedClientAsync();
        Assert.Equal(HttpStatusCode.Forbidden,
            (await withoutPermissions.GetAsync("/api/pacientes/1/foto")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await UploadAsync(withoutPermissions, "/api/medicamentos/1/foto", Png(), "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await withoutPermissions.DeleteAsync("/api/medicamentos/1/foto")).StatusCode);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task UsuarioORolInactivoNoAccede(bool userActive, bool roleActive)
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(
            read: true, modify: true, userActive: userActive, roleActive: roleActive);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/pacientes/1/foto")).StatusCode);
    }

    [Fact]
    public async Task PoliticaProvisionalPermiteLeerCualquierPacienteConPermisoExplicito()
    {
        using var factory = new PhotoApiFactory();
        using var writer = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(writer, "/api/pacientes/1/foto", Png(), "image/png")).StatusCode);

        using var reader = await factory.CreateAuthenticatedClientAsync(read: true, modify: false);
        Assert.Equal(HttpStatusCode.OK,
            (await reader.GetAsync("/api/pacientes/1/foto")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await reader.DeleteAsync("/api/pacientes/1/foto")).StatusCode);
    }

    [Fact]
    public async Task RecursosYFotografiasInexistentesRetornan404()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/pacientes/1/foto")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await UploadAsync(client, "/api/pacientes/999/foto", Png(), "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await UploadAsync(client, "/api/medicamentos/999/foto", Png(), "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/medicamentos/999/foto")).StatusCode);
    }

    [Fact]
    public async Task ValidaArchivoVacioTamanioFormatoMimeYContenido()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await UploadAsync(client, "/api/pacientes/1/foto", [], "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,
            (await UploadAsync(client, "/api/pacientes/1/foto", new byte[5 * 1024 * 1024 + 1], "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.UnsupportedMediaType,
            (await UploadAsync(client, "/api/pacientes/1/foto", [1, 2, 3], "text/plain")).StatusCode);
        Assert.Equal(HttpStatusCode.UnsupportedMediaType,
            (await UploadAsync(client, "/api/pacientes/1/foto", Png(), "image/jpeg")).StatusCode);
        byte[] avifHeader = [0, 0, 0, 16, (byte)'f', (byte)'t', (byte)'y', (byte)'p',
            (byte)'a', (byte)'v', (byte)'i', (byte)'f', 0, 0, 0, 0];
        var disguisedAvif = await UploadAsync(client, "/api/pacientes/1/foto", avifHeader, "image/png");
        Assert.Equal(HttpStatusCode.UnsupportedMediaType, disguisedAvif.StatusCode);
        Assert.Contains("AVIF", await disguisedAvif.Content.ReadAsStringAsync());
        var malformed = await UploadAsync(client, "/api/pacientes/1/foto", [1, 2, 3], "image/png");
        Assert.Equal(HttpStatusCode.BadRequest, malformed.StatusCode);
        using var problem = JsonDocument.Parse(await malformed.Content.ReadAsStringAsync());
        Assert.Equal("El contenido de la fotografía está malformado.",
            problem.RootElement.GetProperty("errors").GetProperty("Foto")[0].GetString());
        Assert.Null(await factory.GetPatientUrlAsync());
        Assert.False(factory.Storage.Contains("pacientes/1/foto.webp"));
        Assert.Equal(HttpStatusCode.BadRequest,
            (await UploadAsync(client, "/api/medicamentos/1/foto", [1, 2, 3], "image/png")).StatusCode);
        Assert.Equal(HttpStatusCode.RequestEntityTooLarge,
            (await UploadAsync(client, "/api/medicamentos/1/foto", new byte[5 * 1024 * 1024 + 1], "image/png")).StatusCode);
    }

    [Fact]
    public async Task FalloDeR2NoRegistraReferenciaDeFotoDelMedicamento()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        factory.Storage.FailSave = true;

        Assert.Equal(HttpStatusCode.ServiceUnavailable,
            (await UploadAsync(client, "/api/medicamentos/1/foto", Png(), "image/png")).StatusCode);
        Assert.Null(await factory.GetMedicineUrlAsync());
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/medicamentos/1/foto")).StatusCode);
    }

    [Fact]
    public async Task FalloAlEscribirMarcadorNoReactivaReferenciaSql()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);

        factory.Storage.FailSave = true;
        Assert.Equal(HttpStatusCode.ServiceUnavailable,
            (await UploadAsync(client, "/api/pacientes/1/foto", Png(), "image/png")).StatusCode);
        Assert.Null(await factory.GetPatientUrlAsync());

        factory.Storage.FailSave = false;
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(client, "/api/pacientes/1/foto", Png(), "image/png")).StatusCode);
        factory.Storage.FailSave = true;
        Assert.Equal(HttpStatusCode.ServiceUnavailable,
            (await client.DeleteAsync("/api/pacientes/1/foto")).StatusCode);
        Assert.Null(await factory.GetPatientUrlAsync());
        Assert.True(factory.Storage.Contains("pacientes/1/foto.webp"));
    }

    [Fact]
    public async Task FalloSqlPosteriorASubidaEjecutaCompensacion()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        factory.SaveFailure.FailNextPhotoSave = true;

        Assert.Equal(HttpStatusCode.InternalServerError,
            (await UploadAsync(client, "/api/pacientes/1/foto", Png(), "image/png")).StatusCode);
        Assert.Null(await factory.GetPatientUrlAsync());
        Assert.True(factory.Storage.Contains("pacientes/1/foto.webp"));
    }

    [Fact]
    public async Task ReemplazoFallidoConservaFotografiaAnteriorYReferenciaSql()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(client, "/api/pacientes/1/foto", Png(), "image/png")).StatusCode);
        var previous = await (await client.GetAsync("/api/pacientes/1/foto"))
            .Content.ReadAsByteArrayAsync();

        factory.Storage.FailSave = true;
        var failed = await UploadAsync(
            client, "/api/pacientes/1/foto", Png(SKColors.Blue), "image/png");

        Assert.Equal(HttpStatusCode.ServiceUnavailable, failed.StatusCode);
        Assert.Equal("/api/pacientes/1/foto", await factory.GetPatientUrlAsync());
        factory.Storage.FailSave = false;
        var current = await (await client.GetAsync("/api/pacientes/1/foto"))
            .Content.ReadAsByteArrayAsync();
        Assert.Equal(previous, current);
    }

    [Fact]
    public async Task FalloSqlEnEliminacionRestauraObjetoAnterior()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(client, "/api/medicamentos/1/foto", Png(), "image/png")).StatusCode);
        var previous = await (await client.GetAsync("/api/medicamentos/1/foto"))
            .Content.ReadAsByteArrayAsync();

        factory.SaveFailure.FailNextPhotoSave = true;
        Assert.Equal(HttpStatusCode.InternalServerError,
            (await client.DeleteAsync("/api/medicamentos/1/foto")).StatusCode);
        Assert.True(factory.Storage.Contains("medicamentos/1/foto.webp"));
        Assert.Equal("/api/medicamentos/1/foto", await factory.GetMedicineUrlAsync());
    }

    [Fact]
    public async Task DeleteReparaReferenciaCuandoObjetoYaNoExiste()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(client, "/api/pacientes/1/foto", Png(), "image/png")).StatusCode);
        factory.Storage.RemoveExternally("pacientes/1/foto.webp");

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/pacientes/1/foto")).StatusCode);
        Assert.Null(await factory.GetPatientUrlAsync());
    }

    [Fact]
    public async Task ReemplazosConcurrentesNoCorrompenLaFotografia()
    {
        using var factory = new PhotoApiFactory();
        using var client = await factory.CreateAuthenticatedClientAsync(read: true, modify: true);
        Assert.Equal(HttpStatusCode.OK,
            (await UploadAsync(client, "/api/medicamentos/1/foto", Png(), "image/png")).StatusCode);

        var first = UploadAsync(client, "/api/medicamentos/1/foto", Png(SKColors.Red), "image/png");
        var second = UploadAsync(client, "/api/medicamentos/1/foto", Png(SKColors.Green), "image/png");
        var responses = await Task.WhenAll(first, second);

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.OK, response.StatusCode));
        Assert.Single(factory.Storage.Keys, key => key == "medicamentos/1/foto.webp");
        var final = await client.GetAsync("/api/medicamentos/1/foto");
        Assert.Equal(HttpStatusCode.OK, final.StatusCode);
        Assert.NotEmpty(await final.Content.ReadAsByteArrayAsync());
    }

    private static async Task<HttpResponseMessage> UploadAsync(
        HttpClient client, string path, byte[] bytes, string contentType)
    {
        using var form = new MultipartFormDataContent();
        using var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = new MediaTypeHeaderValue(contentType);
        form.Add(content, "foto", "foto.bin");
        return await client.PostAsync(path, form);
    }

    private static byte[] Png(SKColor? color = null)
    {
        using var bitmap = new SKBitmap(16, 16);
        bitmap.Erase(color ?? SKColors.Orange);
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Png, 100);
        return encoded.ToArray();
    }

    private sealed class PhotoApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        private int nextUserId;

        public FakePhotoStorage Storage { get; } = new();
        public PhotoSaveFailureInterceptor SaveFailure { get; } = new();

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = "Server=(local);Database=NotUsedInMemory;Trusted_Connection=True;TrustServerCertificate=True",
                    ["Jwt:Issuer"] = "API-Clinica.Tests",
                    ["Jwt:Audience"] = "API-Clinica.Tests.Client",
                    ["Jwt:SigningKey"] = signingKey,
                    ["Jwt:ExpirationMinutes"] = "60",
                    ["Logging:EventLog:LogLevel:Default"] = "None"
                }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<ClinicaDbContext>>();
                services.RemoveAll<ClinicaDbContext>();
                services.AddSingleton(new DbContextOptionsBuilder<ClinicaDbContext>()
                    .UseInMemoryDatabase(databaseName)
                    .AddInterceptors(SaveFailure).Options);
                services.AddScoped<ClinicaDbContext>();
                services.RemoveAll<IPhotoStorageService>();
                services.AddSingleton<IPhotoStorageService>(Storage);
            });
        }

        public async Task<HttpClient> CreateAuthenticatedClientAsync(
            bool read = false, bool modify = false, bool create = false,
            bool userActive = true, bool roleActive = true)
        {
            var id = Interlocked.Increment(ref nextUserId);
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            using (var scope = Services.CreateScope())
            {
                var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
                if (!await db.Pacientes.AnyAsync())
                {
                    db.Pacientes.Add(new Paciente
                    {
                        IdPaciente = 1, Nombres = "Paciente", Apellidos = "Sintético",
                        FechaNacimiento = new DateOnly(1990, 1, 1), FechaRegistro = DateTime.UtcNow,
                        Activo = true
                    });
                    db.Categorias.Add(new Categoria { IdCategoria = 1, Nombre = "Prueba", Activa = true });
                    db.Marcas.Add(new Marca { IdMarca = 1, Nombre = "Prueba", Activa = true });
                    db.Medicamentos.Add(new Medicamento
                    {
                        IdMedicamento = 1, IdCategoria = 1, IdMarca = 1, Codigo = "MED-1",
                        Nombre = "Medicamento", PrecioVenta = 12.50m, Activo = true
                    });
                }
                var roleId = 100 + id;
                db.Roles.Add(new Rol { IdRol = roleId, Nombre = $"Foto-{id}", Activo = true });
                var user = new Usuario
                {
                    IdUsuario = 100 + id, IdRol = roleId, Username = $"foto.{id}", Activo = true
                };
                var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
                user.PasswordHash = hasher.HashPassword(user, password);
                db.Usuarios.Add(user);
                if (read || modify || create)
                {
                    db.Permisos.AddRange(
                        new Permiso
                        {
                            IdRol = roleId, Modulo = "Pacientes",
                            PuedeConsultar = read, PuedeModificar = modify
                        },
                        new Permiso
                        {
                            IdRol = roleId, Modulo = "Medicamentos",
                            PuedeConsultar = read, PuedeModificar = modify, PuedeCrear = create
                        });
                }
                await db.SaveChangesAsync();
            }

            var client = CreateClient();
            var login = await client.PostAsJsonAsync("/api/auth/login",
                new LoginRequest { Username = $"foto.{id}", Password = password });
            Assert.Equal(HttpStatusCode.OK, login.StatusCode);
            var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
            Assert.NotNull(response);
            client.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", response.AccessToken);
            if (!userActive)
            {
                using var scope = Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
                (await db.Usuarios.SingleAsync(item => item.IdUsuario == 100 + id)).Activo = false;
                await db.SaveChangesAsync();
            }
            if (!roleActive)
            {
                using var scope = Services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
                (await db.Roles.SingleAsync(item => item.IdRol == 100 + id)).Activo = false;
                await db.SaveChangesAsync();
            }
            return client;
        }

        public async Task<string?> GetPatientUrlAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Pacientes.AsNoTracking().Where(item => item.IdPaciente == 1)
                .Select(item => item.UrlFoto).SingleAsync();
        }

        public async Task<PatientSnapshot> GetPatientSnapshotAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Pacientes.AsNoTracking().Where(item => item.IdPaciente == 1)
                .Select(item => new PatientSnapshot(
                    item.Nombres, item.Apellidos, item.FechaNacimiento,
                    item.FechaRegistro, item.Activo, item.UrlFoto)).SingleAsync();
        }

        public async Task<string?> GetMedicineUrlAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Medicamentos.AsNoTracking().Where(item => item.IdMedicamento == 1)
                .Select(item => item.ImagenURL).SingleAsync();
        }

        public async Task<MedicineSnapshot> GetMedicineSnapshotAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Medicamentos.AsNoTracking().Where(item => item.IdMedicamento == 1)
                .Select(item => new MedicineSnapshot(item.IdCategoria, item.IdMarca, item.Codigo,
                    item.Nombre, item.PrecioVenta, item.Activo, item.ImagenURL)).SingleAsync();
        }
    }

    private sealed record MedicineSnapshot(
        int CategoryId, int BrandId, string Code, string Name,
        decimal Price, bool Active, string? ImageUrl);

    private sealed record PatientSnapshot(
        string FirstNames, string LastNames, DateOnly BirthDate,
        DateTime RegisteredAt, bool Active, string? PhotoUrl);

    private sealed class FakePhotoStorage : IPhotoStorageService
    {
        private readonly ConcurrentDictionary<string, StoredPhoto> objects = new(StringComparer.Ordinal);
        private long version;

        public bool FailSave { get; set; }
        public IEnumerable<string> Keys => objects.Keys;
        public bool Contains(string key) => objects.ContainsKey(key);
        public void RemoveExternally(string key) => objects.TryRemove(key, out _);

        public Task<StoredPhoto?> GetAsync(string key, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(objects.TryGetValue(key, out var value) ? value : null);
        }

        public Task<string> SaveAsync(
            string key, ProcessedPhoto photo, PhotoWriteCondition condition,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (FailSave) throw new ExternalDependencyException("R2 no disponible.");
            lock (objects)
            {
                objects.TryGetValue(key, out var current);
                if ((condition.MustNotExist && current is not null) ||
                    (!condition.MustNotExist &&
                     !string.Equals(current?.EntityTag, condition.ExpectedEntityTag, StringComparison.Ordinal)))
                    throw new ConflictException("Conflicto de versión.");
                var entityTag = $"\"v{Interlocked.Increment(ref version)}\"";
                objects[key] = new StoredPhoto([.. photo.Content], photo.ContentType, entityTag);
                return Task.FromResult(entityTag);
            }
        }

        public Task DeleteAsync(
            string key, string expectedEntityTag, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            lock (objects)
            {
                if (!objects.TryGetValue(key, out var current)) return Task.CompletedTask;
                if (!string.Equals(current.EntityTag, expectedEntityTag, StringComparison.Ordinal))
                    throw new ConflictException("Conflicto de versión.");
                objects.TryRemove(key, out _);
                return Task.CompletedTask;
            }
        }
    }

    private sealed class PhotoSaveFailureInterceptor : SaveChangesInterceptor
    {
        public bool FailNextPhotoSave { get; set; }

        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (FailNextPhotoSave && eventData.Context?.ChangeTracker.Entries()
                .Any(entry => entry.State == EntityState.Modified &&
                    (entry.Metadata.ClrType == typeof(Paciente) ||
                     entry.Metadata.ClrType == typeof(Medicamento))) == true)
            {
                FailNextPhotoSave = false;
                throw new DbUpdateException("Fallo sintético de persistencia.");
            }
            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}
