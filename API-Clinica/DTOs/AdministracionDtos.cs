using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed record UsuarioResponse(int IdUsuario, int IdRol, int? IdEmpleado, string Username, bool Activo);

public sealed class CrearUsuarioRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string Username { get; init; } = string.Empty;
    [Required, StringLength(128, MinimumLength = 8)]
    public string Password { get; init; } = string.Empty;
    [Range(1, int.MaxValue)]
    public int IdRol { get; init; }
    public int? IdEmpleado { get; init; }
    public bool Activo { get; init; } = true;
}

public sealed class ActualizarUsuarioRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string Username { get; init; } = string.Empty;
    [Range(1, int.MaxValue)]
    public int IdRol { get; init; }
    public int? IdEmpleado { get; init; }
    public bool Activo { get; init; }
}

public sealed record RolResponse(int IdRol, string Nombre, bool Activo);

public sealed class GuardarRolRequest
{
    [Required, StringLength(50, MinimumLength = 1)]
    public string Nombre { get; init; } = string.Empty;
    public bool Activo { get; init; } = true;
}

public sealed record PermisoResponse(int IdPermiso, int IdRol, string Modulo,
    bool PuedeConsultar, bool PuedeCrear, bool PuedeModificar, bool PuedeEliminar);

public sealed class GuardarPermisoRequest
{
    [Range(1, int.MaxValue)]
    public int IdRol { get; init; }
    [Required, StringLength(50, MinimumLength = 1)]
    public string Modulo { get; init; } = string.Empty;
    public bool PuedeConsultar { get; init; }
    public bool PuedeCrear { get; init; }
    public bool PuedeModificar { get; init; }
    public bool PuedeEliminar { get; init; }
}
