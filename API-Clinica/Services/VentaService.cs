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
    IAccesoActualService accesoActual,
    ILogger<VentaService> logger) : IVentaService
{
    private const decimal MaxSqlMoney = 9_999_999_999_999_999.99m;

    public async Task<VentaResponse> CrearAsync(
        CrearVentaRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        if (!context.Database.IsSqlServer())
        {
            if (context.Database.IsRelational())
                throw new NotSupportedException("La venta transaccional requiere SQL Server.");
            // EF InMemory se utiliza exclusivamente en pruebas y no admite transacciones.
            return await CrearCoreAsync(request, principal, cancellationToken);
        }

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            try
            {
                var response = await CrearCoreAsync(request, principal, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return response;
            }
            catch
            {
                try { await transaction.RollbackAsync(CancellationToken.None); }
                catch (Exception rollbackError)
                {
                    logger.LogError(rollbackError, "No se pudo confirmar el rollback de la venta.");
                }
                throw;
            }
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
        CrearVentaRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        if (request.IdSucursal <= 0)
            throw FarmaciaValidation.Invalid("IdSucursal", "La sucursal debe ser válida.");
        var quantities = PrepararCantidades(request.Items);
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");
        if (!await context.Sucursales.AsNoTracking()
            .AnyAsync(s => s.IdSucursal == request.IdSucursal && s.Activa, cancellationToken))
            throw FarmaciaValidation.Invalid("IdSucursal", "La sucursal debe existir y estar activa.");

        var products = new List<ProductStock>();
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
            products.Add(new ProductStock(idMedicamento, requested, price, lots));
        }

        var sale = new Venta
        {
            IdUsuario = usuario.IdUsuario,
            IdSucursal = request.IdSucursal,
            FechaVenta = now
        };
        context.Ventas.Add(sale);

        var details = new List<(VentaDetalle Detail, int IdMedicamento)>();
        decimal total = 0;
        foreach (var product in products)
        {
            var remaining = product.Requested;
            foreach (var lot in product.Lots)
            {
                if (remaining == 0) break;
                var amount = Math.Min(remaining, lot.CantidadDisponible);
                if (amount <= 0 || lot.CantidadDisponible < amount)
                    throw new ConflictException("El stock del lote cambió durante la venta.");
                var subtotal = product.Price * amount;
                if (subtotal > MaxSqlMoney || total > MaxSqlMoney - subtotal)
                    throw FarmaciaValidation.Invalid("Items", "El importe excede el límite de decimal(18,2).");

                lot.CantidadDisponible -= amount;
                var detail = new VentaDetalle
                {
                    Venta = sale,
                    IdLote = lot.IdLote,
                    Cantidad = amount,
                    PrecioUnitario = product.Price,
                    Subtotal = subtotal
                };
                context.VentaDetalles.Add(detail);
                details.Add((detail, product.IdMedicamento));
                total += subtotal;
                remaining -= amount;
            }
            if (remaining != 0)
                throw new ConflictException("El stock cambió durante la venta.");
        }
        sale.Total = total;
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

    private sealed record ProductStock(
        int IdMedicamento, int Requested, decimal Price,
        IReadOnlyList<LoteMedicamento> Lots);
}
