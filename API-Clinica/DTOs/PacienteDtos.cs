using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed class GuardarPacienteRequest
{
    [Required, StringLength(100)]
    public string Nombres { get; init; } = string.Empty;

    [Required, StringLength(100)]
    public string Apellidos { get; init; } = string.Empty;

    [StringLength(20)]
    public string? DPI { get; init; }

    public DateOnly FechaNacimiento { get; init; }

    [StringLength(1)]
    public string? Genero { get; init; }

    [StringLength(20)]
    public string? Telefono { get; init; }

    [StringLength(100)]
    public string? Correo { get; init; }

    [StringLength(10)]
    public string? TipoSangre { get; init; }

    [StringLength(50)]
    public string? Nit { get; init; }

    [StringLength(150)]
    public string? NombreFacturacion { get; init; }

    [StringLength(150)]
    public string? Direccion { get; init; }

    [StringLength(500)]
    public string? UrlFoto { get; init; }
}

public sealed record PacienteResponse(
    int IdPaciente, string Nombres, string Apellidos, string? DPI,
    DateOnly FechaNacimiento, string? Genero, string? Telefono, string? Correo,
    DateTime FechaRegistro, bool Activo, string? TipoSangre, string? Nit,
    string? NombreFacturacion, string? Direccion, string? UrlFoto);

public sealed record PacienteListadoResponse(
    int IdPaciente, string Nombres, string Apellidos, bool Activo);
