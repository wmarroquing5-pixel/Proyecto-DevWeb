using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IDiagnosticoService
{
    Task<PagedResponse<DiagnosticoResponse>> ListarAsync(
        DiagnosticoFiltroDto filtro, CancellationToken cancellationToken);
    Task<DiagnosticoResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<DiagnosticoResponse> CrearAsync(
        CrearDiagnosticoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
    Task<DiagnosticoResponse> CrearConExamenAsync(
        CrearDiagnosticoConExamenRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
    Task<DiagnosticoResponse> ActualizarAsync(
        int id, ActualizarDiagnosticoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
