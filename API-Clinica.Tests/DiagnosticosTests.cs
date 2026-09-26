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

public sealed class DiagnosticosTests
{
    [Fact]
    public async Task PostExigeJwtPermisoActualYUsuarioActivo()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        using var client = factory.CreateClient();
        var request = new CrearDiagnosticoRequest { IdConsulta = 1, Descripcion = "Hallazgo" };

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/diagnosticos", request)).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/diagnosticos", request)).StatusCode);

        await factory.GrantCrearAsync();
        var created = await client.PostAsJsonAsync("/api/diagnosticos", request);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(1, (await created.Content.ReadFromJsonAsync<DiagnosticoResponse>())?.IdMedico);

        await factory.SetUserActiveAsync(false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/diagnosticos", request)).StatusCode);
        Assert.Equal(1, await factory.CountAsync());
    }

    [Fact]
    public async Task MedicoVinculadoSeObtieneDeUsuarioActualYRechazaSuplantacion()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantCrearAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var forged = await client.PostAsJsonAsync("/api/diagnosticos",
            new CrearDiagnosticoRequest { IdConsulta = 1, IdMedico = 2, Descripcion = "Prueba" });
        Assert.Equal(HttpStatusCode.BadRequest, forged.StatusCode);
        Assert.Equal(0, await factory.CountAsync());

        await factory.SetUserEmployeeAsync(2);
        var created = await client.PostAsJsonAsync("/api/diagnosticos",
            new CrearDiagnosticoRequest { IdConsulta = 1, Descripcion = "  Diagnóstico  " });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var response = await created.Content.ReadFromJsonAsync<DiagnosticoResponse>();
        Assert.NotNull(response);
        Assert.Equal(2, response.IdMedico);
        Assert.Equal("Diagnóstico", response.Descripcion);
        Assert.Equal(2, (await factory.GetSingleAsync()).IdMedico);
    }

    [Fact]
    public async Task UsuarioSinMedicoVinculadoRequiereMedicoValidoYConsultaExistente()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: null);
        await factory.GrantCrearAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var invalidRequests = new[]
        {
            new CrearDiagnosticoRequest { IdConsulta = 1, Descripcion = "Prueba" },
            new CrearDiagnosticoRequest { IdConsulta = 1, IdMedico = 3, Descripcion = "Prueba" },
            new CrearDiagnosticoRequest { IdConsulta = 1, IdMedico = 4, Descripcion = "Prueba" },
            new CrearDiagnosticoRequest { IdConsulta = 1, IdMedico = 999, Descripcion = "Prueba" },
            new CrearDiagnosticoRequest { IdConsulta = 1, IdMedico = 2, Descripcion = "   " }
        };
        foreach (var request in invalidRequests)
            Assert.Equal(HttpStatusCode.BadRequest,
                (await client.PostAsJsonAsync("/api/diagnosticos", request)).StatusCode);

        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/diagnosticos",
                new CrearDiagnosticoRequest
                {
                    IdConsulta = 999, IdMedico = 2, Descripcion = "Prueba"
                })).StatusCode);
        Assert.Equal(0, await factory.CountAsync());

        var created = await client.PostAsJsonAsync("/api/diagnosticos",
            new CrearDiagnosticoRequest { IdConsulta = 1, IdMedico = 2, Descripcion = "Prueba" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(2, (await factory.GetSingleAsync()).IdMedico);
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "diagnosticos.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class DiagnosticoApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = "Server=(local);Database=NotUsedInMemory;Trusted_Connection=True;TrustServerCertificate=True",
                    ["Jwt:Issuer"] = "API-Clinica.Tests",
                    ["Jwt:Audience"] = "API-Clinica.Tests.Client",
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

        public async Task<string> SeedAsync(int? idEmpleadoUsuario)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            db.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            db.Sucursales.Add(new Sucursal { IdSucursal = 1, Nombre = "Prueba", Activa = true });
            db.Empleados.AddRange(
                Empleado(1, "Medico", true),
                Empleado(2, "Medico", true),
                Empleado(3, "Enfermera", true),
                Empleado(4, "Medico", false));
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, IdEmpleado = idEmpleadoUsuario,
                Username = "diagnosticos.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            db.Pacientes.Add(new Paciente
            {
                IdPaciente = 1, Nombres = "Prueba", Apellidos = "Paciente",
                FechaNacimiento = new DateOnly(2000, 1, 1),
                FechaRegistro = DateTime.UtcNow, Activo = true
            });
            await db.SaveChangesAsync();
            db.Consultas.Add(new Consulta
            {
                IdConsulta = 1, IdPaciente = 1, IdMedico = 1, IdSucursal = 1,
                FechaConsulta = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            return password;
        }

        public async Task GrantCrearAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Historial", PuedeCrear = true });
            await db.SaveChangesAsync();
        }

        public async Task SetUserActiveAsync(bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).Activo = active;
            await db.SaveChangesAsync();
        }

        public async Task SetUserEmployeeAsync(int employeeId)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).IdEmpleado = employeeId;
            await db.SaveChangesAsync();
        }

        public async Task<int> CountAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            return await db.Diagnosticos.CountAsync();
        }

        public async Task<Diagnostico> GetSingleAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            return await db.Diagnosticos.AsNoTracking().SingleAsync();
        }

        private static Empleado Empleado(int id, string tipo, bool activo) => new()
        {
            IdEmpleado = id, IdSucursal = 1, Nombres = "Prueba", Apellidos = "Médico",
            DPI = $"DIAGNOSTICO-TEST-{id}", TipoEmpleado = tipo, Activo = activo
        };
    }
}
