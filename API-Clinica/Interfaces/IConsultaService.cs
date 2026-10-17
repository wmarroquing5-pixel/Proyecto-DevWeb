using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IConsultaService
{
    Task<PagedResponse<ConsultaListadoDto>> ListarAsync(
        ConsultaFiltroDto filtro, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
    Task<ConsultaDetalleDto> ObtenerAsync(
        int id, ClaimsPrincipal principal, CancellationToken cancellationToken);
    Task<ConsultaDetalleDto> CrearAsync(
        ConsultaCreateDto request, ClaimsPrincipal principal, CancellationToken cancellationToken);
    Task<ConsultaDetalleDto> ActualizarAsync(
        int id, ConsultaUpdateDto request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
