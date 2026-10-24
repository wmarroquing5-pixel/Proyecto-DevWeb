using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IRecetaFarmaciaService
{
    Task<PagedResponse<RecetaFarmaciaDto>> ListarAsync(
        int page, int pageSize, int? idConsulta, ClaimsPrincipal principal,
        CancellationToken cancellationToken);

    Task<RecetaFarmaciaDto> ObtenerAsync(
        int idReceta, ClaimsPrincipal principal, CancellationToken cancellationToken);
}
