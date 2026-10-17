using API_Clinica.DTOs;
using System.Security.Claims;

namespace API_Clinica.Interfaces;

public interface IHistorialMedicoService
{
    Task<HistorialMedicoResponseDto> CrearAsync(
        HistorialMedicoCreateDto request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
    Task<PagedResponse<HistorialMedicoResponseDto>> ListarAsync(
        HistorialMedicoFiltroDto filtro, CancellationToken cancellationToken);
    Task<HistorialMedicoResponseDto> ObtenerAsync(
        int id, CancellationToken cancellationToken);
}
