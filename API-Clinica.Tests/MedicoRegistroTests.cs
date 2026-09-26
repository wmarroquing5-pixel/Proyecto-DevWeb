using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class MedicoRegistroTests
{
    [Theory]
    [InlineData("Consulta")]
    [InlineData("Diagnostico")]
    [InlineData("Examen")]
    [InlineData("Evolucion")]
    [InlineData("Tratamiento")]
    public async Task RegistroRechazaEmpleadoQueNoEsMedico(string entidad)
    {
        await using var context = CreateContext();
        await SeedEmployeeAsync(context, 1, true, "Enfermera");
        context.Add(CreateMedicalRecord(entidad, 1));

        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdMedico", error.Errors.Keys);
    }

    [Theory]
    [InlineData(false, "Medico", 1)]
    [InlineData(true, "medico", 1)]
    [InlineData(true, "Medico", 2)]
    public async Task ConsultaRechazaMedicoInactivoTipoNoExactoOInexistente(
        bool activo, string tipo, int idMedico)
    {
        await using var context = CreateContext();
        await SeedEmployeeAsync(context, 1, activo, tipo);
        context.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", idMedico));

        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdMedico", error.Errors.Keys);
        Assert.Equal(0, await context.Consultas.AsNoTracking().CountAsync());
    }

    [Fact]
    public async Task ConsultaAceptaMedicoActivoYRechazaCambioDeIdMedicoInvalido()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using var context = CreateContext(databaseName);
        await SeedEmployeeAsync(context, 1, true, "Medico");
        await SeedEmployeeAsync(context, 2, true, "Administrativo");
        var consulta = (Consulta)CreateMedicalRecord("Consulta", 1);
        context.Consultas.Add(consulta);
        Assert.Equal(1, await context.SaveChangesAsync());

        consulta.IdMedico = 2;
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdMedico", error.Errors.Keys);

        await using var verification = CreateContext(databaseName);
        Assert.Equal(1, (await verification.Consultas.SingleAsync()).IdMedico);
    }

    [Fact]
    public async Task RegistroRechazaMedicoDesactivadoEnElMismoSaveChanges()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using var context = CreateContext(databaseName);
        await SeedEmployeeAsync(context, 1, true, "Medico");
        (await context.Empleados.SingleAsync()).Activo = false;
        context.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", 1));

        await Assert.ThrowsAsync<AppValidationException>(() => context.SaveChangesAsync());
        await using var verification = CreateContext(databaseName);
        Assert.True((await verification.Empleados.SingleAsync()).Activo);
        Assert.Empty(await verification.Consultas.ToListAsync());
    }

    private static ClinicaDbContext CreateContext(string? databaseName = null) =>
        new(new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseInMemoryDatabase(databaseName ?? Guid.NewGuid().ToString("N"))
            .Options);

    private static async Task SeedEmployeeAsync(
        ClinicaDbContext context, int id, bool activo, string tipo)
    {
        context.Empleados.Add(new Empleado
        {
            IdEmpleado = id, IdSucursal = 1, Nombres = "Prueba", Apellidos = "Local",
            DPI = $"MEDICO-TEST-{id}", TipoEmpleado = tipo, Activo = activo
        });
        await context.SaveChangesAsync();
    }

    private static object CreateMedicalRecord(string entity, int idMedico) => entity switch
    {
        "Consulta" => new Consulta
        {
            IdMedico = idMedico, IdPaciente = 1, IdSucursal = 1,
            FechaConsulta = DateTime.UtcNow
        },
        "Diagnostico" => new Diagnostico
        {
            IdMedico = idMedico, IdConsulta = 1, Descripcion = "Prueba",
            FechaRegistro = DateTime.UtcNow
        },
        "Examen" => new Examen
        {
            IdMedico = idMedico, IdPaciente = 1, NombreExamen = "Prueba",
            FechaExamen = DateTime.UtcNow
        },
        "Evolucion" => new Evolucion
        {
            IdMedico = idMedico, IdPaciente = 1, Descripcion = "Prueba",
            FechaEvolucion = DateTime.UtcNow
        },
        "Tratamiento" => new Tratamiento
        {
            IdMedico = idMedico, IdConsulta = 1, Descripcion = "Prueba",
            FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
        },
        _ => throw new ArgumentOutOfRangeException(nameof(entity))
    };
}
