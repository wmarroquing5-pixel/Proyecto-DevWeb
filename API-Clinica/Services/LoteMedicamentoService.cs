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

public sealed class LoteMedicamentoService(
    ClinicaDbContext context, ICommonParameterValidator parameterValidator,
    IAccesoActualService accesoActual,
    ILogger<LoteMedicamentoService> logger,
    TimeProvider timeProvider) : ILoteMedicamentoService
{
    private const string TipoAjuste = "Ajuste";
    private const string PrefijoExistenciaInicial = "Existencia inicial | ";

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
        GuardarLoteMedicamentoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var numero = ValidarDatos(request);
        if (request.CantidadDisponible == 0)
        {
            await ValidarMedicamentoAsync(request.IdMedicamento, cancellationToken);
            var loteSinExistencia = CrearEntidad(request, numero);
            context.LoteMedicamentos.Add(loteSinExistencia);
            await context.SaveChangesAsync(cancellationToken);
            return ToResponse(loteSinExistencia);
        }

        var trazabilidadSolicitada = ValidarTrazabilidad(
            request.IdSucursal, request.Observaciones, existenciaInicial: true);
        var fechaOperacion = timeProvider.GetUtcNow().UtcDateTime;
        var hoy = DateOnly.FromDateTime(fechaOperacion);
        if (request.FechaVencimiento <= hoy)
            throw FarmaciaValidation.Invalid(
                "FechaVencimiento",
                "Un lote con existencia inicial debe tener una fecha de vencimiento futura.");

        if (!context.Database.IsSqlServer())
        {
            if (context.Database.IsRelational())
                throw new NotSupportedException(
                    "La creación transaccional con existencia requiere SQL Server.");
            return await CrearConExistenciaCoreAsync(
                request, numero, trazabilidadSolicitada, principal,
                fechaOperacion, cancellationToken);
        }

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            try
            {
                var response = await CrearConExistenciaCoreAsync(
                    request, numero, trazabilidadSolicitada, principal,
                    fechaOperacion, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return response;
            }
            catch
            {
                try { await transaction.RollbackAsync(CancellationToken.None); }
                catch (Exception rollbackError)
                {
                    logger.LogError(rollbackError,
                        "No se pudo confirmar el rollback de la creación del lote.");
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
            throw new ConflictException("El inventario cambió durante la creación. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222 or 547)
        {
            throw new ConflictException("El inventario cambió durante la creación. Intente nuevamente.");
        }
    }

    private async Task<LoteMedicamentoResponse> CrearConExistenciaCoreAsync(
        GuardarLoteMedicamentoRequest request, string numero,
        TrazabilidadSolicitada trazabilidadSolicitada, ClaimsPrincipal principal,
        DateTime fechaOperacion, CancellationToken cancellationToken)
    {
        var trazabilidad = await ObtenerTrazabilidadAsync(
            trazabilidadSolicitada, principal, cancellationToken);

        Medicamento? medicamento;
        if (context.Database.IsSqlServer())
            medicamento = await context.Medicamentos
                .FromSqlInterpolated($"SELECT * FROM [Medicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdMedicamento] = {request.IdMedicamento}")
                .SingleOrDefaultAsync(cancellationToken);
        else
            medicamento = await context.Medicamentos.SingleOrDefaultAsync(
                m => m.IdMedicamento == request.IdMedicamento, cancellationToken);
        if (medicamento is null || !medicamento.Activo)
            throw FarmaciaValidation.Invalid(
                "IdMedicamento", "El medicamento debe existir y estar activo.");

        var lot = CrearEntidad(request, numero);
        context.LoteMedicamentos.Add(lot);
        if (await context.SaveChangesAsync(cancellationToken) != 1)
            throw new InvalidOperationException("No se creó exactamente un lote.");

        var movimiento = new MovimientoInventario
        {
            IdLote = lot.IdLote,
            IdUsuario = trazabilidad.IdUsuario,
            IdSucursal = trazabilidad.IdSucursal,
            TipoMovimiento = TipoAjuste,
            Cantidad = request.CantidadDisponible,
            FechaMovimiento = fechaOperacion,
            Observaciones = trazabilidad.Observaciones
        };
        context.MovimientosInventario.Add(movimiento);
        if (await context.SaveChangesAsync(cancellationToken) != 1)
            throw new InvalidOperationException(
                "No se registró exactamente un movimiento de existencia inicial.");

        return ToResponse(lot);
    }

    private static LoteMedicamento CrearEntidad(
        GuardarLoteMedicamentoRequest request, string numero) => new()
    {
        IdMedicamento = request.IdMedicamento,
        NumeroLote = numero,
        FechaIngreso = request.FechaIngreso,
        FechaVencimiento = request.FechaVencimiento,
        CantidadDisponible = request.CantidadDisponible
    };

    public async Task<LoteMedicamentoResponse> ActualizarAsync(
        int id, ActualizarLoteMedicamentoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var numero = ValidarDatos(request);
        if (request.CantidadEsperada is not int cantidadEsperada || cantidadEsperada < 0)
            throw FarmaciaValidation.Invalid("CantidadEsperada", "La cantidad esperada es obligatoria y no puede ser negativa.");
        if (id <= 0)
            throw new NotFoundException("Lote no encontrado.");
        var trazabilidadSolicitada = request.CantidadDisponible == cantidadEsperada
            ? null
            : ValidarTrazabilidad(
                request.IdSucursal, request.Observaciones, existenciaInicial: false);
        if (!context.Database.IsSqlServer())
        {
            if (context.Database.IsRelational())
                throw new NotSupportedException("La actualización transaccional requiere SQL Server.");
            try
            {
                var trazabilidad = trazabilidadSolicitada is null
                    ? null
                    : await ObtenerTrazabilidadAsync(
                        trazabilidadSolicitada, principal, cancellationToken);
                return await ActualizarCoreAsync(id, request, numero, cantidadEsperada,
                    null, trazabilidad, cancellationToken);
            }
            catch (DbUpdateConcurrencyException)
            {
                throw new ConflictException("El lote cambió durante la operación. Intente nuevamente.");
            }
        }

        // Solo determina el orden de bloqueo. El medicamento se confirma de nuevo
        // después de bloquear el lote dentro de la transacción.
        var idMedicamentoOriginal = await context.LoteMedicamentos.AsNoTracking()
            .Where(l => l.IdLote == id)
            .Select(l => (int?)l.IdMedicamento)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Lote no encontrado.");

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            try
            {
                var trazabilidad = trazabilidadSolicitada is null
                    ? null
                    : await ObtenerTrazabilidadAsync(
                        trazabilidadSolicitada, principal, cancellationToken);
                var response = await ActualizarCoreAsync(id, request, numero,
                    cantidadEsperada, idMedicamentoOriginal, trazabilidad,
                    cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return response;
            }
            catch
            {
                try { await transaction.RollbackAsync(CancellationToken.None); }
                catch (Exception rollbackError)
                {
                    logger.LogError(rollbackError,
                        "No se pudo confirmar el rollback de la actualización del lote.");
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
            throw new ConflictException("El lote cambió durante la operación. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222)
        {
            throw new ConflictException("El lote cambió durante la operación. Intente nuevamente.");
        }
    }

    private async Task<LoteMedicamentoResponse> ActualizarCoreAsync(
        int id, ActualizarLoteMedicamentoRequest request, string numero,
        int cantidadEsperada, int? idMedicamentoOriginal,
        TrazabilidadOperacion? trazabilidad, CancellationToken ct)
    {
        LoteMedicamento lot;
        if (context.Database.IsSqlServer())
        {
            // Ventas y facturas bloquean medicamento antes que lote. Si se cambia
            // el medicamento, ambos se bloquean en orden ascendente.
            foreach (var idMedicamento in new[] { idMedicamentoOriginal!.Value,
                request.IdMedicamento }.Distinct().Order())
            {
                var medicamento = await context.Medicamentos
                    .FromSqlInterpolated($"SELECT * FROM [Medicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdMedicamento] = {idMedicamento}")
                    .SingleOrDefaultAsync(ct);
                if (idMedicamento == request.IdMedicamento &&
                    (medicamento is null || !medicamento.Activo))
                    throw FarmaciaValidation.Invalid("IdMedicamento", "El medicamento debe existir y estar activo.");
                if (medicamento is null)
                    throw new ConflictException("El medicamento del lote cambió. Intente nuevamente.");
            }

            // XLOCK impide que una nueva FK de tratamiento aparezca entre la
            // comprobación histórica y el guardado de un cambio de medicamento.
            lot = await context.LoteMedicamentos
                .FromSqlInterpolated($"SELECT * FROM [LoteMedicamento] WITH (XLOCK, HOLDLOCK) WHERE [IdLote] = {id}")
                .SingleOrDefaultAsync(ct)
                ?? throw new NotFoundException("Lote no encontrado.");
            if (lot.IdMedicamento != idMedicamentoOriginal)
                throw new ConflictException("El medicamento del lote cambió. Intente nuevamente.");
        }
        else
        {
            lot = await context.LoteMedicamentos.SingleOrDefaultAsync(l => l.IdLote == id, ct)
                ?? throw new NotFoundException("Lote no encontrado.");
        }

        if (lot.CantidadDisponible != cantidadEsperada)
            throw new ConflictException("La existencia del lote cambió. Consulte el stock actual e intente nuevamente.");
        if (!context.Database.IsSqlServer())
            await ValidarMedicamentoAsync(request.IdMedicamento, ct);
        if (lot.IdMedicamento != request.IdMedicamento &&
            (await context.VentaDetalles.AsNoTracking().AnyAsync(
                d => d.IdLote == id, ct) ||
             await context.Tratamientos.AsNoTracking().AnyAsync(
                t => t.IdLote == id, ct) ||
             await context.MovimientosInventario.AsNoTracking().AnyAsync(
                m => m.IdLote == id, ct)))
            throw new ConflictException(
                "No se puede cambiar el medicamento de un lote con historial asociado.");

        var diferencia = request.CantidadDisponible - lot.CantidadDisponible;
        if (diferencia != 0 && trazabilidad is null)
            throw new InvalidOperationException(
                "El ajuste de existencia no tiene información de trazabilidad.");
        lot.IdMedicamento = request.IdMedicamento;
        lot.NumeroLote = numero;
        lot.FechaIngreso = request.FechaIngreso;
        lot.FechaVencimiento = request.FechaVencimiento;
        lot.CantidadDisponible = request.CantidadDisponible;
        if (diferencia != 0)
        {
            context.MovimientosInventario.Add(new MovimientoInventario
            {
                IdLote = lot.IdLote,
                IdUsuario = trazabilidad!.IdUsuario,
                IdSucursal = trazabilidad.IdSucursal,
                TipoMovimiento = TipoAjuste,
                Cantidad = diferencia,
                FechaMovimiento = timeProvider.GetUtcNow().UtcDateTime,
                Observaciones = trazabilidad.Observaciones
            });
        }

        var changes = await context.SaveChangesAsync(ct);
        if (diferencia != 0 && changes != 2)
            throw new InvalidOperationException(
                "El ajuste no actualizó exactamente el lote y su movimiento.");
        return ToResponse(lot);
    }

    public async Task<EntradaInventarioResponse> RegistrarEntradaAsync(
        int id, RegistrarEntradaInventarioRequest request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        ValidarEntrada(id, request);
        if (!context.Database.IsSqlServer())
        {
            if (context.Database.IsRelational())
                throw new NotSupportedException("La entrada transaccional requiere SQL Server.");
            return await RegistrarEntradaCoreAsync(
                id, null, request, principal, cancellationToken);
        }

        // Esta lectura determina el orden de bloqueo. La relación se confirma
        // de nuevo dentro de la transacción antes de modificar existencias.
        var idMedicamento = await context.LoteMedicamentos.AsNoTracking()
            .Where(l => l.IdLote == id)
            .Select(l => (int?)l.IdMedicamento)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Lote no encontrado.");

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            try
            {
                var response = await RegistrarEntradaCoreAsync(
                    id, idMedicamento, request, principal, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return response;
            }
            catch
            {
                try { await transaction.RollbackAsync(CancellationToken.None); }
                catch (Exception rollbackError)
                {
                    logger.LogError(rollbackError,
                        "No se pudo confirmar el rollback de la entrada de inventario.");
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
            throw new ConflictException("El lote cambió durante la entrada. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222 or 547)
        {
            throw new ConflictException("El inventario cambió durante la entrada. Intente nuevamente.");
        }
    }

    private async Task<EntradaInventarioResponse> RegistrarEntradaCoreAsync(
        int id, int? idMedicamentoEsperado,
        RegistrarEntradaInventarioRequest request, ClaimsPrincipal principal,
        CancellationToken ct)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
            ?? throw new ForbiddenException("Acceso denegado.");

        Sucursal? sucursal;
        if (context.Database.IsSqlServer())
            sucursal = await context.Sucursales
                .FromSqlInterpolated($"SELECT * FROM [Sucursal] WITH (UPDLOCK, HOLDLOCK) WHERE [IdSucursal] = {request.IdSucursal}")
                .SingleOrDefaultAsync(ct);
        else
            sucursal = await context.Sucursales.SingleOrDefaultAsync(
                s => s.IdSucursal == request.IdSucursal, ct);
        if (sucursal is null || !sucursal.Activa)
            throw FarmaciaValidation.Invalid(
                "IdSucursal", "La sucursal debe existir y estar activa.");

        Medicamento? medicamento;
        LoteMedicamento? lote;
        if (context.Database.IsSqlServer())
        {
            medicamento = await context.Medicamentos
                .FromSqlInterpolated($"SELECT * FROM [Medicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdMedicamento] = {idMedicamentoEsperado!.Value}")
                .SingleOrDefaultAsync(ct);
            lote = await context.LoteMedicamentos
                .FromSqlInterpolated($"SELECT * FROM [LoteMedicamento] WITH (XLOCK, HOLDLOCK) WHERE [IdLote] = {id}")
                .SingleOrDefaultAsync(ct);
        }
        else
        {
            lote = await context.LoteMedicamentos.SingleOrDefaultAsync(l => l.IdLote == id, ct);
            medicamento = lote is null ? null : await context.Medicamentos
                .SingleOrDefaultAsync(m => m.IdMedicamento == lote.IdMedicamento, ct);
        }

        if (lote is null)
            throw new NotFoundException("Lote no encontrado.");
        if (idMedicamentoEsperado.HasValue &&
            lote.IdMedicamento != idMedicamentoEsperado.Value)
            throw new ConflictException("El medicamento del lote cambió. Intente nuevamente.");
        if (medicamento is null || medicamento.IdMedicamento != lote.IdMedicamento ||
            !medicamento.Activo)
            throw new ConflictException("El medicamento del lote debe existir y estar activo.");

        var fecha = DateTime.UtcNow;
        var hoy = DateOnly.FromDateTime(fecha);
        if (lote.FechaIngreso > hoy || lote.FechaVencimiento <= hoy)
            throw new ConflictException("El lote no está vigente para recibir inventario.");
        if (lote.CantidadDisponible > int.MaxValue - request.Cantidad)
            throw FarmaciaValidation.Invalid(
                "Cantidad", "La entrada excede el límite de existencias permitido.");

        var observaciones = NormalizarObservaciones(request.Observaciones);
        lote.CantidadDisponible += request.Cantidad;
        var movimiento = new MovimientoInventario
        {
            IdLote = lote.IdLote,
            IdUsuario = usuario.IdUsuario,
            IdSucursal = sucursal.IdSucursal,
            TipoMovimiento = "Entrada",
            Cantidad = request.Cantidad,
            FechaMovimiento = fecha,
            Observaciones = observaciones
        };
        context.MovimientosInventario.Add(movimiento);
        var changes = await context.SaveChangesAsync(ct);
        if (changes != 2)
            throw new InvalidOperationException(
                "La entrada no actualizó exactamente el lote y su movimiento.");

        return new EntradaInventarioResponse(
            movimiento.IdMovimiento, lote.IdLote, lote.IdMedicamento,
            sucursal.IdSucursal, movimiento.Cantidad, lote.CantidadDisponible,
            movimiento.FechaMovimiento, movimiento.Observaciones);
    }

    private static void ValidarEntrada(
        int id, RegistrarEntradaInventarioRequest request)
    {
        if (id <= 0)
            throw new NotFoundException("Lote no encontrado.");
        if (request.IdSucursal <= 0)
            throw FarmaciaValidation.Invalid(
                "IdSucursal", "La sucursal debe ser válida.");
        if (request.Cantidad <= 0)
            throw FarmaciaValidation.Invalid(
                "Cantidad", "La cantidad debe ser positiva.");
        if (request.Observaciones?.Trim().Length > 300)
            throw FarmaciaValidation.Invalid(
                "Observaciones", "No puede exceder 300 caracteres.");
    }

    private static string? NormalizarObservaciones(string? value)
    {
        var normalized = value?.Trim();
        return string.IsNullOrEmpty(normalized) ? null : normalized;
    }

    private static TrazabilidadSolicitada ValidarTrazabilidad(
        int? idSucursal, string? observaciones, bool existenciaInicial)
    {
        if (idSucursal is not int sucursal || sucursal <= 0)
            throw FarmaciaValidation.Invalid(
                "IdSucursal",
                "La sucursal es obligatoria cuando se modifica la existencia.");

        var justificacion = NormalizarObservaciones(observaciones);
        if (justificacion is null)
            throw FarmaciaValidation.Invalid(
                "Observaciones",
                "La justificación es obligatoria cuando se modifica la existencia.");

        var texto = existenciaInicial
            ? $"{PrefijoExistenciaInicial}{justificacion}"
            : justificacion;
        if (texto.Length > 300)
            throw FarmaciaValidation.Invalid(
                "Observaciones", "No puede exceder 300 caracteres.");

        return new TrazabilidadSolicitada(sucursal, texto);
    }

    private async Task<TrazabilidadOperacion> ObtenerTrazabilidadAsync(
        TrazabilidadSolicitada solicitud, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(
            principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");

        Sucursal? sucursal;
        if (context.Database.IsSqlServer())
            sucursal = await context.Sucursales
                .FromSqlInterpolated($"SELECT * FROM [Sucursal] WITH (UPDLOCK, HOLDLOCK) WHERE [IdSucursal] = {solicitud.IdSucursal}")
                .SingleOrDefaultAsync(cancellationToken);
        else
            sucursal = await context.Sucursales.SingleOrDefaultAsync(
                s => s.IdSucursal == solicitud.IdSucursal, cancellationToken);
        if (sucursal is null || !sucursal.Activa)
            throw FarmaciaValidation.Invalid(
                "IdSucursal", "La sucursal debe existir y estar activa.");

        return new TrazabilidadOperacion(
            usuario.IdUsuario, sucursal.IdSucursal, solicitud.Observaciones);
    }

    public async Task EliminarAsync(int id, CancellationToken cancellationToken)
    {
        var lot = await context.LoteMedicamentos.SingleOrDefaultAsync(
            l => l.IdLote == id, cancellationToken)
            ?? throw new NotFoundException("Lote no encontrado.");
        if (await context.MovimientosInventario.AsNoTracking()
            .AnyAsync(m => m.IdLote == id, cancellationToken))
            throw new ConflictException(
                "No se puede eliminar un lote con movimientos de inventario asociados.");
        if (await context.VentaDetalles.AsNoTracking()
            .AnyAsync(d => d.IdLote == id, cancellationToken))
            throw new ConflictException("No se puede eliminar un lote utilizado en ventas.");

        context.LoteMedicamentos.Remove(lot);
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("El lote cambió durante la operación. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql && sql.Number == 547)
        {
            throw new ConflictException(
                "No se puede eliminar un lote con dependencias históricas asociadas.");
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
        return ValidarDatos(request.NumeroLote, request.FechaIngreso,
            request.FechaVencimiento, request.CantidadDisponible);
    }

    private static string ValidarDatos(ActualizarLoteMedicamentoRequest request)
    {
        return ValidarDatos(request.NumeroLote, request.FechaIngreso,
            request.FechaVencimiento, request.CantidadDisponible);
    }

    private static string ValidarDatos(
        string? numeroLote, DateOnly fechaIngreso, DateOnly fechaVencimiento,
        int cantidadDisponible)
    {
        var numero = FarmaciaValidation.RequiredText(numeroLote, "NumeroLote", 50);
        if (cantidadDisponible < 0)
            throw FarmaciaValidation.Invalid("CantidadDisponible", "Debe ser mayor o igual a cero.");
        if (fechaIngreso == default)
            throw FarmaciaValidation.Invalid(
                "FechaIngreso", "Debe ser una fecha válida.");
        if (fechaVencimiento == default || fechaVencimiento <= fechaIngreso)
            throw FarmaciaValidation.Invalid(
                "FechaVencimiento", "Debe ser posterior a FechaIngreso.");
        return numero;
    }

    private static LoteMedicamentoResponse ToResponse(LoteMedicamento lot) =>
        new(lot.IdLote, lot.IdMedicamento, lot.NumeroLote,
            lot.FechaIngreso, lot.FechaVencimiento, lot.CantidadDisponible);

    private sealed record TrazabilidadSolicitada(
        int IdSucursal, string Observaciones);

    private sealed record TrazabilidadOperacion(
        int IdUsuario, int IdSucursal, string Observaciones);
}
