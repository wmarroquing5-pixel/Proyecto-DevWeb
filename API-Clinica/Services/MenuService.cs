using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using System.Security.Claims;

namespace API_Clinica.Services;

public sealed class MenuService(IAccesoActualService accesoActual) : IMenuService
{
    private static readonly IReadOnlyDictionary<string, string> ModulosPorRuta =
        new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["/pacientes"] = "Pacientes",
            ["/citas"] = "Citas",
            ["/consultas"] = "Historial",
            ["/medicamentos"] = "Medicamentos",
            ["/admin/usuarios"] = "Usuarios",
            ["/admin/roles"] = "Roles",
            ["/admin/empleados"] = "Empleados",
            ["/reportes/citas"] = "Reportes",
            ["/reportes/pacientes"] = "Reportes"
        };

    public async Task<List<MenuItemDto>> ObtenerMenuAsync(
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        var permisos = await accesoActual.ObtenerPermisosAsync(user, ct);
        var modulosConsultables = permisos
            .Where(p => p.PuedeConsultar)
            .Select(p => p.Modulo)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return Filtrar(MenuCompleto.Items, modulosConsultables);
    }

    private static List<MenuItemDto> Filtrar(
        IEnumerable<MenuItemDto> items,
        IReadOnlySet<string> modulosConsultables)
    {
        var visibles = new List<MenuItemDto>();
        foreach (var item in items)
        {
            if (item.Children is { Count: > 0 })
            {
                var hijos = Filtrar(item.Children, modulosConsultables);
                if (hijos.Count > 0)
                    visibles.Add(item with { Children = hijos });
            }
            else if (item.Route == "/dashboard" && modulosConsultables.Count > 0)
            {
                visibles.Add(item);
            }
            else if (item.Route is not null &&
                ModulosPorRuta.TryGetValue(item.Route, out var modulo) &&
                modulosConsultables.Contains(modulo))
            {
                visibles.Add(item);
            }
        }

        return visibles;
    }
}
