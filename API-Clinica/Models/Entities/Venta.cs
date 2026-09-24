namespace API_Clinica.Models.Entities;

public class Venta
{
    public int IdVenta { get; set; }

    public int IdUsuario { get; set; }

    public int IdSucursal { get; set; }

    public DateTime FechaVenta { get; set; }

    public decimal Total { get; set; }
}
