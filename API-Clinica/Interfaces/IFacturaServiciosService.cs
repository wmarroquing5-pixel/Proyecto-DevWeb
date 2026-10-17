using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IFacturaServiciosService
{
    Task<PagedResponse<FacturaConsultaResumenResponse>> ListarAsync(
        FacturaConsultaFiltroDto filtro, CancellationToken cancellationToken);
    Task<FacturaConsultaResponse> ObtenerAsync(
        int id, CancellationToken cancellationToken);
    Task<FacturaServiciosResponse> CrearAsync(
        CrearFacturaServiciosRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
