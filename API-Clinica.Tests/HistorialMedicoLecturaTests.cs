using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class HistorialMedicoLecturaTests
{
    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    [InlineData(true, true)]
    public async Task AtribucionSeDerivaDeRelacionesTrasNuevaConsultaEf(
        bool consultaDirecta, bool diagnostico)
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await SeedAsync(databaseName);
        await using (var writer = CreateContext(databaseName))
        {
            writer.HistorialesMedicos.Add(new Evolucion
            {
                IdEvolucion = 1, IdConsulta = consultaDirecta ? 1 : null,
                IdDiagnostico = diagnostico ? 1 : null,
                IdPaciente = 999, IdMedico = 999,
                Descripcion = "Evolución", FechaEvolucion = DateTime.UtcNow
            });
            await writer.SaveChangesAsync();
        }

        await using var reader = CreateContext(databaseName);
        var result = await new HistorialMedicoLecturaService(reader)
            .ObtenerAtribucionAsync(1, CancellationToken.None);
        Assert.Equal(1, result.IdConsulta);
        Assert.Equal(diagnostico ? 1 : null, result.IdDiagnostico);
        Assert.Equal(7, result.IdPaciente);
        Assert.Equal(5, result.IdMedico);
    }

    [Fact]
    public async Task RelacionesIncoherentesSeRechazanAlGuardar()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await SeedAsync(databaseName);
        await using (var writer = CreateContext(databaseName))
        {
            writer.Consultas.Add(new Consulta
            {
                IdConsulta = 2, IdPaciente = 8, IdMedico = 5,
                IdSucursal = 1, FechaConsulta = DateTime.UtcNow
            });
            await writer.SaveChangesAsync();
            writer.HistorialesMedicos.Add(new Evolucion
            {
                IdEvolucion = 1, IdConsulta = 2, IdDiagnostico = 1,
                Descripcion = "Incoherente", FechaEvolucion = DateTime.UtcNow
            });
            var error = await Assert.ThrowsAsync<AppValidationException>(
                () => writer.SaveChangesAsync());
            Assert.Contains("IdDiagnostico", error.Errors.Keys);
        }

        await using var reader = CreateContext(databaseName);
        Assert.Empty(await reader.HistorialesMedicos.ToListAsync());
    }

    [Fact]
    public async Task ExamenConConsultaYDiagnosticoDistintosSeRechaza()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await SeedAsync(databaseName);
        await using var context = CreateContext(databaseName);
        context.Consultas.Add(new Consulta
        {
            IdConsulta = 2, IdPaciente = 8, IdMedico = 5,
            IdSucursal = 1, FechaConsulta = DateTime.UtcNow
        });
        await context.SaveChangesAsync();

        var examen = new Examen
        {
            IdConsulta = 2, NombreExamen = "Incoherente",
            FechaExamen = DateTime.UtcNow
        };
        context.Examenes.Add(examen);
        context.Entry(examen).Property<int?>("IdDiagnostico").CurrentValue = 1;
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdDiagnostico", error.Errors.Keys);
        Assert.Empty(await context.Examenes.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task GuardadoSincronoRechazaHistorialIncoherente()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await SeedAsync(databaseName);
        using var context = CreateContext(databaseName);
        context.Consultas.Add(new Consulta
        {
            IdConsulta = 2, IdPaciente = 8, IdMedico = 5,
            IdSucursal = 1, FechaConsulta = DateTime.UtcNow
        });
        context.SaveChanges();
        context.HistorialesMedicos.Add(new Evolucion
        {
            IdConsulta = 2, IdDiagnostico = 1,
            Descripcion = "Incoherente", FechaEvolucion = DateTime.UtcNow
        });
        var error = Assert.Throws<AppValidationException>(() => context.SaveChanges());
        Assert.Contains("IdDiagnostico", error.Errors.Keys);
    }

    [Fact]
    public async Task SinAsociacionClinicaNoInventaPacienteNiMedico()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using (var writer = CreateContext(databaseName))
        {
            writer.HistorialesMedicos.Add(new Evolucion
            {
                IdEvolucion = 1, IdPaciente = 999, IdMedico = 999,
                Descripcion = "Sin atribución", FechaEvolucion = DateTime.UtcNow
            });
            await writer.SaveChangesAsync();
        }

        await using var reader = CreateContext(databaseName);
        var result = await new HistorialMedicoLecturaService(reader)
            .ObtenerAtribucionAsync(1, CancellationToken.None);
        Assert.Null(result.IdConsulta);
        Assert.Null(result.IdDiagnostico);
        Assert.Null(result.IdPaciente);
        Assert.Null(result.IdMedico);
    }

    private static ClinicaDbContext CreateContext(string databaseName) =>
        new(new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseInMemoryDatabase(databaseName).Options);

    private static async Task SeedAsync(string databaseName)
    {
        await using var db = CreateContext(databaseName);
        db.Empleados.Add(new Empleado
        {
            IdEmpleado = 5, IdSucursal = 1, Nombres = "Médico",
            Apellidos = "Prueba", DPI = "HISTORIAL-TEST-5",
            TipoEmpleado = "Medico", Activo = true
        });
        await db.SaveChangesAsync();
        db.Consultas.Add(new Consulta
        {
            IdConsulta = 1, IdPaciente = 7, IdMedico = 5,
            IdSucursal = 1, FechaConsulta = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        db.Diagnosticos.Add(new Diagnostico
        {
            IdDiagnostico = 1, IdConsulta = 1,
            Descripcion = "Prueba", FechaRegistro = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
    }
}
