using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IFacturaServiciosService
{
    Task<FacturaServiciosResponse> CrearAsync(
        CrearFacturaServiciosRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
