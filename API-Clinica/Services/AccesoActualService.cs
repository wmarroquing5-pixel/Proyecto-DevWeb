using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace API_Clinica.Services;

public sealed class AccesoActualService(ClinicaDbContext context) : IAccesoActualService
{
    public async Task<Usuario?> ObtenerUsuarioActivoAsync(ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var username = principal.FindFirst("Username")?.Value;
        if (principal.Identity?.IsAuthenticated != true ||
            !int.TryParse(principal.FindFirst("IdUsuario")?.Value, out var idUsuario) ||
            !int.TryParse(principal.FindFirst("IdRol")?.Value, out var idRol) ||
            string.IsNullOrWhiteSpace(username) ||
            idUsuario <= 0 || idRol <= 0)
            return null;

        return await context.Usuarios.AsNoTracking()
            .Where(u => u.IdUsuario == idUsuario && u.IdRol == idRol && u.Activo &&
                u.Username == username)
            .Join(context.Roles.AsNoTracking().Where(r => r.Activo),
                u => u.IdRol, r => r.IdRol, (u, _) => u)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<PermisoActualResponse>> ObtenerPermisosAsync(
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var usuario = await ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");

        var permissions = await context.Permisos.AsNoTracking()
            .Where(p => p.IdRol == usuario.IdRol)
            .OrderBy(p => p.Modulo)
            .Select(p => new PermisoActualResponse(p.IdPermiso, p.Modulo,
                p.PuedeConsultar, p.PuedeCrear, p.PuedeModificar, p.PuedeEliminar))
            .ToListAsync(cancellationToken);
        return permissions.GroupBy(p => p.Modulo, StringComparer.OrdinalIgnoreCase)
            .Where(group => group.Count() == 1)
            .Select(group => group.Single())
            .ToList();
    }
}
