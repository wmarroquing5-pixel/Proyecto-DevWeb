namespace API_Clinica.Models.Entities;

public class Marca
{
    public int IdMarca { get; set; }

    public string Nombre { get; set; } = null!;

    public bool Activa { get; set; }
}
