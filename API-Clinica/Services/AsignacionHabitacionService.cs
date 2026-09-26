using API_Clinica.Common;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class AsignacionHabitacionService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator,
    HabitacionTransactionCoordinator coordinator) : IAsignacionHabitacionService
{
    public async Task<PagedResponse<AsignacionHabitacionResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.AsignacionesHabitacion.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderByDescending(a => a.FechaIngreso)
            .ThenByDescending(a => a.IdAsignacion)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(a => new AsignacionHabitacionResponse(a.IdAsignacion,
                a.IdHabitacion, a.IdPaciente, a.FechaIngreso,
                a.FechaEgreso, a.Observaciones))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<AsignacionHabitacionResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.AsignacionesHabitacion.AsNoTracking()
            .Where(a => a.IdAsignacion == id)
            .Select(a => new AsignacionHabitacionResponse(a.IdAsignacion,
                a.IdHabitacion, a.IdPaciente, a.FechaIngreso,
                a.FechaEgreso, a.Observaciones))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Asignación no encontrada.");

    public async Task<AsignacionHabitacionResponse> AsignarAsync(
        CrearAsignacionHabitacionRequest request, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var ingreso = request.FechaIngreso?.UtcDateTime ?? now;
        if (ingreso > now)
            throw InvalidDate("FechaIngreso", "La fecha de ingreso no puede estar en el futuro.");

        var assignment = await coordinator.EjecutarAsync(request.IdHabitacion, async room =>
        {
            var patient = await GetPatientForAssignmentAsync(request.IdPaciente, cancellationToken);
            if (patient is null || !patient.Activo)
                throw new AppValidationException("Paciente no válido.",
                    new Dictionary<string, string[]> { ["IdPaciente"] = ["El paciente debe existir y estar activo."] });

            if (await context.AsignacionesHabitacion.AsNoTracking()
                .AnyAsync(a => a.IdPaciente == request.IdPaciente && a.FechaEgreso == null, cancellationToken))
                throw new ConflictException("El paciente ya tiene una asignación activa.");

            if (!room.Activa)
                throw new ConflictException("La habitación está inactiva.");

            var active = await ActiveAssignmentCountAsync(room.IdHabitacion, cancellationToken);
            if (room.Estado != EstadoHabitacion.Libre || active != 0)
                throw new ConflictException("La habitación no está libre.");

            var entity = new AsignacionHabitacion
            {
                IdHabitacion = room.IdHabitacion,
                IdPaciente = request.IdPaciente,
                FechaIngreso = ingreso,
                Observaciones = NormalizeNotes(request.Observaciones)
            };
            context.AsignacionesHabitacion.Add(entity);
            room.Estado = EstadoHabitacion.Ocupada;
            return entity;
        }, cancellationToken, publicarEstadoHabitacion: true);
        return ToResponse(assignment);
    }

    public async Task<AsignacionHabitacionResponse> ActualizarAsync(
        int id, ActualizarAsignacionHabitacionRequest request, CancellationToken cancellationToken)
    {
        var roomId = await GetRoomIdAsync(id, cancellationToken);
        var assignment = await coordinator.EjecutarAsync(roomId, async room =>
        {
            var entity = await GetTrackedAsync(id, cancellationToken);
            if (entity.FechaEgreso is null &&
                (room.Estado != EstadoHabitacion.Ocupada || !room.Activa ||
                 await ActiveAssignmentCountAsync(room.IdHabitacion, cancellationToken) != 1))
                throw new ConflictException("La habitación y la asignación activa son inconsistentes.");

            if (request.FechaIngreso is DateTimeOffset input)
            {
                var ingreso = input.UtcDateTime;
                if (ingreso > (entity.FechaEgreso ?? DateTime.UtcNow))
                    throw InvalidDate("FechaIngreso", "El ingreso debe ser anterior al egreso o al momento actual.");
                entity.FechaIngreso = ingreso;
            }
            entity.Observaciones = NormalizeNotes(request.Observaciones);
            return entity;
        }, cancellationToken);
        return ToResponse(assignment);
    }

    public async Task<AsignacionHabitacionResponse> RegistrarEgresoAsync(
        int id, CancellationToken cancellationToken)
    {
        var roomId = await GetRoomIdAsync(id, cancellationToken);
        var assignment = await coordinator.EjecutarAsync(roomId, async room =>
        {
            var entity = await GetTrackedAsync(id, cancellationToken);
            if (entity.FechaEgreso is not null)
                throw new ConflictException("La asignación ya tiene egreso.");
            if (await ActiveAssignmentCountAsync(room.IdHabitacion, cancellationToken) != 1)
                throw new ConflictException("Existen asignaciones activas inconsistentes.");

            var now = DateTime.UtcNow;
            if (now < entity.FechaIngreso)
                throw new ConflictException("La fecha de ingreso es posterior al momento actual.");
            entity.FechaEgreso = now;
            room.Estado = EstadoHabitacion.EnLimpieza;
            return entity;
        }, cancellationToken, publicarEstadoHabitacion: true);
        return ToResponse(assignment);
    }

    public async Task EliminarAsync(int id, CancellationToken cancellationToken)
    {
        var roomId = await GetRoomIdAsync(id, cancellationToken);
        await coordinator.EjecutarAsync(roomId, async _ =>
        {
            var entity = await GetTrackedAsync(id, cancellationToken);
            if (entity.FechaEgreso is null)
                throw new ConflictException("Registre el egreso antes de eliminar una asignación activa.");
            context.AsignacionesHabitacion.Remove(entity);
            return true;
        }, cancellationToken);
    }

    private async Task<int> GetRoomIdAsync(int id, CancellationToken ct) =>
        await context.AsignacionesHabitacion.AsNoTracking()
            .Where(a => a.IdAsignacion == id)
            .Select(a => (int?)a.IdHabitacion)
            .SingleOrDefaultAsync(ct)
        ?? throw new NotFoundException("Asignación no encontrada.");

    private async Task<AsignacionHabitacion> GetTrackedAsync(int id, CancellationToken ct) =>
        await context.AsignacionesHabitacion.SingleOrDefaultAsync(a => a.IdAsignacion == id, ct)
        ?? throw new NotFoundException("Asignación no encontrada.");

    private async Task<int> ActiveAssignmentCountAsync(int roomId, CancellationToken ct) =>
        await context.AsignacionesHabitacion.AsNoTracking()
            .CountAsync(a => a.IdHabitacion == roomId && a.FechaEgreso == null, ct);

    private async Task<Paciente?> GetPatientForAssignmentAsync(int idPaciente, CancellationToken ct)
    {
        if (context.Database.IsSqlServer())
        {
            // El bloqueo se conserva hasta confirmar la transacción iniciada por el coordinador.
            return await context.Pacientes
                .FromSqlInterpolated($"SELECT * FROM [Paciente] WITH (UPDLOCK, HOLDLOCK) WHERE [IdPaciente] = {idPaciente}")
                .AsNoTracking().SingleOrDefaultAsync(ct);
        }
        return await context.Pacientes.AsNoTracking()
            .SingleOrDefaultAsync(p => p.IdPaciente == idPaciente, ct);
    }

    private static string? NormalizeNotes(string? text) =>
        string.IsNullOrWhiteSpace(text) ? null : text.Trim();

    private static AppValidationException InvalidDate(string field, string message) =>
        new("Fecha no válida.", new Dictionary<string, string[]> { [field] = [message] });

    private static AsignacionHabitacionResponse ToResponse(AsignacionHabitacion entity) =>
        new(entity.IdAsignacion, entity.IdHabitacion, entity.IdPaciente,
            entity.FechaIngreso, entity.FechaEgreso, entity.Observaciones);
}
