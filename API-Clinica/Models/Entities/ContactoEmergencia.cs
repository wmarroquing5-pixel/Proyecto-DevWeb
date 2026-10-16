namespace API_Clinica.Models.Entities;

public sealed class ContactoEmergencia
{
    public int IdContacto { get; set; }
    public string Nombres { get; set; } = null!;
    public string Apellidos { get; set; } = null!;
    public string Telefono { get; set; } = null!;
    public string Direccion { get; set; } = null!;
    public string? CorreoElectronico { get; set; }
    public string? Parentesco { get; set; }
    public bool Activo { get; set; }
    public int? IdPaciente { get; set; }
}
