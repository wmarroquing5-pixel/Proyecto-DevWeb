using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public static class VentaDetalleMedicamentoValidator
{
    public static async Task ValidarAsync(ClinicaDbContext context, CancellationToken cancellationToken)
    {
        var ids = ObtenerLotesPendientes(context);
        if (ids.Length == 0) return;

        var lotes = await context.LoteMedicamentos.AsNoTracking()
            .Where(l => ids.Contains(l.IdLote))
            .ToDictionaryAsync(l => l.IdLote, l => l.IdMedicamento, cancellationToken);
        AplicarLotesPendientes(context, lotes);
        var idsMedicamento = lotes.Values.Distinct().ToArray();
        var medicamentos = await context.Medicamentos.AsNoTracking()
            .Where(m => idsMedicamento.Contains(m.IdMedicamento))
            .ToDictionaryAsync(m => m.IdMedicamento, m => m.Activo, cancellationToken);
        AplicarMedicamentosPendientes(context, medicamentos);
        ValidarEstados(ids, lotes, medicamentos);
    }

    public static void Validar(ClinicaDbContext context)
    {
        var ids = ObtenerLotesPendientes(context);
        if (ids.Length == 0) return;

        var lotes = context.LoteMedicamentos.AsNoTracking()
            .Where(l => ids.Contains(l.IdLote))
            .ToDictionary(l => l.IdLote, l => l.IdMedicamento);
        AplicarLotesPendientes(context, lotes);
        var idsMedicamento = lotes.Values.Distinct().ToArray();
        var medicamentos = context.Medicamentos.AsNoTracking()
            .Where(m => idsMedicamento.Contains(m.IdMedicamento))
            .ToDictionary(m => m.IdMedicamento, m => m.Activo);
        AplicarMedicamentosPendientes(context, medicamentos);
        ValidarEstados(ids, lotes, medicamentos);
    }

    private static int[] ObtenerLotesPendientes(ClinicaDbContext context) =>
        context.ChangeTracker.Entries<VentaDetalle>()
            .Where(e => e.State is EntityState.Added or EntityState.Modified)
            .Select(e => e.Entity.IdLote)
            .Distinct().ToArray();

    private static void AplicarLotesPendientes(
        ClinicaDbContext context, Dictionary<int, int> lotes)
    {
        foreach (var entry in context.ChangeTracker.Entries<LoteMedicamento>())
        {
            if (entry.State == EntityState.Deleted)
                lotes.Remove(entry.Entity.IdLote);
            else if (entry.State is EntityState.Added or EntityState.Modified)
                lotes[entry.Entity.IdLote] = entry.Entity.IdMedicamento;
        }
    }

    private static void AplicarMedicamentosPendientes(
        ClinicaDbContext context, Dictionary<int, bool> medicamentos)
    {
        foreach (var entry in context.ChangeTracker.Entries<Medicamento>())
        {
            if (entry.State == EntityState.Deleted)
                medicamentos.Remove(entry.Entity.IdMedicamento);
            else if (entry.State is EntityState.Added or EntityState.Modified)
                medicamentos[entry.Entity.IdMedicamento] = entry.Entity.Activo;
        }
    }

    private static void ValidarEstados(
        int[] ids, Dictionary<int, int> lotes, Dictionary<int, bool> medicamentos)
    {
        foreach (var idLote in ids)
        {
            if (!lotes.TryGetValue(idLote, out var idMedicamento) ||
                !medicamentos.TryGetValue(idMedicamento, out var activo) || !activo)
                throw new AppValidationException("No se puede vender un medicamento inactivo.",
                    new Dictionary<string, string[]>
                    {
                        ["IdLote"] = ["El lote debe existir y pertenecer a un medicamento activo."]
                    });
        }
    }
}
