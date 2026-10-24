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

public sealed class PacientesTests
{
    [Fact]
    public async Task CrearPacienteValidoNormalizaYProtegeCamposDelServidor()
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var respuesta = await client.PostAsJsonAsync("/api/pacientes", new
        {
            idPaciente = 999,
            nombres = "  Ana   María  ",
            apellidos = "  López   Pérez ",
            dpi = "  12345 ",
            fechaNacimiento = new DateOnly(2000, 5, 10),
            genero = "F",
            telefono = "  5555 1234 ",
            correo = "  ana@example.com  ",
            tipoSangre = " O+ ",
            nit = " CF ",
            nombreFacturacion = " Ana López ",
            direccion = " Calle   1 ",
            urlFoto = " imagen.png ",
            fechaRegistro = new DateTime(2000, 1, 1),
            activo = false
        });

        Assert.Equal(HttpStatusCode.Created, respuesta.StatusCode);
        var paciente = await respuesta.Content.ReadFromJsonAsync<PacienteResponse>();
        Assert.NotNull(paciente);
        Assert.NotEqual(999, paciente.IdPaciente);
        Assert.Equal("Ana María", paciente.Nombres);
        Assert.Equal("López Pérez", paciente.Apellidos);
        Assert.Equal("ana@example.com", paciente.Correo);
        Assert.Equal("Calle 1", paciente.Direccion);
        Assert.Equal("O+", paciente.TipoSangre);
        Assert.True(paciente.Activo);
        Assert.True(paciente.FechaRegistro > DateTime.UtcNow.AddMinutes(-1));
        Assert.Equal($"/api/pacientes/{paciente.IdPaciente}", respuesta.Headers.Location?.AbsolutePath);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var almacenado = await db.Pacientes.SingleAsync();
        Assert.Equal(paciente.IdPaciente, almacenado.IdPaciente);
        Assert.Equal("CF", almacenado.Nit);
        Assert.Equal("Ana López", almacenado.NombreFacturacion);
        Assert.Null(almacenado.UrlFoto);
        Assert.True(almacenado.Activo);
    }

    [Theory]
    [InlineData("   ", "Pérez")]
    [InlineData("Ana", "  ")]
    public async Task RechazaNombresOApellidosVacios(string nombres, string apellidos)
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var respuesta = await client.PostAsJsonAsync("/api/pacientes", new GuardarPacienteRequest
        {
            Nombres = nombres, Apellidos = apellidos,
            FechaNacimiento = new DateOnly(2000, 1, 1)
        });
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Pacientes.ToListAsync());
    }

    [Theory]
    [InlineData(1, 1, 1)]
    [InlineData(9999, 1, 1)]
    public async Task RechazaFechaNoInformadaOFutura(int year, int month, int day)
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var respuesta = await client.PostAsJsonAsync("/api/pacientes", new GuardarPacienteRequest
        {
            Nombres = "Ana", Apellidos = "Pérez",
            FechaNacimiento = new DateOnly(year, month, day)
        });
        Assert.Equal(HttpStatusCode.BadRequest, respuesta.StatusCode);
    }

    [Theory]
    [InlineData("nombres", 101)]
    [InlineData("apellidos", 101)]
    [InlineData("dpi", 21)]
    [InlineData("genero", 2)]
    [InlineData("telefono", 21)]
    [InlineData("tipoSangre", 11)]
    [InlineData("nit", 51)]
    [InlineData("nombreFacturacion", 151)]
    [InlineData("direccion", 151)]
    [InlineData("urlFoto", 501)]
    public async Task RechazaCadenasQueExcedenLongitudSql(string campo, int longitud)
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var cuerpo = new Dictionary<string, object?>
        {
            ["nombres"] = "Ana", ["apellidos"] = "Pérez",
            ["fechaNacimiento"] = new DateOnly(2000, 1, 1)
        };
        cuerpo[campo] = new string('x', longitud);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/pacientes", cuerpo)).StatusCode);
    }

    [Fact]
    public async Task RechazaCorreoInvalidoYAceptaOpcionalesVacios()
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var invalido = await client.PostAsJsonAsync("/api/pacientes", new GuardarPacienteRequest
        {
            Nombres = "Ana", Apellidos = "Pérez", FechaNacimiento = new DateOnly(2000, 1, 1),
            Correo = "sin-arroba"
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalido.StatusCode);

        var correoLargo = await client.PostAsJsonAsync("/api/pacientes", new GuardarPacienteRequest
        {
            Nombres = "Ana", Apellidos = "Pérez", FechaNacimiento = new DateOnly(2000, 1, 1),
            Correo = new string('a', 92) + "@example.com"
        });
        Assert.Equal(HttpStatusCode.BadRequest, correoLargo.StatusCode);

        var valido = await client.PostAsJsonAsync("/api/pacientes", new GuardarPacienteRequest
        {
            Nombres = "Ana", Apellidos = "Pérez", FechaNacimiento = new DateOnly(2000, 1, 1),
            Correo = "   ", DPI = "   ", Genero = " "
        });
        Assert.Equal(HttpStatusCode.Created, valido.StatusCode);
        var paciente = await valido.Content.ReadFromJsonAsync<PacienteResponse>();
        Assert.NotNull(paciente);
        Assert.Null(paciente.Correo);
        Assert.Null(paciente.DPI);
        Assert.Null(paciente.Genero);
    }

    [Fact]
    public async Task NoImponeUnicidadDeDpiNiNitAusenteEnSql()
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var primero = new GuardarPacienteRequest
        {
            Nombres = "Ana", Apellidos = "Uno", FechaNacimiento = new DateOnly(2000, 1, 1),
            DPI = "COMPARTIDO", Nit = "CF"
        };
        var segundo = new GuardarPacienteRequest
        {
            Nombres = "Luis", Apellidos = "Dos", FechaNacimiento = new DateOnly(2001, 1, 1),
            DPI = "COMPARTIDO", Nit = "CF"
        };
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/pacientes", primero)).StatusCode);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/pacientes", segundo)).StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Equal(2, await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Pacientes.CountAsync());
    }

    [Fact]
    public async Task ListarFiltraPaginaYObtienePorId()
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Pacientes.AddRange(
                new Paciente { Nombres = "Ana", Apellidos = "Uno", FechaNacimiento = new DateOnly(2000, 1, 1), Activo = true },
                new Paciente { Nombres = "Ana", Apellidos = "Dos", FechaNacimiento = new DateOnly(2001, 1, 1), Activo = false },
                new Paciente { Nombres = "Luis", Apellidos = "Tres", FechaNacimiento = new DateOnly(2002, 1, 1), Activo = true });
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var pagina = await client.GetFromJsonAsync<PagedResponse<PacienteListadoResponse>>(
            "/api/pacientes?nombre=ana&page=2&pageSize=1");
        Assert.NotNull(pagina);
        Assert.Equal(2, pagina.TotalCount);
        Assert.Equal(2, pagina.TotalPages);
        Assert.Single(pagina.Items);
        Assert.Equal("Dos", pagina.Items[0].Apellidos);
        var listadoJson = await client.GetStringAsync("/api/pacientes?nombre=ana&page=2&pageSize=1");
        Assert.DoesNotContain("\"dpi\"", listadoJson, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("\"correo\"", listadoJson, StringComparison.OrdinalIgnoreCase);
        var activos = await client.GetFromJsonAsync<PagedResponse<PacienteListadoResponse>>(
            "/api/pacientes?activo=true");
        Assert.NotNull(activos);
        Assert.Equal(2, activos.TotalCount);
        var detalle = await client.GetFromJsonAsync<PacienteResponse>(
            $"/api/pacientes/{pagina.Items[0].IdPaciente}");
        Assert.NotNull(detalle);
        Assert.False(detalle.Activo);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/pacientes/9999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/pacientes?page=0")).StatusCode);
    }

    [Fact]
    public async Task ActualizarYDesactivarConservaRegistroYCamposDelServidor()
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var creado = await client.PostAsJsonAsync("/api/pacientes", NuevoPaciente());
        var paciente = await creado.Content.ReadFromJsonAsync<PacienteResponse>();
        Assert.NotNull(paciente);

        var actualizado = await client.PutAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}", new
        {
            nombres = "  María  ", apellidos = "  Nuevo  ",
            fechaNacimiento = new DateOnly(2001, 2, 3),
            fechaRegistro = new DateTime(1990, 1, 1), activo = false,
            idPaciente = 999
        });
        Assert.Equal(HttpStatusCode.OK, actualizado.StatusCode);
        var actual = await actualizado.Content.ReadFromJsonAsync<PacienteResponse>();
        Assert.NotNull(actual);
        Assert.Equal(paciente.IdPaciente, actual.IdPaciente);
        Assert.Equal(paciente.FechaRegistro, actual.FechaRegistro);
        Assert.True(actual.Activo);
        Assert.Equal("María", actual.Nombres);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/pacientes/9999", NuevoPaciente())).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/pacientes/{paciente.IdPaciente}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/pacientes/{paciente.IdPaciente}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}", NuevoPaciente())).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var persistido = await db.Pacientes.SingleAsync();
        Assert.False(persistido.Activo);
        Assert.Equal("María", persistido.Nombres);
        Assert.Equal(paciente.FechaRegistro, persistido.FechaRegistro);
    }

    [Fact]
    public async Task CambiarEstadoDesactivaYReactivaSinSobrescribirDatos()
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var creado = await client.PostAsJsonAsync("/api/pacientes", NuevoPaciente());
        var paciente = await creado.Content.ReadFromJsonAsync<PacienteResponse>();
        Assert.NotNull(paciente);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.PatchAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}/estado",
                new { activo = false })).StatusCode);
        Assert.False((await client.GetFromJsonAsync<PacienteResponse>(
            $"/api/pacientes/{paciente.IdPaciente}"))!.Activo);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.PatchAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}/estado",
                new { activo = true })).StatusCode);
        var reactivado = await client.GetFromJsonAsync<PacienteResponse>(
            $"/api/pacientes/{paciente.IdPaciente}");
        Assert.NotNull(reactivado);
        Assert.True(reactivado.Activo);
        Assert.Equal(paciente.Nombres, reactivado.Nombres);
        Assert.Equal(paciente.Apellidos, reactivado.Apellidos);
        Assert.Equal(paciente.FechaRegistro, reactivado.FechaRegistro);

        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PatchAsJsonAsync("/api/pacientes/9999/estado",
                new { activo = true })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PatchAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}/estado",
                new { })).StatusCode);
    }

    [Fact]
    public async Task RequiereJwtYPermisoActualPorOperacion()
    {
        using var factory = new PacienteApiFactory();
        var password = await factory.SeedUserAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/pacientes")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/pacientes", NuevoPaciente())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PutAsJsonAsync("/api/pacientes/1", NuevoPaciente())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PatchAsJsonAsync("/api/pacientes/1/estado", new { activo = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.DeleteAsync("/api/pacientes/1")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/pacientes")).StatusCode);

        await factory.GrantReadAsync();
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/pacientes")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/pacientes", NuevoPaciente())).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            Assert.Empty(await db.Pacientes.ToListAsync());
            (await db.Permisos.SingleAsync()).PuedeCrear = true;
            await db.SaveChangesAsync();
        }
        var creado = await client.PostAsJsonAsync("/api/pacientes", NuevoPaciente());
        Assert.Equal(HttpStatusCode.Created, creado.StatusCode);
        var paciente = await creado.Content.ReadFromJsonAsync<PacienteResponse>();
        Assert.NotNull(paciente);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}", NuevoPaciente())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PatchAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}/estado",
                new { activo = false })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.DeleteAsync($"/api/pacientes/{paciente.IdPaciente}")).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleAsync();
            permiso.PuedeModificar = true;
            permiso.PuedeEliminar = true;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}", NuevoPaciente())).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.PatchAsJsonAsync($"/api/pacientes/{paciente.IdPaciente}/estado",
                new { activo = false })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/pacientes/{paciente.IdPaciente}")).StatusCode);
    }

    [Fact]
    public void MapeoPacienteConservaQuinceColumnasYSinPropiedadesSombraPropias()
    {
        using var factory = new PacienteApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var entidad = db.Model.FindEntityType(typeof(Paciente));
        Assert.NotNull(entidad);
        Assert.Equal("Paciente", entidad.GetTableName());
        Assert.Equal(15, entidad.GetProperties().Count());
        Assert.All(entidad.GetProperties(), propiedad => Assert.NotNull(propiedad.PropertyInfo));
        Assert.Equal(4, entidad.GetReferencingForeignKeys().Count());
        Assert.All(entidad.GetReferencingForeignKeys(), fk =>
            Assert.Equal(Microsoft.EntityFrameworkCore.DeleteBehavior.NoAction, fk.DeleteBehavior));
        var tabla = Microsoft.EntityFrameworkCore.Metadata.StoreObjectIdentifier.Create(
            entidad, Microsoft.EntityFrameworkCore.Metadata.StoreObjectType.Table);
        Assert.NotNull(tabla);
        Assert.Equal("Genero", entidad.FindProperty(nameof(Paciente.Sexo))!
            .GetColumnName(tabla.Value));
    }

    private static GuardarPacienteRequest NuevoPaciente() => new()
    {
        Nombres = "Ana", Apellidos = "Pérez", FechaNacimiento = new DateOnly(2000, 1, 1)
    };

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "pacientes.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class PacienteApiFactory : WebApplicationFactory<Program>
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

        public async Task<string> SeedUserAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            db.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            var usuario = new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "pacientes.prueba", Activo = true
            };
            usuario.PasswordHash = hasher.HashPassword(usuario, password);
            db.Usuarios.Add(usuario);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task GrantReadAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso
            {
                IdRol = 1, Modulo = "Pacientes", PuedeConsultar = true
            });
            await db.SaveChangesAsync();
        }

        public async Task GrantAllAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso
            {
                IdRol = 1, Modulo = "Pacientes", PuedeConsultar = true,
                PuedeCrear = true, PuedeModificar = true, PuedeEliminar = true
            });
            await db.SaveChangesAsync();
        }
    }
}
