using API_Clinica.Common;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class HabitacionService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator,
    HabitacionTransactionCoordinator coordinator,
    IHabitacionEstadoNotifier notifier) : IHabitacionService
{
    public async Task<PagedResponse<HabitacionResponse>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Habitaciones.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(h => h.IdHabitacion)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(h => new HabitacionResponse(h.IdHabitacion, h.IdSucursal,
                h.NumeroHabitacion, h.TipoHabitacion, h.Estado, h.Activa))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<HabitacionResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Habitaciones.AsNoTracking()
            .Where(h => h.IdHabitacion == id)
            .Select(h => new HabitacionResponse(h.IdHabitacion, h.IdSucursal,
                h.NumeroHabitacion, h.TipoHabitacion, h.Estado, h.Activa))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Habitación no encontrada.");

    public async Task<HabitacionResponse> CrearAsync(
        CrearHabitacionRequest request, CancellationToken cancellationToken)
    {
        var number = RequiredText(request.NumeroHabitacion, "NumeroHabitacion", 20);
        var type = OptionalText(request.TipoHabitacion, "TipoHabitacion", 50);
        await ValidateSucursalAsync(request.IdSucursal, cancellationToken);
        var room = new Habitacion
        {
            IdSucursal = request.IdSucursal, NumeroHabitacion = number,
            TipoHabitacion = type, Estado = EstadoHabitacion.Libre, Activa = true
        };
        context.Habitaciones.Add(room);
        await context.SaveChangesAsync(cancellationToken);
        await notifier.PublicarAsync(room.IdHabitacion, room.Estado);
        return ToResponse(room);
    }

    public async Task<HabitacionResponse> ActualizarAsync(
        int id, ActualizarHabitacionRequest request, CancellationToken cancellationToken)
    {
        var number = RequiredText(request.NumeroHabitacion, "NumeroHabitacion", 20);
        var type = OptionalText(request.TipoHabitacion, "TipoHabitacion", 50);
        var state = ValidateState(request.Estado);

        return await coordinator.EjecutarAsync(id, async room =>
        {
            var active = await ActiveAssignmentCountAsync(id, cancellationToken);
            if (active > 1 || (active == 1 &&
                (room.Estado != EstadoHabitacion.Ocupada || !room.Activa)))
                throw new ConflictException("La habitación y sus asignaciones activas son inconsistentes.");

            if (active == 1)
            {
                if ((state is not null && state != EstadoHabitacion.Ocupada) ||
                    request.Activa == false || request.IdSucursal != room.IdSucursal)
                    throw new ConflictException("No se puede cambiar estado, sucursal o actividad de una habitación ocupada.");
            }
            else
            {
                if (state == EstadoHabitacion.Ocupada)
                    throw new ConflictException("Solo una asignación activa puede ocupar la habitación.");
                if (room.Estado == EstadoHabitacion.Ocupada && state != EstadoHabitacion.EnLimpieza)
                    throw new ConflictException("Una habitación ocupada sin asignación debe pasar a En limpieza.");
            }

            if (request.IdSucursal != room.IdSucursal)
                await ValidateSucursalAsync(request.IdSucursal, cancellationToken);

            room.IdSucursal = request.IdSucursal;
            room.NumeroHabitacion = number;
            room.TipoHabitacion = type;
            if (state is not null) room.Estado = state;
            if (request.Activa.HasValue) room.Activa = request.Activa.Value;
            return ToResponse(room);
        }, cancellationToken, publicarEstadoHabitacion: true);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        await coordinator.EjecutarAsync(id, async room =>
        {
            if (room.Estado == EstadoHabitacion.Ocupada ||
                await ActiveAssignmentCountAsync(id, cancellationToken) > 0)
                throw new ConflictException("No se puede desactivar una habitación ocupada.");
            room.Activa = false;
            return true;
        }, cancellationToken, publicarEstadoHabitacion: true);
    }

    private async Task<int> ActiveAssignmentCountAsync(int id, CancellationToken ct) =>
        await context.AsignacionesHabitacion.AsNoTracking()
            .CountAsync(a => a.IdHabitacion == id && a.FechaEgreso == null, ct);

    private async Task ValidateSucursalAsync(int id, CancellationToken ct)
    {
        if (!await context.Sucursales.AsNoTracking()
            .AnyAsync(s => s.IdSucursal == id && s.Activa, ct))
            throw new AppValidationException("Sucursal no válida.",
                new Dictionary<string, string[]> { ["IdSucursal"] = ["La sucursal debe existir y estar activa."] });
    }

    private static string? ValidateState(string? value)
    {
        if (value is null) return null;
        var state = value.Trim();
        if (state is EstadoHabitacion.Libre or EstadoHabitacion.Ocupada or EstadoHabitacion.EnLimpieza)
            return state;
        throw new AppValidationException("Estado no válido.",
            new Dictionary<string, string[]> { ["Estado"] = ["Use Libre, Ocupada o En limpieza."] });
    }

    private static string RequiredText(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > maxLength)
            throw new AppValidationException("Datos no válidos.",
                new Dictionary<string, string[]> { [field] = [$"Debe contener entre 1 y {maxLength} caracteres."] });
        return text;
    }

    private static string? OptionalText(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (text?.Length > maxLength)
            throw new AppValidationException("Datos no válidos.",
                new Dictionary<string, string[]> { [field] = [$"Máximo {maxLength} caracteres."] });
        return string.IsNullOrEmpty(text) ? null : text;
    }

    private static HabitacionResponse ToResponse(Habitacion room) =>
        new(room.IdHabitacion, room.IdSucursal, room.NumeroHabitacion,
            room.TipoHabitacion, room.Estado, room.Activa);
}
