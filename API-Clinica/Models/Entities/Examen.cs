namespace API_Clinica.Models.Entities;

public class Examen
{
    public int IdExamen { get; set; }

    public int IdPaciente { get; set; }

    public int? IdConsulta { get; set; }

    public int? IdDiagnostico { get; set; }

    public int? IdTurno { get; set; }

    public int IdMedico { get; set; }

    public string NombreExamen { get; set; } = null!;

    public DateTime FechaExamen { get; set; }

    public DateOnly? FechaResultado { get; set; }

    public string? Prioridad { get; set; }

    public string? Resultado { get; set; }
}
