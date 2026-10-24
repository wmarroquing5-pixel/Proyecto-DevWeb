using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

// Alcance de lectura aprobado en SEC-LECT-01: únicamente el médico responsable activo.
public sealed class ConsultaLecturaScope(
    ClinicaDbContext context, IAccesoActualService accesoActual)
{
    public async Task<int> ObtenerMedicoAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
            ?? throw new ForbiddenException("Acceso denegado.");
        return await ObtenerMedicoAsync(usuario, ct);
    }

    internal async Task<int> ObtenerMedicoAsync(Usuario usuario, CancellationToken ct)
    {
        if (usuario.IdEmpleado is not int idEmpleado ||
            !await context.Empleados.AsNoTracking().AnyAsync(e =>
                e.IdEmpleado == idEmpleado && e.Activo && e.TipoEmpleado == "Medico", ct))
            throw new ForbiddenException("No tiene un médico activo vinculado.");
        return idEmpleado;
    }

    public IQueryable<Consulta> ConsultasVisibles(int idMedico) =>
        context.Consultas.AsNoTracking().Where(c => c.IdMedico == idMedico);

    public IQueryable<Diagnostico> DiagnosticosVisibles(int idMedico)
    {
        var consultas = ConsultasVisibles(idMedico).Select(c => c.IdConsulta);
        return context.Diagnosticos.AsNoTracking()
            .Where(d => consultas.Contains(d.IdConsulta));
    }

    public IQueryable<Tratamiento> TratamientosVisibles(int idMedico)
    {
        var consultas = ConsultasVisibles(idMedico).Select(c => c.IdConsulta);
        return context.Tratamientos.AsNoTracking()
            .Where(t => consultas.Contains(t.IdConsulta));
    }

    public IQueryable<Examen> ExamenesVisibles(int idMedico)
    {
        var consultas = ConsultasVisibles(idMedico).Select(c => c.IdConsulta);
        return context.Examenes.AsNoTracking().Where(e =>
            e.IdConsulta.HasValue
                ? consultas.Contains(e.IdConsulta.Value) &&
                  (!e.IdDiagnostico.HasValue || context.Diagnosticos.Any(d =>
                      d.IdDiagnostico == e.IdDiagnostico.Value &&
                      d.IdConsulta == e.IdConsulta.Value))
                : e.IdDiagnostico.HasValue && context.Diagnosticos.Any(d =>
                    d.IdDiagnostico == e.IdDiagnostico.Value &&
                    consultas.Contains(d.IdConsulta)));
    }

    public IQueryable<Evolucion> HistorialesVisibles(int idMedico)
    {
        var consultas = ConsultasVisibles(idMedico).Select(c => c.IdConsulta);
        return context.HistorialesMedicos.AsNoTracking().Where(h =>
            h.IdConsulta.HasValue
                ? consultas.Contains(h.IdConsulta.Value) &&
                  (!h.IdDiagnostico.HasValue || context.Diagnosticos.Any(d =>
                      d.IdDiagnostico == h.IdDiagnostico.Value &&
                      d.IdConsulta == h.IdConsulta.Value))
                : h.IdDiagnostico.HasValue && context.Diagnosticos.Any(d =>
                    d.IdDiagnostico == h.IdDiagnostico.Value &&
                    consultas.Contains(d.IdConsulta)));
    }
}
