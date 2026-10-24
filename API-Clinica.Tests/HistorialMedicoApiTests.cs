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
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace API_Clinica.Tests;

public sealed class HistorialMedicoApiTests
{
    [Fact]
    public async Task DetalleDerivaAtribucionDeConsultaDiagnosticoAmbosONinguno()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedHistorialesAsync();
        await factory.GrantConsultarAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        foreach (var id in new[] { 1, 2, 3 })
        {
            var dto = await client.GetFromJsonAsync<HistorialMedicoResponseDto>(
                $"/api/historial-medico/{id}");
            Assert.NotNull(dto);
            Assert.Equal(1, dto.IdConsulta);
            Assert.Equal(1, dto.IdPaciente);
            Assert.Equal(1, dto.IdMedico);
            Assert.Equal(id == 1 ? null : 1, dto.IdDiagnostico);
        }
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/historial-medico/4")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/historial-medico/999")).StatusCode);
    }

    [Fact]
    public async Task ListadoPaginaYFiltraPorConsultaDiagnosticoYPacienteDerivados()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedHistorialesAsync();
        await factory.GrantConsultarAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var consulta = await client.GetFromJsonAsync<PagedResponse<HistorialMedicoResponseDto>>(
            "/api/historial-medico?idConsulta=1&page=2&pageSize=1");
        Assert.NotNull(consulta);
        Assert.Equal(3, consulta.TotalCount);
        Assert.Equal(3, consulta.TotalPages);
        Assert.Equal(2, Assert.Single(consulta.Items).IdHistorial);
        Assert.Equal(1, consulta.Items[0].IdConsulta);

        var diagnostico = await client.GetFromJsonAsync<PagedResponse<HistorialMedicoResponseDto>>(
            "/api/historial-medico?idDiagnostico=1");
        Assert.NotNull(diagnostico);
        Assert.Equal(2, diagnostico.TotalCount);
        Assert.Equal(new[] { 2, 3 }, diagnostico.Items.Select(h => h.IdHistorial));

        var paciente = await client.GetFromJsonAsync<PagedResponse<HistorialMedicoResponseDto>>(
            "/api/historial-medico?idPaciente=2");
        Assert.NotNull(paciente);
        Assert.Equal(0, paciente.TotalCount);
        Assert.Empty(paciente.Items);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/historial-medico/5")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/historial-medico?idConsulta=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/historial-medico?pageSize=101")).StatusCode);
    }

    [Fact]
    public async Task ReferenciasContradictoriasSeRechazanSinInventarAtribucion()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedHistorialesAsync();
        await factory.GrantConsultarAsync();
        await factory.MoveDiagnosticoAsync(1, 2);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/historial-medico/3")).StatusCode);
        var visible = await client.GetFromJsonAsync<PagedResponse<HistorialMedicoResponseDto>>(
            "/api/historial-medico?idConsulta=1");
        Assert.Equal(1, visible?.TotalCount);
    }

    [Fact]
    public async Task ReferenciasHistoricasInexistentesNoSeExponenEnLectura()
    {
        using (var factory = new HistorialApiFactory())
        {
            var password = await factory.SeedAsync();
            await factory.SeedHistorialesAsync();
            await factory.GrantConsultarAsync();
            await factory.RemoveDiagnosticoAsync(1);
            using var client = factory.CreateClient();
            await LoginAsync(client, password);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync("/api/historial-medico/2")).StatusCode);
        }
        using (var factory = new HistorialApiFactory())
        {
            var password = await factory.SeedAsync();
            await factory.SeedHistorialesAsync();
            await factory.GrantConsultarAsync();
            await factory.RemoveConsultaAsync(1);
            using var client = factory.CreateClient();
            await LoginAsync(client, password);
            Assert.Equal(HttpStatusCode.NotFound,
                (await client.GetAsync("/api/historial-medico/1")).StatusCode);
        }
    }

    [Fact]
    public async Task JwtPermisoYEstadoActualProtegenLecturas()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedHistorialesAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/historial-medico")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/historial-medico/1")).StatusCode);
        await factory.GrantConsultarAsync();
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/historial-medico/1")).StatusCode);
        await factory.SetUserActiveAsync(false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/historial-medico/1")).StatusCode);
    }

    [Fact]
    public async Task CrearRegistraEvolucionYConservaHistorialAnterior()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedHistorialesAsync();
        await factory.GrantAsync(consultar: true, crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var antes = DateTime.UtcNow;
        var response = await client.PostAsJsonAsync("/api/historial-medico", Nuevo());
        var despues = DateTime.UtcNow;

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<HistorialMedicoResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdPaciente);
        Assert.Equal(1, dto.IdConsulta);
        Assert.Equal(1, dto.IdDiagnostico);
        Assert.Equal(1, dto.IdMedico);
        Assert.Equal("Paciente estable y sin fiebre", dto.Descripcion);
        Assert.InRange(dto.FechaHistorial, antes, despues);
        Assert.Equal($"/api/historial-medico/{dto.IdHistorial}",
            response.Headers.Location?.AbsolutePath);

        var detalle = await client.GetFromJsonAsync<HistorialMedicoResponseDto>(
            $"/api/historial-medico/{dto.IdHistorial}");
        Assert.Equal(dto, detalle);
        Assert.Equal("Consulta", (await client.GetFromJsonAsync<HistorialMedicoResponseDto>(
            "/api/historial-medico/1"))?.Descripcion);
        Assert.Equal(7, await factory.CountAsync());

        Assert.Equal(HttpStatusCode.MethodNotAllowed,
            (await client.PutAsJsonAsync($"/api/historial-medico/{dto.IdHistorial}",
                new { Descripcion = "Cambio" })).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed,
            (await client.DeleteAsync($"/api/historial-medico/{dto.IdHistorial}")).StatusCode);
    }

    [Fact]
    public async Task CrearEvolucionSinDiagnosticoConservaConsultaYPaciente()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(consultar: true, crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PostAsJsonAsync("/api/historial-medico",
            Nuevo(idDiagnostico: null));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await response.Content.ReadFromJsonAsync<HistorialMedicoResponseDto>();
        Assert.NotNull(created);
        Assert.Equal(1, created.IdPaciente);
        Assert.Equal(1, created.IdConsulta);
        Assert.Null(created.IdDiagnostico);

        var list = await client.GetFromJsonAsync<PagedResponse<HistorialMedicoResponseDto>>(
            "/api/historial-medico?idConsulta=1&idPaciente=1");
        Assert.Equal(created.IdHistorial, Assert.Single(list!.Items).IdHistorial);
        Assert.Equal(1, await factory.CountAsync());
    }

    [Fact]
    public async Task ReferenciasInvalidasNoCreanEvolucion()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/historial-medico",
                Nuevo(idPaciente: 999))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/historial-medico",
                Nuevo(idConsulta: 999, idDiagnostico: null))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/historial-medico",
                Nuevo(idDiagnostico: 999))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/historial-medico",
                Nuevo(idPaciente: 1, idConsulta: 2, idDiagnostico: null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/historial-medico",
                Nuevo(idDiagnostico: 2))).StatusCode);

        await factory.SetPatientActiveAsync(1, false);
        Assert.Equal(HttpStatusCode.UnprocessableEntity,
            (await client.PostAsJsonAsync("/api/historial-medico", Nuevo())).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task MedicoAjenoOInactivoNoPuedeCrearEvolucion()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/historial-medico",
                Nuevo(idPaciente: 2, idConsulta: 2, idDiagnostico: 2))).StatusCode);
        await factory.SetEmployeeActiveAsync(1, false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/historial-medico", Nuevo())).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task JwtPermisoUsuarioYRolProtegenCreacion()
    {
        using (var factory = new HistorialApiFactory())
        {
            var password = await factory.SeedAsync();
            using var client = factory.CreateClient();
            Assert.Equal(HttpStatusCode.Unauthorized,
                (await client.PostAsJsonAsync("/api/historial-medico", Nuevo())).StatusCode);
            await LoginAsync(client, password);
            Assert.Equal(HttpStatusCode.Forbidden,
                (await client.PostAsJsonAsync("/api/historial-medico", Nuevo())).StatusCode);
        }

        using (var factory = new HistorialApiFactory())
        {
            var password = await factory.SeedAsync();
            await factory.GrantAsync(crear: true);
            using var client = factory.CreateClient();
            await LoginAsync(client, password);
            await factory.SetUserActiveAsync(false);
            Assert.Equal(HttpStatusCode.Forbidden,
                (await client.PostAsJsonAsync("/api/historial-medico", Nuevo())).StatusCode);
        }

        using (var factory = new HistorialApiFactory())
        {
            var password = await factory.SeedAsync();
            await factory.GrantAsync(crear: true);
            using var client = factory.CreateClient();
            await LoginAsync(client, password);
            await factory.SetRoleActiveAsync(false);
            Assert.Equal(HttpStatusCode.Forbidden,
                (await client.PostAsJsonAsync("/api/historial-medico", Nuevo())).StatusCode);
        }
    }

    [Fact]
    public async Task DatosInvalidosYCamposDeSuplantacionSeRechazan()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var invalidos = new object[]
        {
            new { IdPaciente = 0, IdConsulta = 1, Descripcion = "Evolución" },
            new { IdPaciente = 1, IdConsulta = 0, Descripcion = "Evolución" },
            new { IdPaciente = 1, IdConsulta = 1, Descripcion = "   " },
            new { IdPaciente = 1, IdConsulta = 1, Descripcion = new string('x', 301) },
            new { IdPaciente = 1, IdConsulta = 1, Descripcion = "Evolución", IdMedico = 2 }
        };
        foreach (var request in invalidos)
            Assert.Equal(HttpStatusCode.BadRequest,
                (await client.PostAsJsonAsync("/api/historial-medico", request)).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task ErrorDePersistenciaNoDejaEscrituraParcial()
    {
        using var factory = new HistorialApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        factory.FailNextSave();

        Assert.Equal(HttpStatusCode.InternalServerError,
            (await client.PostAsJsonAsync("/api/historial-medico", Nuevo())).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public void ModeloEfConservaCincoColumnasDosFkYCompatibilidadClr()
    {
        using var db = new ClinicaDbContext(new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);
        var entity = db.Model.FindEntityType(typeof(Evolucion));
        Assert.NotNull(entity);
        Assert.Equal(5, entity.GetProperties().Count());
        Assert.Equal(2, entity.GetForeignKeys().Count());
        Assert.Null(entity.FindProperty(nameof(Evolucion.IdPaciente)));
        Assert.Null(entity.FindProperty(nameof(Evolucion.IdMedico)));
        Assert.NotNull(entity.FindProperty(nameof(Evolucion.IdConsulta)));
        Assert.NotNull(entity.FindProperty(nameof(Evolucion.IdDiagnostico)));
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "historial.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private static HistorialMedicoCreateDto Nuevo(
        int idPaciente = 1, int idConsulta = 1, int? idDiagnostico = 1) => new()
    {
        IdPaciente = idPaciente,
        IdConsulta = idConsulta,
        IdDiagnostico = idDiagnostico,
        Descripcion = "  Paciente   estable y sin fiebre  "
    };

    private sealed class HistorialApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        private readonly FailNextSaveInterceptor saveInterceptor = new();

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
                    .UseInMemoryDatabase(databaseName)
                    .AddInterceptors(saveInterceptor).Options);
                services.AddScoped<ClinicaDbContext>();
            });
        }

        public async Task<string> SeedAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            db.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            db.Sucursales.Add(new Sucursal { IdSucursal = 1, Nombre = "Prueba", Activa = true });
            db.Empleados.AddRange(Empleado(1), Empleado(2));
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, IdEmpleado = 1,
                Username = "historial.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            db.Pacientes.AddRange(Paciente(1), Paciente(2));
            await db.SaveChangesAsync();
            db.Consultas.AddRange(
                new Consulta { IdConsulta = 1, IdPaciente = 1, IdMedico = 1,
                    IdSucursal = 1, FechaConsulta = DateTime.UtcNow },
                new Consulta { IdConsulta = 2, IdPaciente = 2, IdMedico = 2,
                    IdSucursal = 1, FechaConsulta = DateTime.UtcNow });
            await db.SaveChangesAsync();
            db.Diagnosticos.AddRange(
                new Diagnostico { IdDiagnostico = 1, IdConsulta = 1,
                    Descripcion = "Uno", FechaRegistro = DateTime.UtcNow },
                new Diagnostico { IdDiagnostico = 2, IdConsulta = 2,
                    Descripcion = "Dos", FechaRegistro = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return password;
        }

        public async Task SeedHistorialesAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.HistorialesMedicos.AddRange(
                Historial(1, 1, null, "Consulta"),
                Historial(2, null, 1, "Diagnóstico"),
                Historial(3, 1, 1, "Ambas"),
                Historial(4, null, null, "Sin asociación"),
                Historial(5, 2, null, "Otro paciente"),
                Historial(6, null, 2, "Otro diagnóstico"));
            await db.SaveChangesAsync();
        }

        public async Task GrantConsultarAsync()
            => await GrantAsync(consultar: true);

        public async Task GrantAsync(bool consultar = false, bool crear = false)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleOrDefaultAsync(p =>
                p.IdRol == 1 && p.Modulo == "Historial");
            if (permiso is null)
            {
                permiso = new Permiso { IdRol = 1, Modulo = "Historial" };
                db.Permisos.Add(permiso);
            }
            permiso.PuedeConsultar |= consultar;
            permiso.PuedeCrear |= crear;
            await db.SaveChangesAsync();
        }

        public async Task MoveDiagnosticoAsync(int id, int nuevaConsulta)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Diagnosticos.SingleAsync(d => d.IdDiagnostico == id)).IdConsulta = nuevaConsulta;
            await db.SaveChangesAsync();
        }

        public async Task RemoveDiagnosticoAsync(int id)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Diagnosticos.Remove(await db.Diagnosticos.SingleAsync(d => d.IdDiagnostico == id));
            await db.SaveChangesAsync();
        }

        public async Task RemoveConsultaAsync(int id)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Consultas.Remove(await db.Consultas.SingleAsync(c => c.IdConsulta == id));
            await db.SaveChangesAsync();
        }

        public async Task SetUserActiveAsync(bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).Activo = active;
            await db.SaveChangesAsync();
        }

        public async Task SetRoleActiveAsync(bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Roles.SingleAsync()).Activo = active;
            await db.SaveChangesAsync();
        }

        public async Task SetEmployeeActiveAsync(int id, bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Empleados.SingleAsync(e => e.IdEmpleado == id)).Activo = active;
            await db.SaveChangesAsync();
        }

        public async Task SetPatientActiveAsync(int id, bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Pacientes.SingleAsync(p => p.IdPaciente == id)).Activo = active;
            await db.SaveChangesAsync();
        }

        public void FailNextSave() => saveInterceptor.Arm();

        public async Task<int> CountAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .HistorialesMedicos.CountAsync();
        }

        private static Evolucion Historial(
            int id, int? consulta, int? diagnostico, string descripcion) => new()
        {
            IdEvolucion = id, IdConsulta = consulta, IdDiagnostico = diagnostico,
            IdPaciente = 999, IdMedico = 999, Descripcion = descripcion,
            FechaEvolucion = DateTime.UtcNow
        };

        private static Paciente Paciente(int id) => new()
        {
            IdPaciente = id, Nombres = "Paciente", Apellidos = "Prueba",
            FechaNacimiento = new DateOnly(2000, 1, 1),
            FechaRegistro = DateTime.UtcNow, Activo = true
        };

        private static Empleado Empleado(int id) => new()
        {
            IdEmpleado = id, IdSucursal = 1, Nombres = "Médico",
            Apellidos = "Prueba", DPI = $"HIST-TEST-{id}",
            TipoEmpleado = "Medico", Activo = true
        };

        private sealed class FailNextSaveInterceptor : SaveChangesInterceptor
        {
            private int armed;

            public void Arm() => Interlocked.Exchange(ref armed, 1);

            public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
                DbContextEventData eventData, InterceptionResult<int> result,
                CancellationToken cancellationToken = default)
            {
                if (Interlocked.Exchange(ref armed, 0) == 1)
                    throw new DbUpdateException("Fallo sintético de persistencia.");
                return base.SavingChangesAsync(eventData, result, cancellationToken);
            }
        }
    }
}
