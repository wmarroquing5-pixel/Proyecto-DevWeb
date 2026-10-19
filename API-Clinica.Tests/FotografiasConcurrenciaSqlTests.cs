using System.Collections.Concurrent;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;

namespace API_Clinica.Tests;

public sealed class FotografiasConcurrenciaSqlTests
{
    [Fact]
    public async Task BloqueoDistribuidoControlaExclusividadLiberacionTimeoutYCancelacion()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        await using var firstContext = database.OpenContext();
        await using var secondContext = database.OpenContext();
        var first = CreateLock(firstContext, timeoutMilliseconds: 30_000);
        var second = CreateLock(secondContext, timeoutMilliseconds: 150);
        const string key = "pacientes/987654/foto.webp";

        Assert.Equal(0, await firstContext.Pacientes.CountAsync());
        await using (var held = await first.AcquireAsync(key, CancellationToken.None))
        {
            await Assert.ThrowsAsync<ConflictException>(() =>
                second.AcquireAsync(key, CancellationToken.None));

            using var cancellation = new CancellationTokenSource(TimeSpan.FromMilliseconds(100));
            var cancellable = CreateLock(secondContext, timeoutMilliseconds: 30_000);
            await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
                cancellable.AcquireAsync(key, cancellation.Token));
        }

        await using (var reacquired = await second.AcquireAsync(key, CancellationToken.None))
        {
            // La adquisición confirma que DisposeAsync liberó el bloqueo de sesión.
        }

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
        {
            await using var held = await first.AcquireAsync(key, CancellationToken.None);
            throw new InvalidOperationException("Fallo sintético.");
        });
        await using (var afterException = await second.AcquireAsync(key, CancellationToken.None))
        {
            // La liberación también ocurre durante el desenrollado por excepción.
        }

        await Assert.ThrowsAsync<ArgumentException>(() =>
            first.AcquireAsync("ventas/1/documento.bin", CancellationToken.None));
        Assert.Equal(0, await firstContext.Pacientes.CountAsync());
    }

    [Fact]
    public async Task DeleteCondicionalIgnoradoReproduceBorradoDeVersionNueva()
    {
        const string key = "pacientes/1/foto.webp";
        var storage = new R2DeleteWithoutPreconditionFake();
        storage.Seed(key, [1], "\"v1\"");

        await storage.SaveAsync(
            key,
            new ProcessedPhoto([2], "image/webp"),
            PhotoWriteCondition.ForReplacement("\"v1\""),
            CancellationToken.None);
        await storage.DeleteAsync(key, "\"v1\"", CancellationToken.None);

        Assert.Null(await storage.GetAsync(key, CancellationToken.None));
    }

    [Fact]
    public async Task EliminacionAnteriorNoBorraReemplazoDeOtraInstancia()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        int patientId;
        await using (var setup = database.OpenContext())
        {
            var patient = new Paciente
            {
                Nombres = "Foto",
                Apellidos = "Concurrente",
                FechaNacimiento = new DateOnly(1990, 1, 1),
                FechaRegistro = DateTime.UtcNow,
                Activo = true,
                UrlFoto = "/api/pacientes/1/foto"
            };
            setup.Pacientes.Add(patient);
            await setup.SaveChangesAsync();
            patientId = patient.IdPaciente;
            patient.UrlFoto = $"/api/pacientes/{patientId}/foto";
            await setup.SaveChangesAsync();
        }

        var key = $"pacientes/{patientId}/foto.webp";
        var storage = new R2DeleteWithoutPreconditionFake();
        storage.Seed(key, [1], "\"v1\"");

        await using var deleteContext = database.OpenContext();
        await using var replaceContext = database.OpenContext();
        var deleteService = CreateService(deleteContext, storage, [9]);
        var replaceService = CreateService(replaceContext, storage, [2]);

        storage.PauseNextSave();
        var deleting = deleteService.DeletePatientPhotoAsync(patientId, CancellationToken.None);
        await storage.SaveEntered.WaitAsync(TimeSpan.FromSeconds(10));

        await using (var afterClear = database.OpenContext())
        {
            Assert.Null(await afterClear.Pacientes
                .Where(item => item.IdPaciente == patientId)
                .Select(item => item.UrlFoto)
                .SingleAsync());
        }

        // Simula la pérdida de la sesión propietaria de sp_getapplock después
        // del COMMIT SQL y antes del PUT condicional del marcador.
        await deleteContext.Database.CloseConnectionAsync();

        var replacing = replaceService.SavePatientPhotoAsync(
            patientId, file: null, CancellationToken.None);
        await replacing;

        storage.AllowSave();
        await Assert.ThrowsAsync<ConflictException>(async () => await deleting);

        var current = await storage.GetAsync(key, CancellationToken.None);
        Assert.NotNull(current);
        Assert.Equal([2], current.Content);
        await using var verification = database.OpenContext();
        Assert.Equal($"/api/pacientes/{patientId}/foto",
            await verification.Pacientes.Where(item => item.IdPaciente == patientId)
                .Select(item => item.UrlFoto).SingleAsync());
    }

    private static PhotoService CreateService(
        ClinicaDbContext context,
        IPhotoStorageService storage,
        byte[] processedContent)
    {
        var operationLock = new PhotoOperationLock(
            context,
            new PhotoOperationLockRegistry(),
            NullLogger<PhotoOperationLock>.Instance);
        return new PhotoService(
            context,
            storage,
            new StaticPhotoProcessor(processedContent),
            operationLock,
            NullLogger<PhotoService>.Instance);
    }

    private static PhotoOperationLock CreateLock(
        ClinicaDbContext context, int timeoutMilliseconds) =>
        new(
            context,
            new PhotoOperationLockRegistry(),
            NullLogger<PhotoOperationLock>.Instance,
            timeoutMilliseconds);

    private sealed class StaticPhotoProcessor(byte[] content) : IPhotoImageProcessor
    {
        public Task<ProcessedPhoto> ProcessAsync(
            IFormFile? file, CancellationToken cancellationToken) =>
            Task.FromResult(new ProcessedPhoto([.. content], "image/webp"));
    }

    private sealed class R2DeleteWithoutPreconditionFake : IPhotoStorageService
    {
        private readonly ConcurrentDictionary<string, StoredPhoto> objects =
            new(StringComparer.Ordinal);
        private readonly TaskCompletionSource deleteEntered =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource allowDelete =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource saveEntered =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private readonly TaskCompletionSource allowSave =
            new(TaskCreationOptions.RunContinuationsAsynchronously);
        private long version = 1;
        private bool pauseDelete;
        private int pauseSave;

        public Task DeleteEntered => deleteEntered.Task;
        public Task SaveEntered => saveEntered.Task;

        public void Seed(string key, byte[] content, string entityTag) =>
            objects[key] = new StoredPhoto([.. content], "image/webp", entityTag);

        public void PauseNextDelete() => pauseDelete = true;

        public void AllowDelete() => allowDelete.TrySetResult();

        public void PauseNextSave() => Interlocked.Exchange(ref pauseSave, 1);

        public void AllowSave() => allowSave.TrySetResult();

        public Task<StoredPhoto?> GetAsync(string key, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            return Task.FromResult(objects.TryGetValue(key, out var value)
                ? value with { Content = [.. value.Content] }
                : null);
        }

        public async Task<string> SaveAsync(
            string key,
            ProcessedPhoto photo,
            PhotoWriteCondition condition,
            CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (Interlocked.Exchange(ref pauseSave, 0) == 1)
            {
                saveEntered.TrySetResult();
                await allowSave.Task.WaitAsync(cancellationToken);
            }

            lock (objects)
            {
                objects.TryGetValue(key, out var current);
                if ((condition.MustNotExist && current is not null) ||
                    (!condition.MustNotExist &&
                     !string.Equals(current?.EntityTag, condition.ExpectedEntityTag,
                         StringComparison.Ordinal)))
                    throw new ConflictException("Conflicto de versión sintético.");
                var entityTag = $"\"v{Interlocked.Increment(ref version)}\"";
                objects[key] = new StoredPhoto(
                    [.. photo.Content], photo.ContentType, entityTag);
                return entityTag;
            }
        }

        public async Task DeleteAsync(
            string key,
            string expectedEntityTag,
            CancellationToken cancellationToken)
        {
            if (pauseDelete)
            {
                pauseDelete = false;
                deleteEntered.TrySetResult();
                await allowDelete.Task.WaitAsync(cancellationToken);
            }

            // Reproduce el comportamiento confirmado de R2: If-Match se ignora en DELETE.
            objects.TryRemove(key, out _);
        }
    }
}
