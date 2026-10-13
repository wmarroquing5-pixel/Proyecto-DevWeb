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
            Label = "Citas",
            Route = "/citas",
            Icon = "fa-calendar-alt",
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
                }
            }
        },
        new MenuItemDto
        {
            Label = "Reportes",
            Icon = "fa-chart-bar",
            Roles = new[] { "Admin" },
            Children = new List<MenuItemDto>
            {
                new MenuItemDto
                {
                    Label = "Citas del día",
                    Route = "/reportes/citas",
                    Icon = "fa-calendar-day",
                    Roles = new[] { "Admin" }
                },
                new MenuItemDto
                {
                    Label = "Pacientes atendidos",
                    Route = "/reportes/pacientes",
                    Icon = "fa-notes-medical",
                    Roles = new[] { "Admin" }
                }
            }
        }
    };
}