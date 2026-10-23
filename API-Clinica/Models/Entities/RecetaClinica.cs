namespace API_Clinica.Models.Entities;

public sealed class RecetaClinica
{
    public int IdReceta { get; set; }
    public int IdTratamiento { get; set; }
    public int IdDiagnostico { get; set; }
    public int IdUsuarioPrescriptor { get; set; }
    public int? IdRecetaAnterior { get; set; }
    public int NumeroVersion { get; set; }
    public string Estado { get; set; } = null!;
    public DateTime FechaPrescripcionUtc { get; set; }
    public Guid ClaveOperacion { get; set; }
    public byte[] HashSolicitud { get; set; } = null!;
}
