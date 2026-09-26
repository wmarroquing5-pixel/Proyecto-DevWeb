using System.Data;
using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using API_Clinica.Interfaces;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class HabitacionTransactionCoordinator(
    ClinicaDbContext context, IHabitacionEstadoNotifier notifier)
{
    public async Task<T> EjecutarAsync<T>(
        int idHabitacion,
        Func<Habitacion, Task<T>> action,
        CancellationToken cancellationToken,
        bool publicarEstadoHabitacion = false)
    {
        try
        {
            if (!context.Database.IsSqlServer())
            {
                if (context.Database.IsRelational())
                    throw new NotSupportedException("La coordinación de habitaciones requiere SQL Server.");

                // EF InMemory, utilizado exclusivamente por las pruebas, no ofrece transacciones.
                var inMemoryRoom = await ObtenerSinBloqueoAsync(idHabitacion, cancellationToken);
                var inMemoryResult = await action(inMemoryRoom);
                var inMemoryChanges = await context.SaveChangesAsync(cancellationToken);
                if (publicarEstadoHabitacion && inMemoryChanges > 0)
                    await notifier.PublicarAsync(inMemoryRoom.IdHabitacion, inMemoryRoom.Estado);
                return inMemoryResult;
            }

            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);

            // El bloqueo de actualización sobre la PK serializa asignación, egreso y cambios de estado.
            var room = await context.Habitaciones
                .FromSqlInterpolated($"SELECT * FROM [Habitacion] WITH (UPDLOCK, HOLDLOCK) WHERE [IdHabitacion] = {idHabitacion}")
                .SingleOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundException("Habitación no encontrada.");

            var result = await action(room);
            var changes = await context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            if (publicarEstadoHabitacion && changes > 0)
                await notifier.PublicarAsync(room.IdHabitacion, room.Estado);
            return result;
        }
        catch (SqlException ex) when (ex.Number is 1205 or 1222)
        {
            throw new ConflictException("La habitación está siendo modificada. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222)
        {
            throw new ConflictException("La habitación está siendo modificada. Intente nuevamente.");
        }
    }

    private async Task<Habitacion> ObtenerSinBloqueoAsync(int id, CancellationToken cancellationToken) =>
        await context.Habitaciones.SingleOrDefaultAsync(h => h.IdHabitacion == id, cancellationToken)
        ?? throw new NotFoundException("Habitación no encontrada.");
}
