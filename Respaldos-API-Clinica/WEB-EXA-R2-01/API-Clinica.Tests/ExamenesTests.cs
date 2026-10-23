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

public sealed class ExamenesTests
{
    private static readonly DateTime Fecha = new(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc);

    [Fact]
    public async Task CrearConRelacionesValidasDerivaPacienteYMedico()
    {
        using var factory = new ExamenApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/examenes", Nuevo(
            idConsulta: 1, idDiagnostico: 1, idTurno: 1, prioridad: " Alta "));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<ExamenResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdConsulta);
        Assert.Equal(1, dto.IdDiagnostico);
        Assert.Equal(1, dto.IdPaciente);
        Assert.Equal(1, dto.IdMedico);
        Assert.Equal("Alta", dto.Prioridad);
        Assert.Equal("Hemograma completo", dto.NombreExamen);
        Assert.Equal(new DateOnly(2026, 6, 2), dto.FechaResultado);
        Assert.Equal(1, await factory.CountAsync());
    }

    [Fact]
    public async Task RelacionesOpcionalesNoInventanAtribucion()
    {
        using var factory = new ExamenApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantAsync(crear: true, consultar: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var libre = await client.PostAsJsonAsync("/api/examenes",
            new ExamenCreateDto { NombreExamen = "Sin asociación", FechaExamen = Fecha });
        Assert.Equal(HttpStatusCode.Created, libre.StatusCode);
        var sinRelacion = await libre.Content.ReadFromJsonAsync<ExamenResponseDto>();
        Assert.NotNull(sinRelacion);
        Assert.Null(sinRelacion.IdConsulta);
        Assert.Null(sinRelacion.IdDiagnostico);
        Assert.Null(sinRelacion.IdPaciente);
        Assert.Null(sinRelacion.IdMedico);
        Assert.Null(sinRelacion.FechaResultado);

        var porConsulta = await client.PostAsJsonAsync("/api/examenes", Nuevo(idConsulta: 1));
        var porDiagnostico = await client.PostAsJsonAsync("/api/examenes",
            Nuevo(idDiagnostico: 1));
        Assert.Equal(HttpStatusCode.Created, porConsulta.StatusCode);
        Assert.Equal(HttpStatusCode.Created, porDiagnostico.StatusCode);
        var derivado = await porDiagnostico.Content.ReadFromJsonAsync<ExamenResponseDto>();
        Assert.NotNull(derivado);
        Assert.Null(derivado.IdConsulta);
        Assert.Equal(1, derivado.IdPaciente);
        Assert.Equal(1, derivado.IdMedico);

        var detalle = await client.GetFromJsonAsync<ExamenResponseDto>(
            $"/api/examenes/{derivado.IdExamen}");
        Assert.NotNull(detalle);
        Assert.Equal(derivado, detalle);
    }

    [Fact]
    public async Task RechazaReferenciasInexistentesIncoherentesYPrioridadInvalida()
    {
        using var factory = new ExamenApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var invalidos = new[]
        {
            Nuevo(idConsulta: 999), Nuevo(idDiagnostico: 999),
            Nuevo(idTurno: 999), Nuevo(idConsulta: 2, idDiagnostico: 1),
            Nuevo(prioridad: "Urgente"),
            Nuevo(fechaResultado: new DateOnly(2026, 5, 31)),
            Nuevo(nombre: "  "), Nuevo(nombre: new string('x', 201)),
            new ExamenCreateDto { NombreExamen = "Examen", FechaExamen = default }
        };
        foreach (var request in invalidos)
            Assert.Equal(HttpStatusCode.BadRequest,
                (await client.PostAsJsonAsync("/api/examenes", request)).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task MedicoAjenoOInactivoNoPuedeRegistrarExamenClinico()
    {
        using var factory = new ExamenApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 2);
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/examenes", Nuevo(idConsulta: 1))).StatusCode);
        await factory.SetUserEmployeeAsync(1);
        await factory.SetEmployeeActiveAsync(1, false);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/examenes",
                Nuevo(idDiagnostico: 1))).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task JwtPermisosYEstadoActualProtegenRutas()
    {
        using var factory = new ExamenApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/examenes")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/examenes", Nuevo())).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/examenes")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/examenes", Nuevo())).StatusCode);
        await factory.GrantAsync(consultar: true, crear: true);
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/examenes")).StatusCode);
        var created = await client.PostAsJsonAsync("/api/examenes", Nuevo());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/examenes/1", Actualizar())).StatusCode);
        await factory.SetUserActiveAsync(false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/examenes")).StatusCode);
    }

    [Fact]
    public async Task ListadoFiltraYPaginaYDetalleNoEncontrado()
    {
        using var factory = new ExamenApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedExamenesAsync();
        await factory.GrantAsync(consultar: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var page = await client.GetFromJsonAsync<PagedResponse<ExamenResponseDto>>(
            "/api/examenes?idConsulta=1&page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal(2, page.TotalPages);
        Assert.Equal(2, Assert.Single(page.Items).IdExamen);
        var diag = await client.GetFromJsonAsync<PagedResponse<ExamenResponseDto>>(
            "/api/examenes?idDiagnostico=1");
        Assert.NotNull(diag);
        Assert.Equal(1, diag.TotalCount);
        Assert.Equal(3, Assert.Single(diag.Items).IdExamen);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/examenes/999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/examenes?idDiagnostico=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/examenes?pageSize=101")).StatusCode);
    }

    [Fact]
    public async Task ActualizacionConservaAsociacionesYValidaTurnoYMedico()
    {
        using var factory = new ExamenApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedExamenesAsync();
        await factory.GrantAsync(modificar: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/examenes/1", new
            {
                IdConsulta = 2, NombreExamen = "Cambio", FechaExamen = Fecha
            })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/examenes/1", Actualizar(idTurno: 999)))
            .StatusCode);
        var response = await client.PutAsJsonAsync("/api/examenes/1", Actualizar(idTurno: 2));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<ExamenResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdConsulta);
        Assert.Null(dto.IdDiagnostico);
        Assert.Equal(2, dto.IdTurno);
        Assert.Equal("Resultado revisado", dto.NombreExamen);
        await factory.SetUserEmployeeAsync(2);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/examenes/1", Actualizar())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/examenes/999", Actualizar())).StatusCode);
        Assert.Equal(1, (await factory.GetExamenAsync(1)).IdConsulta);
    }

    [Fact]
    public void ModeloEfNoPersisteResultadoNiAtribucionDerivada()
    {
        using var db = new ClinicaDbContext(new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);
        var entity = db.Model.FindEntityType(typeof(Examen));
        Assert.NotNull(entity);
        Assert.Null(entity.FindProperty(nameof(Examen.Resultado)));
        Assert.Null(entity.FindProperty(nameof(Examen.IdPaciente)));
        Assert.Null(entity.FindProperty(nameof(Examen.IdMedico)));
        Assert.NotNull(entity.FindProperty(nameof(Examen.IdDiagnostico)));
        Assert.NotNull(entity.FindProperty(nameof(Examen.IdTurno)));
        Assert.NotNull(entity.FindProperty(nameof(Examen.FechaResultado)));
        Assert.NotNull(entity.FindProperty(nameof(Examen.Prioridad)));
        Assert.Equal(8, entity.GetProperties().Count());
        Assert.Equal(3, entity.GetForeignKeys().Count());
        Assert.False(entity.FindProperty(nameof(Examen.IdDiagnostico))!.IsShadowProperty());
        Assert.False(entity.FindProperty(nameof(Examen.IdTurno))!.IsShadowProperty());
    }

    private static ExamenCreateDto Nuevo(
        int? idConsulta = null, int? idDiagnostico = null, int? idTurno = null,
        string? prioridad = null, string nombre = "  Hemograma   completo  ",
        DateTime? fechaExamen = null, DateOnly? fechaResultado = null) => new()
    {
        IdConsulta = idConsulta, IdDiagnostico = idDiagnostico, IdTurno = idTurno,
        NombreExamen = nombre, FechaExamen = fechaExamen ?? Fecha,
        FechaResultado = fechaResultado ?? new DateOnly(2026, 6, 2),
        Prioridad = prioridad
    };

    private static ExamenUpdateDto Actualizar(int? idTurno = null) => new()
    {
        IdTurno = idTurno, NombreExamen = " Resultado   revisado ",
        FechaExamen = Fecha, FechaResultado = new DateOnly(2026, 6, 3),
        Prioridad = "Media"
    };

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "examenes.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class ExamenApiFactory : WebApplicationFactory<Program>
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
                Empleado(1, "Medico", true), Empleado(2, "Medico", true),
                Empleado(3, "Enfermera", true));
            db.Turnos.AddRange(
                new Turno { IdTurno = 1, Nombre = "Matutino", Codigo = "MAT",
                    Jornada = "Diurna", Activo = true },
                new Turno { IdTurno = 2, Nombre = "Vespertino", Codigo = "VES",
                    Jornada = "Diurna", Activo = true });
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, IdEmpleado = idEmpleadoUsuario,
                Username = "examenes.prueba", Activo = true
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
            db.Consultas.AddRange(
                new Consulta { IdConsulta = 1, IdPaciente = 1, IdMedico = 1,
                    IdSucursal = 1, FechaConsulta = Fecha },
                new Consulta { IdConsulta = 2, IdPaciente = 1, IdMedico = 2,
                    IdSucursal = 1, FechaConsulta = Fecha });
            await db.SaveChangesAsync();
            db.Diagnosticos.Add(new Diagnostico
            {
                IdDiagnostico = 1, IdConsulta = 1, Descripcion = "Hallazgo",
                FechaRegistro = Fecha
            });
            await db.SaveChangesAsync();
            return password;
        }

        public async Task GrantAsync(
            bool consultar = false, bool crear = false, bool modificar = false)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleOrDefaultAsync(p => p.Modulo == "Historial");
            if (permiso is null)
                db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Historial",
                    PuedeConsultar = consultar, PuedeCrear = crear, PuedeModificar = modificar });
            else
            {
                permiso.PuedeConsultar |= consultar;
                permiso.PuedeCrear |= crear;
                permiso.PuedeModificar |= modificar;
            }
            await db.SaveChangesAsync();
        }

        public async Task SeedExamenesAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Examenes.AddRange(
                new Examen { IdExamen = 1, IdConsulta = 1, NombreExamen = "Uno",
                    FechaExamen = Fecha },
                new Examen { IdExamen = 2, IdConsulta = 1, NombreExamen = "Dos",
                    FechaExamen = Fecha },
                new Examen { IdExamen = 3, IdDiagnostico = 1, NombreExamen = "Tres",
                    FechaExamen = Fecha });
            await db.SaveChangesAsync();
        }

        public async Task<int> CountAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Examenes.CountAsync();
        }

        public async Task<Examen> GetExamenAsync(int id)
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Examenes.AsNoTracking().SingleAsync(e => e.IdExamen == id);
        }

        public async Task SetUserEmployeeAsync(int id)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).IdEmpleado = id;
            await db.SaveChangesAsync();
        }

        public async Task SetEmployeeActiveAsync(int id, bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Empleados.SingleAsync(e => e.IdEmpleado == id)).Activo = active;
            await db.SaveChangesAsync();
        }

        public async Task SetUserActiveAsync(bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).Activo = active;
            await db.SaveChangesAsync();
        }

        private static Empleado Empleado(int id, string tipo, bool activo) => new()
        {
            IdEmpleado = id, IdSucursal = 1, Nombres = "Prueba", Apellidos = "Médico",
            DPI = $"EXAMEN-TEST-{id}", TipoEmpleado = tipo, Activo = activo
        };
    }
}
