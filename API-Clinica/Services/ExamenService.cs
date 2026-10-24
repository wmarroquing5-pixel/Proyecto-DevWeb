using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class ExamenService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator,
    IAccesoActualService accesoActual,
    ConsultaLecturaScope lecturaScope) : IExamenService
{
    public async Task<PagedResponse<ExamenResponseDto>> ListarAsync(
        ExamenFiltroDto filtro, ClaimsPrincipal principal, CancellationToken ct)
    {
        var idMedico = await lecturaScope.ObtenerMedicoAsync(principal, ct);
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        ValidarId(filtro.IdConsulta, nameof(filtro.IdConsulta));
        ValidarId(filtro.IdDiagnostico, nameof(filtro.IdDiagnostico));
        var query = lecturaScope.ExamenesVisibles(idMedico);
        if (filtro.IdConsulta is int idConsulta)
            query = query.Where(e => e.IdConsulta == idConsulta);
        if (filtro.IdDiagnostico is int idDiagnostico)
            query = query.Where(e => e.IdDiagnostico == idDiagnostico);

        var total = await query.LongCountAsync(ct);
        var examenes = await query.OrderBy(e => e.IdExamen)
            .Skip(pagination.Skip).Take(pagination.PageSize).ToListAsync(ct);
        return new(await MapearAsync(examenes, ct), filtro.Page, filtro.PageSize, total);
    }

    public async Task<ExamenResponseDto> ObtenerAsync(
        int id, ClaimsPrincipal principal, CancellationToken ct)
    {
        var idMedico = await lecturaScope.ObtenerMedicoAsync(principal, ct);
        var examen = await lecturaScope.ExamenesVisibles(idMedico)
            .SingleOrDefaultAsync(e => e.IdExamen == id, ct)
            ?? throw new NotFoundException("Examen no encontrado.");
        return (await MapearAsync([examen], ct))[0];
    }

    public async Task<ExamenResponseDto> CrearAsync(
        ExamenCreateDto request, ClaimsPrincipal principal, CancellationToken ct)
    {
        var usuario = await ObtenerUsuarioAsync(principal, ct);
        var nombre = ValidarNombre(request.NombreExamen);
        var prioridad = ValidarDatos(request.FechaExamen, request.FechaResultado,
            request.Prioridad);
        await ValidarRelacionesAsync(request.IdConsulta, request.IdDiagnostico,
            request.IdTurno, usuario, ct);

        var examen = new Examen
        {
            IdConsulta = request.IdConsulta,
            IdDiagnostico = request.IdDiagnostico,
            IdTurno = request.IdTurno,
            NombreExamen = nombre,
            FechaExamen = request.FechaExamen,
            FechaResultado = request.FechaResultado,
            Prioridad = prioridad
        };
        context.Examenes.Add(examen);
        await GuardarAsync(ct);
        return (await MapearAsync([examen], ct))[0];
    }

    public async Task<ExamenResponseDto> ActualizarAsync(
        int id, ExamenUpdateDto request, ClaimsPrincipal principal, CancellationToken ct)
    {
        var usuario = await ObtenerUsuarioAsync(principal, ct);
        var examen = await context.Examenes.SingleOrDefaultAsync(e => e.IdExamen == id, ct)
            ?? throw new NotFoundException("Examen no encontrado.");
        var nombre = ValidarNombre(request.NombreExamen);
        var prioridad = ValidarDatos(request.FechaExamen, request.FechaResultado,
            request.Prioridad);
        await ValidarRelacionesAsync(examen.IdConsulta, examen.IdDiagnostico,
            request.IdTurno, usuario, ct);

        // IdConsulta e IdDiagnostico son inmutables para no cambiar la atribución histórica.
        examen.IdTurno = request.IdTurno;
        examen.NombreExamen = nombre;
        examen.FechaExamen = request.FechaExamen;
        examen.FechaResultado = request.FechaResultado;
        examen.Prioridad = prioridad;
        await GuardarAsync(ct);
        return (await MapearAsync([examen], ct))[0];
    }

    private async Task<Usuario> ObtenerUsuarioAsync(ClaimsPrincipal principal, CancellationToken ct) =>
        await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
        ?? throw new ForbiddenException("Acceso denegado.");

    private async Task ValidarRelacionesAsync(
        int? idConsulta, int? idDiagnostico, int? idTurno, Usuario usuario,
        CancellationToken ct)
    {
        ValidarId(idConsulta, nameof(idConsulta));
        ValidarId(idDiagnostico, nameof(idDiagnostico));
        ValidarId(idTurno, nameof(idTurno));
        if (idTurno is int turno && !await context.Turnos.AsNoTracking()
            .AnyAsync(t => t.IdTurno == turno, ct))
            throw Invalid("IdTurno", "El turno indicado no existe.");

        int? consultaDiagnostico = null;
        if (idDiagnostico is int diagnostico)
        {
            consultaDiagnostico = await context.Diagnosticos.AsNoTracking()
                .Where(d => d.IdDiagnostico == diagnostico)
                .Select(d => (int?)d.IdConsulta).SingleOrDefaultAsync(ct)
                ?? throw Invalid("IdDiagnostico", "El diagnóstico indicado no existe.");
        }
        if (idConsulta is int directa && consultaDiagnostico is int derivada &&
            directa != derivada)
            throw Invalid("IdDiagnostico", "El diagnóstico debe corresponder a la consulta.");

        var consultaEfectiva = idConsulta ?? consultaDiagnostico;
        if (consultaEfectiva is not int idClinico) return;
        var consulta = await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == idClinico)
            .Select(c => new { c.IdMedico })
            .SingleOrDefaultAsync(ct)
            ?? throw Invalid("IdConsulta", "La consulta indicada no existe.");
        if (!await context.Empleados.AsNoTracking().AnyAsync(e =>
            e.IdEmpleado == consulta.IdMedico && e.Activo && e.TipoEmpleado == "Medico", ct))
            throw Invalid("IdMedico", "El médico de la consulta debe existir, estar activo y ser de tipo Medico.");

        if (usuario.IdEmpleado is int idEmpleado &&
            await context.Empleados.AsNoTracking().AnyAsync(e =>
                e.IdEmpleado == idEmpleado && e.TipoEmpleado == "Medico", ct) &&
            idEmpleado != consulta.IdMedico)
            throw new ForbiddenException("No puede registrar un examen para otro médico.");
    }

    private async Task<IReadOnlyList<ExamenResponseDto>> MapearAsync(
        IReadOnlyList<Examen> examenes, CancellationToken ct)
    {
        if (examenes.Count == 0) return [];
        var diagnosticoIds = examenes.Where(e => e.IdDiagnostico.HasValue)
            .Select(e => e.IdDiagnostico!.Value).Distinct().ToArray();
        var diagnosticos = await context.Diagnosticos.AsNoTracking()
            .Where(d => diagnosticoIds.Contains(d.IdDiagnostico))
            .Select(d => new { d.IdDiagnostico, d.IdConsulta })
            .ToDictionaryAsync(d => d.IdDiagnostico, d => d.IdConsulta, ct);
        var consultaIds = examenes.Where(e => e.IdConsulta.HasValue)
            .Select(e => e.IdConsulta!.Value)
            .Concat(diagnosticos.Values).Distinct().ToArray();
        var consultas = await context.Consultas.AsNoTracking()
            .Where(c => consultaIds.Contains(c.IdConsulta))
            .Select(c => new { c.IdConsulta, c.IdPaciente, c.IdMedico })
            .ToDictionaryAsync(c => c.IdConsulta, ct);

        var result = new List<ExamenResponseDto>(examenes.Count);
        foreach (var examen in examenes)
        {
            int? desdeDiagnostico = null;
            if (examen.IdDiagnostico is int idDiagnostico)
            {
                if (!diagnosticos.TryGetValue(idDiagnostico, out var idConsultaDiagnostico))
                    throw new ConflictException("El diagnóstico del examen no existe.");
                desdeDiagnostico = idConsultaDiagnostico;
            }
            if (examen.IdConsulta is int directa && desdeDiagnostico is int derivada &&
                directa != derivada)
                throw new ConflictException("La consulta y el diagnóstico del examen no corresponden.");
            var idConsulta = examen.IdConsulta ?? desdeDiagnostico;
            int? idPaciente = null;
            int? idMedico = null;
            if (idConsulta is int id)
            {
                if (!consultas.TryGetValue(id, out var consulta))
                    throw new ConflictException("La consulta del examen no existe.");
                idPaciente = consulta.IdPaciente;
                idMedico = consulta.IdMedico;
            }
            result.Add(new ExamenResponseDto(examen.IdExamen, examen.IdConsulta,
                examen.IdDiagnostico, examen.IdTurno, examen.NombreExamen,
                examen.FechaExamen, examen.FechaResultado, examen.Prioridad,
                idPaciente, idMedico));
        }
        return result;
    }

    private async Task GuardarAsync(CancellationToken ct)
    {
        try { await context.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number == 547)
        {
            throw new ConflictException("Alguna referencia del examen ya no existe.");
        }
    }

    private static string ValidarNombre(string? value)
    {
        var nombre = string.Join(' ', (value ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));
        if (nombre.Length == 0)
            throw Invalid("NombreExamen", "El nombre del examen es obligatorio.");
        if (nombre.Length > 200)
            throw Invalid("NombreExamen", "Máximo 200 caracteres.");
        return nombre;
    }

    private static string? ValidarDatos(
        DateTime fechaExamen, DateOnly? fechaResultado, string? prioridad)
    {
        if (fechaExamen == default)
            throw Invalid("FechaExamen", "La fecha del examen es obligatoria.");
        if (fechaResultado is DateOnly fecha &&
            fecha < DateOnly.FromDateTime(fechaExamen))
            throw Invalid("FechaResultado", "La fecha del resultado no puede preceder al examen.");
        var normalizada = prioridad?.Trim();
        if (string.IsNullOrEmpty(normalizada)) return null;
        if (normalizada is not ("Baja" or "Media" or "Alta"))
            throw Invalid("Prioridad", "Debe ser Baja, Media o Alta.");
        return normalizada;
    }

    private static void ValidarId(int? id, string campo)
    {
        if (id is <= 0)
            throw Invalid(campo, "Debe ser mayor que cero.");
    }

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del examen no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });
}
