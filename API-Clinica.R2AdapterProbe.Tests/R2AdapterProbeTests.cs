using System.Security.Cryptography;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.R2AdapterProbe;
using SkiaSharp;

namespace API_Clinica.R2AdapterProbe.Tests;

public sealed class R2AdapterProbeTests
{
    [Fact]
    public void ModoPredeterminadoNoLeeConfiguracion()
    {
        var reads = 0;

        var result = ProbeExecutionGate.Evaluate([], _ =>
        {
            reads++;
            return null;
        });

        Assert.False(result.CanExecute);
        Assert.Equal(0, result.ExitCode);
        Assert.Equal("PREPARATION_ONLY", result.Status);
        Assert.Equal(0, reads);
    }

    [Fact]
    public void ExigeAutorizacionIndependienteYEvidenciaApi12G5()
    {
        var environment = new Dictionary<string, string?>
        {
            [ProbeExecutionGate.AuthorizationVariable] =
                ProbeExecutionGate.AuthorizationValue
        };

        var result = ProbeExecutionGate.Evaluate(
            [ProbeExecutionGate.ExecuteArgument],
            name => environment.GetValueOrDefault(name));

        Assert.False(result.CanExecute);
        Assert.Equal(4, result.ExitCode);
        Assert.Equal("API12G5_EVIDENCE_REQUIRED", result.Status);
    }

    [Fact]
    public void HabilitaSoloConLasDosBarrerasExactas()
    {
        var environment = new Dictionary<string, string?>
        {
            [ProbeExecutionGate.AuthorizationVariable] =
                ProbeExecutionGate.AuthorizationValue,
            [ProbeExecutionGate.LockEvidenceVariable] =
                ProbeExecutionGate.LockEvidenceValue
        };

        var result = ProbeExecutionGate.Evaluate(
            [ProbeExecutionGate.ExecuteArgument],
            name => environment.GetValueOrDefault(name));

        Assert.True(result.CanExecute);
        Assert.Equal(0, result.ExitCode);
        Assert.Equal("EXECUTION_AUTHORIZED", result.Status);
    }

    [Fact]
    public void ConfiguracionRechazaBucketDistintoDelProductivoEsperado()
    {
        var environment = new Dictionary<string, string?>
        {
            ["R2__AccountId"] = "synthetic",
            ["R2__AccessKeyId"] = "present",
            ["R2__SecretAccessKey"] = "present",
            ["R2__BucketName"] = "otro-bucket"
        };

        var options = R2AdapterProbeOptions.FromEnvironment(
            name => environment.GetValueOrDefault(name));

        Assert.False(R2AdapterProbeOptions.IsReady(options));
    }

    [Fact]
    public void RechazaClavesFueraDelPrefijoSintetico()
    {
        const string runId = "0123456789abcdef0123456789abcdef";

        R2AdapterProbeRunner.EnsureSyntheticKey(
            $"api-clinica-integration/{runId}/foto.webp", runId);

        Assert.Throws<InvalidOperationException>(() =>
            R2AdapterProbeRunner.EnsureSyntheticKey("pacientes/1/foto.webp", runId));
        Assert.Throws<InvalidOperationException>(() =>
            R2AdapterProbeRunner.EnsureSyntheticKey("medicamentos/1/foto.webp", runId));
    }

    [Fact]
    public async Task FlujoCompletoUsaPrecondicionesVerificaContenidoYLimpia()
    {
        var storage = new FakePhotoStorage();
        var runner = CreateRunner(storage);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(0, result);
        Assert.Null(storage.Content);
        Assert.Equal(3, storage.SaveCalls);
        Assert.Equal(1, storage.DeleteCalls);
        Assert.All(storage.Keys, key =>
            Assert.Matches(
                "^api-clinica-integration/[0-9a-f]{32}/foto\\.webp$", key));
    }

    [Fact]
    public async Task FalloTrasCargaConciliaYEliminaSoloContenidoReconocido()
    {
        var storage = new FakePhotoStorage { FailFirstGetAfterSave = true };
        var runner = CreateRunner(storage);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(6, result);
        Assert.Null(storage.Content);
        Assert.Equal(1, storage.DeleteCalls);
    }

    [Fact]
    public async Task ConciliacionNoEliminaContenidoDesconocido()
    {
        var storage = new FakePhotoStorage { ReplaceWithUnknownOnFailure = true };
        var runner = CreateRunner(storage);

        var result = await runner.RunAsync(CancellationToken.None);

        Assert.Equal(7, result);
        Assert.NotNull(storage.Content);
        Assert.Equal(0, storage.DeleteCalls);
    }

    private static R2AdapterProbeRunner CreateRunner(FakePhotoStorage storage)
    {
        var counter = 0;
        return new R2AdapterProbeRunner(
            storage,
            _ => [checked((byte)++counter), 2, 3, 4],
            TextWriter.Null,
            TextWriter.Null);
    }

    private sealed class FakePhotoStorage : IPhotoStorageService
    {
        private int version;
        private bool hasSaved;

        internal byte[]? Content { get; private set; }
        internal string? EntityTag { get; private set; }
        internal int SaveCalls { get; private set; }
        internal int DeleteCalls { get; private set; }
        internal bool FailFirstGetAfterSave { get; init; }
        internal bool ReplaceWithUnknownOnFailure { get; init; }
        internal List<string> Keys { get; } = [];

        public Task<StoredPhoto?> GetAsync(
            string key,
            CancellationToken cancellationToken)
        {
            Keys.Add(key);
            if (hasSaved && FailFirstGetAfterSave)
            {
                hasSaved = false;
                throw new ExternalDependencyException("Fallo simulado.");
            }
            if (hasSaved && ReplaceWithUnknownOnFailure)
            {
                hasSaved = false;
                Content = [99, 98, 97];
                EntityTag = "etag-externo";
                throw new ExternalDependencyException("Fallo simulado.");
            }
            return Task.FromResult(
                Content is null
                    ? null
                    : new StoredPhoto(Content.ToArray(), "image/webp", EntityTag!));
        }

        public Task<string> SaveAsync(
            string key,
            ProcessedPhoto photo,
            PhotoWriteCondition condition,
            CancellationToken cancellationToken)
        {
            Keys.Add(key);
            SaveCalls++;
            if (condition.MustNotExist)
            {
                if (Content is not null)
                    throw new ConflictException("Existe.");
            }
            else if (!string.Equals(
                         condition.ExpectedEntityTag,
                         EntityTag,
                         StringComparison.Ordinal))
            {
                throw new ConflictException("Versión obsoleta.");
            }

            Content = photo.Content.ToArray();
            EntityTag = $"etag-{++version}";
            hasSaved = true;
            return Task.FromResult(EntityTag);
        }

        public Task DeleteAsync(
            string key,
            string expectedEntityTag,
            CancellationToken cancellationToken)
        {
            Keys.Add(key);
            DeleteCalls++;
            if (!string.Equals(expectedEntityTag, EntityTag, StringComparison.Ordinal))
                throw new ConflictException("Versión obsoleta.");
            Content = null;
            EntityTag = null;
            return Task.CompletedTask;
        }
    }
}
