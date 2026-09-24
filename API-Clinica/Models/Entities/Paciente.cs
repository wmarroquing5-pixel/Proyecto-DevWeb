namespace API_Clinica.Models.Entities;

public class Paciente
{
    public int IdPaciente { get; set; }

    public string Nombres { get; set; } = null!;

    public string Apellidos { get; set; } = null!;

    public string? DPI { get; set; }

    public DateOnly FechaNacimiento { get; set; }

    public string? Sexo { get; set; }

    public string? Telefono { get; set; }

    public string? Correo { get; set; }

    public DateTime FechaRegistro { get; set; }

    public bool Activo { get; set; }
}
