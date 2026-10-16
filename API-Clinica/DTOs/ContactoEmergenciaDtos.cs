using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public abstract class ContactoEmergenciaDatosRequest
{
    [Required, StringLength(100)]
    public string Nombres { get; init; } = string.Empty;

    [Required, StringLength(100)]
    public string Apellidos { get; init; } = string.Empty;

    [Required, StringLength(20)]
    public string Telefono { get; init; } = string.Empty;

    [Required, StringLength(150)]
    public string Direccion { get; init; } = string.Empty;

    [StringLength(75)]
    public string? CorreoElectronico { get; init; }

    [StringLength(50)]
    public string? Parentesco { get; init; }

    [Range(1, int.MaxValue)]
    public int? IdPaciente { get; init; }
}

public sealed class ContactoEmergenciaCreateDto : ContactoEmergenciaDatosRequest;

public sealed class ContactoEmergenciaUpdateDto : ContactoEmergenciaDatosRequest;

public sealed record ContactoEmergenciaResponseDto(
    int IdContacto, string Nombres, string Apellidos, string Telefono,
    string Direccion, string? CorreoElectronico, string? Parentesco,
    bool Activo, int? IdPaciente);
