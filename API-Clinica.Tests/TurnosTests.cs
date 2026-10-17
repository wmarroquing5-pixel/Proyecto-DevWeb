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

public sealed class TurnosTests
{
    private static readonly TimeOnly Entrada = new(8, 15, 0, 123, 456);
    private static readonly TimeOnly Salida = new(17, 30, 0, 654, 321);

    private static TurnoCreateDto Nuevo(string codigo = "MAT") => new()
    {
        Nombre = "Matutino", Codigo = codigo, Jornada = "Diurna",
        HoraEntrada = Entrada, HoraSalida = Salida
    };

    [Fact]
    public async Task CreaConHorasExactasYEstadoControladoPorServidor()
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/turnos", new
        {
            idTurno = 999, activo = false, nombre = " Turno   mañana ",
            codigo = " MAT ", jornada = " Diurna ",
            horaEntrada = Entrada, horaSalida = Salida
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<TurnoResponseDto>();
        Assert.NotNull(dto);
        Assert.NotEqual(999, dto.IdTurno);
        Assert.True(dto.Activo);
        Assert.Equal("Turno mañana", dto.Nombre);
        Assert.Equal("MAT", dto.Codigo);
        Assert.Equal(Entrada, dto.HoraEntrada);
        Assert.Equal(Salida, dto.HoraSalida);
        Assert.Equal($"/api/turnos/{dto.IdTurno}", response.Headers.Location?.AbsolutePath);
    }

