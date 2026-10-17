using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class HistorialMedicoService(
    ClinicaDbContext context,
    HistorialMedicoLecturaService lectura,
    ICommonParameterValidator parameterValidator,
    IAccesoActualService accesoActual) : IHistorialMedicoService
{
    public async Task<HistorialMedicoResponseDto> CrearAsync(
        HistorialMedicoCreateDto request, ClaimsPrincipal principal, CancellationToken ct)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
            ?? throw new ForbiddenException("Acceso denegado.");
        var idMedico = await ObtenerMedicoActualAsync(usuario, ct);
        var descripcion = ValidarDescripcion(request.Descripcion);

        if (request.IdPaciente <= 0)
            throw Invalid(nameof(request.IdPaciente), "Debe indicar un paciente válido.");
        if (request.IdConsulta <= 0)
            throw Invalid(nameof(request.IdConsulta), "Debe indicar una consulta válida.");
        if (request.IdDiagnostico is <= 0)
            throw Invalid(nameof(request.IdDiagnostico),
                "Debe indicar un diagnóstico válido.");

        var pacienteActivo = await context.Pacientes.AsNoTracking()
            .Where(p => p.IdPaciente == request.IdPaciente)
            .Select(p => (bool?)p.Activo)
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Paciente no encontrado.");
        if (!pacienteActivo)
            throw new BusinessRuleException("El paciente no está activo.");

        var consulta = await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == request.IdConsulta)
            .Select(c => new { c.IdPaciente, c.IdMedico })
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Consulta no encontrada.");
        if (consulta.IdPaciente != request.IdPaciente)
            throw Invalid(nameof(request.IdPaciente),
                "La consulta debe corresponder al paciente indicado.");
        if (consulta.IdMedico != idMedico)
            throw new ForbiddenException(
                "No puede registrar una evolución para una consulta de otro médico.");

        if (request.IdDiagnostico is int idDiagnostico)
        {
            var idConsultaDiagnostico = await context.Diagnosticos.AsNoTracking()
                .Where(d => d.IdDiagnostico == idDiagnostico)
                .Select(d => (int?)d.IdConsulta)
                .SingleOrDefaultAsync(ct)
                ?? throw new NotFoundException("Diagnóstico no encontrado.");
            if (idConsultaDiagnostico != request.IdConsulta)
                throw Invalid(nameof(request.IdDiagnostico),
                    "El diagnóstico debe corresponder a la consulta indicada.");
        }

        var historial = new Evolucion
        {
            IdConsulta = request.IdConsulta,
            IdDiagnostico = request.IdDiagnostico,
            FechaEvolucion = DateTime.UtcNow,
            Descripcion = descripcion
        };
        context.HistorialesMedicos.Add(historial);
        try
        {
            await context.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number == 547)
        {
            throw new ConflictException(
                "Alguna referencia clínica dejó de existir durante el registro.");
        }

        return (await MapearAsync([historial], ct))[0];
    }

    public async Task<PagedResponse<HistorialMedicoResponseDto>> ListarAsync(
        HistorialMedicoFiltroDto filtro, CancellationToken ct)
    {
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        ValidarId(filtro.IdConsulta, nameof(filtro.IdConsulta));
        ValidarId(filtro.IdDiagnostico, nameof(filtro.IdDiagnostico));
        ValidarId(filtro.IdPaciente, nameof(filtro.IdPaciente));

        var query = context.HistorialesMedicos.AsNoTracking();
        if (filtro.IdConsulta is int idConsulta)
        {
            var diagnosticos = context.Diagnosticos.AsNoTracking()
                .Where(d => d.IdConsulta == idConsulta)
                .Select(d => d.IdDiagnostico);
            query = query.Where(h => h.IdConsulta == idConsulta ||
                h.IdConsulta == null && h.IdDiagnostico.HasValue &&
                diagnosticos.Contains(h.IdDiagnostico.Value));
        }
        if (filtro.IdDiagnostico is int idDiagnostico)
            query = query.Where(h => h.IdDiagnostico == idDiagnostico);
        if (filtro.IdPaciente is int idPaciente)
        {
            var consultas = context.Consultas.AsNoTracking()
                .Where(c => c.IdPaciente == idPaciente).Select(c => c.IdConsulta);
            var diagnosticos = context.Diagnosticos.AsNoTracking()
                .Where(d => consultas.Contains(d.IdConsulta))
                .Select(d => d.IdDiagnostico);
            query = query.Where(h => h.IdConsulta.HasValue &&
                consultas.Contains(h.IdConsulta.Value) ||
                h.IdConsulta == null && h.IdDiagnostico.HasValue &&
                diagnosticos.Contains(h.IdDiagnostico.Value));
        }

        var total = await query.LongCountAsync(ct);
        var historiales = await query.OrderBy(h => h.IdEvolucion)
            .Skip(pagination.Skip).Take(pagination.PageSize).ToListAsync(ct);
        return new(await MapearAsync(historiales, ct), filtro.Page, filtro.PageSize, total);
    }

    public async Task<HistorialMedicoResponseDto> ObtenerAsync(int id, CancellationToken ct)
    {
        var historial = await context.HistorialesMedicos.AsNoTracking()
            .SingleOrDefaultAsync(h => h.IdEvolucion == id, ct)
            ?? throw new NotFoundException("Historial médico no encontrado.");
        return (await MapearAsync([historial], ct))[0];
    }

    private async Task<IReadOnlyList<HistorialMedicoResponseDto>> MapearAsync(
        IReadOnlyList<Evolucion> historiales, CancellationToken ct)
    {
        var atribuciones = await lectura.ObtenerAtribucionesAsync(historiales, ct);
        var result = new List<HistorialMedicoResponseDto>(historiales.Count);
        for (var i = 0; i < historiales.Count; i++)
        {
            var historial = historiales[i];
            var atribucion = atribuciones[i];
            result.Add(new HistorialMedicoResponseDto(historial.IdEvolucion,
                atribucion.IdConsulta, historial.IdDiagnostico,
                atribucion.IdPaciente, atribucion.IdMedico,
                historial.FechaEvolucion, historial.Descripcion));
        }
        return result;
    }

    private static void ValidarId(int? id, string campo)
    {
        if (id is <= 0)
            throw new AppValidationException("El filtro de historial no es válido.",
                new Dictionary<string, string[]> { [campo] = ["Debe ser mayor que cero."] });
    }

    private async Task<int> ObtenerMedicoActualAsync(Usuario usuario, CancellationToken ct)
    {
        if (usuario.IdEmpleado is not int idEmpleado)
            throw new ForbiddenException("El usuario no está vinculado a un médico activo.");

        var medicoValido = await context.Empleados.AsNoTracking().AnyAsync(e =>
            e.IdEmpleado == idEmpleado && e.Activo && e.TipoEmpleado == "Medico", ct);
        if (!medicoValido)
            throw new ForbiddenException("El usuario no está vinculado a un médico activo.");
        return idEmpleado;
    }

    private static string ValidarDescripcion(string? value)
    {
        var descripcion = string.Join(' ', (value ?? string.Empty).Split(
            (char[]?)null, StringSplitOptions.RemoveEmptyEntries));
        if (descripcion.Length == 0)
            throw Invalid(nameof(HistorialMedicoCreateDto.Descripcion),
                "La descripción es obligatoria.");
        if (descripcion.Length > 300)
            throw Invalid(nameof(HistorialMedicoCreateDto.Descripcion),
                "Máximo 300 caracteres.");
        return descripcion;
    }

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del historial médico no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });
}
