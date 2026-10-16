namespace API_Clinica.Models.Entities;

public sealed class Turno
{
    public int IdTurno { get; set; }
    public string Nombre { get; set; } = null!;
    public string Codigo { get; set; } = null!;
    public TimeOnly HoraEntrada { get; set; }
    public TimeOnly HoraSalida { get; set; }
    public string Jornada { get; set; } = null!;
    public bool Activo { get; set; }
}
