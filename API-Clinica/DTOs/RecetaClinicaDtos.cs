using System.Text.Json.Serialization;

namespace API_Clinica.DTOs;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class CrearRecetaClinicaRequest
{
    public int IdConsulta { get; init; }
    public int IdDiagnostico { get; init; }
    public Guid ClaveOperacion { get; init; }
    public string DescripcionTratamiento { get; init; } = string.Empty;
    public string? IndicacionesGenerales { get; init; }
    public DateOnly FechaInicio { get; init; }
    public DateOnly? FechaFin { get; init; }
    public IReadOnlyList<RecetaLineaCrearRequest> Lineas { get; init; } = [];
}

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class RecetaLineaCrearRequest
{
    public int IdMedicamento { get; init; }
    public int CantidadPrescritaUnidades { get; init; }
}

// Reservado para una posible edición de borradores. No puede activarse con el
// modelo C actual sin aprobar estados, inmutabilidad e idempotencia de adiciones.
[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class AgregarMedicamentosRecetaRequest
{
    public Guid ClaveOperacion { get; init; }
    public IReadOnlyList<RecetaLineaCrearRequest> Lineas { get; init; } = [];
}

public sealed record RecetaLineaDetalleDto(
    int IdRecetaLinea, int Orden, int IdMedicamento, string NombreMedicamento,
    string Presentacion, int CantidadPrescritaUnidades);

public sealed record RecetaClinicaDetalleDto(
    int IdReceta, int IdConsulta, int IdTratamiento, string DescripcionTratamiento,
    string? IndicacionesGenerales, DateOnly FechaInicio, DateOnly? FechaFin,
    int IdDiagnostico, string DescripcionDiagnostico, int NumeroVersion, string Estado,
    int IdUsuarioPrescriptor, DateTime FechaPrescripcionUtc,
    IReadOnlyList<RecetaLineaDetalleDto> Lineas);

public sealed record RecetaClinicaResumenDto(
    int IdReceta, int IdConsulta, int IdTratamiento, string DescripcionTratamiento,
    DateOnly FechaInicio, DateOnly? FechaFin,
    int IdDiagnostico, string DescripcionDiagnostico, int NumeroVersion, string Estado,
    DateTime FechaPrescripcionUtc, int CantidadLineas);
