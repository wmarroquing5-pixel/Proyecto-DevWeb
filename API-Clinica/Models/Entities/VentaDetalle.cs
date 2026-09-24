namespace API_Clinica.Models.Entities;

public class VentaDetalle
{
    public int IdVentaDetalle { get; set; }

    public int IdVenta { get; set; }

    public int IdLote { get; set; }

    public int Cantidad { get; set; }

    public decimal PrecioUnitario { get; set; }

    public decimal Subtotal { get; set; }
}
