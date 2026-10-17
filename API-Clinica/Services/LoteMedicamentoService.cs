using System.Data;
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
    ILogger<LoteMedicamentoService> logger) : ILoteMedicamentoService
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
        int id, ActualizarLoteMedicamentoRequest request, CancellationToken cancellationToken)
    {
        var numero = ValidarDatos(request);
        if (request.CantidadEsperada is not int cantidadEsperada || cantidadEsperada < 0)
            throw FarmaciaValidation.Invalid("CantidadEsperada", "La cantidad esperada es obligatoria y no puede ser negativa.");
        if (id <= 0)
            throw new NotFoundException("Lote no encontrado.");
        if (!context.Database.IsSqlServer())
        {
            if (context.Database.IsRelational())
                throw new NotSupportedException("La actualización transaccional requiere SQL Server.");
            try
            {
                return await ActualizarCoreAsync(id, request, numero, cantidadEsperada,
                    null, cancellationToken);
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
                var response = await ActualizarCoreAsync(id, request, numero,
                    cantidadEsperada, idMedicamentoOriginal, cancellationToken);
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
        int cantidadEsperada, int? idMedicamentoOriginal, CancellationToken ct)
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
                t => t.IdLote == id, ct)))
            throw new ConflictException("No se puede cambiar el medicamento de un lote utilizado en ventas o tratamientos.");

        lot.IdMedicamento = request.IdMedicamento;
        lot.NumeroLote = numero;
        lot.FechaIngreso = request.FechaIngreso;
        lot.FechaVencimiento = request.FechaVencimiento;
        lot.CantidadDisponible = request.CantidadDisponible;
        await context.SaveChangesAsync(ct);
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
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("El lote cambió durante la operación. Intente nuevamente.");
        }
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
        FarmaciaValidation.Dates(fechaIngreso, fechaVencimiento);
        return numero;
    }

    private static LoteMedicamentoResponse ToResponse(LoteMedicamento lot) =>
        new(lot.IdLote, lot.IdMedicamento, lot.NumeroLote,
            lot.FechaIngreso, lot.FechaVencimiento, lot.CantidadDisponible);
}
