using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IClinicaService
{
    Task<PagedResponse<ClinicaResponseDto>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken);
    Task<ClinicaResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<ClinicaResponseDto> CrearAsync(
        ClinicaCreateDto request, CancellationToken cancellationToken);
    Task<ClinicaResponseDto> ActualizarAsync(
        int id, ClinicaUpdateDto request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