    [Theory]
    [InlineData("   ", "MAT", "Diurna")]
    [InlineData("Matutino", "   ", "Diurna")]
    [InlineData("Matutino", "MAT", "   ")]
    [InlineData("Matutino", "MAT", "Vespertina")]
    [InlineData("Matutino", "MAT", "diurna")]
    public async Task RechazaCamposObligatoriosYJornadasNoDefinidas(
        string nombre, string codigo, string jornada)
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/turnos", new TurnoCreateDto
            {
                Nombre = nombre, Codigo = codigo, Jornada = jornada,
                HoraEntrada = Entrada, HoraSalida = Salida
            })).StatusCode);
    }

    [Theory]
    [InlineData(51, 1, 1)]
    [InlineData(1, 21, 1)]
    [InlineData(1, 1, 21)]
    public async Task RechazaLongitudesSql(int nombre, int codigo, int jornada)
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/turnos", new TurnoCreateDto
            {
                Nombre = new string('N', nombre), Codigo = new string('C', codigo),
                Jornada = new string('J', jornada),
                HoraEntrada = Entrada, HoraSalida = Salida
            })).StatusCode);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ExigeAmbasHoras(bool faltaEntrada)
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/turnos", new TurnoCreateDto
            {
                Nombre = "Prueba", Codigo = "MAT", Jornada = "Diurna",
                HoraEntrada = faltaEntrada ? null : Entrada,
                HoraSalida = faltaEntrada ? Salida : null
            })).StatusCode);
    }

    [Fact]
    public async Task RechazaFormatoDeHoraInvalido()
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/turnos", new
            {
                nombre = "Prueba", codigo = "MAT", jornada = "Diurna",
                horaEntrada = "25:00:00", horaSalida = "17:00:00"
            })).StatusCode);
    }

    [Theory]
    [InlineData("Diurna", "00:00:00.0000000", "08:00:00.0000000")]
    [InlineData("Nocturna", "22:00:00.0000000", "06:00:00.0000000")]
    public async Task AceptaJornadasYTurnoQueCruzaMedianoche(
        string jornada, string entrada, string salida)
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/turnos", new TurnoCreateDto
        {
            Nombre = "Prueba", Codigo = "PR", Jornada = jornada,
            HoraEntrada = TimeOnly.Parse(entrada), HoraSalida = TimeOnly.Parse(salida)
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<TurnoResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(TimeOnly.Parse(entrada), dto.HoraEntrada);
        Assert.Equal(TimeOnly.Parse(salida), dto.HoraSalida);
    }

    [Fact]
    public async Task CodigoDuplicadoEsConflictoEnCreacionYActualizacion()
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedTurnosAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/turnos", Nuevo())).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync("/api/turnos/2", new TurnoUpdateDto
            {
                Nombre = "Duplicado", Codigo = "MAT", Jornada = "Diurna",
                HoraEntrada = Entrada, HoraSalida = Salida
            })).StatusCode);
    }

    [Fact]
    public async Task ListaPaginadaYConsultaPorId()
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedTurnosAsync();
        await factory.GrantAsync(true, false, false, false);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var page = await client.GetFromJsonAsync<PagedResponse<TurnoResponseDto>>(
            "/api/turnos?page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal("NOC", Assert.Single(page.Items).Codigo);
        Assert.Equal("NOC", (await client.GetFromJsonAsync<TurnoResponseDto>(
            "/api/turnos/2"))?.Codigo);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/turnos/999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/turnos?page=0")).StatusCode);
    }

    [Fact]
    public async Task ActualizaCodigoYHorasSinCambiarEstado()
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedTurnosAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PutAsJsonAsync("/api/turnos/1", new
        {
            idTurno = 999, activo = false, nombre = " Nuevo   turno ",
            codigo = " NUE ", jornada = "Nocturna",
            horaEntrada = new TimeOnly(23, 0), horaSalida = new TimeOnly(7, 0)
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<TurnoResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdTurno);
        Assert.True(dto.Activo);
        Assert.Equal("Nuevo turno", dto.Nombre);
        Assert.Equal("NUE", dto.Codigo);
        Assert.Equal(new TimeOnly(23, 0), dto.HoraEntrada);
        Assert.Equal(new TimeOnly(7, 0), dto.HoraSalida);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/turnos/999", new TurnoUpdateDto
            {
                Nombre = "Otro", Codigo = "OT", Jornada = "Diurna",
                HoraEntrada = Entrada, HoraSalida = Salida
            })).StatusCode);
    }

    [Fact]
    public async Task DesactivaSinPerderReferenciasDeEmpleadoYExamen()
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedTurnosAsync();
        await factory.SeedReferenciasAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/turnos/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/turnos/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync("/api/turnos/999")).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.False((await db.Turnos.SingleAsync(t => t.IdTurno == 1)).Activo);
        Assert.Equal(1, (await db.Empleados.SingleAsync()).IdTurno);
        Assert.Equal(1, (await db.Examenes.SingleAsync()).IdTurno);
        Assert.False((await client.GetFromJsonAsync<TurnoResponseDto>("/api/turnos/1"))!.Activo);
    }

    [Fact]
    public async Task ExigeJwtYPermisoActualPorOperacion()
    {
        using var factory = new TurnoApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedTurnosAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/turnos")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/turnos")).StatusCode);
        await factory.GrantAsync(true, false, false, false);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/turnos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/turnos", Nuevo("OT"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/turnos/1", new TurnoUpdateDto
            {
                Nombre = "Otro", Codigo = "MAT", Jornada = "Diurna",
                HoraEntrada = Entrada, HoraSalida = Salida
            })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync("/api/turnos/1")).StatusCode);
        await factory.GrantAsync(true, true, true, true);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/turnos", Nuevo("OT"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync("/api/turnos/1", new TurnoUpdateDto
            {
                Nombre = "Otro", Codigo = "MAT", Jornada = "Diurna",
                HoraEntrada = Entrada, HoraSalida = Salida
            })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/turnos/1")).StatusCode);
    }

    [Fact]
    public void MapeoConservaSieteColumnasYDosRelacionesEntrantes()
    {
        using var factory = new TurnoApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var entity = db.Model.FindEntityType(typeof(Turno));
        Assert.NotNull(entity);
        Assert.Equal("Turno", entity.GetTableName());
        Assert.Equal(7, entity.GetProperties().Count());
        Assert.All(entity.GetProperties(), p => Assert.NotNull(p.PropertyInfo));
        Assert.Equal("IdTurno", Assert.Single(entity.FindPrimaryKey()!.Properties).Name);
        Assert.True(entity.GetIndexes().Single(i => i.Properties.Single().Name == "Codigo").IsUnique);
        Assert.Equal("time(7)", entity.FindProperty("HoraEntrada")!
            .FindAnnotation("Relational:ColumnType")?.Value);
        Assert.Equal("time(7)", entity.FindProperty("HoraSalida")!
            .FindAnnotation("Relational:ColumnType")?.Value);
        Assert.True(entity.FindProperty("Activo")!.GetDefaultValue() is true);
        var inbound = entity.GetReferencingForeignKeys().ToArray();
        Assert.Equal(2, inbound.Length);
        Assert.Contains(inbound, fk => fk.DeclaringEntityType.GetTableName() == "Empleado" &&
            fk.Properties.Single().Name == "IdTurno" && fk.DeleteBehavior == DeleteBehavior.NoAction);
        Assert.Contains(inbound, fk => fk.DeclaringEntityType.GetTableName() == "Examen" &&
            fk.Properties.Single().Name == "IdTurno" && fk.DeleteBehavior == DeleteBehavior.NoAction);
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "turnos.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class TurnoApiFactory : WebApplicationFactory<Program>
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
                    ["ConnectionStrings:DefaultConnection"] =
                        "Server=(local);Database=NotUsedInMemory;Trusted_Connection=True;TrustServerCertificate=True",
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

        public async Task<string> SeedAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            db.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            db.Sucursales.Add(new Sucursal { IdSucursal = 1, Nombre = "Prueba", Activa = true });
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "turnos.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task SeedTurnosAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Turnos.AddRange(
                new Turno { IdTurno = 1, Nombre = "Matutino", Codigo = "MAT",
                    HoraEntrada = new TimeOnly(8, 0), HoraSalida = new TimeOnly(16, 0),
                    Jornada = "Diurna", Activo = true },
                new Turno { IdTurno = 2, Nombre = "Nocturno", Codigo = "NOC",
                    HoraEntrada = new TimeOnly(22, 0), HoraSalida = new TimeOnly(6, 0),
                    Jornada = "Nocturna", Activo = true });
            await db.SaveChangesAsync();
        }

        public async Task SeedReferenciasAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Empleados.Add(new Empleado
            {
                IdEmpleado = 1, IdSucursal = 1, IdTurno = 1,
                Nombres = "Prueba", Apellidos = "Empleado", DPI = "TURNOS-DPI-1",
                TipoEmpleado = "Administrativo", Activo = true
            });
            db.Examenes.Add(new Examen
            {
                IdExamen = 1, IdTurno = 1, NombreExamen = "Prueba",
                FechaExamen = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        public async Task GrantAsync(bool consultar, bool crear, bool modificar, bool eliminar)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleOrDefaultAsync();
            if (permiso is null)
            {
                permiso = new Permiso { IdRol = 1, Modulo = "Turnos" };
                db.Permisos.Add(permiso);
            }
            permiso.PuedeConsultar = consultar;
            permiso.PuedeCrear = crear;
            permiso.PuedeModificar = modificar;
            permiso.PuedeEliminar = eliminar;
            await db.SaveChangesAsync();
        }
    }
}
