using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IEspecialidadService
{
    Task<PagedResponse<EspecialidadResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<EspecialidadResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<EspecialidadResponse> CrearAsync(GuardarEspecialidadRequest request, CancellationToken cancellationToken);
    Task<EspecialidadResponse> ActualizarAsync(int id, GuardarEspecialidadRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
