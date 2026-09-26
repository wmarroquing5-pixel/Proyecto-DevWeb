using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IDiagnosticoService
{
    Task<DiagnosticoResponse> CrearAsync(
        CrearDiagnosticoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
