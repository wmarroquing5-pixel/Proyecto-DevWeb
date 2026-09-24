namespace API_Clinica.Models.Entities;

public class Categoria
{
    public int IdCategoria { get; set; }

    public string Nombre { get; set; } = null!;

    public bool Activa { get; set; }
}
