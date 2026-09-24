namespace API_Clinica.Models.Entities;

public class LoteMedicamento
{
    public int IdLote { get; set; }

    public int IdMedicamento { get; set; }

    public string NumeroLote { get; set; } = null!;

    public DateOnly FechaIngreso { get; set; }

    public DateOnly FechaVencimiento { get; set; }

    public int CantidadDisponible { get; set; }
}
