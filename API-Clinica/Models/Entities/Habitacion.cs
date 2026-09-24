namespace API_Clinica.Models.Entities;

public class Habitacion
{
    public int IdHabitacion { get; set; }

    public int IdSucursal { get; set; }

    public string NumeroHabitacion { get; set; } = null!;

    public string? TipoHabitacion { get; set; }

    public string Estado { get; set; } = null!;

    public bool Activa { get; set; }
}
