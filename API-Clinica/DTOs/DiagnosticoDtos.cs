using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed class CrearDiagnosticoRequest
{
    [Range(1, int.MaxValue)]
    public int IdConsulta { get; init; }

    [Range(1, int.MaxValue)]
    public int? IdMedico { get; init; }

    [Required]
    public string Descripcion { get; init; } = string.Empty;
}

public sealed record DiagnosticoResponse(
    int IdDiagnostico, int IdConsulta, int IdMedico,
    string Descripcion, DateTime FechaRegistro);
