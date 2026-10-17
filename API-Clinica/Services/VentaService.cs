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
    ICommonParameterValidator parameterValidator,
    ILogger<VentaService> logger) : IVentaService
{
    private const decimal MaxSqlMoney = 9_999_999_999_999_999.99m;

    public async Task<PagedResponse<VentaConsultaResumenResponse>> ListarAsync(
        VentaConsultaFiltroDto filtro, CancellationToken ct)
    {
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        ValidarFiltros(filtro.IdVenta, filtro.IdSucursal, filtro.IdPaciente,
            filtro.IdUsuario, filtro.FechaDesde, filtro.FechaHasta);

        var query = context.Ventas.AsNoTracking()
            .Where(v => v.TipoFactura == "Venta Publica");
        if (filtro.IdVenta is int idVenta)
            query = query.Where(v => v.IdVenta == idVenta);
        if (filtro.FechaDesde is DateTime desde)
            query = query.Where(v => v.FechaVenta >= desde);
        if (filtro.FechaHasta is DateTime hasta)
            query = query.Where(v => v.FechaVenta <= hasta);
        if (filtro.IdSucursal is int idSucursal)
            query = query.Where(v => v.IdSucursal == idSucursal);
        if (filtro.IdPaciente is int idPaciente)
            query = query.Where(v => EF.Property<int?>(v, "IdPaciente") == idPaciente);
        if (filtro.IdUsuario is int idUsuario)
            query = query.Where(v => v.IdUsuario == idUsuario);

        var total = await query.LongCountAsync(ct);
        var items = await query.OrderByDescending(v => v.FechaVenta)
            .ThenByDescending(v => v.IdVenta)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(v => new VentaConsultaResumenResponse(
                v.IdVenta, v.IdUsuario, v.IdSucursal,
                EF.Property<int?>(v, "IdPaciente"), v.FechaVenta, v.Total))
            .ToListAsync(ct);
        return new(items, filtro.Page, filtro.PageSize, total);
    }

    public async Task<VentaConsultaResponse> ObtenerAsync(int id, CancellationToken ct)
    {
        if (id <= 0)
            throw FarmaciaValidation.Invalid("IdVenta", "Debe ser mayor que cero.");
        var venta = await context.Ventas.AsNoTracking()
            .Where(v => v.IdVenta == id && v.TipoFactura == "Venta Publica")
            .Select(v => new
            {
                v.IdVenta, v.IdUsuario, v.IdSucursal, v.FechaVenta,
                v.TipoFactura, v.Total,
                IdPaciente = EF.Property<int?>(v, "IdPaciente")
            })
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Venta no encontrada.");
        var detalles = await ObtenerDetallesAsync(id, ct);
        return new(venta.IdVenta, venta.IdUsuario, venta.IdSucursal,
            venta.IdPaciente, venta.FechaVenta, venta.TipoFactura,
            venta.Total, detalles);
    }

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
                MovimientoSalidaRegistrar.Registrar(
                    context, lot.IdLote, amount, usuario.IdUsuario, request.IdSucursal, now);
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
                d.Detail.IdLote!.Value, d.IdMedicamento, d.Detail.Cantidad,
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

    private async Task<IReadOnlyList<VentaConsultaDetalleResponse>> ObtenerDetallesAsync(
        int idVenta, CancellationToken ct)
    {
        var filas = await context.VentaDetalles.AsNoTracking()
            .Where(d => d.IdVenta == idVenta)
            .OrderBy(d => d.IdVentaDetalle)
            .Select(d => new
            {
                d.IdVentaDetalle, d.IdLote, d.Cantidad,
                d.PrecioUnitario, d.Subtotal,
                IdServicio = EF.Property<int?>(d, "IdServicio")
            })
            .ToListAsync(ct);
        var loteIds = filas.Where(d => d.IdLote.HasValue)
            .Select(d => d.IdLote!.Value).Distinct().ToArray();
        var medicamentos = await context.LoteMedicamentos.AsNoTracking()
            .Where(l => loteIds.Contains(l.IdLote))
            .ToDictionaryAsync(l => l.IdLote, l => l.IdMedicamento, ct);
        return filas.Select(d => new VentaConsultaDetalleResponse(
            d.IdVentaDetalle, d.IdLote,
            d.IdLote is int idLote && medicamentos.TryGetValue(idLote, out var medicamento)
                ? medicamento : null,
            d.IdServicio, d.Cantidad, d.PrecioUnitario, d.Subtotal)).ToList();
    }

    private static void ValidarFiltros(
        int? idVenta, int? idSucursal, int? idPaciente, int? idUsuario,
        DateTime? desde, DateTime? hasta)
    {
        ValidarFiltroId(idVenta, nameof(VentaConsultaFiltroDto.IdVenta));
        ValidarFiltroId(idSucursal, nameof(VentaConsultaFiltroDto.IdSucursal));
        ValidarFiltroId(idPaciente, nameof(VentaConsultaFiltroDto.IdPaciente));
        ValidarFiltroId(idUsuario, nameof(VentaConsultaFiltroDto.IdUsuario));
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            throw FarmaciaValidation.Invalid(nameof(VentaConsultaFiltroDto.FechaHasta),
                "Debe ser igual o posterior a FechaDesde.");
    }

    private static void ValidarFiltroId(int? id, string campo)
    {
        if (id is <= 0)
            throw FarmaciaValidation.Invalid(campo, "Debe ser mayor que cero.");
    }

    private sealed record ProductStock(
        int IdMedicamento, int Requested, decimal Price,
        IReadOnlyList<LoteMedicamento> Lots);
}
