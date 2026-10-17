using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace API_Clinica.DTOs;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public sealed class ConsumoClinicoCreateDto
{
    [Range(1, int.MaxValue)]
    public int Cantidad { get; init; }
}

public sealed record ConsumoClinicoResponseDto(
    int IdMovimiento, int IdTratamiento, int IdLote,
    int Cantidad, int IdSucursal, DateTime FechaMovimiento);
