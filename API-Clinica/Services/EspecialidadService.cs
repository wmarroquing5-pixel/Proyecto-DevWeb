using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class EspecialidadService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : IEspecialidadService
{
    public async Task<PagedResponse<EspecialidadResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Especialidades.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(e => e.IdEspecialidad)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(e => new EspecialidadResponse(e.IdEspecialidad, e.Nombre, e.Activa))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<EspecialidadResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Especialidades.AsNoTracking()
            .Where(e => e.IdEspecialidad == id)
            .Select(e => new EspecialidadResponse(e.IdEspecialidad, e.Nombre, e.Activa))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Especialidad no encontrada.");

    public async Task<EspecialidadResponse> CrearAsync(
        GuardarEspecialidadRequest request, CancellationToken cancellationToken)
    {
        var nombre = ValidarNombre(request.Nombre);
        if (await context.Especialidades.AnyAsync(e => e.Nombre == nombre, cancellationToken))
            throw new ConflictException("La especialidad ya existe.");
        var especialidad = new Especialidad { Nombre = nombre, Activa = request.Activa ?? true };
        context.Especialidades.Add(especialidad);
        await GuardarAsync(cancellationToken);
        return ToResponse(especialidad);
    }

    public async Task<EspecialidadResponse> ActualizarAsync(
        int id, GuardarEspecialidadRequest request, CancellationToken cancellationToken)
    {
        var especialidad = await context.Especialidades.SingleOrDefaultAsync(
            e => e.IdEspecialidad == id, cancellationToken)
            ?? throw new NotFoundException("Especialidad no encontrada.");
        var nombre = ValidarNombre(request.Nombre);
        if (await context.Especialidades.AnyAsync(
            e => e.IdEspecialidad != id && e.Nombre == nombre, cancellationToken))
            throw new ConflictException("La especialidad ya existe.");
        especialidad.Nombre = nombre;
        if (request.Activa.HasValue) especialidad.Activa = request.Activa.Value;
        await GuardarAsync(cancellationToken);
        return ToResponse(especialidad);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var especialidad = await context.Especialidades.SingleOrDefaultAsync(
            e => e.IdEspecialidad == id, cancellationToken)
            ?? throw new NotFoundException("Especialidad no encontrada.");
        if (!especialidad.Activa) return;
        especialidad.Activa = false;
        await GuardarAsync(cancellationToken);
    }

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627)
        {
            throw new ConflictException("La especialidad ya existe.");
        }
    }

    private static string ValidarNombre(string? value)
    {
        var nombre = value?.Trim();
        if (string.IsNullOrWhiteSpace(nombre) || nombre.Length > 100)
            throw new AppValidationException("Nombre no válido.",
                new Dictionary<string, string[]> { ["Nombre"] = ["Debe contener entre 1 y 100 caracteres."] });
        return nombre;
    }

    private static EspecialidadResponse ToResponse(Especialidad especialidad) =>
        new(especialidad.IdEspecialidad, especialidad.Nombre, especialidad.Activa);
}
