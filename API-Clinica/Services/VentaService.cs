using System.Data;
using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class VentaService(
    ClinicaDbContext context,
    IAccesoActualService accesoActual) : IVentaService
{
    private const decimal MaxSqlMoney = 9_999_999_999_999_999.99m;

    public async Task<VentaResponse> CrearAsync(
        CrearVentaRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        if (request.IdSucursal <= 0)
            throw FarmaciaValidation.Invalid("IdSucursal", "La sucursal debe ser válida.");
        var quantities = PrepararCantidades(request.Items);
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);

        if (!context.Database.IsSqlServer())
        {
            if (context.Database.IsRelational())
                throw new NotSupportedException("La venta transaccional requiere SQL Server.");
            return await CrearCoreAsync(request.IdSucursal, quantities, principal,
                now, today, cancellationToken);
        }

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            var response = await CrearCoreAsync(request.IdSucursal, quantities, principal,
                now, today, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return response;
        }
        catch (SqlException ex) when (ex.Number is 1205 or 1222)
        {
            throw new ConflictException("El inventario está siendo modificado. Intente nuevamente.");
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("El inventario cambió durante la venta. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222)
        {
            throw new ConflictException("El inventario está siendo modificado. Intente nuevamente.");
        }
    }

    private async Task<VentaResponse> CrearCoreAsync(
        int idSucursal, SortedDictionary<int, int> quantities,
        ClaimsPrincipal principal, DateTime now, DateOnly today,
        CancellationToken cancellationToken)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");
        if (!await context.Sucursales.AsNoTracking()
            .AnyAsync(s => s.IdSucursal == idSucursal && s.Activa, cancellationToken))
            throw FarmaciaValidation.Invalid("IdSucursal", "La sucursal debe existir y estar activa.");

        var allocations = new List<Allocation>();
        decimal total = 0;
        // El orden por IdMedicamento mantiene un orden estable de bloqueo entre ventas concurrentes.
        foreach (var (idMedicamento, requested) in quantities)
        {
            var medicine = await ObtenerMedicamentoAsync(idMedicamento, cancellationToken);
            if (medicine is null || !medicine.Activo)
                throw FarmaciaValidation.Invalid("IdMedicamento", "El medicamento debe existir y estar activo.");

            var price = FarmaciaValidation.Price(medicine.PrecioVenta);
            var lots = await ObtenerLotesVendiblesAsync(idMedicamento, today, cancellationToken);
            var available = lots.Sum(l => (long)l.CantidadDisponible);
            if (available < requested)
                throw new ConflictException($"Stock insuficiente para el medicamento {idMedicamento}.");

            var remaining = requested;
            foreach (var lot in lots)
            {
                if (remaining == 0) break;
                var amount = Math.Min(remaining, lot.CantidadDisponible);
                var subtotal = price * amount;
                if (subtotal > MaxSqlMoney || total > MaxSqlMoney - subtotal)
                    throw FarmaciaValidation.Invalid("Items", "El importe excede el límite de decimal(18,2).");

                allocations.Add(new Allocation(lot, idMedicamento, amount, price, subtotal));
                total += subtotal;
                remaining -= amount;
            }
        }

        var sale = new Venta
        {
            IdUsuario = usuario.IdUsuario,
            IdSucursal = idSucursal,
            FechaVenta = now,
            Total = total
        };
        context.Ventas.Add(sale);
        await context.SaveChangesAsync(cancellationToken);

        var details = new List<(VentaDetalle Detail, int IdMedicamento)>();
        foreach (var allocation in allocations)
        {
            allocation.Lot.CantidadDisponible -= allocation.Amount;
            var detail = new VentaDetalle
            {
                IdVenta = sale.IdVenta,
                IdLote = allocation.Lot.IdLote,
                Cantidad = allocation.Amount,
                PrecioUnitario = allocation.Price,
                Subtotal = allocation.Subtotal
            };
            context.VentaDetalles.Add(detail);
            details.Add((detail, allocation.IdMedicamento));
        }
        await context.SaveChangesAsync(cancellationToken);

        return new VentaResponse(sale.IdVenta, sale.IdUsuario, sale.IdSucursal,
            sale.FechaVenta, sale.Total,
            details.Select(d => new VentaDetalleResponse(d.Detail.IdVentaDetalle,
                d.Detail.IdLote, d.IdMedicamento, d.Detail.Cantidad,
                d.Detail.PrecioUnitario, d.Detail.Subtotal)).ToList());
    }

    private async Task<Medicamento?> ObtenerMedicamentoAsync(int id, CancellationToken ct)
    {
        if (context.Database.IsSqlServer())
            return await context.Medicamentos
                .FromSqlInterpolated($"SELECT * FROM [Medicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdMedicamento] = {id}")
                .SingleOrDefaultAsync(ct);
        return await context.Medicamentos.SingleOrDefaultAsync(m => m.IdMedicamento == id, ct);
    }

    private async Task<List<LoteMedicamento>> ObtenerLotesVendiblesAsync(
        int idMedicamento, DateOnly today, CancellationToken ct)
    {
        List<LoteMedicamento> lots;
        if (context.Database.IsSqlServer())
            lots = await context.LoteMedicamentos
                .FromSqlInterpolated($"SELECT * FROM [LoteMedicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdMedicamento] = {idMedicamento} AND [CantidadDisponible] > 0 AND [FechaVencimiento] > {today} AND [FechaIngreso] <= {today}")
                .ToListAsync(ct);
        else
            lots = await context.LoteMedicamentos
                .Where(l => l.IdMedicamento == idMedicamento && l.CantidadDisponible > 0 &&
                    l.FechaVencimiento > today && l.FechaIngreso <= today)
                .ToListAsync(ct);

        return lots.OrderBy(l => l.FechaVencimiento)
            .ThenBy(l => l.FechaIngreso)
            .ThenBy(l => l.IdLote)
            .ToList();
    }

    private static SortedDictionary<int, int> PrepararCantidades(
        List<CrearVentaItemRequest>? items)
    {
        if (items is null || items.Count == 0)
            throw FarmaciaValidation.Invalid("Items", "Debe incluir al menos un medicamento.");

        var quantities = new SortedDictionary<int, int>();
        foreach (var item in items)
        {
            if (item is null || item.IdMedicamento <= 0 || item.Cantidad <= 0)
                throw FarmaciaValidation.Invalid("Items", "Cada elemento requiere un medicamento y una cantidad positiva.");
            var current = quantities.GetValueOrDefault(item.IdMedicamento);
            if ((long)current + item.Cantidad > int.MaxValue)
                throw FarmaciaValidation.Invalid("Items", "La cantidad solicitada excede el rango permitido.");
            quantities[item.IdMedicamento] = current + item.Cantidad;
        }
        return quantities;
    }

    private sealed record Allocation(
        LoteMedicamento Lot, int IdMedicamento, int Amount,
        decimal Price, decimal Subtotal);
}
