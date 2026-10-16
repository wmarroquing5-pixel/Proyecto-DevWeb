namespace API_Clinica.DTOs;

public abstract class ServicioDatosRequest
{
    public string Codigo { get; init; } = string.Empty;
    public string Nombre { get; init; } = string.Empty;
    public string? Descripcion { get; init; }
    public decimal PrecioBase { get; init; }
    public string TipoServicio { get; init; } = string.Empty;
}

public sealed class ServicioCreateDto : ServicioDatosRequest;

public sealed class ServicioUpdateDto : ServicioDatosRequest;

public sealed record ServicioResponseDto(
    int IdServicio, string Codigo, string Nombre, string? Descripcion,
    decimal PrecioBase, string TipoServicio, bool Activo);
