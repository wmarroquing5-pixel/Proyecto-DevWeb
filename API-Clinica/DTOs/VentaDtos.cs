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

public sealed class VentaConsultaFiltroDto
{
    public int? IdVenta { get; init; }
    public DateTime? FechaDesde { get; init; }
    public DateTime? FechaHasta { get; init; }
    public int? IdSucursal { get; init; }
    public int? IdPaciente { get; init; }
    public int? IdUsuario { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed record VentaConsultaResumenResponse(
    int IdVenta, int IdUsuario, int IdSucursal, int? IdPaciente,
    DateTime FechaVenta, decimal Total);

public sealed record VentaConsultaDetalleResponse(
    int IdDetalle, int? IdLote, int? IdMedicamento, int? IdServicio,
    int Cantidad, decimal PrecioUnitario, decimal Subtotal);

public sealed record VentaConsultaResponse(
    int IdVenta, int IdUsuario, int IdSucursal, int? IdPaciente,
    DateTime FechaVenta, string TipoFactura, decimal Total,
    IReadOnlyList<VentaConsultaDetalleResponse> Detalles);
