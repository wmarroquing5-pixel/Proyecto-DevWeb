namespace API_Clinica.Models.Entities;

public sealed class Servicio
{
    public int IdServicio { get; set; }
    public string Codigo { get; set; } = null!;
    public string Nombre { get; set; } = null!;
    public string? Descripcion { get; set; }
    public decimal PrecioBase { get; set; }
    public string TipoServicio { get; set; } = null!;
    public bool Activo { get; set; }
}
