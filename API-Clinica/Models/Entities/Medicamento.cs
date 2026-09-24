namespace API_Clinica.Models.Entities;

public class Medicamento
{
    public int IdMedicamento { get; set; }

    public int IdCategoria { get; set; }

    public int IdMarca { get; set; }

    public string Codigo { get; set; } = null!;

    public string Nombre { get; set; } = null!;

    public string? Descripcion { get; set; }

    public decimal PrecioVenta { get; set; }

    public string? ImagenURL { get; set; }

    public bool Activo { get; set; }
}
