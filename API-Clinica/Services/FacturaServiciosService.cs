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

public sealed class FacturaServiciosService(
    ClinicaDbContext context,
    IAccesoActualService accesoActual,
    ICommonParameterValidator parameterValidator,
    ILogger<FacturaServiciosService> logger) : IFacturaServiciosService
{
    private const string TipoFactura = "Estancia Medica";
    private const decimal MaximoImporte = 9_999_999_999_999_999.99m;

    public async Task<PagedResponse<FacturaConsultaResumenResponse>> ListarAsync(
        FacturaConsultaFiltroDto filtro, CancellationToken ct)
    {
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        ValidarFiltros(filtro.IdFactura, filtro.IdSucursal, filtro.IdPaciente,
            filtro.IdUsuario, filtro.FechaDesde, filtro.FechaHasta);

        var query = context.Ventas.AsNoTracking()
            .Where(v => v.TipoFactura == TipoFactura);
        if (filtro.IdFactura is int idFactura)
            query = query.Where(v => v.IdVenta == idFactura);
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
            .Select(v => new FacturaConsultaResumenResponse(
                v.IdVenta, v.IdUsuario, v.IdSucursal,
                EF.Property<int?>(v, "IdPaciente"), v.FechaVenta, v.TipoFactura,
                EF.Property<string?>(v, "Nit"),
                EF.Property<string?>(v, "NombreFacturacion"), v.Total))
            .ToListAsync(ct);
        return new(items, filtro.Page, filtro.PageSize, total);
    }

    public async Task<FacturaConsultaResponse> ObtenerAsync(int id, CancellationToken ct)
    {
        if (id <= 0)
            throw Invalid("IdFactura", "Debe ser mayor que cero.");
        var factura = await context.Ventas.AsNoTracking()
            .Where(v => v.IdVenta == id && v.TipoFactura == TipoFactura)
            .Select(v => new
            {
                v.IdVenta, v.IdUsuario, v.IdSucursal, v.FechaVenta,
                v.TipoFactura, v.Total,
                IdPaciente = EF.Property<int?>(v, "IdPaciente"),
                Nit = EF.Property<string?>(v, "Nit"),
                NombreFacturacion = EF.Property<string?>(v, "NombreFacturacion")
            })
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Factura no encontrada.");
        var detalles = await ObtenerDetallesAsync(id, ct);
        return new(factura.IdVenta, factura.IdUsuario, factura.IdSucursal,
            factura.IdPaciente, factura.FechaVenta, factura.TipoFactura,
            factura.Nit, factura.NombreFacturacion, factura.Total, detalles);
    }

    public async Task<FacturaServiciosResponse> CrearAsync(
        CrearFacturaServiciosRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        if (!context.Database.IsSqlServer())
        {
            if (context.Database.IsRelational())
                throw new NotSupportedException("La facturación transaccional requiere SQL Server.");
            // EF InMemory se usa únicamente en pruebas y no admite transacciones SQL.
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
                    logger.LogError(rollbackError, "No se pudo confirmar el rollback de la factura de servicios.");
                }
                throw;
            }
        }
        catch (SqlException ex) when (ex.Number is 1205 or 1222 or 547)
        {
            throw new ConflictException("Los datos de la factura cambiaron durante la operación. Intente nuevamente.");
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("El inventario cambió durante la factura. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222 or 547)
        {
            throw new ConflictException("Los datos de la factura cambiaron durante la operación. Intente nuevamente.");
        }
    }

    private async Task<FacturaServiciosResponse> CrearCoreAsync(
        CrearFacturaServiciosRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var today = DateOnly.FromDateTime(now);
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");
        if (request.IdSucursal <= 0 || !await context.Sucursales.AsNoTracking()
            .AnyAsync(s => s.IdSucursal == request.IdSucursal && s.Activa, cancellationToken))
            throw Invalid("IdSucursal", "La sucursal debe existir y estar activa.");
        if (request.IdPaciente <= 0 || !await context.Pacientes.AsNoTracking()
            .AnyAsync(p => p.IdPaciente == request.IdPaciente, cancellationToken))
            throw Invalid("IdPaciente", "El paciente indicado no existe.");

        var nit = TextoOpcional(request.Nit, "Nit", 50);
        var nombreFacturacion = TextoOpcional(request.NombreFacturacion, "NombreFacturacion", 150);
        var items = request.Servicios ?? [];
        var cantidadesMedicamentos = PrepararCantidades(request.Medicamentos);
        if (items.Count == 0 && cantidadesMedicamentos.Count == 0)
            throw Invalid("Servicios", "Debe incluir al menos un servicio o medicamento.");
        foreach (var item in items)
        {
            if (item is null || item.IdServicio <= 0 || item.Cantidad <= 0)
                throw Invalid("Servicios", "Cada línea requiere un servicio y una cantidad positiva.");
        }

        var ids = items.Select(i => i.IdServicio).Distinct().OrderBy(id => id).ToArray();
        var servicios = ids.Length == 0
            ? new Dictionary<int, Servicio>()
            : await context.Servicios.AsNoTracking()
                .Where(s => ids.Contains(s.IdServicio))
                .OrderBy(s => s.IdServicio)
                .ToDictionaryAsync(s => s.IdServicio, cancellationToken);
        var lineas = new List<(int IdServicio, int Cantidad, decimal Precio, decimal Subtotal)>();
        decimal total = 0;
        foreach (var item in items)
        {
            if (!servicios.TryGetValue(item.IdServicio, out var servicio) || !servicio.Activo)
                throw Invalid("Servicios", "Todos los servicios deben existir y estar activos.");
            var precio = servicio.PrecioBase;
            if (precio <= 0 || precio > MaximoImporte || decimal.Round(precio, 2) != precio)
                throw Invalid("Servicios", "El precio del servicio debe ser positivo y válido para decimal(18,2).");
            var subtotal = precio * item.Cantidad;
            if (subtotal > MaximoImporte || total > MaximoImporte - subtotal)
                throw Invalid("Servicios", "El importe excede el límite de decimal(18,2).");
            lineas.Add((item.IdServicio, item.Cantidad, precio, subtotal));
            total += subtotal;
        }

        var productos = new List<ProductoStock>();
        // El orden estable de IdMedicamento coincide con el bloqueo empleado en VentaService.
        foreach (var (idMedicamento, cantidad) in cantidadesMedicamentos)
        {
            var medicamento = await ObtenerMedicamentoAsync(idMedicamento, cancellationToken);
            if (medicamento is null || !medicamento.Activo)
                throw Invalid("Medicamentos", "Todos los medicamentos deben existir y estar activos.");
            var precio = FarmaciaValidation.Price(medicamento.PrecioVenta);
            var lotes = await ObtenerLotesVendiblesAsync(idMedicamento, today, cancellationToken);
            if (lotes.Sum(l => (long)l.CantidadDisponible) < cantidad)
                throw new ConflictException($"Stock insuficiente para el medicamento {idMedicamento}.");
            productos.Add(new ProductoStock(idMedicamento, cantidad, precio, lotes));
        }

        var factura = new Venta
        {
            IdUsuario = usuario.IdUsuario,
            IdSucursal = request.IdSucursal,
            FechaVenta = now,
            TipoFactura = TipoFactura
        };
        context.Ventas.Add(factura);
        context.Entry(factura).Property<int?>("IdPaciente").CurrentValue = request.IdPaciente;
        context.Entry(factura).Property<string?>("Nit").CurrentValue = nit;
        context.Entry(factura).Property<string?>("NombreFacturacion").CurrentValue = nombreFacturacion;

        var detalles = new List<(VentaDetalle Entidad, int? IdServicio, int? IdMedicamento)>();
        foreach (var linea in lineas)
        {
            var detalle = new VentaDetalle
            {
                Venta = factura,
                IdLote = null,
                Cantidad = linea.Cantidad,
                PrecioUnitario = linea.Precio,
                Subtotal = linea.Subtotal
            };
            context.VentaDetalles.Add(detalle);
            context.Entry(detalle).Property<int?>("IdServicio").CurrentValue = linea.IdServicio;
            detalles.Add((detalle, linea.IdServicio, null));
        }
        foreach (var producto in productos)
        {
            var pendiente = producto.Cantidad;
            foreach (var lote in producto.Lotes)
            {
                if (pendiente == 0) break;
                var cantidad = Math.Min(pendiente, lote.CantidadDisponible);
                if (cantidad <= 0 || lote.CantidadDisponible < cantidad)
                    throw new ConflictException("El stock del lote cambió durante la factura.");
                var subtotal = producto.Precio * cantidad;
                if (subtotal > MaximoImporte || total > MaximoImporte - subtotal)
                    throw Invalid("Medicamentos", "El importe excede el límite de decimal(18,2).");

                lote.CantidadDisponible -= cantidad;
                MovimientoSalidaRegistrar.Registrar(
                    context, lote.IdLote, cantidad, usuario.IdUsuario, request.IdSucursal, now);
                var detalle = new VentaDetalle
                {
                    Venta = factura,
                    IdLote = lote.IdLote,
                    Cantidad = cantidad,
                    PrecioUnitario = producto.Precio,
                    Subtotal = subtotal
                };
                context.VentaDetalles.Add(detalle);
                context.Entry(detalle).Property<int?>("IdServicio").CurrentValue = null;
                detalles.Add((detalle, null, producto.IdMedicamento));
                total += subtotal;
                pendiente -= cantidad;
            }
            if (pendiente != 0)
                throw new ConflictException("El stock cambió durante la factura.");
        }
        factura.Total = total;
        await context.SaveChangesAsync(cancellationToken);

        return new FacturaServiciosResponse(
            factura.IdVenta, factura.IdUsuario, factura.IdSucursal,
            request.IdPaciente, factura.FechaVenta, factura.TipoFactura,
            nit, nombreFacturacion, factura.Total,
            detalles.Select(d => new FacturaServicioDetalleResponse(
                d.Entidad.IdVentaDetalle, d.IdServicio, d.Entidad.Cantidad,
                d.Entidad.PrecioUnitario, d.Entidad.Subtotal)
                { IdLote = d.Entidad.IdLote, IdMedicamento = d.IdMedicamento }).ToList());
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
        List<LoteMedicamento> lotes;
        if (context.Database.IsSqlServer())
            lotes = await context.LoteMedicamentos
                .FromSqlInterpolated($"SELECT * FROM [LoteMedicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdMedicamento] = {idMedicamento} AND [CantidadDisponible] > 0 AND [FechaVencimiento] > {today} AND [FechaIngreso] <= {today}")
                .ToListAsync(ct);
        else
            lotes = await context.LoteMedicamentos
                .Where(l => l.IdMedicamento == idMedicamento && l.CantidadDisponible > 0 &&
                    l.FechaVencimiento > today && l.FechaIngreso <= today)
                .ToListAsync(ct);

        return lotes.OrderBy(l => l.FechaVencimiento)
            .ThenBy(l => l.FechaIngreso)
            .ThenBy(l => l.IdLote)
            .ToList();
    }

    private static SortedDictionary<int, int> PrepararCantidades(
        List<CrearFacturaMedicamentoItemRequest>? items)
    {
        var cantidades = new SortedDictionary<int, int>();
        if (items is null) return cantidades;
        foreach (var item in items)
        {
            if (item is null || item.IdMedicamento <= 0 || item.Cantidad <= 0)
                throw Invalid("Medicamentos", "Cada línea requiere un medicamento y una cantidad positiva.");
            var actual = cantidades.GetValueOrDefault(item.IdMedicamento);
            if ((long)actual + item.Cantidad > int.MaxValue)
                throw Invalid("Medicamentos", "La cantidad solicitada excede el rango permitido.");
            cantidades[item.IdMedicamento] = actual + item.Cantidad;
        }
        return cantidades;
    }

    private sealed record ProductoStock(
        int IdMedicamento, int Cantidad, decimal Precio,
        IReadOnlyList<LoteMedicamento> Lotes);

    private async Task<IReadOnlyList<FacturaServicioDetalleResponse>> ObtenerDetallesAsync(
        int idFactura, CancellationToken ct)
    {
        var filas = await context.VentaDetalles.AsNoTracking()
            .Where(d => d.IdVenta == idFactura)
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
        return filas.Select(d => new FacturaServicioDetalleResponse(
            d.IdVentaDetalle, d.IdServicio, d.Cantidad,
            d.PrecioUnitario, d.Subtotal)
        {
            IdLote = d.IdLote,
            IdMedicamento = d.IdLote is int idLote &&
                medicamentos.TryGetValue(idLote, out var medicamento)
                ? medicamento : null
        }).ToList();
    }

    private static void ValidarFiltros(
        int? idFactura, int? idSucursal, int? idPaciente, int? idUsuario,
        DateTime? desde, DateTime? hasta)
    {
        ValidarFiltroId(idFactura, nameof(FacturaConsultaFiltroDto.IdFactura));
        ValidarFiltroId(idSucursal, nameof(FacturaConsultaFiltroDto.IdSucursal));
        ValidarFiltroId(idPaciente, nameof(FacturaConsultaFiltroDto.IdPaciente));
        ValidarFiltroId(idUsuario, nameof(FacturaConsultaFiltroDto.IdUsuario));
        if (desde.HasValue && hasta.HasValue && desde > hasta)
            throw Invalid(nameof(FacturaConsultaFiltroDto.FechaHasta),
                "Debe ser igual o posterior a FechaDesde.");
    }

    private static void ValidarFiltroId(int? id, string campo)
    {
        if (id is <= 0)
            throw Invalid(campo, "Debe ser mayor que cero.");
    }

    private static string? TextoOpcional(string? valor, string campo, int maximo)
    {
        var texto = string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));
        if (texto.Length > maximo)
            throw Invalid(campo, $"Máximo {maximo} caracteres.");
        return texto.Length == 0 ? null : texto;
    }

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos de la factura no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });
}
