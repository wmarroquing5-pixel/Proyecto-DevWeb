namespace API_Clinica.DTOs;

public sealed class CrearFacturaServiciosRequest
{
    public int IdSucursal { get; init; }
    public int IdPaciente { get; init; }
    public string? Nit { get; init; }
    public string? NombreFacturacion { get; init; }
    public List<CrearFacturaServicioItemRequest> Servicios { get; init; } = [];
    public List<CrearFacturaMedicamentoItemRequest> Medicamentos { get; init; } = [];
}

public sealed class CrearFacturaServicioItemRequest
{
    public int IdServicio { get; init; }
    public int Cantidad { get; init; }
}

public sealed class CrearFacturaMedicamentoItemRequest
{
    public int IdMedicamento { get; init; }
    public int Cantidad { get; init; }
}

public sealed record FacturaServicioDetalleResponse(
    int IdDetalle, int? IdServicio, int Cantidad,
    decimal PrecioUnitario, decimal Subtotal)
{
    public int? IdLote { get; init; }
    public int? IdMedicamento { get; init; }
}

public sealed record FacturaServiciosResponse(
    int IdFactura, int IdUsuario, int IdSucursal, int IdPaciente,
    DateTime FechaFactura, string TipoFactura,
    string? Nit, string? NombreFacturacion, decimal Total,
    IReadOnlyList<FacturaServicioDetalleResponse> Detalles);

public sealed class FacturaConsultaFiltroDto
{
    public int? IdFactura { get; init; }
    public DateTime? FechaDesde { get; init; }
    public DateTime? FechaHasta { get; init; }
    public int? IdSucursal { get; init; }
    public int? IdPaciente { get; init; }
    public int? IdUsuario { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed record FacturaConsultaResumenResponse(
    int IdFactura, int IdUsuario, int IdSucursal, int? IdPaciente,
    DateTime FechaFactura, string TipoFactura, string? Nit,
    string? NombreFacturacion, decimal Total);

public sealed record FacturaConsultaResponse(
    int IdFactura, int IdUsuario, int IdSucursal, int? IdPaciente,
    DateTime FechaFactura, string TipoFactura, string? Nit,
    string? NombreFacturacion, decimal Total,
    IReadOnlyList<FacturaServicioDetalleResponse> Detalles);
