namespace API_Clinica.Models.Entities;

public class Diagnostico
{
    public int IdDiagnostico { get; set; }

    public int IdConsulta { get; set; }

    public int IdMedico { get; set; }

    public string Descripcion { get; set; } = null!;

    public DateTime FechaRegistro { get; set; }
}
