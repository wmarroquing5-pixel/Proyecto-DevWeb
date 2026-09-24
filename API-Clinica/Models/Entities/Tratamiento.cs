namespace API_Clinica.Models.Entities;

public class Tratamiento
{
    public int IdTratamiento { get; set; }

    public int IdConsulta { get; set; }

    public int IdMedico { get; set; }

    public string Descripcion { get; set; } = null!;

    public string? Indicaciones { get; set; }

    public DateOnly FechaInicio { get; set; }

    public DateOnly? FechaFin { get; set; }
}
