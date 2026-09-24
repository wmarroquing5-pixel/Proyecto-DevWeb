namespace API_Clinica.Models.Entities;

public class Usuario
{
    public int IdUsuario { get; set; }

    public int IdRol { get; set; }

    public int? IdEmpleado { get; set; }

    public string Username { get; set; } = null!;

    public string PasswordHash { get; set; } = null!;

    public bool Activo { get; set; }
}
