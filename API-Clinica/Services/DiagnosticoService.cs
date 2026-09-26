using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class DiagnosticoService(
    ClinicaDbContext context,
    IAccesoActualService accesoActual) : IDiagnosticoService
{
    public async Task<DiagnosticoResponse> CrearAsync(
        CrearDiagnosticoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");

        var descripcion = request.Descripcion?.Trim();
        if (string.IsNullOrWhiteSpace(descripcion))
            throw Invalid("Descripcion", "La descripción es obligatoria.");

        if (request.IdConsulta <= 0)
            throw Invalid("IdConsulta", "La consulta debe ser válida.");

        if (!await context.Consultas.AsNoTracking()
            .AnyAsync(c => c.IdConsulta == request.IdConsulta, cancellationToken))
            throw new NotFoundException("Consulta no encontrada.");

        var idMedico = await ResolverMedicoAsync(usuario, request.IdMedico, cancellationToken);
        var diagnostico = new Diagnostico
        {
            IdConsulta = request.IdConsulta,
            IdMedico = idMedico,
            Descripcion = descripcion,
            FechaRegistro = DateTime.UtcNow
        };
        context.Diagnosticos.Add(diagnostico);
        await context.SaveChangesAsync(cancellationToken);

        return new DiagnosticoResponse(diagnostico.IdDiagnostico, diagnostico.IdConsulta,
            diagnostico.IdMedico, diagnostico.Descripcion, diagnostico.FechaRegistro);
    }

    private async Task<int> ResolverMedicoAsync(
        Usuario usuario, int? solicitado, CancellationToken cancellationToken)
    {
        if (usuario.IdEmpleado is int idEmpleado)
        {
            var vinculado = await context.Empleados.AsNoTracking()
                .Where(e => e.IdEmpleado == idEmpleado)
                .Select(e => new { e.IdEmpleado, e.TipoEmpleado, e.Activo })
                .SingleOrDefaultAsync(cancellationToken);

            if (vinculado?.TipoEmpleado == "Medico")
            {
                if (!vinculado.Activo)
                    throw Invalid("IdMedico", "El médico vinculado al usuario está inactivo.");
                if (solicitado.HasValue && solicitado.Value != vinculado.IdEmpleado)
                    throw Invalid("IdMedico", "El médico debe coincidir con el usuario autenticado.");
                return vinculado.IdEmpleado;
            }
        }

        if (solicitado is not > 0)
            throw Invalid("IdMedico", "Debe indicar un médico válido.");

        if (!await context.Empleados.AsNoTracking()
            .AnyAsync(e => e.IdEmpleado == solicitado.Value && e.Activo &&
                e.TipoEmpleado == "Medico", cancellationToken))
            throw Invalid("IdMedico", "El empleado indicado debe existir, estar activo y ser de tipo Medico.");

        return solicitado.Value;
    }

    private static AppValidationException Invalid(string field, string message) =>
        new("Datos no válidos.", new Dictionary<string, string[]> { [field] = [message] });
}
