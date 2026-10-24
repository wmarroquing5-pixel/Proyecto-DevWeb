using API_Clinica.Data;
using API_Clinica.Services;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class ConsultaLecturaScopeTests
{
    [Fact]
    public void FiltrosClinicosSeTraducenASqlAntesDePaginar()
    {
        var options = new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseSqlServer("Server=(local);Database=NotUsed;Trusted_Connection=True;TrustServerCertificate=True")
            .Options;
        using var db = new ClinicaDbContext(options);
        var scope = new ConsultaLecturaScope(db, new AccesoActualService(db));

        var queries = new[]
        {
            scope.ConsultasVisibles(7).OrderBy(c => c.IdConsulta)
                .Skip(10).Take(10).ToQueryString(),
            scope.DiagnosticosVisibles(7).OrderBy(d => d.IdDiagnostico)
                .Skip(10).Take(10).ToQueryString(),
            scope.ExamenesVisibles(7).OrderBy(e => e.IdExamen)
                .Skip(10).Take(10).ToQueryString(),
            scope.TratamientosVisibles(7).OrderBy(t => t.IdTratamiento)
                .Skip(10).Take(10).ToQueryString(),
            scope.HistorialesVisibles(7).OrderBy(h => h.IdEvolucion)
                .Skip(10).Take(10).ToQueryString()
        };

        foreach (var sql in queries)
        {
            Assert.Contains("[IdMedico]", sql);
            Assert.Contains("WHERE", sql);
            Assert.Contains("OFFSET", sql);
            Assert.True(sql.IndexOf("WHERE", StringComparison.Ordinal) <
                sql.IndexOf("OFFSET", StringComparison.Ordinal));
        }
    }
}
