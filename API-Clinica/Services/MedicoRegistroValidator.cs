using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace API_Clinica.Services;

public static class MedicoRegistroValidator
{
    public static async Task ValidarAsync(ClinicaDbContext context, CancellationToken cancellationToken)
    {
        var ids = ObtenerIdsPendientes(context)
            .Concat(await ObtenerIdsDesdeRelacionesAsync(context, cancellationToken))
            .Distinct().ToArray();
        if (ids.Length == 0) return;

        var empleados = await context.Empleados.AsNoTracking()
            .Where(e => ids.Contains(e.IdEmpleado))
            .Select(e => new EmpleadoEstado(e.IdEmpleado, e.Activo, e.TipoEmpleado))
            .ToDictionaryAsync(e => e.IdEmpleado, cancellationToken);
        ValidarEstados(context, ids, empleados);
    }

    public static void Validar(ClinicaDbContext context)
    {
        var ids = ObtenerIdsPendientes(context)
            .Concat(ObtenerIdsDesdeRelaciones(context))
            .Distinct().ToArray();
        if (ids.Length == 0) return;

        var empleados = context.Empleados.AsNoTracking()
            .Where(e => ids.Contains(e.IdEmpleado))
            .Select(e => new EmpleadoEstado(e.IdEmpleado, e.Activo, e.TipoEmpleado))
            .ToDictionary(e => e.IdEmpleado);
        ValidarEstados(context, ids, empleados);
    }

    private static void ValidarEstados(
        ClinicaDbContext context, int[] ids, Dictionary<int, EmpleadoEstado> empleados)
    {
        foreach (var id in ids)
        {
            if (!empleados.TryGetValue(id, out var empleado))
                throw Invalid("El empleado indicado no existe.");

            var tracked = context.ChangeTracker.Entries<Empleado>()
                .SingleOrDefault(e => e.Entity.IdEmpleado == id &&
                    e.State is EntityState.Modified or EntityState.Deleted);
            if (tracked?.State == EntityState.Deleted)
                throw Invalid("El empleado indicado no existe.");
            if (tracked?.State == EntityState.Modified)
                empleado = new EmpleadoEstado(id, tracked.Entity.Activo, tracked.Entity.TipoEmpleado);

            if (!empleado.Activo)
                throw Invalid("El empleado indicado está inactivo.");
            if (!string.Equals(empleado.TipoEmpleado, "Medico", StringComparison.Ordinal))
                throw Invalid("El empleado indicado no es de tipo Medico.");
        }
    }

    private static int[] ObtenerIdsPendientes(ClinicaDbContext context) =>
        context.ChangeTracker.Entries<Consulta>()
            .Where(e => e.State == EntityState.Added ||
                (e.State == EntityState.Modified &&
                    e.Property("IdMedico").IsModified))
            .Select(e => e.Entity.IdMedico)
            .Distinct()
            .ToArray();

    private static int[] IdsConsultaReferenciada(ClinicaDbContext context) =>
        context.ChangeTracker.Entries<Diagnostico>()
            .Where(e => DebeValidar(e, "IdConsulta"))
            .Select(e => e.Entity.IdConsulta)
            .Concat(context.ChangeTracker.Entries<Evolucion>()
                .Where(e => DebeValidar(e, "IdConsulta", "IdDiagnostico") &&
                    e.Entity.IdConsulta.HasValue)
                .Select(e => e.Entity.IdConsulta!.Value))
            .Concat(context.ChangeTracker.Entries<Examen>()
                .Where(e => DebeValidar(e, "IdConsulta", "IdDiagnostico") &&
                    e.Entity.IdConsulta.HasValue)
                .Select(e => e.Entity.IdConsulta!.Value))
            .Concat(context.ChangeTracker.Entries<Tratamiento>()
                .Where(e => DebeValidar(e, "IdConsulta"))
                .Select(e => e.Entity.IdConsulta))
            .Distinct().ToArray();

    private static int[] IdsDiagnosticoReferenciado(ClinicaDbContext context) =>
        context.ChangeTracker.Entries<Evolucion>()
            .Where(e => DebeValidar(e, "IdConsulta", "IdDiagnostico") &&
                e.Entity.IdDiagnostico.HasValue)
            .Select(e => e.Entity.IdDiagnostico!.Value)
            .Concat(context.ChangeTracker.Entries<Examen>()
                .Where(e => DebeValidar(e, "IdConsulta", "IdDiagnostico") &&
                    e.Entity.IdDiagnostico.HasValue)
                .Select(e => e.Entity.IdDiagnostico!.Value))
            .Distinct().ToArray();

    private static bool DebeValidar(EntityEntry entry, params string[] relaciones) =>
        entry.State == EntityState.Added ||
        (entry.State == EntityState.Modified &&
            relaciones.Any(nombre => entry.Property(nombre).IsModified));

