using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed class CrearDiagnosticoRequest
{
    [Range(1, int.MaxValue)]
    public int IdConsulta { get; init; }

    [Range(1, int.MaxValue)]
    public int? IdMedico { get; init; }

    [Required, StringLength(300)]
    public string Descripcion { get; init; } = string.Empty;
}

public sealed class DiagnosticoFiltroDto
{
    public int? IdConsulta { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

// La asociación clínica y la fecha de registro no se pueden cambiar por esta operación.
public sealed class ActualizarDiagnosticoRequest
{
    [Required, StringLength(300)]
    public string Descripcion { get; init; } = string.Empty;
}

public sealed record DiagnosticoResponse(
    int IdDiagnostico, int IdConsulta, int IdMedico,
    string Descripcion, DateTime FechaRegistro);
