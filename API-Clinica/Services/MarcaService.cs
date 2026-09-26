using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class MarcaService(
    ClinicaDbContext context, ICommonParameterValidator parameterValidator) : IMarcaService
{
    public async Task<PagedResponse<MarcaResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Marcas.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(m => m.IdMarca)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(m => new MarcaResponse(m.IdMarca, m.Nombre, m.Activa))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<MarcaResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Marcas.AsNoTracking()
            .Where(m => m.IdMarca == id)
            .Select(m => new MarcaResponse(m.IdMarca, m.Nombre, m.Activa))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Marca no encontrada.");

    public async Task<MarcaResponse> CrearAsync(
        GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken)
    {
        var brand = new Marca
        {
            Nombre = FarmaciaValidation.RequiredText(request.Nombre, "Nombre", 100),
            Activa = request.Activa ?? true
        };
        context.Marcas.Add(brand);
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(brand);
    }

    public async Task<MarcaResponse> ActualizarAsync(
        int id, GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken)
    {
        var brand = await context.Marcas.SingleOrDefaultAsync(
            m => m.IdMarca == id, cancellationToken)
            ?? throw new NotFoundException("Marca no encontrada.");
        var nombre = FarmaciaValidation.RequiredText(request.Nombre, "Nombre", 100);
        if (request.Activa == false && brand.Activa)
            await VerificarSinMedicamentosActivosAsync(id, cancellationToken);

        brand.Nombre = nombre;
        if (request.Activa.HasValue) brand.Activa = request.Activa.Value;
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(brand);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var brand = await context.Marcas.SingleOrDefaultAsync(
            m => m.IdMarca == id, cancellationToken)
            ?? throw new NotFoundException("Marca no encontrada.");
        if (!brand.Activa) return;
        await VerificarSinMedicamentosActivosAsync(id, cancellationToken);
        brand.Activa = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task VerificarSinMedicamentosActivosAsync(int id, CancellationToken cancellationToken)
    {
        if (await context.Medicamentos.AsNoTracking()
            .AnyAsync(m => m.IdMarca == id && m.Activo, cancellationToken))
            throw new ConflictException("La marca tiene medicamentos activos.");
    }

    private static MarcaResponse ToResponse(Marca brand) =>
        new(brand.IdMarca, brand.Nombre, brand.Activa);
}
