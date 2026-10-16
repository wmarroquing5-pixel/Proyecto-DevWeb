using API_Clinica.Data;
using API_Clinica.Exceptions;
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
            .Select(h => new { h.IdEvolucion, h.IdConsulta, h.IdDiagnostico })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Historial médico no encontrado.");

        int? consultaDiagnostico = null;
        if (historial.IdDiagnostico is int idDiagnostico)
        {
            consultaDiagnostico = await context.Diagnosticos.AsNoTracking()
                .Where(d => d.IdDiagnostico == idDiagnostico)
                .Select(d => (int?)d.IdConsulta)
                .SingleOrDefaultAsync(cancellationToken);
            if (consultaDiagnostico is null)
                throw new ConflictException("El diagnóstico del historial no existe.");
        }

        if (historial.IdConsulta is int idConsultaDirecta &&
            consultaDiagnostico is int idConsultaDiagnostico &&
            idConsultaDirecta != idConsultaDiagnostico)
            throw new ConflictException("La consulta y el diagnóstico del historial no corresponden.");

        var idConsulta = historial.IdConsulta ?? consultaDiagnostico;
        if (idConsulta is null)
            return new(historial.IdEvolucion, null, historial.IdDiagnostico, null, null);

        var consulta = await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == idConsulta.Value)
            .Select(c => new { c.IdPaciente, c.IdMedico })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ConflictException("La consulta del historial no existe.");

        return new(historial.IdEvolucion, idConsulta, historial.IdDiagnostico,
            consulta.IdPaciente, consulta.IdMedico);
    }
}
