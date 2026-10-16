using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface ITurnoService
{
    Task<PagedResponse<TurnoResponseDto>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken);
    Task<TurnoResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<TurnoResponseDto> CrearAsync(
        TurnoCreateDto request, CancellationToken cancellationToken);
    Task<TurnoResponseDto> ActualizarAsync(
        int id, TurnoUpdateDto request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
