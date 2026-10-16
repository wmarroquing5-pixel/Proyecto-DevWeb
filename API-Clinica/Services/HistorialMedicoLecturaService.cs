using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

// Modelo interno de lectura; no cambia las respuestas REST existentes.
public sealed record HistorialMedicoAtribucion(
    int IdHistorial, int? IdConsulta, int? IdDiagnostico,
    int? IdPaciente, int? IdMedico);

public sealed class HistorialMedicoLecturaService(ClinicaDbContext context)
{
    public async Task<HistorialMedicoAtribucion> ObtenerAtribucionAsync(
        int idHistorial, CancellationToken cancellationToken)
    {
        var historial = await context.HistorialesMedicos.AsNoTracking()
            .Where(h => h.IdEvolucion == idHistorial)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Historial médico no encontrado.");

        return (await ObtenerAtribucionesAsync([historial], cancellationToken))[0];
    }

    // Resuelve una página en tres consultas como máximo y conserva las mismas reglas
    // de atribución que la lectura individual.
    public async Task<IReadOnlyList<HistorialMedicoAtribucion>> ObtenerAtribucionesAsync(
        IReadOnlyList<Evolucion> historiales, CancellationToken cancellationToken)
    {
        if (historiales.Count == 0) return [];
        var diagnosticoIds = historiales.Where(h => h.IdDiagnostico.HasValue)
            .Select(h => h.IdDiagnostico!.Value).Distinct().ToArray();
        var diagnosticos = await context.Diagnosticos.AsNoTracking()
            .Where(d => diagnosticoIds.Contains(d.IdDiagnostico))
            .Select(d => new { d.IdDiagnostico, d.IdConsulta })
            .ToDictionaryAsync(d => d.IdDiagnostico, d => d.IdConsulta,
                cancellationToken);
        var consultaIds = historiales.Where(h => h.IdConsulta.HasValue)
            .Select(h => h.IdConsulta!.Value)
            .Concat(diagnosticos.Values).Distinct().ToArray();
        var consultas = await context.Consultas.AsNoTracking()
            .Where(c => consultaIds.Contains(c.IdConsulta))
            .Select(c => new { c.IdConsulta, c.IdPaciente, c.IdMedico })
            .ToDictionaryAsync(c => c.IdConsulta, cancellationToken);

        var result = new List<HistorialMedicoAtribucion>(historiales.Count);
        foreach (var historial in historiales)
        {
            int? consultaDiagnostico = null;
            if (historial.IdDiagnostico is int idDiagnostico)
            {
                if (!diagnosticos.TryGetValue(idDiagnostico, out var idConsultaDelDiagnostico))
                    throw new ConflictException("El diagnóstico del historial no existe.");
                consultaDiagnostico = idConsultaDelDiagnostico;
            }

            if (historial.IdConsulta is int idConsultaDirecta &&
                consultaDiagnostico is int idConsultaDiagnostico &&
                idConsultaDirecta != idConsultaDiagnostico)
                throw new ConflictException("La consulta y el diagnóstico del historial no corresponden.");

            var idConsulta = historial.IdConsulta ?? consultaDiagnostico;
            if (idConsulta is null)
            {
                result.Add(new(historial.IdEvolucion, null, historial.IdDiagnostico,
                    null, null));
                continue;
            }
            if (!consultas.TryGetValue(idConsulta.Value, out var consulta))
                throw new ConflictException("La consulta del historial no existe.");

            result.Add(new(historial.IdEvolucion, idConsulta, historial.IdDiagnostico,
                consulta.IdPaciente, consulta.IdMedico));
        }
        return result;
    }
}
