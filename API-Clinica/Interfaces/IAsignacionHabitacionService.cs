using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IAsignacionHabitacionService
{
    Task<PagedResponse<AsignacionHabitacionResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<AsignacionHabitacionResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<AsignacionHabitacionResponse> AsignarAsync(CrearAsignacionHabitacionRequest request, CancellationToken cancellationToken);
    Task<AsignacionHabitacionResponse> ActualizarAsync(int id, ActualizarAsignacionHabitacionRequest request, CancellationToken cancellationToken);
    Task<AsignacionHabitacionResponse> RegistrarEgresoAsync(int id, CancellationToken cancellationToken);
    Task EliminarAsync(int id, CancellationToken cancellationToken);
}
