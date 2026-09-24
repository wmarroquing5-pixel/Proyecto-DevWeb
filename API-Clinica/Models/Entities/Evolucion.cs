namespace API_Clinica.Models.Entities;

public class Evolucion
{
    public int IdEvolucion { get; set; }

    public int IdPaciente { get; set; }

    public int? IdConsulta { get; set; }

    public int IdMedico { get; set; }

    public DateTime FechaEvolucion { get; set; }

    public string Descripcion { get; set; } = null!;
}
