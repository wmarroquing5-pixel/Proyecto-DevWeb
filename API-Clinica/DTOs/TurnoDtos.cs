namespace API_Clinica.DTOs;

public abstract class TurnoDatosRequest
{
    public string Nombre { get; init; } = string.Empty;
    public string Codigo { get; init; } = string.Empty;
    public TimeOnly? HoraEntrada { get; init; }
    public TimeOnly? HoraSalida { get; init; }
    public string Jornada { get; init; } = string.Empty;
}

public sealed class TurnoCreateDto : TurnoDatosRequest;

public sealed class TurnoUpdateDto : TurnoDatosRequest;

public sealed record TurnoResponseDto(
    int IdTurno, string Nombre, string Codigo, TimeOnly HoraEntrada,
    TimeOnly HoraSalida, string Jornada, bool Activo);
