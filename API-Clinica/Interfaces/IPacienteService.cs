using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IPacienteService
{
    Task<PagedResponse<PacienteListadoResponse>> ListarAsync(
        string? nombre, bool? activo, int page, int pageSize, CancellationToken cancellationToken);
    Task<PacienteResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<PacienteResponse> CrearAsync(GuardarPacienteRequest request, CancellationToken cancellationToken);
    Task<PacienteResponse> ActualizarAsync(int id, GuardarPacienteRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
