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
            ["/consultas"] = "Consultas",
            ["/medicamentos"] = "Medicamentos",
            ["/inventario/lotes"] = "LotesMedicamento",
            ["/habitaciones"] = "Habitaciones",
            ["/ventas"] = "Ventas",
            ["/facturas"] = "Facturas",
            ["/admin/sucursales"] = "Sucursales",
            ["/admin/clinicas"] = "Clinicas",
            ["/admin/especialidades"] = "Especialidades",
            ["/admin/turnos"] = "Turnos",
            ["/admin/servicios"] = "Servicios",
            ["/admin/categorias"] = "Categorias",
            ["/admin/marcas"] = "Marcas",
            ["/admin/usuarios"] = "Usuarios",
            ["/admin/roles"] = "Roles",
            ["/admin/empleados"] = "Empleados",
            ["/admin/permisos"] = "Permisos"
        };

    private static readonly IReadOnlySet<string> ModulosReconocidos =
        ModulosPorRuta.Values.ToHashSet(StringComparer.OrdinalIgnoreCase);

    public async Task<List<MenuItemDto>> ObtenerMenuAsync(
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        var permisos = await accesoActual.ObtenerPermisosAsync(user, ct);
        var modulosConsultables = permisos
            .Where(p => !string.IsNullOrWhiteSpace(p.Modulo))
            .GroupBy(p => p.Modulo, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() == 1)
            .Select(group => group.Single())
            .Where(p => p.PuedeConsultar && ModulosReconocidos.Contains(p.Modulo))
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
