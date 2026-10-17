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

public sealed class ClinicasTests
{
    [Fact]
    public async Task CreaClinicaNormalizadaConEstadoControladoPorServidor()
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PostAsJsonAsync("/api/clinicas", new
        {
            idClinica = 999, activa = false, nombreClinica = "  Clínica   Central  ",
            especialidad = " Medicina   General ", idSucursal = 1
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var clinica = await response.Content.ReadFromJsonAsync<ClinicaResponseDto>();
        Assert.NotNull(clinica);
        Assert.NotEqual(999, clinica.IdClinica);
        Assert.True(clinica.Activa);
        Assert.Equal("Clínica Central", clinica.NombreClinica);
        Assert.Equal("Medicina General", clinica.Especialidad);
        Assert.Equal($"/api/clinicas/{clinica.IdClinica}", response.Headers.Location?.AbsolutePath);

        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Clinicas.SingleAsync();
        Assert.Equal(1, stored.IdSucursal);
        Assert.True(stored.Activa);
    }

    [Theory]
    [InlineData("   ")]
    [InlineData("")]
    public async Task RechazaNombreObligatorio(string nombre)
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/clinicas",
            new ClinicaCreateDto { NombreClinica = nombre, IdSucursal = 1 });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Clinicas.ToListAsync());
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task RechazaLongitudesSql(bool nombre)
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var request = new ClinicaCreateDto
        {
            NombreClinica = nombre ? new string('N', 101) : "Válida",
            Especialidad = nombre ? null : new string('E', 101),
            IdSucursal = 1
        };
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/clinicas", request)).StatusCode);
    }

    [Fact]
    public async Task RechazaSucursalInexistente()
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/clinicas",
                new ClinicaCreateDto { NombreClinica = "Prueba", IdSucursal = 999 }))
            .StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Clinicas.ToListAsync());
    }

    [Fact]
    public async Task SucursalInactivaConservaFkSinReglaAdicionalAprobada()
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.DisableSucursalAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/clinicas",
            new ClinicaCreateDto { NombreClinica = "Prueba", IdSucursal = 1 });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task ListaPaginadaYConsultaPorId()
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.SeedClinicasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var page = await client.GetFromJsonAsync<PagedResponse<ClinicaResponseDto>>(
            "/api/clinicas?page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal("Segunda", Assert.Single(page.Items).NombreClinica);
        var id = page.Items[0].IdClinica;
        var detail = await client.GetFromJsonAsync<ClinicaResponseDto>($"/api/clinicas/{id}");
        Assert.NotNull(detail);
        Assert.Equal(id, detail.IdClinica);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/clinicas/9999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/clinicas?page=0")).StatusCode);
    }

    [Fact]
    public async Task ActualizaSinPermitirCambiarIdentidadOEstado()
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedClinicasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PutAsJsonAsync("/api/clinicas/1", new
        {
            idClinica = 999, activa = false, nombreClinica = "  Nuevo   nombre ",
            especialidad = "  ", idSucursal = 1
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var clinica = await response.Content.ReadFromJsonAsync<ClinicaResponseDto>();
        Assert.NotNull(clinica);
        Assert.Equal(1, clinica.IdClinica);
        Assert.True(clinica.Activa);
        Assert.Equal("Nuevo nombre", clinica.NombreClinica);
        Assert.Null(clinica.Especialidad);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/clinicas/9999",
                new ClinicaUpdateDto { NombreClinica = "Prueba", IdSucursal = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/clinicas/1",
                new ClinicaUpdateDto { NombreClinica = "Prueba", IdSucursal = 999 })).StatusCode);
    }

    [Fact]
    public async Task DesactivaSinEliminarNiRomperConsultaHistorica()
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedConsultaAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/clinicas/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/clinicas/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.DeleteAsync("/api/clinicas/9999")).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.False((await db.Clinicas.SingleAsync(c => c.IdClinica == 1)).Activa);
        var consulta = await db.Consultas.SingleAsync();
        Assert.Equal(1, db.Entry(consulta).Property<int?>("IdClinica").CurrentValue);
    }

    [Fact]
    public async Task ExigeJwtYPermisoActualPorOperacion()
    {
        using var factory = new ClinicaApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedClinicasAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/clinicas")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/clinicas")).StatusCode);
        await factory.GrantReadAsync();
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/clinicas")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/clinicas",
                new ClinicaCreateDto { NombreClinica = "Nueva", IdSucursal = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/clinicas/1",
                new ClinicaUpdateDto { NombreClinica = "Otra", IdSucursal = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.DeleteAsync("/api/clinicas/1")).StatusCode);
        await factory.GrantWriteAsync();
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/clinicas",
                new ClinicaCreateDto { NombreClinica = "Nueva", IdSucursal = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync("/api/clinicas/1",
                new ClinicaUpdateDto { NombreClinica = "Otra", IdSucursal = 1 })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/clinicas/1")).StatusCode);
    }

    [Fact]
    public void MapeoConservaCincoColumnasYDosRelaciones()
    {
        using var factory = new ClinicaApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var entity = db.Model.FindEntityType(typeof(Clinica));
        Assert.NotNull(entity);
        Assert.Equal("Clinica", entity.GetTableName());
        Assert.Equal(5, entity.GetProperties().Count());
        Assert.All(entity.GetProperties(), p => Assert.NotNull(p.PropertyInfo));
        Assert.Equal("IdClinica", Assert.Single(entity.FindPrimaryKey()!.Properties).Name);
        var fk = Assert.Single(entity.GetForeignKeys());
        Assert.Equal("Sucursal", fk.PrincipalEntityType.GetTableName());
        Assert.Equal("IdSucursal", Assert.Single(fk.Properties).Name);
        Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior);
        var inbound = Assert.Single(entity.GetReferencingForeignKeys());
        Assert.Equal("Consulta", inbound.DeclaringEntityType.GetTableName());
        Assert.Equal("IdClinica", Assert.Single(inbound.Properties).Name);
        Assert.Equal(DeleteBehavior.NoAction, inbound.DeleteBehavior);
        Assert.True(entity.FindProperty("Activa")!.GetDefaultValue() is true);
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "clinicas.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class ClinicaApiFactory : WebApplicationFactory<Program>
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
                IdUsuario = 1, IdRol = 1, Username = "clinicas.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task DisableSucursalAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Sucursales.SingleAsync()).Activa = false;
            await db.SaveChangesAsync();
        }

        public async Task SeedClinicasAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Clinicas.AddRange(
                new Clinica { IdClinica = 1, IdSucursal = 1, NombreClinica = "Primera", Activa = true },
                new Clinica { IdClinica = 2, IdSucursal = 1, NombreClinica = "Segunda", Activa = true });
            await db.SaveChangesAsync();
        }

        public async Task SeedConsultaAsync()
        {
            await SeedClinicasAsync();
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Pacientes.Add(new Paciente
            {
                IdPaciente = 1, Nombres = "Paciente", Apellidos = "Prueba",
                FechaNacimiento = new DateOnly(1990, 1, 1), FechaRegistro = DateTime.UtcNow,
                Activo = true
            });
            db.Empleados.Add(new Empleado
            {
                IdEmpleado = 1, IdSucursal = 1, Nombres = "Médico", Apellidos = "Prueba",
                DPI = "DPI-MED", TipoEmpleado = "Medico", Activo = true
            });
            await db.SaveChangesAsync();
            var consulta = new Consulta
            {
                IdConsulta = 1, IdPaciente = 1, IdMedico = 1, IdSucursal = 1,
                FechaConsulta = DateTime.UtcNow
            };
            db.Consultas.Add(consulta);
            db.Entry(consulta).Property<int?>("IdClinica").CurrentValue = 1;
            await db.SaveChangesAsync();
        }

        public async Task GrantReadAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso
                { IdRol = 1, Modulo = "Clinicas", PuedeConsultar = true });
            await db.SaveChangesAsync();
        }

        public async Task GrantWriteAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleAsync();
            permiso.PuedeCrear = true;
            permiso.PuedeModificar = true;
            permiso.PuedeEliminar = true;
            await db.SaveChangesAsync();
        }

        public async Task GrantAllAsync()
        {
            await GrantReadAsync();
            await GrantWriteAsync();
        }
    }
}
