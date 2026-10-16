namespace API_Clinica.DTOs;

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
