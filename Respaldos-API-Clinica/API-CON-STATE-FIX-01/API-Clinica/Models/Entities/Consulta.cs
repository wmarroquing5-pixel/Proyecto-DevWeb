namespace API_Clinica.Models.Entities;

public class Consulta
{
    public int IdConsulta { get; set; }

    public int IdPaciente { get; set; }

    public int IdMedico { get; set; }

    public int IdSucursal { get; set; }

    public DateTime FechaConsulta { get; set; }

    public string? MotivoConsulta { get; set; }

    public string? Sintomas { get; set; }

    public string? Observaciones { get; set; }

    public string? EstadoConsulta { get; set; }

    public double? PesoLb { get; set; }

    public double? PresionDiastolica { get; set; }

    public double? PresionSistolica { get; set; }

    public int? AlturaCm { get; set; }

    public decimal? TemperaturaC { get; set; }

    public short? FrecuenciaCardiaca { get; set; }

    public int? IdClinica { get; set; }
}
