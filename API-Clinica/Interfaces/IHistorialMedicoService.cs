using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IHistorialMedicoService
{
    Task<PagedResponse<HistorialMedicoResponseDto>> ListarAsync(
        HistorialMedicoFiltroDto filtro, CancellationToken cancellationToken);
    Task<HistorialMedicoResponseDto> ObtenerAsync(
        int id, CancellationToken cancellationToken);
}
