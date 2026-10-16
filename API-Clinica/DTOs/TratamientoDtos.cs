using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace API_Clinica.DTOs;

public sealed class TratamientoCreateDto
{
    [Range(1, int.MaxValue)]
    public int IdConsulta { get; init; }
    [Required, StringLength(300)]
    public string Descripcion { get; init; } = string.Empty;
    [StringLength(300)]
    public string? Indicaciones { get; init; }
    public DateOnly FechaInicio { get; init; }
    public DateOnly? FechaFin { get; init; }
    [Range(1, int.MaxValue)]
    public int? IdLote { get; init; }
    public int? Cantidad { get; init; }
}

// La consulta queda fija para conservar la atribución clínica histórica.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class TratamientoUpdateDto
{
    [Required, StringLength(300)]
    public string Descripcion { get; init; } = string.Empty;
    [StringLength(300)]
    public string? Indicaciones { get; init; }
    public DateOnly FechaInicio { get; init; }
    public DateOnly? FechaFin { get; init; }
    [Range(1, int.MaxValue)]
    public int? IdLote { get; init; }
    public int? Cantidad { get; init; }
}

public sealed class TratamientoFiltroDto
{
    public int? IdConsulta { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed record TratamientoResponseDto(
    int IdTratamiento, int IdConsulta, int IdPaciente, int IdMedico,
    string Descripcion, string? Indicaciones, DateOnly FechaInicio,
    DateOnly? FechaFin, int? IdLote, short? Cantidad);
