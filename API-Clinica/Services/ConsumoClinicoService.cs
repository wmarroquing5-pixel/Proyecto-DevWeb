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

public sealed class ConsumoClinicoService(
    ClinicaDbContext context,
    IAccesoActualService accesoActual,
    ILogger<ConsumoClinicoService> logger) : IConsumoClinicoService
{
    public async Task<ConsumoClinicoResponseDto> RegistrarAsync(
        int idTratamiento, ConsumoClinicoCreateDto request,
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        if (idTratamiento <= 0)
            throw Invalid("IdTratamiento", "El tratamiento debe ser válido.");
        if (request.Cantidad <= 0)
            throw Invalid("Cantidad", "La cantidad debe ser positiva.");
        if (!context.Database.IsSqlServer())
            throw new NotSupportedException("El consumo transaccional requiere SQL Server.");

        // Esta lectura fuera de la transacción solo determina el orden de bloqueo.
        // Los identificadores se vuelven a comprobar después de bloquear las filas.
        var candidato = await context.Tratamientos.AsNoTracking()
            .Where(t => t.IdTratamiento == idTratamiento)
            .Join(context.LoteMedicamentos.AsNoTracking(),
                t => t.IdLote, l => (int?)l.IdLote,
                (t, l) => new Candidato(l.IdLote, l.IdMedicamento))
            .SingleOrDefaultAsync(cancellationToken);

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);
            try
            {
                var result = await RegistrarCoreAsync(
                    idTratamiento, candidato, request.Cantidad, principal, cancellationToken);
                await transaction.CommitAsync(cancellationToken);
                return result;
            }
            catch
            {
                try { await transaction.RollbackAsync(CancellationToken.None); }
                catch (Exception rollbackError)
                {
                    logger.LogError(rollbackError,
                        "No se pudo confirmar el rollback del consumo clínico.");
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
            throw new ConflictException("El inventario cambió durante el consumo. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222 or 547)
        {
            throw new ConflictException("El inventario cambió durante el consumo. Intente nuevamente.");
        }
    }

    private async Task<ConsumoClinicoResponseDto> RegistrarCoreAsync(
        int idTratamiento, Candidato? candidato, int cantidad,
        ClaimsPrincipal principal, CancellationToken ct)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
            ?? throw new ForbiddenException("Acceso denegado.");

        var tratamiento = await context.Tratamientos
            .FromSqlInterpolated($"SELECT * FROM [Tratamiento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdTratamiento] = {idTratamiento}")
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Tratamiento no encontrado.");
        if (tratamiento.IdLote is not int idLote)
            throw new ConflictException("El tratamiento no tiene un lote asociado.");
        if (candidato is null || candidato.IdLote != idLote)
            throw new ConflictException("El lote del tratamiento cambió. Intente nuevamente.");

        var consulta = await context.Consultas
            .FromSqlInterpolated($"SELECT * FROM [Consulta] WITH (UPDLOCK, HOLDLOCK) WHERE [IdConsulta] = {tratamiento.IdConsulta}")
            .SingleOrDefaultAsync(ct)
            ?? throw new ConflictException("La consulta del tratamiento ya no existe.");

        if (usuario.IdEmpleado != consulta.IdMedico ||
            !await context.Empleados.AsNoTracking().AnyAsync(e =>
                e.IdEmpleado == consulta.IdMedico && e.Activo &&
                e.TipoEmpleado == "Medico", ct))
            throw new ForbiddenException("Solo el médico responsable activo puede registrar el consumo.");

        // Compatible con ventas y facturas: bloquear primero medicamento y luego lote.
        var medicamento = await context.Medicamentos
            .FromSqlInterpolated($"SELECT * FROM [Medicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdMedicamento] = {candidato.IdMedicamento}")
            .SingleOrDefaultAsync(ct);
        if (medicamento is null || !medicamento.Activo)
            throw new ConflictException("El medicamento del lote debe existir y estar activo.");

        var lote = await context.LoteMedicamentos
            .FromSqlInterpolated($"SELECT * FROM [LoteMedicamento] WITH (UPDLOCK, HOLDLOCK) WHERE [IdLote] = {idLote}")
            .SingleOrDefaultAsync(ct);
        if (lote is null || lote.IdMedicamento != medicamento.IdMedicamento)
            throw new ConflictException("El lote del tratamiento cambió. Intente nuevamente.");

        var fecha = DateTime.UtcNow;
        var hoy = DateOnly.FromDateTime(fecha);
        if (lote.FechaIngreso > hoy || lote.FechaVencimiento <= hoy)
            throw new ConflictException("El lote no está vigente para consumo.");
        if (lote.CantidadDisponible < cantidad)
            throw new ConflictException("Stock insuficiente en el lote del tratamiento.");

        lote.CantidadDisponible -= cantidad;
        var movimiento = MovimientoSalidaRegistrar.RegistrarUsoInterno(
            context, idLote, cantidad, usuario.IdUsuario, consulta.IdSucursal, fecha);
        await context.SaveChangesAsync(ct);
        return new ConsumoClinicoResponseDto(
            movimiento.IdMovimiento, tratamiento.IdTratamiento, idLote,
            cantidad, consulta.IdSucursal, fecha);
    }

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del consumo clínico no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private sealed record Candidato(int IdLote, int IdMedicamento);
}
