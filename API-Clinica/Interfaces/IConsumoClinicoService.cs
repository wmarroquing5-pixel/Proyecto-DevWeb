using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IConsumoClinicoService
{
    Task<ConsumoClinicoResponseDto> RegistrarAsync(
        int idTratamiento, ConsumoClinicoCreateDto request,
        ClaimsPrincipal principal, CancellationToken cancellationToken);
}
