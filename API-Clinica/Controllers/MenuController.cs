using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/menu")]
[Authorize]
public sealed class MenuController(IMenuService menuService) : ControllerBase
{
    /// <summary>
    /// Devuelve el menú filtrado por los permisos del usuario autenticado.
    /// Angular lo consume desde MenuService.loadMenu()
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<MenuItemDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<List<MenuItemDto>>> Obtener(
        CancellationToken cancellationToken)
    {
        var menu = await menuService.ObtenerMenuAsync(User, cancellationToken);
        return Ok(menu);
    }
}