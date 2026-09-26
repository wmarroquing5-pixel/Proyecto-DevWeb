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
        var ids = ObtenerIdsPendientes(context);
        if (ids.Length == 0) return;

        var empleados = await context.Empleados.AsNoTracking()
            .Where(e => ids.Contains(e.IdEmpleado))
            .Select(e => new EmpleadoEstado(e.IdEmpleado, e.Activo, e.TipoEmpleado))
            .ToDictionaryAsync(e => e.IdEmpleado, cancellationToken);
        ValidarEstados(context, ids, empleados);
    }

    public static void Validar(ClinicaDbContext context)
    {
        var ids = ObtenerIdsPendientes(context);
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
        context.ChangeTracker.Entries()
            .Where(e => e.State == EntityState.Added ||
                (e.State == EntityState.Modified && EsRegistroMedico(e) &&
                    e.Property("IdMedico").IsModified))
            .Select(e => IdMedico(e.Entity))
            .Where(id => id.HasValue)
            .Select(id => id!.Value)
            .Distinct()
            .ToArray();

    private static bool EsRegistroMedico(EntityEntry entry) =>
        IdMedico(entry.Entity).HasValue;

    private static int? IdMedico(object entity) => entity switch
    {
        Consulta x => x.IdMedico,
        Diagnostico x => x.IdMedico,
        Examen x => x.IdMedico,
        Evolucion x => x.IdMedico,
        Tratamiento x => x.IdMedico,
        _ => null
    };

    private static AppValidationException Invalid(string message) =>
        new("El médico indicado no es válido.",
            new Dictionary<string, string[]> { ["IdMedico"] = [message] });

    private sealed record EmpleadoEstado(int IdEmpleado, bool Activo, string TipoEmpleado);
}
