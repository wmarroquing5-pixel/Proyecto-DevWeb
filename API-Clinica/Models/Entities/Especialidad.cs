namespace API_Clinica.Models.Entities;

public class Especialidad
{
    public int IdEspecialidad { get; set; }

    public string Nombre { get; set; } = null!;

    public bool Activa { get; set; }
}
