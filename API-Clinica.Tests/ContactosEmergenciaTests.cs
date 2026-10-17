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

public sealed class ContactosEmergenciaTests
{
    [Fact]
    public async Task CreaContactoValidoConPacienteYEstadoDelServidor()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PostAsJsonAsync("/api/contactos-emergencia", new
        {
            idContacto = 999, activo = false, nombres = "  Ana   María ",
            apellidos = " López   Pérez ", telefono = " 5555   1234 ",
            direccion = " Calle   1 ", correoElectronico = " ana@example.com ",
            parentesco = " Madre ", idPaciente = 1
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var contacto = await response.Content.ReadFromJsonAsync<ContactoEmergenciaResponseDto>();
        Assert.NotNull(contacto);
        Assert.NotEqual(999, contacto.IdContacto);
        Assert.True(contacto.Activo);
        Assert.Equal(1, contacto.IdPaciente);
        Assert.Equal("Ana María", contacto.Nombres);
        Assert.Equal("López Pérez", contacto.Apellidos);
        Assert.Equal("5555 1234", contacto.Telefono);
        Assert.Equal("Calle 1", contacto.Direccion);
        Assert.Equal("ana@example.com", contacto.CorreoElectronico);
        Assert.Equal($"/api/contactos-emergencia/{contacto.IdContacto}",
            response.Headers.Location?.AbsolutePath);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(1, (await db.ContactosEmergencia.SingleAsync()).IdPaciente);
        Assert.True((await db.Pacientes.SingleAsync()).Activo);
    }

    [Fact]
    public async Task CreaContactoSinPacienteNiDatosOpcionales()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/contactos-emergencia", Nuevo());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var contacto = await response.Content.ReadFromJsonAsync<ContactoEmergenciaResponseDto>();
        Assert.NotNull(contacto);
        Assert.Null(contacto.IdPaciente);
        Assert.Null(contacto.CorreoElectronico);
        Assert.Null(contacto.Parentesco);
    }

