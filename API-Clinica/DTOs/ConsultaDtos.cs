using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

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

    private decimal? temperaturaC;
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public decimal? TemperaturaC
    {
        get => temperaturaC;
        init { temperaturaC = value; TemperaturaCEnviada = true; }
    }

    private short? frecuenciaCardiaca;
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)]
    public short? FrecuenciaCardiaca
    {
        get => frecuenciaCardiaca;
        init { frecuenciaCardiaca = value; FrecuenciaCardiacaEnviada = true; }
    }

    [JsonIgnore]
    public bool TemperaturaCEnviada { get; private set; }

    [JsonIgnore]
    public bool FrecuenciaCardiacaEnviada { get; private set; }
}

public sealed class ConsultaCreateDto : ConsultaDatosRequest;

public sealed class ConsultaUpdateDto : ConsultaDatosRequest;

public sealed class RegistrarEvaluacionConsultaRequest
{
    [StringLength(300)]
    public string? Sintomas { get; init; }

    [StringLength(300)]
    public string? Observaciones { get; init; }

    public double? PesoLb { get; init; }
    public int? AlturaCm { get; init; }
    public double? PresionSistolica { get; init; }
    public double? PresionDiastolica { get; init; }
    public decimal? TemperaturaC { get; init; }
    public short? FrecuenciaCardiaca { get; init; }
}

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
    int? IdClinica, DateTime FechaConsulta)
{
    public string? EstadoConsulta { get; init; }
    public string? MotivoConsulta { get; init; }
    public string? NombrePaciente { get; init; }
    public string? NombreMedico { get; init; }
    public string? NombreSucursal { get; init; }
    public string? NombreClinica { get; init; }
}

public sealed record ConsultaDetalleDto(
    int IdConsulta, int IdPaciente, int IdMedico, int IdSucursal,
    int? IdClinica, DateTime FechaConsulta, string? MotivoConsulta,
    string? Sintomas, string? Observaciones, double? PesoLb,
    double? PresionDiastolica, double? PresionSistolica, int? AlturaCm)
{
    public string? EstadoConsulta { get; init; }
    public decimal? TemperaturaC { get; init; }
    public short? FrecuenciaCardiaca { get; init; }
}
