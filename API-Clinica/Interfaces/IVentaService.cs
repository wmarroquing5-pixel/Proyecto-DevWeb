using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IVentaService
{
    Task<VentaResponse> CrearAsync(
        CrearVentaRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
