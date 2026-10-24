using API_Clinica.DTOs;

namespace API_Clinica.Common;

/// <summary>
/// Menú completo de la aplicación (estático, no viene de BD).
/// El backend filtra por los permisos del usuario antes de enviarlo.
/// </summary>
public static class MenuCompleto
{
    public static readonly List<MenuItemDto> Items = new()
    {
        new MenuItemDto
        {
            Label = "Dashboard",
            Route = "/dashboard",
            Icon = "fa-home",
            Roles = new[] { "Admin", "Doctor", "Recepcionista" }
        },
        new MenuItemDto
        {
            Label = "Pacientes",
            Route = "/pacientes",
            Icon = "fa-user-injured",
            Roles = new[] { "Admin", "Doctor", "Recepcionista" }
        },
        new MenuItemDto
        {
            Label = "Consultas",
            Route = "/consultas",
            Icon = "fa-stethoscope",
            Roles = new[] { "Admin", "Doctor" }
        },
        new MenuItemDto
        {
            Label = "Medicamentos",
            Route = "/medicamentos",
            Icon = "fa-pills",
            Roles = new[] { "Admin", "Doctor" }
        },
        new MenuItemDto
        {
            Label = "Lotes de medicamentos",
            Route = "/inventario/lotes",
            Icon = "fa-boxes-stacked"
        },
        new MenuItemDto
        {
            Label = "Habitaciones",
            Route = "/habitaciones",
            Icon = "fa-bed"
        },
        new MenuItemDto
        {
            Label = "Ventas",
            Route = "/ventas",
            Icon = "fa-cash-register"
        },
        new MenuItemDto
        {
            Label = "Recetas de farmacia",
            Route = "/farmacia/recetas",
            Icon = "bi bi-prescription2"
        },
        new MenuItemDto
        {
            Label = "Facturación",
            Route = "/facturas",
            Icon = "fa-file-invoice-dollar"
        },
        new MenuItemDto
        {
            Label = "Catálogos organizativos",
            Icon = "bi bi-building",
            Children = new List<MenuItemDto>
            {
                new MenuItemDto
                {
                    Label = "Sucursales",
                    Route = "/admin/sucursales",
                    Icon = "bi bi-building"
                },
                new MenuItemDto
                {
                    Label = "Clínicas",
                    Route = "/admin/clinicas",
                    Icon = "bi bi-hospital"
                },
                new MenuItemDto
                {
                    Label = "Especialidades",
                    Route = "/admin/especialidades",
                    Icon = "bi bi-person-lines-fill"
                },
                new MenuItemDto
                {
                    Label = "Turnos",
                    Route = "/admin/turnos",
                    Icon = "bi bi-clock"
                },
                new MenuItemDto
                {
                    Label = "Servicios",
                    Route = "/admin/servicios",
                    Icon = "bi bi-clipboard2-pulse"
                }
            }
        },
        new MenuItemDto
        {
            Label = "Catálogos farmacéuticos",
            Icon = "bi bi-box-seam",
            Children = new List<MenuItemDto>
            {
                new MenuItemDto
                {
                    Label = "Categorías",
                    Route = "/admin/categorias",
                    Icon = "bi bi-tags"
                },
                new MenuItemDto
                {
                    Label = "Marcas",
                    Route = "/admin/marcas",
                    Icon = "bi bi-bookmark-star"
                }
            }
        },
        new MenuItemDto
        {
            Label = "Administración",
            Icon = "fa-cogs",
            Roles = new[] { "Admin" },
            Children = new List<MenuItemDto>
            {
                new MenuItemDto
                {
                    Label = "Usuarios",
                    Route = "/admin/usuarios",
                    Icon = "fa-users-cog",
                    Roles = new[] { "Admin" }
                },
                new MenuItemDto
                {
                    Label = "Roles",
                    Route = "/admin/roles",
                    Icon = "fa-user-tag",
                    Roles = new[] { "Admin" }
                },
                new MenuItemDto
                {
                    Label = "Empleados",
                    Route = "/admin/empleados",
                    Icon = "fa-id-badge",
                    Roles = new[] { "Admin" }
                },
                new MenuItemDto
                {
                    Label = "Permisos",
                    Route = "/admin/permisos",
                    Icon = "fa-shield-halved",
                    Roles = new[] { "Admin" }
                }
            }
        }
    };
}
