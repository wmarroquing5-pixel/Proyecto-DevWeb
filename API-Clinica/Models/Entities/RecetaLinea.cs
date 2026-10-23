namespace API_Clinica.Models.Entities;

public sealed class RecetaLinea
{
    public int IdRecetaLinea { get; set; }
    public int IdReceta { get; set; }
    public int IdMedicamento { get; set; }
    public short Orden { get; set; }
    public int CantidadPrescritaUnidades { get; set; }
    public string? UnidadInventario { get; set; }
    public decimal? Dosis { get; set; }
    public string? UnidadDosis { get; set; }
    public string? Via { get; set; }
    public string? Frecuencia { get; set; }
    public short? DuracionDias { get; set; }
    public string? Indicaciones { get; set; }
    public decimal? ContenidoPorUnidad { get; set; }
    public string? UnidadContenido { get; set; }
    public string? FuenteEquivalencia { get; set; }
    public string? VersionEquivalencia { get; set; }
    public int? IdUsuarioValidador { get; set; }
    public DateTime? FechaValidacionUtc { get; set; }
}
