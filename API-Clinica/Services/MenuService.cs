using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using System.Security.Claims;

namespace API_Clinica.Services;

public sealed class MenuService(IAccesoActualService accesoActual) : IMenuService
{
    public async Task<List<MenuItemDto>> ObtenerMenuAsync(
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        // 1. Obtener los permisos del usuario (ya tienes este servicio)
        var permisos = await accesoActual.ObtenerPermisosAsync(user, ct);

        // 2. Filtrar el menú estático según los permisos
        var filtrado = MenuCompleto.Items
            .Where(item => ItemPermitido(item, permisos))
            .Select(item => FiltrarHijos(item, permisos))
            .ToList();

        return filtrado;
    }

    /// <summary>
    /// Un item es visible si el usuario tiene permiso en ALGUNO de sus módulos.
    /// Ajusta esta lógica al formato real que devuelve ObtenerPermisosAsync.
    /// </summary>
    private static bool ItemPermitido(MenuItemDto item, object permisos)
    {
        // Si no hay roles definidos en el item, se muestra a todos
        if (item.Roles is null || item.Roles.Length == 0) return true;

        // Asumimos que 'permisos' es un IEnumerable<string> con los roles del usuario.
        // Si tu ObtenerPermisosAsync devuelve otra estructura, ajusta aquí.
        if (permisos is IEnumerable<string> rolesUsuario)
        {
            return item.Roles.Any(r => rolesUsuario.Contains(r));
        }

        return false;
    }

    /// <summary>
    /// Filtra recursivamente los hijos de un item.
    /// Si un padre queda sin hijos visibles, se oculta.
    /// </summary>
    private static MenuItemDto FiltrarHijos(MenuItemDto item, object permisos)
    {
        if (item.Children is null || item.Children.Count == 0)
            return item;

        var hijosVisibles = item.Children
            .Where(c => ItemPermitido(c, permisos))
            .Select(c => FiltrarHijos(c, permisos))
            .ToList();

        return item with { Children = hijosVisibles.Count > 0 ? hijosVisibles : null };
    }
}