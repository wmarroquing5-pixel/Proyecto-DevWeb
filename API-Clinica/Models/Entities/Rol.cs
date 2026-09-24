namespace API_Clinica.Models.Entities;

public class Rol
{
    public int IdRol { get; set; }

    public string Nombre { get; set; } = null!;

    public bool Activo { get; set; }
}
