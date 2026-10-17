using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace API_Clinica.DTOs;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class HistorialMedicoCreateDto
{
    [Range(1, int.MaxValue)]
    public int IdPaciente { get; init; }

    [Range(1, int.MaxValue)]
    public int IdConsulta { get; init; }

    [Range(1, int.MaxValue)]
    public int? IdDiagnostico { get; init; }

    [Required, StringLength(300)]
    public string Descripcion { get; init; } = string.Empty;
}

public sealed class HistorialMedicoFiltroDto
{
    public int? IdConsulta { get; init; }
    public int? IdDiagnostico { get; init; }
    public int? IdPaciente { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

// IdConsulta, IdPaciente e IdMedico representan la atribución derivada;
// IdConsulta puede obtenerse de Diagnostico aunque la FK directa sea nula.
public sealed record HistorialMedicoResponseDto(
    int IdHistorial, int? IdConsulta, int? IdDiagnostico,
    int? IdPaciente, int? IdMedico, DateTime FechaHistorial,
    string Descripcion);
