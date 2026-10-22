using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public abstract class ConsultaDatosRequest
{
    [Range(1, int.MaxValue)]
    public int IdPaciente { get; init; }

    // Si el usuario está vinculado a un médico, el servicio obtiene su IdEmpleado.
    [Range(1, int.MaxValue)]
    public int? IdMedico { get; init; }

    [Range(1, int.MaxValue)]
    public int IdSucursal { get; init; }

    public int? IdClinica { get; init; }

    public DateTime FechaConsulta { get; init; }

    [StringLength(300)]
    public string? MotivoConsulta { get; init; }

    [StringLength(300)]
    public string? Sintomas { get; init; }

    [StringLength(300)]
    public string? Observaciones { get; init; }

    public double? PesoLb { get; init; }

    public double? PresionDiastolica { get; init; }

    public double? PresionSistolica { get; init; }

    public int? AlturaCm { get; init; }
}

public sealed class ConsultaCreateDto : ConsultaDatosRequest;

public sealed class ConsultaUpdateDto : ConsultaDatosRequest;

public sealed class ConsultaFiltroDto
{
    public int? IdPaciente { get; init; }
    public int? IdMedico { get; init; }
    public int? IdSucursal { get; init; }
    public int? IdClinica { get; init; }
    public DateTime? Desde { get; init; }
    public DateTime? Hasta { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed record ConsultaListadoDto(
    int IdConsulta, int IdPaciente, int IdMedico, int IdSucursal,
    int? IdClinica, DateTime FechaConsulta);

public sealed record ConsultaDetalleDto(
    int IdConsulta, int IdPaciente, int IdMedico, int IdSucursal,
    int? IdClinica, DateTime FechaConsulta, string? MotivoConsulta,
    string? Sintomas, string? Observaciones, double? PesoLb,
    double? PresionDiastolica, double? PresionSistolica, int? AlturaCm);
