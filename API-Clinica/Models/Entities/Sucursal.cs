namespace API_Clinica.Models.Entities;

public class Sucursal
{
    public int IdSucursal { get; set; }

    public string Nombre { get; set; } = null!;

    public string? Direccion { get; set; }

    public bool Activa { get; set; }
}
