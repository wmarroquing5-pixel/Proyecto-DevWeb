using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class SucursalService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : ISucursalService
{
    public async Task<PagedResponse<SucursalResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Sucursales.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(s => s.IdSucursal)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(s => new SucursalResponse(s.IdSucursal, s.Nombre, s.Direccion, s.Activa))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<SucursalResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Sucursales.AsNoTracking()
            .Where(s => s.IdSucursal == id)
            .Select(s => new SucursalResponse(s.IdSucursal, s.Nombre, s.Direccion, s.Activa))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Sucursal no encontrada.");

    public async Task<SucursalResponse> CrearAsync(
        GuardarSucursalRequest request, CancellationToken cancellationToken)
    {
        var sucursal = new Sucursal
        {
            Nombre = ValidarNombre(request.Nombre),
            Direccion = ValidarDireccion(request.Direccion),
            Activa = request.Activa ?? true
        };
        context.Sucursales.Add(sucursal);
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(sucursal);
    }

    public async Task<SucursalResponse> ActualizarAsync(
        int id, GuardarSucursalRequest request, CancellationToken cancellationToken)
    {
        var sucursal = await context.Sucursales.SingleOrDefaultAsync(
            s => s.IdSucursal == id, cancellationToken)
            ?? throw new NotFoundException("Sucursal no encontrada.");
        sucursal.Nombre = ValidarNombre(request.Nombre);
        sucursal.Direccion = ValidarDireccion(request.Direccion);
        if (request.Activa.HasValue) sucursal.Activa = request.Activa.Value;
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(sucursal);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var sucursal = await context.Sucursales.SingleOrDefaultAsync(
            s => s.IdSucursal == id, cancellationToken)
            ?? throw new NotFoundException("Sucursal no encontrada.");
        if (!sucursal.Activa) return;
        sucursal.Activa = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private static string ValidarNombre(string? value)
    {
        var nombre = value?.Trim();
        if (string.IsNullOrWhiteSpace(nombre) || nombre.Length > 100)
            throw new AppValidationException("Nombre no válido.",
                new Dictionary<string, string[]> { ["Nombre"] = ["Debe contener entre 1 y 100 caracteres."] });
        return nombre;
    }

    private static string? ValidarDireccion(string? value)
    {
        var direccion = value?.Trim();
        if (direccion?.Length > 255)
            throw new AppValidationException("Dirección no válida.",
                new Dictionary<string, string[]> { ["Direccion"] = ["Máximo 255 caracteres."] });
        return string.IsNullOrEmpty(direccion) ? null : direccion;
    }

    private static SucursalResponse ToResponse(Sucursal sucursal) =>
        new(sucursal.IdSucursal, sucursal.Nombre, sucursal.Direccion, sucursal.Activa);
}
