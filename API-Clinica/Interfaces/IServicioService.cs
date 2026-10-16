using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IServicioService
{
    Task<PagedResponse<ServicioResponseDto>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken);
    Task<ServicioResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<ServicioResponseDto> CrearAsync(
        ServicioCreateDto request, CancellationToken cancellationToken);
    Task<ServicioResponseDto> ActualizarAsync(
        int id, ServicioUpdateDto request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
