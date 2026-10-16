using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IExamenService
{
    Task<PagedResponse<ExamenResponseDto>> ListarAsync(
        ExamenFiltroDto filtro, CancellationToken cancellationToken);
    Task<ExamenResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<ExamenResponseDto> CrearAsync(
        ExamenCreateDto request, ClaimsPrincipal principal, CancellationToken cancellationToken);
    Task<ExamenResponseDto> ActualizarAsync(
        int id, ExamenUpdateDto request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
