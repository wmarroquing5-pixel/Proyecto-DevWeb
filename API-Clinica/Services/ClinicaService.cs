using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class ClinicaService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : IClinicaService
{
    public async Task<PagedResponse<ClinicaResponseDto>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Clinicas.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(c => c.IdClinica)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(c => new ClinicaResponseDto(c.IdClinica, c.NombreClinica,
                c.Especialidad, c.Activa, c.IdSucursal))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<ClinicaResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Clinicas.AsNoTracking()
            .Where(c => c.IdClinica == id)
            .Select(c => new ClinicaResponseDto(c.IdClinica, c.NombreClinica,
                c.Especialidad, c.Activa, c.IdSucursal))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Clínica no encontrada.");

    public async Task<ClinicaResponseDto> CrearAsync(
        ClinicaCreateDto request, CancellationToken cancellationToken)
    {
        var clinica = new Clinica { Activa = true };
        await AplicarDatosAsync(clinica, request, cancellationToken);
        context.Clinicas.Add(clinica);
        await GuardarAsync(cancellationToken);
        return ToResponse(clinica);
    }

    public async Task<ClinicaResponseDto> ActualizarAsync(
        int id, ClinicaUpdateDto request, CancellationToken cancellationToken)
    {
        var clinica = await context.Clinicas.SingleOrDefaultAsync(
            c => c.IdClinica == id, cancellationToken)
            ?? throw new NotFoundException("Clínica no encontrada.");
        await AplicarDatosAsync(clinica, request, cancellationToken);
        await GuardarAsync(cancellationToken);
        return ToResponse(clinica);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var clinica = await context.Clinicas.SingleOrDefaultAsync(
            c => c.IdClinica == id, cancellationToken)
            ?? throw new NotFoundException("Clínica no encontrada.");
        if (!clinica.Activa) return;
        clinica.Activa = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task AplicarDatosAsync(
        Clinica clinica, ClinicaDatosRequest request, CancellationToken cancellationToken)
    {
        var nombre = NormalizarEspacios(request.NombreClinica);
        if (nombre.Length is 0 or > 100)
            throw Invalid("NombreClinica", "Debe contener entre 1 y 100 caracteres.");
        var especialidad = NormalizarEspacios(request.Especialidad);
        if (especialidad.Length > 100)
            throw Invalid("Especialidad", "Máximo 100 caracteres.");
        if (request.IdSucursal <= 0 || !await context.Sucursales.AsNoTracking()
            .AnyAsync(s => s.IdSucursal == request.IdSucursal, cancellationToken))
            throw Invalid("IdSucursal", "La sucursal indicada no existe.");

        clinica.NombreClinica = nombre;
        clinica.Especialidad = especialidad.Length == 0 ? null : especialidad;
        clinica.IdSucursal = request.IdSucursal;
    }

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number == 547)
        {
            throw new ConflictException("La sucursal indicada ya no está disponible.");
        }
    }

    private static string NormalizarEspacios(string? valor) =>
        string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos de la clínica no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static ClinicaResponseDto ToResponse(Clinica c) =>
        new(c.IdClinica, c.NombreClinica, c.Especialidad, c.Activa, c.IdSucursal);
}
