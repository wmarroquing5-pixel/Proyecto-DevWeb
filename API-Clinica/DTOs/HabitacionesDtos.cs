using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed record HabitacionResponse(
    int IdHabitacion, int IdSucursal, string NumeroHabitacion,
    string? TipoHabitacion, string Estado, bool Activa);

public sealed class CrearHabitacionRequest
{
    [Range(1, int.MaxValue)]
    public int IdSucursal { get; init; }

    [Required, StringLength(20)]
    public string NumeroHabitacion { get; init; } = string.Empty;

    [StringLength(50)]
    public string? TipoHabitacion { get; init; }
}

public sealed class ActualizarHabitacionRequest
{
    [Range(1, int.MaxValue)]
    public int IdSucursal { get; init; }

    [Required, StringLength(20)]
    public string NumeroHabitacion { get; init; } = string.Empty;

    [StringLength(50)]
    public string? TipoHabitacion { get; init; }

    public string? Estado { get; init; }
    public bool? Activa { get; init; }
}

public sealed record AsignacionHabitacionResponse(
    int IdAsignacion, int IdHabitacion, int IdPaciente,
    DateTime FechaIngreso, DateTime? FechaEgreso, string? Observaciones);

public sealed class CrearAsignacionHabitacionRequest
{
    [Range(1, int.MaxValue)]
    public int IdHabitacion { get; init; }

    [Range(1, int.MaxValue)]
    public int IdPaciente { get; init; }

    public DateTimeOffset? FechaIngreso { get; init; }
    public string? Observaciones { get; init; }
}

public sealed class ActualizarAsignacionHabitacionRequest
{
    public DateTimeOffset? FechaIngreso { get; init; }
    public string? Observaciones { get; init; }
}
