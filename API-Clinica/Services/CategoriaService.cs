using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class CategoriaService(
    ClinicaDbContext context, ICommonParameterValidator parameterValidator) : ICategoriaService
{
    public async Task<PagedResponse<CategoriaResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Categorias.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(c => c.IdCategoria)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(c => new CategoriaResponse(c.IdCategoria, c.Nombre, c.Activa))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<CategoriaResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Categorias.AsNoTracking()
            .Where(c => c.IdCategoria == id)
            .Select(c => new CategoriaResponse(c.IdCategoria, c.Nombre, c.Activa))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Categoría no encontrada.");

    public async Task<CategoriaResponse> CrearAsync(
        GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken)
    {
        var category = new Categoria
        {
            Nombre = FarmaciaValidation.RequiredText(request.Nombre, "Nombre", 100),
            Activa = request.Activa ?? true
        };
        context.Categorias.Add(category);
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(category);
    }

    public async Task<CategoriaResponse> ActualizarAsync(
        int id, GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken)
    {
        var category = await context.Categorias.SingleOrDefaultAsync(
            c => c.IdCategoria == id, cancellationToken)
            ?? throw new NotFoundException("Categoría no encontrada.");
        var nombre = FarmaciaValidation.RequiredText(request.Nombre, "Nombre", 100);
        if (request.Activa == false && category.Activa)
            await VerificarSinMedicamentosActivosAsync(id, cancellationToken);

        category.Nombre = nombre;
        if (request.Activa.HasValue) category.Activa = request.Activa.Value;
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(category);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var category = await context.Categorias.SingleOrDefaultAsync(
            c => c.IdCategoria == id, cancellationToken)
            ?? throw new NotFoundException("Categoría no encontrada.");
        if (!category.Activa) return;
        await VerificarSinMedicamentosActivosAsync(id, cancellationToken);
        category.Activa = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task VerificarSinMedicamentosActivosAsync(int id, CancellationToken cancellationToken)
    {
        if (await context.Medicamentos.AsNoTracking()
            .AnyAsync(m => m.IdCategoria == id && m.Activo, cancellationToken))
            throw new ConflictException("La categoría tiene medicamentos activos.");
    }

    private static CategoriaResponse ToResponse(Categoria category) =>
        new(category.IdCategoria, category.Nombre, category.Activa);
}
