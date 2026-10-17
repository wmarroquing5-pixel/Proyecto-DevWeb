using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IVentaService
{
    Task<PagedResponse<VentaConsultaResumenResponse>> ListarAsync(
        VentaConsultaFiltroDto filtro, CancellationToken cancellationToken);
    Task<VentaConsultaResponse> ObtenerAsync(
        int id, CancellationToken cancellationToken);
    Task<VentaResponse> CrearAsync(
        CrearVentaRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
