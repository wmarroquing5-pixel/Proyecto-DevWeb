using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using System.Security.Claims;

namespace API_Clinica.Interfaces;

public interface IAccesoActualService
{
    Task<Usuario?> ObtenerUsuarioActivoAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);
    Task<IReadOnlyList<PermisoActualResponse>> ObtenerPermisosAsync(ClaimsPrincipal principal, CancellationToken cancellationToken);
}
