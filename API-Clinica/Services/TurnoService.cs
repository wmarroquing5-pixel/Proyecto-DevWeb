using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class TurnoService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : ITurnoService
{
    private static readonly HashSet<string> JornadasPermitidas = ["Diurna", "Nocturna"];

    public async Task<PagedResponse<TurnoResponseDto>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Turnos.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(t => t.IdTurno)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(t => new TurnoResponseDto(t.IdTurno, t.Nombre, t.Codigo,
                t.HoraEntrada, t.HoraSalida, t.Jornada, t.Activo))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<TurnoResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Turnos.AsNoTracking()
            .Where(t => t.IdTurno == id)
            .Select(t => new TurnoResponseDto(t.IdTurno, t.Nombre, t.Codigo,
                t.HoraEntrada, t.HoraSalida, t.Jornada, t.Activo))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Turno no encontrado.");

    public async Task<TurnoResponseDto> CrearAsync(
        TurnoCreateDto request, CancellationToken cancellationToken)
    {
        var turno = new Turno { Activo = true };
        await AplicarDatosAsync(turno, request, cancellationToken);
        context.Turnos.Add(turno);
        await GuardarAsync(cancellationToken);
        return ToResponse(turno);
    }

    public async Task<TurnoResponseDto> ActualizarAsync(
        int id, TurnoUpdateDto request, CancellationToken cancellationToken)
    {
        var turno = await context.Turnos.SingleOrDefaultAsync(
            t => t.IdTurno == id, cancellationToken)
            ?? throw new NotFoundException("Turno no encontrado.");
        await AplicarDatosAsync(turno, request, cancellationToken);
        await GuardarAsync(cancellationToken);
        return ToResponse(turno);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var turno = await context.Turnos.SingleOrDefaultAsync(
            t => t.IdTurno == id, cancellationToken)
            ?? throw new NotFoundException("Turno no encontrado.");
        if (!turno.Activo) return;
        turno.Activo = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task AplicarDatosAsync(
        Turno turno, TurnoDatosRequest request, CancellationToken cancellationToken)
    {
        var nombre = NormalizarEspacios(request.Nombre);
        var codigo = NormalizarEspacios(request.Codigo);
        var jornada = NormalizarEspacios(request.Jornada);
        ValidarLongitud(nombre, "Nombre", 50);
        ValidarLongitud(codigo, "Codigo", 20);
        ValidarLongitud(jornada, "Jornada", 20);
        if (!JornadasPermitidas.Contains(jornada))
            throw Invalid("Jornada", "La jornada no está permitida por la base de datos.");
        if (request.HoraEntrada is null)
            throw Invalid("HoraEntrada", "La hora de entrada es obligatoria.");
        if (request.HoraSalida is null)
            throw Invalid("HoraSalida", "La hora de salida es obligatoria.");
        if (await context.Turnos.AsNoTracking().AnyAsync(
            t => t.Codigo == codigo && t.IdTurno != turno.IdTurno, cancellationToken))
            throw new ConflictException("El código del turno ya está registrado.");

        turno.Nombre = nombre;
        turno.Codigo = codigo;
        turno.HoraEntrada = request.HoraEntrada.Value;
        turno.HoraSalida = request.HoraSalida.Value;
        turno.Jornada = jornada;
    }

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627)
        {
            throw new ConflictException("El código del turno ya está registrado.");
        }
    }

    private static void ValidarLongitud(string valor, string campo, int maximo)
    {
        if (valor.Length is 0 || valor.Length > maximo)
            throw Invalid(campo, $"Debe contener entre 1 y {maximo} caracteres.");
    }

    private static string NormalizarEspacios(string? valor) =>
        string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del turno no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static TurnoResponseDto ToResponse(Turno t) =>
        new(t.IdTurno, t.Nombre, t.Codigo, t.HoraEntrada,
            t.HoraSalida, t.Jornada, t.Activo);
}
