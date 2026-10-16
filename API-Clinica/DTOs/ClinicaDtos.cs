using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public abstract class ClinicaDatosRequest
{
    [Required, StringLength(100)]
    public string NombreClinica { get; init; } = string.Empty;

    [StringLength(100)]
    public string? Especialidad { get; init; }

    [Range(1, int.MaxValue)]
    public int IdSucursal { get; init; }
}

public sealed class ClinicaCreateDto : ClinicaDatosRequest;

public sealed class ClinicaUpdateDto : ClinicaDatosRequest;

public sealed record ClinicaResponseDto(
    int IdClinica, string NombreClinica, string? Especialidad,
    bool Activa, int IdSucursal);
