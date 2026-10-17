using API_Clinica.Data;
using API_Clinica.Exceptions;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class MedicoRegistroTests
{
    [Theory]
    [InlineData("Consulta")]
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

    [Theory]
    [InlineData("Diagnostico", false, "Medico")]
    [InlineData("Diagnostico", true, "Enfermera")]
    [InlineData("EvolucionConsulta", false, "Medico")]
    [InlineData("EvolucionDiagnostico", true, "Enfermera")]
    public async Task RegistroRelacionadoValidaMedicoDeConsulta(
        string entidad, bool activo, string tipo)
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using (var seed = CreateContext(databaseName))
        {
            await SeedEmployeeAsync(seed, 1, true, "Medico");
            seed.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", 1));
            await seed.SaveChangesAsync();
            if (entidad == "EvolucionDiagnostico")
            {
                seed.Diagnosticos.Add((Diagnostico)CreateMedicalRecord("Diagnostico", 1));
                await seed.SaveChangesAsync();
            }
            var medico = await seed.Empleados.SingleAsync();
            medico.Activo = activo;
            medico.TipoEmpleado = tipo;
            await seed.SaveChangesAsync();
        }

        await using var context = CreateContext(databaseName);
        object registro = entidad switch
        {
            "Diagnostico" => CreateMedicalRecord("Diagnostico", 999),
            "EvolucionConsulta" => new Evolucion
            {
                IdConsulta = 1, IdMedico = 999, IdPaciente = 999,
                FechaEvolucion = DateTime.UtcNow, Descripcion = "Prueba"
            },
            "EvolucionDiagnostico" => new Evolucion
            {
                IdDiagnostico = 1, IdMedico = 999, IdPaciente = 999,
                FechaEvolucion = DateTime.UtcNow, Descripcion = "Prueba"
            },
            _ => throw new ArgumentOutOfRangeException(nameof(entidad))
        };
        context.Add(registro);
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdMedico", error.Errors.Keys);
    }

    [Theory]
    [InlineData("Examen", false, "Medico")]
    [InlineData("Examen", true, "Enfermera")]
    [InlineData("Tratamiento", false, "Medico")]
    [InlineData("Tratamiento", true, "Enfermera")]
    public async Task ExamenYTratamientoValidanMedicoPersistidoDeConsulta(
        string entidad, bool activo, string tipo)
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using (var seed = CreateContext(databaseName))
        {
            await SeedEmployeeAsync(seed, 1, true, "Medico");
            await SeedEmployeeAsync(seed, 2, true, "Enfermera");
            seed.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", 1));
            await seed.SaveChangesAsync();
        }

        await using (var valid = CreateContext(databaseName))
        {
            var record = CreateMedicalRecord(entidad, 2);
            if (record is Examen examen) examen.IdConsulta = 1;
            valid.Add(record);
            Assert.Equal(1, await valid.SaveChangesAsync());
        }

        await using (var update = CreateContext(databaseName))
        {
            var medico = await update.Empleados.SingleAsync(e => e.IdEmpleado == 1);
            medico.Activo = activo;
            medico.TipoEmpleado = tipo;
            await update.SaveChangesAsync();
        }

        await using var invalid = CreateContext(databaseName);
        var another = CreateMedicalRecord(entidad, 2);
        if (another is Examen otherExam) otherExam.IdConsulta = 1;
        invalid.Add(another);
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => invalid.SaveChangesAsync());
        Assert.Contains("IdMedico", error.Errors.Keys);
    }

    [Theory]
    [InlineData("Examen")]
    [InlineData("Tratamiento")]
    public async Task CambioDeConsultaValidaNuevoMedicoSinLeerIdMedicoIgnorado(string entidad)
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using (var seed = CreateContext(databaseName))
        {
            await SeedEmployeeAsync(seed, 1, true, "Medico");
            await SeedEmployeeAsync(seed, 2, true, "Medico");
            seed.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", 1));
            seed.Consultas.Add(new Consulta
            {
                IdConsulta = 2, IdPaciente = 1, IdSucursal = 1,
                IdMedico = 2, FechaConsulta = DateTime.UtcNow
            });
            await seed.SaveChangesAsync();
            var record = CreateMedicalRecord(entidad, 999);
            if (record is Examen examen) examen.IdConsulta = 1;
            seed.Add(record);
            await seed.SaveChangesAsync();
            (await seed.Empleados.SingleAsync(e => e.IdEmpleado == 2)).Activo = false;
            await seed.SaveChangesAsync();
        }

        await using var edit = CreateContext(databaseName);
        if (entidad == "Examen")
            (await edit.Examenes.SingleAsync()).IdConsulta = 2;
        else
            (await edit.Tratamientos.SingleAsync()).IdConsulta = 2;
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => edit.SaveChangesAsync());
        Assert.Contains("IdMedico", error.Errors.Keys);
    }

    [Fact]
    public async Task ExamenConSoloDiagnosticoValidaMedicoDeConsulta()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using (var seed = CreateContext(databaseName))
        {
            await SeedEmployeeAsync(seed, 1, true, "Medico");
            seed.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", 1));
            await seed.SaveChangesAsync();
            seed.Diagnosticos.Add((Diagnostico)CreateMedicalRecord("Diagnostico", 999));
            await seed.SaveChangesAsync();
            (await seed.Empleados.SingleAsync()).Activo = false;
            await seed.SaveChangesAsync();
        }

        await using var context = CreateContext(databaseName);
        var examen = (Examen)CreateMedicalRecord("Examen", 999);
        context.Examenes.Add(examen);
        context.Entry(examen).Property<int?>("IdDiagnostico").CurrentValue = 1;
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdMedico", error.Errors.Keys);
    }

    [Fact]
    public async Task TratamientoRechazaConsultaInexistenteAntesDeGuardar()
    {
        await using var context = CreateContext();
        context.Tratamientos.Add((Tratamiento)CreateMedicalRecord("Tratamiento", 999));
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdConsulta", error.Errors.Keys);
        Assert.Empty(await context.Tratamientos.AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task ExamenRechazaDiagnosticoInexistenteAntesDeGuardar()
    {
        await using var context = CreateContext();
        var examen = (Examen)CreateMedicalRecord("Examen", 999);
        context.Examenes.Add(examen);
        context.Entry(examen).Property<int?>("IdDiagnostico").CurrentValue = 999;
        var error = await Assert.ThrowsAsync<AppValidationException>(
            () => context.SaveChangesAsync());
        Assert.Contains("IdDiagnostico", error.Errors.Keys);
    }

    [Fact]
    public async Task ConsultaNuevaSeUsaEnElMismoGuardadoDeTratamiento()
    {
        await using var context = CreateContext();
        await SeedEmployeeAsync(context, 1, true, "Medico");
        context.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", 1));
        context.Tratamientos.Add((Tratamiento)CreateMedicalRecord("Tratamiento", 999));
        Assert.Equal(2, await context.SaveChangesAsync());
    }

    [Fact]
    public async Task DiagnosticoModificadoEnMismoGuardadoSeUsaParaHistorial()
    {
        var databaseName = Guid.NewGuid().ToString("N");
        await using (var seed = CreateContext(databaseName))
        {
            await SeedEmployeeAsync(seed, 1, true, "Medico");
            seed.Consultas.Add((Consulta)CreateMedicalRecord("Consulta", 1));
            seed.Consultas.Add(new Consulta
            {
                IdConsulta = 2, IdPaciente = 1, IdSucursal = 1,
                IdMedico = 1, FechaConsulta = DateTime.UtcNow
            });
            await seed.SaveChangesAsync();
            seed.Diagnosticos.Add((Diagnostico)CreateMedicalRecord("Diagnostico", 999));
            await seed.SaveChangesAsync();
        }

        await using var context = CreateContext(databaseName);
        (await context.Diagnosticos.SingleAsync()).IdConsulta = 2;
        context.HistorialesMedicos.Add(new Evolucion
        {
            IdConsulta = 2, IdDiagnostico = 1,
            FechaEvolucion = DateTime.UtcNow, Descripcion = "Coherente"
        });
        Assert.Equal(2, await context.SaveChangesAsync());
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
