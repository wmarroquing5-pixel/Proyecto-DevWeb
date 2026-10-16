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

    public DateOnly? FechaIngreso { get; set; }

    public string? TipoSangre { get; set; }

    public int? IdTurno { get; set; }

    public string? Direccion { get; set; }

    public string? Telefono { get; set; }

    public string? CorreoElectronico { get; set; }
}
