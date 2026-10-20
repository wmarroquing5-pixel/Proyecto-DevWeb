using API_Clinica.Data;
using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using System.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

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

    public async Task<PagedResponse<PermisoResponse>> ListarPermisosAsync(
        PermisoFiltroDto filtro, CancellationToken ct)
    {
        if (filtro.IdRol is <= 0)
            throw Invalid(nameof(filtro.IdRol), "Debe ser un identificador positivo.");

        var modulo = filtro.Modulo?.Trim();
        if (modulo?.Length > 50)
            throw Invalid(nameof(filtro.Modulo), "No puede exceder 50 caracteres.");

        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        var query = context.Permisos.AsNoTracking().AsQueryable();
        if (filtro.IdRol.HasValue)
            query = query.Where(p => p.IdRol == filtro.IdRol.Value);
        if (!string.IsNullOrWhiteSpace(modulo))
            query = query.Where(p => p.Modulo.Contains(modulo));

        var total = await query.LongCountAsync(ct);
        var items = await query.OrderBy(p => p.IdPermiso)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(p => new PermisoResponse(p.IdPermiso, p.IdRol, p.Modulo,
                p.PuedeConsultar, p.PuedeCrear, p.PuedeModificar, p.PuedeEliminar))
            .ToListAsync(ct);
        return new(items, filtro.Page, filtro.PageSize, total);
    }

    public IReadOnlyList<string> ListarModulosPermiso() => PermisoModuleCatalog.All;

    public async Task<PermisoResponse> ObtenerPermisoAsync(int id, CancellationToken ct) =>
        await context.Permisos.AsNoTracking().Where(p => p.IdPermiso == id)
            .Select(p => new PermisoResponse(p.IdPermiso, p.IdRol, p.Modulo,
                p.PuedeConsultar, p.PuedeCrear, p.PuedeModificar, p.PuedeEliminar))
            .SingleOrDefaultAsync(ct)
        ?? throw new NotFoundException("Permiso no encontrado.");

    public async Task<PermisoResponse> CrearPermisoAsync(GuardarPermisoRequest request, CancellationToken ct)
    {
        var modulo = AllowedModule(request.Modulo);
        return await ExecutePermissionMutationAsync(
            token => CrearPermisoCoreAsync(request, modulo, token), ct);
    }

    public async Task<PermisoResponse> ActualizarPermisoAsync(int id, GuardarPermisoRequest request, CancellationToken ct)
    {
        if (id <= 0)
            throw Invalid(nameof(id), "Debe ser un identificador positivo.");

        var modulo = AllowedModule(request.Modulo);
        return await ExecutePermissionMutationAsync(async token =>
        {
            var permiso = await context.Permisos.SingleOrDefaultAsync(
                p => p.IdPermiso == id, token)
                ?? throw new NotFoundException("Permiso no encontrado.");
            await ValidatePermissionReferences(request.IdRol, modulo, id, token);
            await EnsurePermissionAdministrationPreservedAsync(
                permiso, request, modulo, deleting: false, token);
            permiso.IdRol = request.IdRol;
            permiso.Modulo = modulo;
            SetPermissionFlags(permiso, request);
            await SaveAsync(token);
            return ToResponse(permiso);
        }, ct);
    }

    public async Task EliminarPermisoAsync(int id, CancellationToken ct)
    {
        if (id <= 0)
            throw Invalid(nameof(id), "Debe ser un identificador positivo.");

        await ExecutePermissionMutationAsync(async token =>
        {
            var permiso = await context.Permisos.SingleOrDefaultAsync(
                p => p.IdPermiso == id, token)
                ?? throw new NotFoundException("Permiso no encontrado.");
            await EnsurePermissionAdministrationPreservedAsync(
                permiso, replacement: null, modulo: null, deleting: true, token);
            context.Permisos.Remove(permiso);
            await SaveAsync(token);
            return true;
        }, ct);
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
        if (!await context.Roles.AnyAsync(r => r.IdRol == idRol && r.Activo, ct))
            throw Invalid("IdRol", "El rol no existe o está inactivo.");
        if (await context.Permisos.AnyAsync(p => p.IdRol == idRol && p.Modulo == modulo &&
            (!id.HasValue || p.IdPermiso != id.Value), ct))
            throw new ConflictException("Ya existe un permiso para ese rol y módulo.");
    }

    private async Task<PermisoResponse> CrearPermisoCoreAsync(
        GuardarPermisoRequest request, string modulo, CancellationToken ct)
    {
        if (!await context.Roles.AnyAsync(r => r.IdRol == request.IdRol && r.Activo, ct))
            throw Invalid("IdRol", "El rol no existe o está inactivo.");
        if (await context.Permisos.AnyAsync(
            p => p.IdRol == request.IdRol && p.Modulo == modulo, ct))
            throw new ConflictException("Ya existe un permiso para ese rol y módulo.");

        var permiso = new Permiso { IdRol = request.IdRol, Modulo = modulo };
        SetPermissionFlags(permiso, request);
        context.Permisos.Add(permiso);
        await SaveAsync(ct);
        return ToResponse(permiso);
    }

    private async Task<T> ExecutePermissionMutationAsync<T>(
        Func<CancellationToken, Task<T>> operation, CancellationToken ct)
    {
        if (!context.Database.IsSqlServer())
            return await operation(ct);

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, ct);
            try
            {
                await LockPermissionsTableAsync(ct);
                var result = await operation(ct);
                await transaction.CommitAsync(ct);
                return result;
            }
            catch
            {
                await transaction.RollbackAsync(CancellationToken.None);
                throw;
            }
        }
        catch (SqlException ex) when (ex.Number is 1205 or 1222)
        {
            throw new ConflictException(
                "Los permisos están siendo modificados. Intente nuevamente.");
        }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException(
                "El permiso cambió durante la operación. Consulte el estado actual e intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627 or 547)
        {
            throw new ConflictException(
                "La operación entra en conflicto con una restricción de la base de datos.");
        }
    }

    private async Task EnsurePermissionAdministrationPreservedAsync(
        Permiso current,
        GuardarPermisoRequest? replacement,
        string? modulo,
        bool deleting,
        CancellationToken ct)
    {
        if (!string.Equals(current.Modulo, "Permisos", StringComparison.OrdinalIgnoreCase) ||
            !await RoleHasActiveUserAsync(current.IdRol, ct))
            return;

        var replacementIsEffective = !deleting &&
            string.Equals(modulo, "Permisos", StringComparison.Ordinal) &&
            replacement is not null &&
            await RoleHasActiveUserAsync(replacement.IdRol, ct);

        await EnsureOperationPreservedAsync(
            current.IdPermiso, current.PuedeConsultar,
            replacementIsEffective && replacement!.PuedeConsultar, Operacion.Consultar, ct);
        await EnsureOperationPreservedAsync(
            current.IdPermiso, current.PuedeCrear,
            replacementIsEffective && replacement!.PuedeCrear, Operacion.Crear, ct);
        await EnsureOperationPreservedAsync(
            current.IdPermiso, current.PuedeModificar,
            replacementIsEffective && replacement!.PuedeModificar, Operacion.Modificar, ct);
        await EnsureOperationPreservedAsync(
            current.IdPermiso, current.PuedeEliminar,
            replacementIsEffective && replacement!.PuedeEliminar, Operacion.Eliminar, ct);
    }

    private async Task EnsureOperationPreservedAsync(
        int currentPermissionId,
        bool currentlyGranted,
        bool remainsGranted,
        Operacion operation,
        CancellationToken ct)
    {
        if (!currentlyGranted || remainsGranted)
            return;

        var alternatives = context.Permisos.AsNoTracking().Where(permission =>
            permission.IdPermiso != currentPermissionId && permission.Modulo == "Permisos");
        alternatives = operation switch
        {
            Operacion.Consultar => alternatives.Where(permission => permission.PuedeConsultar),
            Operacion.Crear => alternatives.Where(permission => permission.PuedeCrear),
            Operacion.Modificar => alternatives.Where(permission => permission.PuedeModificar),
            Operacion.Eliminar => alternatives.Where(permission => permission.PuedeEliminar),
            _ => alternatives.Where(_ => false)
        };

        var hasAlternative = await alternatives.AnyAsync(permission =>
            context.Roles.Any(role => role.IdRol == permission.IdRol && role.Activo) &&
            context.Usuarios.Any(user => user.IdRol == permission.IdRol && user.Activo), ct);
        if (!hasAlternative)
            throw new ConflictException(
                $"No se puede revocar la última capacidad efectiva para {operation} permisos.");
    }

    private async Task<bool> RoleHasActiveUserAsync(int idRol, CancellationToken ct)
    {
        if (!await context.Roles.AnyAsync(role => role.IdRol == idRol && role.Activo, ct))
            return false;
        return await context.Usuarios.AnyAsync(
            user => user.IdRol == idRol && user.Activo, ct);
    }

    private async Task LockPermissionsTableAsync(CancellationToken ct)
    {
        var transaction = context.Database.CurrentTransaction
            ?? throw new InvalidOperationException("La modificación SQL de permisos requiere una transacción activa.");
        await using var command = context.Database.GetDbConnection().CreateCommand();
        command.Transaction = transaction.GetDbTransaction();
        command.CommandText =
            "SELECT TOP (1) [IdPermiso] FROM [dbo].[Permiso] WITH (TABLOCKX, HOLDLOCK);";
        await command.ExecuteScalarAsync(ct);
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

    private static string AllowedModule(string? value)
    {
        _ = RequiredText(value, nameof(GuardarPermisoRequest.Modulo));
        if (!PermisoModuleCatalog.TryNormalize(value, out var module))
            throw Invalid(nameof(GuardarPermisoRequest.Modulo),
                "El módulo no corresponde a una política de autorización de la API.");
        return module;
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
