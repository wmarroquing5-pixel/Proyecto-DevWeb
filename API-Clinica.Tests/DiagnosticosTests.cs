using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
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
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/diagnosticos",
                new CrearDiagnosticoRequest { IdConsulta = 1, Descripcion = "Prueba" })).StatusCode);
        await factory.SetConsultationDoctorAsync(2);
        var created = await client.PostAsJsonAsync("/api/diagnosticos",
            new CrearDiagnosticoRequest { IdConsulta = 1, Descripcion = "  Diagnóstico  " });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var response = await created.Content.ReadFromJsonAsync<DiagnosticoResponse>();
        Assert.NotNull(response);
        Assert.Equal(2, response.IdMedico);
        Assert.Equal("Diagnóstico", response.Descripcion);
        Assert.Equal(2, await factory.GetPersistedDoctorIdAsync());
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
            new CrearDiagnosticoRequest { IdConsulta = 1, IdMedico = 1, Descripcion = "Prueba" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(1, await factory.GetPersistedDoctorIdAsync());
    }

    [Fact]
    public async Task MedicoDeConsultaInactivoRechazaDiagnostico()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantCrearAsync();
        await factory.SetEmployeeActiveAsync(1, false);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PostAsJsonAsync("/api/diagnosticos",
            new CrearDiagnosticoRequest { IdConsulta = 1, Descripcion = "Prueba" });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task LecturasExigenJwtYPermisoActualYDerivanMedicoDeConsulta()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedDiagnosticosAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/diagnosticos/1")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/diagnosticos")).StatusCode);

        await factory.GrantConsultarAsync();
        var response = await client.GetAsync("/api/diagnosticos/1");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var detalle = await response.Content.ReadFromJsonAsync<DiagnosticoResponse>();
        Assert.NotNull(detalle);
        Assert.Equal(1, detalle.IdMedico);
        Assert.Equal(1, detalle.IdConsulta);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/diagnosticos/999")).StatusCode);
        await factory.SetUserActiveAsync(false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/diagnosticos/1")).StatusCode);
    }

    [Fact]
    public async Task ListadoFiltraPaginaYValidaParametros()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedDiagnosticosAsync();
        await factory.GrantConsultarAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var page = await client.GetFromJsonAsync<PagedResponse<DiagnosticoResponse>>(
            "/api/diagnosticos?idConsulta=1&page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal(2, page.TotalPages);
        Assert.Single(page.Items);
        Assert.Equal(2, page.Items[0].IdDiagnostico);
        Assert.Equal(1, page.Items[0].IdMedico);

        var other = await client.GetFromJsonAsync<PagedResponse<DiagnosticoResponse>>(
            "/api/diagnosticos?idConsulta=2");
        Assert.NotNull(other);
        Assert.Equal(1, other.TotalCount);
        Assert.Equal(3, Assert.Single(other.Items).IdDiagnostico);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/diagnosticos?idConsulta=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/diagnosticos?pageSize=101")).StatusCode);
    }

    [Fact]
    public async Task ActualizacionSoloCambiaDescripcionYConservaReferenciasClinicas()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedDiagnosticosAsync();
        await factory.GrantModificarAsync();
        await factory.SeedHistorialAsync(1);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PutAsJsonAsync("/api/diagnosticos/1", new
        {
            IdConsulta = 2, IdMedico = 2, FechaRegistro = DateTime.UtcNow.AddDays(1),
            Descripcion = "  Descripción corregida  "
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<DiagnosticoResponse>();
        Assert.NotNull(result);
        Assert.Equal("Descripción corregida", result.Descripcion);
        Assert.Equal(1, result.IdConsulta);
        Assert.Equal(1, result.IdMedico);
        var persisted = await factory.GetDiagnosticoAsync(1);
        Assert.Equal(1, persisted.IdConsulta);
        Assert.Equal("Descripción corregida", persisted.Descripcion);
        Assert.Equal(factory.OriginalDate, persisted.FechaRegistro);
        Assert.Equal(1, await factory.GetHistorialConsultaAsync());
    }

    [Fact]
    public async Task ActualizacionRechazaSinPermisoMedicoAjenoYDiagnosticoInexistente()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedDiagnosticosAsync();
        using var client = factory.CreateClient();
        var request = new ActualizarDiagnosticoRequest { Descripcion = "Cambio" };
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PutAsJsonAsync("/api/diagnosticos/1", request)).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/diagnosticos/1", request)).StatusCode);
        await factory.GrantModificarAsync();
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/diagnosticos/999", request)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/diagnosticos/1",
                new ActualizarDiagnosticoRequest { Descripcion = "   " })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/diagnosticos/1",
                new ActualizarDiagnosticoRequest { Descripcion = new string('x', 301) })).StatusCode);
        await factory.SetUserEmployeeAsync(2);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/diagnosticos/1", request)).StatusCode);
        Assert.Equal("Hallazgo uno", (await factory.GetDiagnosticoAsync(1)).Descripcion);
    }

    [Fact]
    public async Task ActualizacionRechazaMedicoInactivoYPreservaPost()
    {
        using var factory = new DiagnosticoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedDiagnosticosAsync();
        await factory.GrantModificarAsync();
        await factory.GrantCrearAsync();
        await factory.SetEmployeeActiveAsync(1, false);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/diagnosticos/1",
                new ActualizarDiagnosticoRequest { Descripcion = "Cambio" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/diagnosticos",
                new CrearDiagnosticoRequest
                {
                    IdConsulta = 1, Descripcion = "Nuevo"
                })).StatusCode);
        Assert.Equal("Hallazgo uno", (await factory.GetDiagnosticoAsync(1)).Descripcion);
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
        public DateTime OriginalDate { get; } = new(2025, 1, 2, 3, 4, 5, DateTimeKind.Utc);

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
            var permiso = await db.Permisos.SingleOrDefaultAsync(p => p.Modulo == "Historial");
            if (permiso is null)
                db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Historial", PuedeCrear = true });
            else
                permiso.PuedeCrear = true;
            await db.SaveChangesAsync();
        }

        public Task GrantConsultarAsync() => GrantAsync(consultar: true, modificar: false);
        public Task GrantModificarAsync() => GrantAsync(consultar: false, modificar: true);

        private async Task GrantAsync(bool consultar, bool modificar)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleOrDefaultAsync(p => p.Modulo == "Historial");
            if (permiso is null)
                db.Permisos.Add(new Permiso
                {
                    IdRol = 1, Modulo = "Historial",
                    PuedeConsultar = consultar, PuedeModificar = modificar
                });
            else
            {
                permiso.PuedeConsultar |= consultar;
                permiso.PuedeModificar |= modificar;
            }
            await db.SaveChangesAsync();
        }

        public async Task SeedDiagnosticosAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Consultas.Add(new Consulta
            {
                IdConsulta = 2, IdPaciente = 1, IdMedico = 2, IdSucursal = 1,
                FechaConsulta = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            db.Diagnosticos.AddRange(
                new Diagnostico { IdDiagnostico = 1, IdConsulta = 1,
                    Descripcion = "Hallazgo uno", FechaRegistro = OriginalDate },
                new Diagnostico { IdDiagnostico = 2, IdConsulta = 1,
                    Descripcion = "Hallazgo dos", FechaRegistro = OriginalDate },
                new Diagnostico { IdDiagnostico = 3, IdConsulta = 2,
                    Descripcion = "Hallazgo tres", FechaRegistro = OriginalDate });
            await db.SaveChangesAsync();
        }

        public async Task SeedHistorialAsync(int idDiagnostico)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.HistorialesMedicos.Add(new Evolucion
            {
                IdEvolucion = 1, IdDiagnostico = idDiagnostico,
                FechaEvolucion = DateTime.UtcNow, Descripcion = "Seguimiento"
            });
            await db.SaveChangesAsync();
        }

        public async Task<Diagnostico> GetDiagnosticoAsync(int id)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            return await db.Diagnosticos.AsNoTracking().SingleAsync(d => d.IdDiagnostico == id);
        }

        public async Task<int?> GetHistorialConsultaAsync()
        {
            using var scope = Services.CreateScope();
            return (await scope.ServiceProvider.GetRequiredService<HistorialMedicoLecturaService>()
                .ObtenerAtribucionAsync(1, CancellationToken.None)).IdConsulta;
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

        public async Task SetConsultationDoctorAsync(int employeeId)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Consultas.SingleAsync()).IdMedico = employeeId;
            await db.SaveChangesAsync();
        }

        public async Task SetEmployeeActiveAsync(int employeeId, bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Empleados.SingleAsync(e => e.IdEmpleado == employeeId)).Activo = active;
            await db.SaveChangesAsync();
        }

        public async Task<int> CountAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            return await db.Diagnosticos.CountAsync();
        }

        public async Task<int> GetPersistedDoctorIdAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            return await db.Diagnosticos.AsNoTracking()
                .Join(db.Consultas.AsNoTracking(), d => d.IdConsulta, c => c.IdConsulta,
                    (_, c) => c.IdMedico)
                .SingleAsync();
        }

        private static Empleado Empleado(int id, string tipo, bool activo) => new()
        {
            IdEmpleado = id, IdSucursal = 1, Nombres = "Prueba", Apellidos = "Médico",
            DPI = $"DIAGNOSTICO-TEST-{id}", TipoEmpleado = tipo, Activo = activo
        };
    }
}
