using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class LoteMedicamentoService(
    ClinicaDbContext context, ICommonParameterValidator parameterValidator) : ILoteMedicamentoService
{
    public async Task<PagedResponse<LoteMedicamentoResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.LoteMedicamentos.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(l => l.IdLote)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(l => new LoteMedicamentoResponse(l.IdLote, l.IdMedicamento,
                l.NumeroLote, l.FechaIngreso, l.FechaVencimiento, l.CantidadDisponible))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<LoteMedicamentoResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.LoteMedicamentos.AsNoTracking()
            .Where(l => l.IdLote == id)
            .Select(l => new LoteMedicamentoResponse(l.IdLote, l.IdMedicamento,
                l.NumeroLote, l.FechaIngreso, l.FechaVencimiento, l.CantidadDisponible))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Lote no encontrado.");

    public async Task<LoteMedicamentoResponse> CrearAsync(
        GuardarLoteMedicamentoRequest request, CancellationToken cancellationToken)
    {
        var numero = ValidarDatos(request);
        await ValidarMedicamentoAsync(request.IdMedicamento, cancellationToken);
        var lot = new LoteMedicamento
        {
            IdMedicamento = request.IdMedicamento, NumeroLote = numero,
            FechaIngreso = request.FechaIngreso,
            FechaVencimiento = request.FechaVencimiento,
            CantidadDisponible = request.CantidadDisponible
        };
        context.LoteMedicamentos.Add(lot);
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(lot);
    }

    public async Task<LoteMedicamentoResponse> ActualizarAsync(
        int id, GuardarLoteMedicamentoRequest request, CancellationToken cancellationToken)
    {
        var lot = await context.LoteMedicamentos.SingleOrDefaultAsync(
            l => l.IdLote == id, cancellationToken)
            ?? throw new NotFoundException("Lote no encontrado.");
        var numero = ValidarDatos(request);
        await ValidarMedicamentoAsync(request.IdMedicamento, cancellationToken);
        if (lot.IdMedicamento != request.IdMedicamento &&
            await context.VentaDetalles.AsNoTracking().AnyAsync(
                d => d.IdLote == id, cancellationToken))
            throw new ConflictException("No se puede cambiar el medicamento de un lote utilizado en ventas.");

        lot.IdMedicamento = request.IdMedicamento;
        lot.NumeroLote = numero;
        lot.FechaIngreso = request.FechaIngreso;
        lot.FechaVencimiento = request.FechaVencimiento;
        lot.CantidadDisponible = request.CantidadDisponible;
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(lot);
    }

    public async Task EliminarAsync(int id, CancellationToken cancellationToken)
    {
        var lot = await context.LoteMedicamentos.SingleOrDefaultAsync(
            l => l.IdLote == id, cancellationToken)
            ?? throw new NotFoundException("Lote no encontrado.");
        if (await context.VentaDetalles.AsNoTracking()
            .AnyAsync(d => d.IdLote == id, cancellationToken))
            throw new ConflictException("No se puede eliminar un lote utilizado en ventas.");

        context.LoteMedicamentos.Remove(lot);
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && sql.Number == 547)
        {
            throw new ConflictException("No se puede eliminar un lote utilizado en ventas.");
        }
    }

    private async Task ValidarMedicamentoAsync(int id, CancellationToken cancellationToken)
    {
        if (id <= 0 || !await context.Medicamentos.AsNoTracking()
            .AnyAsync(m => m.IdMedicamento == id && m.Activo, cancellationToken))
            throw FarmaciaValidation.Invalid("IdMedicamento", "El medicamento debe existir y estar activo.");
    }

    private static string ValidarDatos(GuardarLoteMedicamentoRequest request)
    {
        var numero = FarmaciaValidation.RequiredText(request.NumeroLote, "NumeroLote", 50);
        if (request.CantidadDisponible < 0)
            throw FarmaciaValidation.Invalid("CantidadDisponible", "Debe ser mayor o igual a cero.");
        FarmaciaValidation.Dates(request.FechaIngreso, request.FechaVencimiento);
        return numero;
    }

    private static LoteMedicamentoResponse ToResponse(LoteMedicamento lot) =>
        new(lot.IdLote, lot.IdMedicamento, lot.NumeroLote,
            lot.FechaIngreso, lot.FechaVencimiento, lot.CantidadDisponible);
}