    [Fact]
    public async Task RechazaPacienteInexistenteSinInsertarContacto()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/contactos-emergencia",
                Nuevo(idPaciente: 999))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/contactos-emergencia",
                Nuevo(idPaciente: 0))).StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .ContactosEmergencia.ToListAsync());
    }

    [Theory]
    [InlineData("nombres")]
    [InlineData("apellidos")]
    [InlineData("telefono")]
    [InlineData("direccion")]
    public async Task RechazaCamposObligatoriosVacios(string campo)
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body[campo] = "   ";
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/contactos-emergencia", body)).StatusCode);
    }

    [Theory]
    [InlineData("nombres", 101)]
    [InlineData("apellidos", 101)]
    [InlineData("telefono", 21)]
    [InlineData("direccion", 151)]
    [InlineData("correoElectronico", 76)]
    [InlineData("parentesco", 51)]
    public async Task RechazaLongitudesSql(string campo, int longitud)
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body[campo] = new string('x', longitud);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/contactos-emergencia", body)).StatusCode);
    }

    [Fact]
    public async Task ValidaCorreoYNoInventaUnicidadDeTelefonoOCorreo()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var invalid = CuerpoBase();
        invalid["correoElectronico"] = "correo-invalido";
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/contactos-emergencia", invalid)).StatusCode);
        var valid = CuerpoBase();
        valid["correoElectronico"] = " repetido@example.com ";
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/contactos-emergencia", valid)).StatusCode);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/contactos-emergencia", valid)).StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Equal(2, await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .ContactosEmergencia.CountAsync());
    }

    [Fact]
    public async Task ListaFiltraPorPacienteYObtienePorId()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantReadAsync();
        await factory.SeedContactsAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var page = await client.GetFromJsonAsync<PagedResponse<ContactoEmergenciaResponseDto>>(
            "/api/contactos-emergencia?page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(3, page.TotalCount);
        Assert.Equal("Segundo", Assert.Single(page.Items).Nombres);
        var filtered = await client.GetFromJsonAsync<PagedResponse<ContactoEmergenciaResponseDto>>(
            "/api/contactos-emergencia?idPaciente=1");
        Assert.NotNull(filtered);
        Assert.Equal(2, filtered.TotalCount);
        Assert.All(filtered.Items, c => Assert.Equal(1, c.IdPaciente));
        var detail = await client.GetFromJsonAsync<ContactoEmergenciaResponseDto>(
            $"/api/contactos-emergencia/{page.Items[0].IdContacto}");
        Assert.NotNull(detail);
        Assert.Equal("Segundo", detail.Nombres);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/contactos-emergencia/9999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/contactos-emergencia?idPaciente=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/contactos-emergencia?page=0")).StatusCode);
    }

    [Fact]
    public async Task ActualizaAsociacionOpcionalSinAlterarEstadoNiPaciente()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedContactsAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PutAsJsonAsync("/api/contactos-emergencia/3", new
        {
            idContacto = 999, activo = false, nombres = "  Actualizado ",
            apellidos = " Prueba ", telefono = " 5555 9999 ",
            direccion = " Calle 2 ", correoElectronico = "   ",
            parentesco = "   ", idPaciente = 1
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var contacto = await response.Content.ReadFromJsonAsync<ContactoEmergenciaResponseDto>();
        Assert.NotNull(contacto);
        Assert.Equal(3, contacto.IdContacto);
        Assert.True(contacto.Activo);
        Assert.Equal(1, contacto.IdPaciente);
        Assert.Equal("Actualizado", contacto.Nombres);
        Assert.Null(contacto.CorreoElectronico);
        Assert.Null(contacto.Parentesco);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/contactos-emergencia/3",
                Actualizar(idPaciente: 999))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/contactos-emergencia/9999",
                Actualizar())).StatusCode);
        var detached = await client.PutAsJsonAsync("/api/contactos-emergencia/3",
            Actualizar());
        Assert.Equal(HttpStatusCode.OK, detached.StatusCode);
        Assert.Null((await detached.Content.ReadFromJsonAsync<ContactoEmergenciaResponseDto>())?.IdPaciente);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.True((await db.Pacientes.SingleAsync()).Activo);
        Assert.Null((await db.ContactosEmergencia.SingleAsync(c => c.IdContacto == 3)).IdPaciente);
    }

    [Fact]
    public async Task DesactivaSinEliminarContactoNiPaciente()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedContactsAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/contactos-emergencia/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/contactos-emergencia/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.DeleteAsync("/api/contactos-emergencia/9999")).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var contacto = await db.ContactosEmergencia.SingleAsync(c => c.IdContacto == 1);
        Assert.False(contacto.Activo);
        Assert.Equal(1, contacto.IdPaciente);
        Assert.True((await db.Pacientes.SingleAsync()).Activo);
    }

    [Fact]
    public async Task PacienteInactivoSigueSiendoFkValidaSinReglaAdicionalAprobada()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.DisablePacienteAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/contactos-emergencia",
                Nuevo(idPaciente: 1))).StatusCode);
    }

    [Fact]
    public async Task ExigeJwtYPermisoDinamicoActual()
    {
        using var factory = new ContactoApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedContactsAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/contactos-emergencia")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/contactos-emergencia")).StatusCode);
        await factory.GrantReadAsync();
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/contactos-emergencia")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/contactos-emergencia", Nuevo())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/contactos-emergencia/1", Actualizar())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.DeleteAsync("/api/contactos-emergencia/1")).StatusCode);
        await factory.GrantWriteAsync();
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/contactos-emergencia", Nuevo())).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync("/api/contactos-emergencia/1", Actualizar())).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync("/api/contactos-emergencia/1")).StatusCode);
    }

    [Fact]
    public void MapeoConservaNueveColumnasYFkOpcional()
    {
        using var factory = new ContactoApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var entity = db.Model.FindEntityType(typeof(ContactoEmergencia));
        Assert.NotNull(entity);
        Assert.Equal("ContactoEmergencia", entity.GetTableName());
        Assert.Equal(9, entity.GetProperties().Count());
        Assert.All(entity.GetProperties(), p => Assert.NotNull(p.PropertyInfo));
        Assert.Equal("IdContacto", Assert.Single(entity.FindPrimaryKey()!.Properties).Name);
        var fk = Assert.Single(entity.GetForeignKeys());
        Assert.Equal("Paciente", fk.PrincipalEntityType.GetTableName());
        Assert.Equal("IdPaciente", Assert.Single(fk.Properties).Name);
        Assert.False(fk.IsRequired);
        Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior);
        Assert.False(entity.FindProperty("Activo")!.IsNullable);
        Assert.Null(entity.FindProperty("Activo")!.FindAnnotation("Relational:DefaultValue"));
    }

    private static Dictionary<string, object?> CuerpoBase() => new()
    {
        ["nombres"] = "Ana", ["apellidos"] = "Pérez",
        ["telefono"] = "5555 1234", ["direccion"] = "Calle 1"
    };

    private static ContactoEmergenciaCreateDto Nuevo(int? idPaciente = null) => new()
    {
        Nombres = "Ana", Apellidos = "Pérez", Telefono = "5555 1234",
        Direccion = "Calle 1", IdPaciente = idPaciente
    };

    private static ContactoEmergenciaUpdateDto Actualizar(int? idPaciente = null) => new()
    {
        Nombres = "Ana", Apellidos = "Pérez", Telefono = "5555 1234",
        Direccion = "Calle 1", IdPaciente = idPaciente
    };

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "contactos.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class ContactoApiFactory : WebApplicationFactory<Program>
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
            db.Pacientes.Add(new Paciente
            {
                IdPaciente = 1, Nombres = "Paciente", Apellidos = "Prueba",
                FechaNacimiento = new DateOnly(1990, 1, 1), FechaRegistro = DateTime.UtcNow,
                Activo = true
            });
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "contactos.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task DisablePacienteAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Pacientes.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }

        public async Task SeedContactsAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.ContactosEmergencia.AddRange(
                new ContactoEmergencia { IdContacto = 1, Nombres = "Primero", Apellidos = "Uno",
                    Telefono = "111", Direccion = "A", Activo = true, IdPaciente = 1 },
                new ContactoEmergencia { IdContacto = 2, Nombres = "Segundo", Apellidos = "Dos",
                    Telefono = "222", Direccion = "B", Activo = true, IdPaciente = 1 },
                new ContactoEmergencia { IdContacto = 3, Nombres = "Tercero", Apellidos = "Tres",
                    Telefono = "333", Direccion = "C", Activo = true, IdPaciente = null });
            await db.SaveChangesAsync();
        }

        public async Task GrantReadAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso
                { IdRol = 1, Modulo = "ContactosEmergencia", PuedeConsultar = true });
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
