using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed record SucursalResponse(int IdSucursal, string Nombre, string? Direccion, bool Activa);

public sealed class GuardarSucursalRequest
{
    [Required, StringLength(100)]
    public string Nombre { get; init; } = string.Empty;

    [StringLength(255)]
    public string? Direccion { get; init; }

    public bool? Activa { get; init; }
}

public sealed record EspecialidadResponse(int IdEspecialidad, string Nombre, bool Activa);

public sealed class GuardarEspecialidadRequest
{
    [Required, StringLength(100)]
    public string Nombre { get; init; } = string.Empty;

    public bool? Activa { get; init; }
}
