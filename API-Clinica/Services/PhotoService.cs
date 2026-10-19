using System.Data;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using SkiaSharp;

namespace API_Clinica.Services;

public sealed class PhotoService(
    ClinicaDbContext context,
    IPhotoStorageService storage,
    IPhotoImageProcessor processor,
    PhotoOperationLock operationLock,
    ILogger<PhotoService> logger) : IPhotoService
{
    private const string PatientRouteTemplate = "/api/pacientes/{0}/foto";
    private const string MedicineRouteTemplate = "/api/medicamentos/{0}/foto";
    private static readonly ProcessedPhoto DeletionMarker = CreateDeletionMarker();

    public async Task<PhotoResponse> SavePatientPhotoAsync(
        int patientId, IFormFile? file, CancellationToken cancellationToken)
    {
        var patient = await context.Pacientes.SingleOrDefaultAsync(
            item => item.IdPaciente == patientId, cancellationToken)
            ?? throw new NotFoundException("Paciente no encontrado.");
        if (!patient.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un paciente inactivo.");

        var photo = await processor.ProcessAsync(file, cancellationToken);
        var key = PatientKey(patientId);
        var relativeUrl = string.Format(PatientRouteTemplate, patientId);
        await using var heldLock = await operationLock.AcquireAsync(key, cancellationToken);
        await context.Entry(patient).ReloadAsync(cancellationToken);
        if (!patient.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un paciente inactivo.");
        var previous = await storage.GetAsync(key, cancellationToken);
        var newEntityTag = await SaveObjectAsync(key, photo, previous, cancellationToken);

        var previousUrl = patient.UrlFoto;
        patient.UrlFoto = relativeUrl;
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            patient.UrlFoto = previousUrl;
            await CompensateSaveAsync(key, previous, newEntityTag);
            throw;
        }
        return new PhotoResponse(relativeUrl);
    }

    public async Task<PhotoContent> GetPatientPhotoAsync(
        int patientId, CancellationToken cancellationToken)
    {
        var relativeUrl = await context.Pacientes.AsNoTracking()
            .Where(item => item.IdPaciente == patientId)
            .Select(item => item.UrlFoto)
            .SingleOrDefaultAsync(cancellationToken);
        if (relativeUrl is null)
        {
            if (!await context.Pacientes.AsNoTracking()
                .AnyAsync(item => item.IdPaciente == patientId, cancellationToken))
                throw new NotFoundException("Paciente no encontrado.");
            throw new NotFoundException("Fotografía no encontrada.");
        }

        var stored = await storage.GetAsync(PatientKey(patientId), cancellationToken)
            ?? throw new NotFoundException("Fotografía no encontrada.");
        return new PhotoContent(stored.Content, stored.ContentType);
    }

    public async Task DeletePatientPhotoAsync(
        int patientId, CancellationToken cancellationToken)
    {
        var patient = await context.Pacientes.SingleOrDefaultAsync(
            item => item.IdPaciente == patientId, cancellationToken)
            ?? throw new NotFoundException("Paciente no encontrado.");
        if (!patient.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un paciente inactivo.");
        if (patient.UrlFoto is null)
            throw new NotFoundException("Fotografía no encontrada.");

        var key = PatientKey(patientId);
        await using var heldLock = await operationLock.AcquireAsync(key, cancellationToken);
        await context.Entry(patient).ReloadAsync(cancellationToken);
        if (!patient.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un paciente inactivo.");
        if (patient.UrlFoto is null)
            throw new NotFoundException("Fotografía no encontrada.");
        var previous = await storage.GetAsync(key, cancellationToken);
        patient.UrlFoto = null;
        await PersistDeletedReferenceAsync(cancellationToken);
        if (previous is not null)
            await ReplaceWithDeletionMarkerAsync(key, previous.EntityTag, cancellationToken);
    }

    public async Task<PhotoResponse> SaveMedicinePhotoAsync(
        int medicineId, IFormFile? file, CancellationToken cancellationToken)
    {
        var medicine = await context.Medicamentos.SingleOrDefaultAsync(
            item => item.IdMedicamento == medicineId, cancellationToken)
            ?? throw new NotFoundException("Medicamento no encontrado.");
        if (!medicine.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un medicamento inactivo.");

        var photo = await processor.ProcessAsync(file, cancellationToken);
        var key = MedicineKey(medicineId);
        var relativeUrl = string.Format(MedicineRouteTemplate, medicineId);
        await using var heldLock = await operationLock.AcquireAsync(key, cancellationToken);
        await context.Entry(medicine).ReloadAsync(cancellationToken);
        if (!medicine.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un medicamento inactivo.");
        var previous = await storage.GetAsync(key, cancellationToken);
        var newEntityTag = await SaveObjectAsync(key, photo, previous, cancellationToken);

        var previousUrl = medicine.ImagenURL;
        medicine.ImagenURL = relativeUrl;
        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            medicine.ImagenURL = previousUrl;
            await CompensateSaveAsync(key, previous, newEntityTag);
            throw;
        }
        return new PhotoResponse(relativeUrl);
    }

    public async Task<PhotoContent> GetMedicinePhotoAsync(
        int medicineId, CancellationToken cancellationToken)
    {
        var relativeUrl = await context.Medicamentos.AsNoTracking()
            .Where(item => item.IdMedicamento == medicineId)
            .Select(item => item.ImagenURL)
            .SingleOrDefaultAsync(cancellationToken);
        if (relativeUrl is null)
        {
            if (!await context.Medicamentos.AsNoTracking()
                .AnyAsync(item => item.IdMedicamento == medicineId, cancellationToken))
                throw new NotFoundException("Medicamento no encontrado.");
            throw new NotFoundException("Fotografía no encontrada.");
        }

        var stored = await storage.GetAsync(MedicineKey(medicineId), cancellationToken)
            ?? throw new NotFoundException("Fotografía no encontrada.");
        return new PhotoContent(stored.Content, stored.ContentType);
    }

    public async Task DeleteMedicinePhotoAsync(
        int medicineId, CancellationToken cancellationToken)
    {
        var medicine = await context.Medicamentos.SingleOrDefaultAsync(
            item => item.IdMedicamento == medicineId, cancellationToken)
            ?? throw new NotFoundException("Medicamento no encontrado.");
        if (!medicine.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un medicamento inactivo.");
        if (medicine.ImagenURL is null)
            throw new NotFoundException("Fotografía no encontrada.");

        var key = MedicineKey(medicineId);
        await using var heldLock = await operationLock.AcquireAsync(key, cancellationToken);
        await context.Entry(medicine).ReloadAsync(cancellationToken);
        if (!medicine.Activo)
            throw new ConflictException("No se puede modificar la fotografía de un medicamento inactivo.");
        if (medicine.ImagenURL is null)
            throw new NotFoundException("Fotografía no encontrada.");
        var previous = await storage.GetAsync(key, cancellationToken);
        medicine.ImagenURL = null;
        await PersistDeletedReferenceAsync(cancellationToken);
        if (previous is not null)
            await ReplaceWithDeletionMarkerAsync(key, previous.EntityTag, cancellationToken);
    }

    private async Task<string> SaveObjectAsync(
        string key,
        ProcessedPhoto photo,
        StoredPhoto? previous,
        CancellationToken cancellationToken) =>
        await storage.SaveAsync(key, photo,
            previous is null
                ? PhotoWriteCondition.ForNewObject
                : PhotoWriteCondition.ForReplacement(previous.EntityTag),
            cancellationToken);

    private async Task CompensateSaveAsync(
        string key, StoredPhoto? previous, string newEntityTag)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(15));
        try
        {
            if (previous is null)
                await ReplaceWithDeletionMarkerAsync(key, newEntityTag, timeout.Token);
            else
                await storage.SaveAsync(key,
                    new ProcessedPhoto(previous.Content, previous.ContentType),
                    PhotoWriteCondition.ForReplacement(newEntityTag), timeout.Token);
        }
        catch (Exception exception)
        {
            logger.LogCritical(
                "Falló la compensación de una fotografía de {PhotoType}; se requiere conciliación. Tipo: {ErrorType}.",
                GetPhotoType(key), exception.GetType().Name);
        }
    }

    private async Task PersistDeletedReferenceAsync(CancellationToken cancellationToken)
    {
        IDbContextTransaction? transaction = null;
        try
        {
            if (context.Database.IsRelational())
            {
                transaction = await context.Database.BeginTransactionAsync(
                    IsolationLevel.ReadCommitted, cancellationToken);
            }

            await context.SaveChangesAsync(cancellationToken);
            if (transaction is not null)
                await transaction.CommitAsync(cancellationToken);
        }
        catch
        {
            if (transaction is not null)
            {
                try
                {
                    await transaction.RollbackAsync(CancellationToken.None);
                }
                catch (Exception rollbackException)
                {
                    logger.LogCritical(
                        "No fue posible confirmar el rollback de la referencia de fotografía. Tipo {ErrorType}.",
                        rollbackException.GetType().Name);
                }
            }
            throw;
        }
        finally
        {
            if (transaction is not null)
                await transaction.DisposeAsync();
        }
    }

    private Task<string> ReplaceWithDeletionMarkerAsync(
        string key, string expectedEntityTag, CancellationToken cancellationToken) =>
        storage.SaveAsync(
            key,
            DeletionMarker,
            PhotoWriteCondition.ForReplacement(expectedEntityTag),
            cancellationToken);

    private static ProcessedPhoto CreateDeletionMarker()
    {
        using var bitmap = new SKBitmap(
            new SKImageInfo(1, 1, SKColorType.Rgba8888, SKAlphaType.Premul));
        bitmap.Erase(SKColors.Transparent);
        using var image = SKImage.FromBitmap(bitmap);
        using var encoded = image.Encode(SKEncodedImageFormat.Webp, 100)
            ?? throw new InvalidOperationException(
                "No fue posible crear el marcador de eliminación de fotografías.");
        return new ProcessedPhoto(encoded.ToArray(), "image/webp");
    }

    private static string PatientKey(int id) => $"pacientes/{id}/foto.webp";

    private static string MedicineKey(int id) => $"medicamentos/{id}/foto.webp";

    private static string GetPhotoType(string key) =>
        key.StartsWith("pacientes/", StringComparison.Ordinal) ? "paciente" : "medicamento";
}
