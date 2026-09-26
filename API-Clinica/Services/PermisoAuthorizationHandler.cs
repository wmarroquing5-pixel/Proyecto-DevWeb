using API_Clinica.Common;
using API_Clinica.Data;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class PermisoAuthorizationHandler(
    IAccesoActualService acceso, ClinicaDbContext context)
    : AuthorizationHandler<PermisoRequirement>
{
    protected override async Task HandleRequirementAsync(
        AuthorizationHandlerContext authorizationContext, PermisoRequirement requirement)
    {
        var cancellationToken = (authorizationContext.Resource as HttpContext)?.RequestAborted
            ?? CancellationToken.None;
        var usuario = await acceso.ObtenerUsuarioActivoAsync(authorizationContext.User, cancellationToken);
        if (usuario is null) return;

        var permisos = await context.Permisos.AsNoTracking()
            .Where(p => p.IdRol == usuario.IdRol && p.Modulo == requirement.Modulo)
            .Take(2).ToListAsync(cancellationToken);

        if (permisos.Count != 1) return;
        var permiso = permisos[0];
        var permitido = requirement.Operacion switch
        {
            Operacion.Consultar => permiso.PuedeConsultar,
            Operacion.Crear => permiso.PuedeCrear,
            Operacion.Modificar => permiso.PuedeModificar,
            Operacion.Eliminar => permiso.PuedeEliminar,
            _ => false
        };

        if (permitido) authorizationContext.Succeed(requirement);
    }
}