    private static async Task<int[]> ObtenerIdsDesdeRelacionesAsync(
        ClinicaDbContext context, CancellationToken ct)
    {
        var consultaIds = IdsConsultaReferenciada(context);
        var diagnosticoIds = IdsDiagnosticoReferenciado(context);
        if (diagnosticoIds.Length > 0)
        {
            var desdeDiagnostico = await context.Diagnosticos.AsNoTracking()
                .Where(d => diagnosticoIds.Contains(d.IdDiagnostico))
                .Select(d => new { d.IdDiagnostico, d.IdConsulta })
                .ToDictionaryAsync(d => d.IdDiagnostico, d => d.IdConsulta, ct);
            IncluirDiagnosticosPendientes(context, diagnosticoIds, desdeDiagnostico);
            if (diagnosticoIds.Any(id => !desdeDiagnostico.ContainsKey(id)))
                throw ReferenciaInexistente("IdDiagnostico");
            ValidarCoherencia(context, desdeDiagnostico);
            consultaIds = consultaIds.Concat(desdeDiagnostico.Values).Distinct().ToArray();
        }

        if (consultaIds.Length == 0) return [];
        var desdeConsulta = await context.Consultas.AsNoTracking()
            .Where(c => consultaIds.Contains(c.IdConsulta))
            .Select(c => new { c.IdConsulta, c.IdMedico })
            .ToDictionaryAsync(c => c.IdConsulta, c => c.IdMedico, ct);
        IncluirConsultasPendientes(context, consultaIds, desdeConsulta);
        if (consultaIds.Any(id => !desdeConsulta.ContainsKey(id)))
            throw ReferenciaInexistente("IdConsulta");
        return desdeConsulta.Values.Distinct().ToArray();
    }

    private static int[] ObtenerIdsDesdeRelaciones(ClinicaDbContext context)
    {
        var consultaIds = IdsConsultaReferenciada(context);
        var diagnosticoIds = IdsDiagnosticoReferenciado(context);
        if (diagnosticoIds.Length > 0)
        {
            var desdeDiagnostico = context.Diagnosticos.AsNoTracking()
                .Where(d => diagnosticoIds.Contains(d.IdDiagnostico))
                .Select(d => new { d.IdDiagnostico, d.IdConsulta })
                .ToDictionary(d => d.IdDiagnostico, d => d.IdConsulta);
            IncluirDiagnosticosPendientes(context, diagnosticoIds, desdeDiagnostico);
            if (diagnosticoIds.Any(id => !desdeDiagnostico.ContainsKey(id)))
                throw ReferenciaInexistente("IdDiagnostico");
            ValidarCoherencia(context, desdeDiagnostico);
            consultaIds = consultaIds.Concat(desdeDiagnostico.Values).Distinct().ToArray();
        }

        if (consultaIds.Length == 0) return [];
        var desdeConsulta = context.Consultas.AsNoTracking()
            .Where(c => consultaIds.Contains(c.IdConsulta))
            .Select(c => new { c.IdConsulta, c.IdMedico })
            .ToDictionary(c => c.IdConsulta, c => c.IdMedico);
        IncluirConsultasPendientes(context, consultaIds, desdeConsulta);
        if (consultaIds.Any(id => !desdeConsulta.ContainsKey(id)))
            throw ReferenciaInexistente("IdConsulta");
        return desdeConsulta.Values.Distinct().ToArray();
    }

    private static void IncluirDiagnosticosPendientes(
        ClinicaDbContext context, int[] ids, Dictionary<int, int> consultas)
    {
        foreach (var entry in context.ChangeTracker.Entries<Diagnostico>()
            .Where(e => ids.Contains(e.Entity.IdDiagnostico)))
        {
            if (entry.State == EntityState.Deleted)
                consultas.Remove(entry.Entity.IdDiagnostico);
            else if (entry.State is EntityState.Added or EntityState.Modified)
                consultas[entry.Entity.IdDiagnostico] = entry.Entity.IdConsulta;
        }
    }

    private static void IncluirConsultasPendientes(
        ClinicaDbContext context, int[] ids, Dictionary<int, int> medicos)
    {
        foreach (var entry in context.ChangeTracker.Entries<Consulta>()
            .Where(e => ids.Contains(e.Entity.IdConsulta)))
        {
            if (entry.State == EntityState.Deleted)
                medicos.Remove(entry.Entity.IdConsulta);
            else if (entry.State is EntityState.Added or EntityState.Modified)
                medicos[entry.Entity.IdConsulta] = entry.Entity.IdMedico;
        }
    }

    private static void ValidarCoherencia(
        ClinicaDbContext context, IReadOnlyDictionary<int, int> consultasPorDiagnostico)
    {
        foreach (var entry in context.ChangeTracker.Entries<Evolucion>()
            .Where(e => DebeValidar(e, "IdConsulta", "IdDiagnostico") &&
                e.Entity.IdConsulta.HasValue && e.Entity.IdDiagnostico.HasValue))
        {
            if (consultasPorDiagnostico.TryGetValue(entry.Entity.IdDiagnostico!.Value,
                    out var idConsulta) && idConsulta != entry.Entity.IdConsulta)
                throw RelacionIncoherente();
        }

        foreach (var entry in context.ChangeTracker.Entries<Examen>()
            .Where(e => DebeValidar(e, "IdConsulta", "IdDiagnostico") &&
                e.Entity.IdConsulta.HasValue))
        {
            var idDiagnostico = entry.Entity.IdDiagnostico;
            if (idDiagnostico is int id &&
                consultasPorDiagnostico.TryGetValue(id, out var idConsulta) &&
                idConsulta != entry.Entity.IdConsulta)
                throw RelacionIncoherente();
        }
    }

    private static AppValidationException RelacionIncoherente() =>
        new("La consulta y el diagnóstico no corresponden.",
            new Dictionary<string, string[]> { ["IdDiagnostico"] =
                ["El diagnóstico debe corresponder a la consulta."] });

    private static AppValidationException ReferenciaInexistente(string propiedad) =>
        new("La referencia clínica no existe.",
            new Dictionary<string, string[]> { [propiedad] =
                ["La referencia indicada debe existir."] });

    private static AppValidationException Invalid(string message) =>
        new("El médico indicado no es válido.",
            new Dictionary<string, string[]> { ["IdMedico"] = [message] });

    private sealed record EmpleadoEstado(int IdEmpleado, bool Activo, string TipoEmpleado);
}
