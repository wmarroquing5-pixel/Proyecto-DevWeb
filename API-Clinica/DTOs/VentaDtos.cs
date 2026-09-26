using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed class CrearVentaRequest
{
    [Range(1, int.MaxValue)]
    public int IdSucursal { get; init; }

    [Required, MinLength(1)]
    public List<CrearVentaItemRequest> Items { get; init; } = [];
}

public sealed class CrearVentaItemRequest
{
    [Range(1, int.MaxValue)]
    public int IdMedicamento { get; init; }

    [Range(1, int.MaxValue)]
    public int Cantidad { get; init; }
}

public sealed record VentaDetalleResponse(
    int IdVentaDetalle, int IdLote, int IdMedicamento,
    int Cantidad, decimal PrecioUnitario, decimal Subtotal);

public sealed record VentaResponse(
    int IdVenta, int IdUsuario, int IdSucursal, DateTime FechaVenta,
    decimal Total, IReadOnlyList<VentaDetalleResponse> Detalles);
