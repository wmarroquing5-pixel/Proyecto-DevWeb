namespace API_Clinica.Models.Entities;

public class AsignacionHabitacion
{
    public int IdAsignacion { get; set; }

    public int IdHabitacion { get; set; }

    public int IdPaciente { get; set; }

    public DateTime FechaIngreso { get; set; }

    public DateTime? FechaEgreso { get; set; }

    public string? Observaciones { get; set; }
}
