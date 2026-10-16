using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public abstract class EmpleadoDatosRequest
{
    [Range(1, int.MaxValue)]
    public int IdSucursal { get; init; }

    public int? IdEspecialidad { get; init; }

    [Required, StringLength(100)]
    public string Nombres { get; init; } = string.Empty;

    [Required, StringLength(100)]
    public string Apellidos { get; init; } = string.Empty;

    [Required, StringLength(20)]
    public string DPI { get; init; } = string.Empty;

    [Required, StringLength(30)]
    public string TipoEmpleado { get; init; } = string.Empty;

    public DateOnly? FechaIngreso { get; init; }

    [StringLength(10)]
    public string? TipoSangre { get; init; }

    public int? IdTurno { get; init; }

    [StringLength(150)]
    public string? Direccion { get; init; }

    [StringLength(12)]
    public string? Telefono { get; init; }

    [StringLength(150)]
    public string? CorreoElectronico { get; init; }
}

public sealed class CrearEmpleadoRequest : EmpleadoDatosRequest;

public sealed class ActualizarEmpleadoRequest : EmpleadoDatosRequest;

public sealed record EmpleadoListadoResponse(
    int IdEmpleado, int IdSucursal, string Nombres, string Apellidos,
    string TipoEmpleado, bool Activo);

public sealed record EmpleadoDetalleResponse(
    int IdEmpleado, int IdSucursal, int? IdEspecialidad, string Nombres,
    string Apellidos, string DPI, string TipoEmpleado, bool Activo,
    DateOnly? FechaIngreso, string? TipoSangre, int? IdTurno,
    string? Direccion, string? Telefono, string? CorreoElectronico);
