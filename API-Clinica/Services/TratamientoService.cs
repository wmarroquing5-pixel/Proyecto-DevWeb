using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class TratamientoService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator,
    IAccesoActualService accesoActual,
    ConsultaLecturaScope lecturaScope) : ITratamientoService
{
    public async Task<PagedResponse<TratamientoResponseDto>> ListarAsync(
        TratamientoFiltroDto filtro, ClaimsPrincipal principal, CancellationToken ct)
    {
        var idMedico = await lecturaScope.ObtenerMedicoAsync(principal, ct);
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        if (filtro.IdConsulta is <= 0)
            throw Invalid(nameof(filtro.IdConsulta), "La consulta debe ser válida.");
        var query = lecturaScope.TratamientosVisibles(idMedico);
        if (filtro.IdConsulta is int idConsulta)
            query = query.Where(t => t.IdConsulta == idConsulta);

        var total = await query.LongCountAsync(ct);
        var items = await ConConsulta(query.OrderBy(t => t.IdTratamiento)
            .Skip(pagination.Skip).Take(pagination.PageSize)).ToListAsync(ct);
        return new(items, filtro.Page, filtro.PageSize, total);
    }

    public async Task<TratamientoResponseDto> ObtenerAsync(
        int id, ClaimsPrincipal principal, CancellationToken ct)
    {
        var idMedico = await lecturaScope.ObtenerMedicoAsync(principal, ct);
        return await ConConsulta(lecturaScope.TratamientosVisibles(idMedico)
            .Where(t => t.IdTratamiento == id))
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Tratamiento no encontrado.");
    }

    private IQueryable<TratamientoResponseDto> ConConsulta(IQueryable<Tratamiento> query) =>
        query.Join(context.Consultas.AsNoTracking(), t => t.IdConsulta,
            c => c.IdConsulta, (t, c) => new TratamientoResponseDto(
                t.IdTratamiento, t.IdConsulta, c.IdPaciente, c.IdMedico,
                t.Descripcion, t.Indicaciones, t.FechaInicio, t.FechaFin,
                t.IdLote, t.Cantidad));

    public async Task<TratamientoResponseDto> CrearAsync(
        TratamientoCreateDto request, ClaimsPrincipal principal, CancellationToken ct)
    {
        var usuario = await ObtenerUsuarioAsync(principal, ct);
        var datos = ValidarDatos(request.Descripcion, request.Indicaciones,
            request.FechaInicio, request.FechaFin, request.IdLote, request.Cantidad);
        await ValidarConsultaAsync(request.IdConsulta, usuario, ct);
        await ValidarLoteAsync(request.IdLote, ct);

        var tratamiento = new Tratamiento
        {
            IdConsulta = request.IdConsulta,
            Descripcion = datos.Descripcion,
            Indicaciones = datos.Indicaciones,
            FechaInicio = request.FechaInicio,
            FechaFin = request.FechaFin,
            IdLote = request.IdLote,
            Cantidad = datos.Cantidad
        };
        context.Tratamientos.Add(tratamiento);
        await GuardarAsync(ct);
        return await ConConsulta(context.Tratamientos.AsNoTracking()
            .Where(t => t.IdTratamiento == tratamiento.IdTratamiento))
            .SingleAsync(ct);
    }

    public async Task<TratamientoResponseDto> ActualizarAsync(
        int id, TratamientoUpdateDto request, ClaimsPrincipal principal,
        CancellationToken ct)
    {
        var usuario = await ObtenerUsuarioAsync(principal, ct);
        var tratamiento = await context.Tratamientos.SingleOrDefaultAsync(
            t => t.IdTratamiento == id, ct)
            ?? throw new NotFoundException("Tratamiento no encontrado.");
        var datos = ValidarDatos(request.Descripcion, request.Indicaciones,
            request.FechaInicio, request.FechaFin, request.IdLote, request.Cantidad);
        await ValidarConsultaAsync(tratamiento.IdConsulta, usuario, ct);
        await ValidarLoteAsync(request.IdLote, ct);

        // IdConsulta nunca cambia: el paciente y el médico se derivan de esa consulta.
        tratamiento.Descripcion = datos.Descripcion;
        tratamiento.Indicaciones = datos.Indicaciones;
        tratamiento.FechaInicio = request.FechaInicio;
        tratamiento.FechaFin = request.FechaFin;
        tratamiento.IdLote = request.IdLote;
        tratamiento.Cantidad = datos.Cantidad;
        await GuardarAsync(ct);
        return await ConConsulta(context.Tratamientos.AsNoTracking()
            .Where(t => t.IdTratamiento == id)).SingleAsync(ct);
    }

    private async Task<Usuario> ObtenerUsuarioAsync(ClaimsPrincipal principal, CancellationToken ct) =>
        await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
        ?? throw new ForbiddenException("Acceso denegado.");

    private async Task ValidarConsultaAsync(int idConsulta, Usuario usuario, CancellationToken ct)
    {
        if (idConsulta <= 0)
            throw Invalid("IdConsulta", "La consulta debe ser válida.");
        var consulta = await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == idConsulta)
            .Select(c => new { c.IdMedico })
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Consulta no encontrada.");
        if (!await context.Empleados.AsNoTracking().AnyAsync(e =>
            e.IdEmpleado == consulta.IdMedico && e.Activo && e.TipoEmpleado == "Medico", ct))
            throw Invalid("IdMedico", "El médico de la consulta debe existir, estar activo y ser de tipo Medico.");

        if (usuario.IdEmpleado != consulta.IdMedico)
            throw new ForbiddenException("Solo el médico responsable puede registrar este tratamiento.");
    }

    private async Task ValidarLoteAsync(int? idLote, CancellationToken ct)
    {
        if (idLote is int id && !await context.LoteMedicamentos.AsNoTracking()
            .AnyAsync(l => l.IdLote == id, ct))
            throw Invalid("IdLote", "El lote indicado no existe.");
    }

    private static DatosValidados ValidarDatos(
        string? descripcion, string? indicaciones, DateOnly fechaInicio,
        DateOnly? fechaFin, int? idLote, int? cantidad)
    {
        var descripcionNormalizada = Normalizar(descripcion);
        if (descripcionNormalizada.Length == 0)
            throw Invalid("Descripcion", "La descripción es obligatoria.");
        if (descripcionNormalizada.Length > 300)
            throw Invalid("Descripcion", "Máximo 300 caracteres.");
        var indicacionesNormalizadas = Normalizar(indicaciones);
        if (indicacionesNormalizadas.Length > 300)
            throw Invalid("Indicaciones", "Máximo 300 caracteres.");
        if (fechaInicio == default)
            throw Invalid("FechaInicio", "La fecha de inicio es obligatoria.");
        if (fechaFin is DateOnly fin && fin < fechaInicio)
            throw Invalid("FechaFin", "La fecha de fin no puede preceder al inicio.");
        if (idLote is <= 0)
            throw Invalid("IdLote", "Debe ser mayor que cero.");
        if (cantidad.HasValue && cantidad is <= 0 or > short.MaxValue)
            throw Invalid("Cantidad", "Debe estar entre 1 y 32767.");
        return new DatosValidados(descripcionNormalizada,
            indicacionesNormalizadas.Length == 0 ? null : indicacionesNormalizadas,
            cantidad.HasValue ? (short)cantidad.Value : null);
    }

    private static string Normalizar(string? valor) =>
        string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));

    private async Task GuardarAsync(CancellationToken ct)
    {
        try { await context.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number == 547)
        {
            throw new ConflictException("Alguna referencia del tratamiento ya no existe.");
        }
    }

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del tratamiento no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private sealed record DatosValidados(
        string Descripcion, string? Indicaciones, short? Cantidad);
}
