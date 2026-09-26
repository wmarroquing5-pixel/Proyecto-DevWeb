using API_Clinica.Data;
using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class AdministracionService(
    ClinicaDbContext context,
    IPasswordHasher<Usuario> passwordHasher,
    ICommonParameterValidator parameterValidator,
    IHttpContextAccessor httpContextAccessor,
    IAuthorizationService authorizationService) : IAdministracionService
{
    public async Task<PagedResponse<UsuarioResponse>> ListarUsuariosAsync(int page, int pageSize, CancellationToken ct)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Usuarios.AsNoTracking();
        var total = await query.LongCountAsync(ct);
        var items = await query.OrderBy(u => u.IdUsuario)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(u => new UsuarioResponse(u.IdUsuario, u.IdRol, u.IdEmpleado, u.Username, u.Activo))
            .ToListAsync(ct);
        return new(items, page, pageSize, total);
    }

    public async Task<UsuarioResponse> ObtenerUsuarioAsync(int id, CancellationToken ct) =>
        await context.Usuarios.AsNoTracking().Where(u => u.IdUsuario == id)
            .Select(u => new UsuarioResponse(u.IdUsuario, u.IdRol, u.IdEmpleado, u.Username, u.Activo))
            .SingleOrDefaultAsync(ct)
        ?? throw new NotFoundException("Usuario no encontrado.");

    public async Task<UsuarioResponse> CrearUsuarioAsync(CrearUsuarioRequest request, CancellationToken ct)
    {
        var username = RequiredText(request.Username, nameof(request.Username));
        if (string.IsNullOrWhiteSpace(request.Password))
            throw Invalid(nameof(request.Password), "La contraseña es obligatoria.");
        if (!int.TryParse(httpContextAccessor.HttpContext?.User.FindFirst("IdRol")?.Value, out var actorRole) ||
            (request.IdRol != actorRole && !await CanModifyRolesAsync()))
            throw new ForbiddenException("No tiene permiso para asignar ese rol.");
        await ValidateUserReferences(request.IdRol, request.IdEmpleado, ct);
        if (await context.Usuarios.AnyAsync(u => u.Username == username, ct))
            throw new ConflictException("El nombre de usuario ya existe.");

        var usuario = new Usuario
        {
            Username = username, IdRol = request.IdRol,
            IdEmpleado = request.IdEmpleado, Activo = request.Activo
        };
        usuario.PasswordHash = passwordHasher.HashPassword(usuario, request.Password);
        context.Usuarios.Add(usuario);
        await SaveAsync(ct);
        return ToResponse(usuario);
    }

    public async Task<UsuarioResponse> ActualizarUsuarioAsync(int id, ActualizarUsuarioRequest request, CancellationToken ct)
    {
        var usuario = await context.Usuarios.SingleOrDefaultAsync(u => u.IdUsuario == id, ct)
            ?? throw new NotFoundException("Usuario no encontrado.");
        var username = RequiredText(request.Username, nameof(request.Username));
        if (request.IdRol != usuario.IdRol && !await CanModifyRolesAsync())
            throw new ForbiddenException("No tiene permiso para cambiar el rol.");
        await ValidateUserReferences(request.IdRol, request.IdEmpleado, ct);
        if (await context.Usuarios.AnyAsync(u => u.IdUsuario != id && u.Username == username, ct))
            throw new ConflictException("El nombre de usuario ya existe.");
        usuario.Username = username;
        usuario.IdRol = request.IdRol;
        usuario.IdEmpleado = request.IdEmpleado;
        usuario.Activo = request.Activo;
        await SaveAsync(ct);
        return ToResponse(usuario);
    }

    public async Task EliminarUsuarioAsync(int id, int actorId, CancellationToken ct)
    {
        if (id == actorId) throw new ConflictException("No puede eliminar su propia cuenta.");
        var usuario = await context.Usuarios.SingleOrDefaultAsync(u => u.IdUsuario == id, ct)
            ?? throw new NotFoundException("Usuario no encontrado.");
        context.Usuarios.Remove(usuario);
        await SaveAsync(ct);
    }

    public async Task<PagedResponse<RolResponse>> ListarRolesAsync(int page, int pageSize, CancellationToken ct)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Roles.AsNoTracking();
        var total = await query.LongCountAsync(ct);
        var items = await query.OrderBy(r => r.IdRol)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(r => new RolResponse(r.IdRol, r.Nombre, r.Activo)).ToListAsync(ct);
        return new(items, page, pageSize, total);
    }

    public async Task<RolResponse> ObtenerRolAsync(int id, CancellationToken ct) =>
        await context.Roles.AsNoTracking().Where(r => r.IdRol == id)
            .Select(r => new RolResponse(r.IdRol, r.Nombre, r.Activo)).SingleOrDefaultAsync(ct)
        ?? throw new NotFoundException("Rol no encontrado.");

    public async Task<RolResponse> CrearRolAsync(GuardarRolRequest request, CancellationToken ct)
    {
        var nombre = RequiredText(request.Nombre, nameof(request.Nombre));
        if (await context.Roles.AnyAsync(r => r.Nombre == nombre, ct))
            throw new ConflictException("El nombre del rol ya existe.");
        var rol = new Rol { Nombre = nombre, Activo = request.Activo };
        context.Roles.Add(rol);
        await SaveAsync(ct);
        return ToResponse(rol);
    }

    public async Task<RolResponse> ActualizarRolAsync(int id, GuardarRolRequest request, CancellationToken ct)
    {
        var rol = await context.Roles.SingleOrDefaultAsync(r => r.IdRol == id, ct)
            ?? throw new NotFoundException("Rol no encontrado.");
        var nombre = RequiredText(request.Nombre, nameof(request.Nombre));
        if (await context.Roles.AnyAsync(r => r.IdRol != id && r.Nombre == nombre, ct))
            throw new ConflictException("El nombre del rol ya existe.");
        rol.Nombre = nombre;
        rol.Activo = request.Activo;
        await SaveAsync(ct);
        return ToResponse(rol);
    }

    public async Task EliminarRolAsync(int id, CancellationToken ct)
    {
        var rol = await context.Roles.SingleOrDefaultAsync(r => r.IdRol == id, ct)
            ?? throw new NotFoundException("Rol no encontrado.");
        if (await context.Usuarios.AnyAsync(u => u.IdRol == id, ct) ||
            await context.Permisos.AnyAsync(p => p.IdRol == id, ct))
            throw new ConflictException("El rol tiene usuarios o permisos asociados.");
        context.Roles.Remove(rol);
        await SaveAsync(ct);
    }

    public async Task<PagedResponse<PermisoResponse>> ListarPermisosAsync(int page, int pageSize, CancellationToken ct)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Permisos.AsNoTracking();
        var total = await query.LongCountAsync(ct);
        var items = await query.OrderBy(p => p.IdPermiso)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(p => new PermisoResponse(p.IdPermiso, p.IdRol, p.Modulo,
                p.PuedeConsultar, p.PuedeCrear, p.PuedeModificar, p.PuedeEliminar))
            .ToListAsync(ct);
        return new(items, page, pageSize, total);
    }

    public async Task<PermisoResponse> ObtenerPermisoAsync(int id, CancellationToken ct) =>
        await context.Permisos.AsNoTracking().Where(p => p.IdPermiso == id)
            .Select(p => new PermisoResponse(p.IdPermiso, p.IdRol, p.Modulo,
                p.PuedeConsultar, p.PuedeCrear, p.PuedeModificar, p.PuedeEliminar))
            .SingleOrDefaultAsync(ct)
        ?? throw new NotFoundException("Permiso no encontrado.");

    public async Task<PermisoResponse> CrearPermisoAsync(GuardarPermisoRequest request, CancellationToken ct)
    {
        var modulo = RequiredText(request.Modulo, nameof(request.Modulo));
        await ValidatePermissionReferences(request.IdRol, modulo, null, ct);
        var permiso = new Permiso { IdRol = request.IdRol, Modulo = modulo };
        SetPermissionFlags(permiso, request);
        context.Permisos.Add(permiso);
        await SaveAsync(ct);
        return ToResponse(permiso);
    }

    public async Task<PermisoResponse> ActualizarPermisoAsync(int id, GuardarPermisoRequest request, CancellationToken ct)
    {
        var permiso = await context.Permisos.SingleOrDefaultAsync(p => p.IdPermiso == id, ct)
            ?? throw new NotFoundException("Permiso no encontrado.");
        var modulo = RequiredText(request.Modulo, nameof(request.Modulo));
        await ValidatePermissionReferences(request.IdRol, modulo, id, ct);
        permiso.IdRol = request.IdRol;
        permiso.Modulo = modulo;
        SetPermissionFlags(permiso, request);
        await SaveAsync(ct);
        return ToResponse(permiso);
    }

    public async Task EliminarPermisoAsync(int id, CancellationToken ct)
    {
        var permiso = await context.Permisos.SingleOrDefaultAsync(p => p.IdPermiso == id, ct)
            ?? throw new NotFoundException("Permiso no encontrado.");
        context.Permisos.Remove(permiso);
        await SaveAsync(ct);
    }

    private async Task ValidateUserReferences(int idRol, int? idEmpleado, CancellationToken ct)
    {
        if (!await context.Roles.AnyAsync(r => r.IdRol == idRol && r.Activo, ct))
            throw Invalid("IdRol", "El rol no existe o está inactivo.");
        if (idEmpleado is int empleado &&
            !await context.Empleados.AnyAsync(e => e.IdEmpleado == empleado, ct))
            throw Invalid("IdEmpleado", "El empleado no existe.");
    }

    private async Task<bool> CanModifyRolesAsync()
    {
        var httpContext = httpContextAccessor.HttpContext;
        return httpContext is not null && (await authorizationService.AuthorizeAsync(
            httpContext.User, httpContext, new PermisoRequirement("Roles", Operacion.Modificar))).Succeeded;
    }

    private async Task ValidatePermissionReferences(int idRol, string modulo, int? id, CancellationToken ct)
    {
        if (!await context.Roles.AnyAsync(r => r.IdRol == idRol, ct))
            throw Invalid("IdRol", "El rol no existe.");
        if (await context.Permisos.AnyAsync(p => p.IdRol == idRol && p.Modulo == modulo &&
            (!id.HasValue || p.IdPermiso != id.Value), ct))
            throw new ConflictException("Ya existe un permiso para ese rol y módulo.");
    }

    private async Task SaveAsync(CancellationToken ct)
    {
        try { await context.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627 or 547)
        {
            throw new ConflictException("La operación entra en conflicto con una restricción de la base de datos.");
        }
    }

    private static string RequiredText(string? value, string name)
    {
        var text = value?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 50)
            throw Invalid(name, "Debe contener entre 1 y 50 caracteres.");
        return text;
    }

    private static AppValidationException Invalid(string name, string message) =>
        new("Datos no válidos.", new Dictionary<string, string[]> { [name] = [message] });

    private static UsuarioResponse ToResponse(Usuario u) =>
        new(u.IdUsuario, u.IdRol, u.IdEmpleado, u.Username, u.Activo);
    private static RolResponse ToResponse(Rol r) => new(r.IdRol, r.Nombre, r.Activo);
    private static PermisoResponse ToResponse(Permiso p) =>
        new(p.IdPermiso, p.IdRol, p.Modulo, p.PuedeConsultar,
            p.PuedeCrear, p.PuedeModificar, p.PuedeEliminar);

    private static void SetPermissionFlags(Permiso permiso, GuardarPermisoRequest request)
    {
        permiso.PuedeConsultar = request.PuedeConsultar;
        permiso.PuedeCrear = request.PuedeCrear;
        permiso.PuedeModificar = request.PuedeModificar;
        permiso.PuedeEliminar = request.PuedeEliminar;
    }
}
