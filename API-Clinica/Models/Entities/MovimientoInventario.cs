namespace API_Clinica.Models.Entities;

public sealed class MovimientoInventario
{
    public int IdMovimiento { get; set; }
    public int IdLote { get; set; }
    public int IdUsuario { get; set; }
    public int IdSucursal { get; set; }
    public string TipoMovimiento { get; set; } = null!;
    public int Cantidad { get; set; }
    public DateTime FechaMovimiento { get; set; }
    public string? Observaciones { get; set; }
}
