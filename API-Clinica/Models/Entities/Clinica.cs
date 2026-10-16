namespace API_Clinica.Models.Entities;

public sealed class Clinica
{
    public int IdClinica { get; set; }
    public string NombreClinica { get; set; } = null!;
    public string? Especialidad { get; set; }
    public bool Activa { get; set; }
    public int IdSucursal { get; set; }
}
