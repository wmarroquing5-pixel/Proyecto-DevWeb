namespace API_Clinica.Models.Entities;

public class Empleado
{
    public int IdEmpleado { get; set; }

    public int IdSucursal { get; set; }

    public int? IdEspecialidad { get; set; }

    public string Nombres { get; set; } = null!;

    public string Apellidos { get; set; } = null!;

    public string DPI { get; set; } = null!;

    public string TipoEmpleado { get; set; } = null!;

    public bool Activo { get; set; }
}
