using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IHabitacionService
{
    Task<PagedResponse<HabitacionResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<HabitacionResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<HabitacionResponse> CrearAsync(CrearHabitacionRequest request, CancellationToken cancellationToken);
    Task<HabitacionResponse> ActualizarAsync(int id, ActualizarHabitacionRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
