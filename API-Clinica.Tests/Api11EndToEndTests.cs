using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace API_Clinica.Tests;

public sealed class Api11EndToEndTests
{
    [Fact]
    public async Task AtencionClinicaCompletaConservaRelacionesYHistorialPrevio()
    {
        using var factory = new ClinicalFlowFactory();
        var seed = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, seed.Password);

        var pacienteResponse = await client.PostAsJsonAsync("/api/pacientes",
            new GuardarPacienteRequest
            {
                Nombres = "Paciente", Apellidos = "Integral",
                FechaNacimiento = new DateOnly(1990, 1, 1), Genero = "F"
            });
        Assert.Equal(HttpStatusCode.Created, pacienteResponse.StatusCode);
        var paciente = await pacienteResponse.Content.ReadFromJsonAsync<PacienteResponse>();
        Assert.NotNull(paciente);

        var consultaResponse = await client.PostAsJsonAsync("/api/consultas",
            new ConsultaCreateDto
            {
                IdPaciente = paciente.IdPaciente,
                IdSucursal = seed.IdSucursal,
                FechaConsulta = DateTime.UtcNow,
                MotivoConsulta = "Evaluacion integral"
            });
        Assert.Equal(HttpStatusCode.Created, consultaResponse.StatusCode);
        var consulta = await consultaResponse.Content.ReadFromJsonAsync<ConsultaDetalleDto>();
        Assert.NotNull(consulta);
        Assert.Equal(seed.IdMedico, consulta.IdMedico);

        var diagnosticoResponse = await client.PostAsJsonAsync("/api/diagnosticos",
            new CrearDiagnosticoRequest
            {
                IdConsulta = consulta.IdConsulta,
                Descripcion = "Diagnostico integral"
            });
        Assert.Equal(HttpStatusCode.Created, diagnosticoResponse.StatusCode);
        var diagnostico = await diagnosticoResponse.Content.ReadFromJsonAsync<DiagnosticoResponse>();
        Assert.NotNull(diagnostico);

        var hoy = DateOnly.FromDateTime(DateTime.UtcNow);
        var examenResponse = await client.PostAsJsonAsync("/api/examenes",
            new ExamenCreateDto
            {
                IdConsulta = consulta.IdConsulta,
                IdDiagnostico = diagnostico.IdDiagnostico,
                NombreExamen = "Hemograma",
                FechaExamen = DateTime.UtcNow,
                FechaResultado = hoy.AddDays(1),
                Prioridad = "Media"
            });
        Assert.Equal(HttpStatusCode.Created, examenResponse.StatusCode);
        var examen = await examenResponse.Content.ReadFromJsonAsync<ExamenResponseDto>();
        Assert.NotNull(examen);

        var tratamientoResponse = await client.PostAsJsonAsync("/api/tratamientos",
            new TratamientoCreateDto
            {
                IdConsulta = consulta.IdConsulta,
                Descripcion = "Tratamiento integral",
                Indicaciones = "Control diario",
                FechaInicio = hoy,
                FechaFin = hoy.AddDays(7)
            });
        Assert.Equal(HttpStatusCode.Created, tratamientoResponse.StatusCode);
        var tratamiento = await tratamientoResponse.Content.ReadFromJsonAsync<TratamientoResponseDto>();
        Assert.NotNull(tratamiento);

        var primeraResponse = await client.PostAsJsonAsync("/api/historial-medico",
            new HistorialMedicoCreateDto
            {
                IdPaciente = paciente.IdPaciente,
                IdConsulta = consulta.IdConsulta,
                IdDiagnostico = diagnostico.IdDiagnostico,
                Descripcion = "Control inicial"
            });
        Assert.Equal(HttpStatusCode.Created, primeraResponse.StatusCode);
        var primera = await primeraResponse.Content.ReadFromJsonAsync<HistorialMedicoResponseDto>();
        Assert.NotNull(primera);

        var segundaResponse = await client.PostAsJsonAsync("/api/historial-medico",
            new HistorialMedicoCreateDto
            {
                IdPaciente = paciente.IdPaciente,
                IdConsulta = consulta.IdConsulta,
                IdDiagnostico = diagnostico.IdDiagnostico,
                Descripcion = "Seguimiento estable"
            });
        Assert.Equal(HttpStatusCode.Created, segundaResponse.StatusCode);
        var segunda = await segundaResponse.Content.ReadFromJsonAsync<HistorialMedicoResponseDto>();
        Assert.NotNull(segunda);

