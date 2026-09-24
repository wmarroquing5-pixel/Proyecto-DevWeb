namespace API_Clinica.Models.Entities;

public class Bitacora
{
    public int IdBitacora { get; set; }

    public int? IdUsuario { get; set; }

    public string TablaAfectada { get; set; } = null!;

    public string Accion { get; set; } = null!;

    public string RegistroId { get; set; } = null!;

    public string? ValoresAnteriores { get; set; }

    public string? ValoresNuevos { get; set; }

    public DateTime Fecha { get; set; }
}
