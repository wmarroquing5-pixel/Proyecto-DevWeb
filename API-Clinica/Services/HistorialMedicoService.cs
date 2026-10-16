using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class HistorialMedicoService(
    ClinicaDbContext context,
    HistorialMedicoLecturaService lectura,
    ICommonParameterValidator parameterValidator) : IHistorialMedicoService
{
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
}
