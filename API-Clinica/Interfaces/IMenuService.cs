using API_Clinica.DTOs;
using System.Security.Claims;

namespace API_Clinica.Interfaces;

public interface IMenuService
{
    /// <summary>
    /// Devuelve el menú filtrado por los permisos/roles del usuario autenticado.
    /// </summary>
    Task<List<MenuItemDto>> ObtenerMenuAsync(ClaimsPrincipal user, CancellationToken ct);
}