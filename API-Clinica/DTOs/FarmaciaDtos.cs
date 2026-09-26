using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed class GuardarCatalogoFarmaciaRequest
{
    [Required, StringLength(100)]
    public string Nombre { get; init; } = string.Empty;

    public bool? Activa { get; init; }
}

public sealed record CategoriaResponse(int IdCategoria, string Nombre, bool Activa);
public sealed record MarcaResponse(int IdMarca, string Nombre, bool Activa);

public sealed class GuardarMedicamentoRequest
{
    [Range(1, int.MaxValue)]
    public int IdCategoria { get; init; }

    [Range(1, int.MaxValue)]
    public int IdMarca { get; init; }

    [Required, StringLength(50)]
    public string Codigo { get; init; } = string.Empty;

    [Required, StringLength(150)]
    public string Nombre { get; init; } = string.Empty;

    [StringLength(500)]
    public string? Descripcion { get; init; }

    public decimal PrecioVenta { get; init; }

    [StringLength(500)]
    public string? ImagenURL { get; init; }

    public bool? Activo { get; init; }
}

public sealed record MedicamentoResponse(
    int IdMedicamento, int IdCategoria, int IdMarca, string Codigo,
    string Nombre, string? Descripcion, decimal PrecioVenta,
    string? ImagenURL, bool Activo);

public sealed class GuardarLoteMedicamentoRequest
{
    [Range(1, int.MaxValue)]
    public int IdMedicamento { get; init; }

    [Required, StringLength(50)]
    public string NumeroLote { get; init; } = string.Empty;

    public DateOnly FechaIngreso { get; init; }
    public DateOnly FechaVencimiento { get; init; }

    [Range(0, int.MaxValue)]
    public int CantidadDisponible { get; init; }
}

public sealed record LoteMedicamentoResponse(
    int IdLote, int IdMedicamento, string NumeroLote,
    DateOnly FechaIngreso, DateOnly FechaVencimiento, int CantidadDisponible);