        var historial = await client.GetFromJsonAsync<PagedResponse<HistorialMedicoResponseDto>>(
            $"/api/historial-medico?idPaciente={paciente.IdPaciente}");
        Assert.NotNull(historial);
        Assert.Equal(2, historial.TotalCount);
        Assert.All(historial.Items, item =>
        {
            Assert.Equal(paciente.IdPaciente, item.IdPaciente);
            Assert.Equal(consulta.IdConsulta, item.IdConsulta);
            Assert.Equal(diagnostico.IdDiagnostico, item.IdDiagnostico);
            Assert.Equal(seed.IdMedico, item.IdMedico);
        });
        Assert.Equal("Control inicial",
            (await client.GetFromJsonAsync<HistorialMedicoResponseDto>(
                $"/api/historial-medico/{primera.IdHistorial}"))?.Descripcion);

        await using var scope = factory.Services.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(1, await db.Pacientes.CountAsync());
        Assert.Equal(1, await db.Consultas.CountAsync());
        Assert.Equal(1, await db.Diagnosticos.CountAsync());
        Assert.Equal(1, await db.Examenes.CountAsync());
        Assert.Equal(1, await db.Tratamientos.CountAsync());
        Assert.Equal(2, await db.HistorialesMedicos.CountAsync());
        Assert.Equal(consulta.IdConsulta, examen.IdConsulta);
        Assert.Equal(diagnostico.IdDiagnostico, examen.IdDiagnostico);
        Assert.Equal(paciente.IdPaciente, tratamiento.IdPaciente);
        Assert.Equal(seed.IdMedico, tratamiento.IdMedico);
        Assert.NotEqual(primera.IdHistorial, segunda.IdHistorial);
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "medico.api11", Password = password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }

    private sealed class ClinicalFlowFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = "api11-clinical-" + Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = "Server=(local);Database=api11;",
                    ["Jwt:Issuer"] = "API-Clinica.Api11Tests",
                    ["Jwt:Audience"] = "API-Clinica.Api11Tests.Client",
                    ["Jwt:SigningKey"] = signingKey,
                    ["Jwt:ExpirationMinutes"] = "60",
                    ["Logging:EventLog:LogLevel:Default"] = "None"
                }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<ClinicaDbContext>>();
                services.RemoveAll<ClinicaDbContext>();
                services.AddSingleton(new DbContextOptionsBuilder<ClinicaDbContext>()
                    .UseInMemoryDatabase(databaseName).Options);
                services.AddScoped<ClinicaDbContext>();
            });
        }

        public async Task<SeedResult> SeedAsync()
        {
            await using var scope = Services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var rol = new Rol { Nombre = "MEDICO API11", Activo = true };
            var sucursal = new Sucursal { Nombre = "Sucursal API11", Activa = true };
            db.AddRange(rol, sucursal);
            await db.SaveChangesAsync();

            var medico = new Empleado
            {
                IdSucursal = sucursal.IdSucursal,
                Nombres = "Medico", Apellidos = "Integral",
                DPI = "API11-MEDICO", TipoEmpleado = "Medico", Activo = true
            };
            db.Empleados.Add(medico);
            await db.SaveChangesAsync();

            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            var usuario = new Usuario
            {
                IdRol = rol.IdRol, IdEmpleado = medico.IdEmpleado,
                Username = "medico.api11", Activo = true
            };
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            usuario.PasswordHash = hasher.HashPassword(usuario, password);
            db.Usuarios.Add(usuario);
            db.Permisos.AddRange(
                new Permiso
                {
                    IdRol = rol.IdRol, Modulo = "Pacientes",
                    PuedeConsultar = true, PuedeCrear = true
                },
                new Permiso
                {
                    IdRol = rol.IdRol, Modulo = "Consultas",
                    PuedeConsultar = true, PuedeCrear = true
                },
                new Permiso
                {
                    IdRol = rol.IdRol, Modulo = "Historial",
                    PuedeConsultar = true, PuedeCrear = true
                });
            await db.SaveChangesAsync();
            return new SeedResult(password, sucursal.IdSucursal, medico.IdEmpleado);
        }
    }

    private sealed record SeedResult(string Password, int IdSucursal, int IdMedico);
}
