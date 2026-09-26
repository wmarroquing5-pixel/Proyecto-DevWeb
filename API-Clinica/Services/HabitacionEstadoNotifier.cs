using API_Clinica.Hubs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace API_Clinica.Services;

public sealed class HabitacionEstadoNotifier(
    IHubContext<HabitacionHub> hubContext,
    ILogger<HabitacionEstadoNotifier> logger) : IHabitacionEstadoNotifier
{
    public async Task PublicarAsync(int habitacionId, string estado)
    {
        try
        {
            await hubContext.Clients.All.SendAsync(
                "ActualizarEstadoHabitacion", new { habitacionId, estado }, CancellationToken.None);
        }
        catch (Exception ex)
        {
            // La transacción ya fue confirmada. Un fallo de entrega no debe convertirla en un error HTTP.
            logger.LogError(ex, "No se pudo publicar el estado de la habitación {HabitacionId}.", habitacionId);
        }
    }
}
