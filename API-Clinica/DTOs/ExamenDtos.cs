using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace API_Clinica.DTOs;

public sealed class ExamenCreateDto
{
    [Range(1, int.MaxValue)]
    public int? IdConsulta { get; init; }
    [Range(1, int.MaxValue)]
    public int? IdDiagnostico { get; init; }
    [Range(1, int.MaxValue)]
    public int? IdTurno { get; init; }
    [Required, StringLength(200)]
    public string NombreExamen { get; init; } = string.Empty;
    public DateTime FechaExamen { get; init; }
    public DateOnly? FechaResultado { get; init; }
    [StringLength(20)]
    public string? Prioridad { get; init; }
}

// Las asociaciones clínicas quedan fijas después de crear el examen.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class ExamenUpdateDto
{
    [Range(1, int.MaxValue)]
    public int? IdTurno { get; init; }
    [Required, StringLength(200)]
    public string NombreExamen { get; init; } = string.Empty;
    public DateTime FechaExamen { get; init; }
    public DateOnly? FechaResultado { get; init; }
    [StringLength(20)]
    public string? Prioridad { get; init; }
}

public sealed class ExamenFiltroDto
{
    public int? IdConsulta { get; init; }
    public int? IdDiagnostico { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed record ExamenResponseDto(
    int IdExamen, int? IdConsulta, int? IdDiagnostico, int? IdTurno,
    string NombreExamen, DateTime FechaExamen, DateOnly? FechaResultado,
    string? Prioridad, int? IdPaciente, int? IdMedico);
