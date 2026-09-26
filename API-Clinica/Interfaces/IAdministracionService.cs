using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IAdministracionService
{
    Task<PagedResponse<UsuarioResponse>> ListarUsuariosAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<UsuarioResponse> ObtenerUsuarioAsync(int id, CancellationToken cancellationToken);
    Task<UsuarioResponse> CrearUsuarioAsync(CrearUsuarioRequest request, CancellationToken cancellationToken);
    Task<UsuarioResponse> ActualizarUsuarioAsync(int id, ActualizarUsuarioRequest request, CancellationToken cancellationToken);
    Task EliminarUsuarioAsync(int id, int actorId, CancellationToken cancellationToken);

    Task<PagedResponse<RolResponse>> ListarRolesAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<RolResponse> ObtenerRolAsync(int id, CancellationToken cancellationToken);
    Task<RolResponse> CrearRolAsync(GuardarRolRequest request, CancellationToken cancellationToken);
    Task<RolResponse> ActualizarRolAsync(int id, GuardarRolRequest request, CancellationToken cancellationToken);
    Task EliminarRolAsync(int id, CancellationToken cancellationToken);

    Task<PagedResponse<PermisoResponse>> ListarPermisosAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<PermisoResponse> ObtenerPermisoAsync(int id, CancellationToken cancellationToken);
    Task<PermisoResponse> CrearPermisoAsync(GuardarPermisoRequest request, CancellationToken cancellationToken);
    Task<PermisoResponse> ActualizarPermisoAsync(int id, GuardarPermisoRequest request, CancellationToken cancellationToken);
    Task EliminarPermisoAsync(int id, CancellationToken cancellationToken);
}
