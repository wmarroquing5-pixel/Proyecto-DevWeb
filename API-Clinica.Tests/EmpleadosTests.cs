using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
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

public sealed class EmpleadosTests
{
    [Fact]
    public async Task CrearEmpleadoConRelacionesValidasYCamposDelServidor()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        await factory.SeedOptionalRelationsAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PostAsJsonAsync("/api/empleados", new
        {
            idEmpleado = 999, activo = false, idSucursal = 1, idEspecialidad = 2,
            nombres = "  Ana   María ", apellidos = " López   Pérez ",
            dpi = "  DPI 123 ", tipoEmpleado = "Medico",
            fechaIngreso = new DateOnly(2020, 1, 2), tipoSangre = " O+ ",
            idTurno = 3, direccion = " Calle   1 ", telefono = " 5555 1234 ",
            correoElectronico = " ana@example.com "
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var empleado = await response.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>();
        Assert.NotNull(empleado);
        Assert.NotEqual(999, empleado.IdEmpleado);
        Assert.True(empleado.Activo);
        Assert.Equal("Ana María", empleado.Nombres);
        Assert.Equal("López Pérez", empleado.Apellidos);
        Assert.Equal("DPI 123", empleado.DPI);
        Assert.Equal("ana@example.com", empleado.CorreoElectronico);
        Assert.Equal(2, empleado.IdEspecialidad);
        Assert.Equal(3, empleado.IdTurno);
        Assert.Equal($"/api/empleados/{empleado.IdEmpleado}", response.Headers.Location?.AbsolutePath);

        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Empleados.SingleAsync();
        Assert.Equal(new DateOnly(2020, 1, 2), stored.FechaIngreso);
        Assert.Equal("Calle 1", stored.Direccion);
        Assert.True(stored.Activo);
    }

    [Fact]
    public async Task PermiteEmpleadoSinEspecialidadNiTurno()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var empleado = await response.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>();
        Assert.NotNull(empleado);
        Assert.Null(empleado.IdEspecialidad);
        Assert.Null(empleado.IdTurno);
        Assert.Null(empleado.FechaIngreso);
    }

    [Theory]
    [InlineData("nombres")]
    [InlineData("apellidos")]
    [InlineData("dpi")]
    public async Task RechazaObligatoriosVacios(string campo)
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body[campo] = "   ";
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/empleados", body)).StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Empleados.ToListAsync());
    }

    [Theory]
    [InlineData("nombres", 101)]
    [InlineData("apellidos", 101)]
    [InlineData("dpi", 21)]
    [InlineData("tipoEmpleado", 31)]
    [InlineData("tipoSangre", 11)]
    [InlineData("direccion", 151)]
    [InlineData("telefono", 13)]
    [InlineData("correoElectronico", 151)]
    public async Task RechazaLongitudesMayoresAlContrato(string campo, int longitud)
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body[campo] = new string('x', longitud);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/empleados", body)).StatusCode);
    }

    [Theory]
    [InlineData("medico")]
    [InlineData("Otro")]
    public async Task RechazaTipoFueraDelCheckSql(string tipo)
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body["tipoEmpleado"] = tipo;
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/empleados", body)).StatusCode);
    }

    [Theory]
    [InlineData("idSucursal", 999)]
    [InlineData("idEspecialidad", 999)]
    [InlineData("idTurno", 999)]
    public async Task RechazaRelacionesInexistentes(string campo, int id)
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body[campo] = id;
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/empleados", body)).StatusCode);
    }

    [Fact]
    public async Task ValidaCorreoOpcionalYFechaIngreso()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var body = CuerpoBase();
        body["correoElectronico"] = "sin-arroba";
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/empleados", body)).StatusCode);
        body["correoElectronico"] = " ";
        body["fechaIngreso"] = DateOnly.MinValue;
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/empleados", body)).StatusCode);
        body.Remove("fechaIngreso");
        var accepted = await client.PostAsJsonAsync("/api/empleados", body);
        Assert.Equal(HttpStatusCode.Created, accepted.StatusCode);
        Assert.Null((await accepted.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>())!
            .CorreoElectronico);
    }

    [Fact]
    public async Task DPIUnicoEnCrearYActualizar()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado("DPI-1"))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado("DPI-1"))).StatusCode);
        var second = await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado("DPI-2"));
        var empleado = await second.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>();
        Assert.NotNull(empleado);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/empleados/{empleado.IdEmpleado}",
                ActualizarEmpleado("DPI-1"))).StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Equal("DPI-2", (await scope.ServiceProvider
            .GetRequiredService<ClinicaDbContext>().Empleados.SingleAsync(e =>
                e.IdEmpleado == empleado.IdEmpleado)).DPI);
    }

    [Fact]
    public async Task ListaFiltraPaginaYObtieneDetalle()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Empleados.AddRange(
                new Empleado { IdSucursal = 1, Nombres = "Ana", Apellidos = "Uno", DPI = "A", TipoEmpleado = "Medico", Activo = true },
                new Empleado { IdSucursal = 1, Nombres = "Ana", Apellidos = "Dos", DPI = "B", TipoEmpleado = "Enfermera", Activo = false },
                new Empleado { IdSucursal = 1, Nombres = "Luis", Apellidos = "Tres", DPI = "C", TipoEmpleado = "Administrativo", Activo = true });
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var page = await client.GetFromJsonAsync<PagedResponse<EmpleadoListadoResponse>>(
            "/api/empleados?nombre=ana&page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal("Dos", Assert.Single(page.Items).Apellidos);
        var activos = await client.GetFromJsonAsync<PagedResponse<EmpleadoListadoResponse>>(
            "/api/empleados?tipoEmpleado=Medico&activo=true&idSucursal=1");
        Assert.NotNull(activos);
        Assert.Single(activos.Items);
        var detalle = await client.GetFromJsonAsync<EmpleadoDetalleResponse>(
            $"/api/empleados/{page.Items[0].IdEmpleado}");
        Assert.NotNull(detalle);
        Assert.Equal("B", detalle.DPI);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/empleados/9999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/empleados?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/empleados?tipoEmpleado=Otro")).StatusCode);
        var listJson = await client.GetStringAsync("/api/empleados");
        Assert.DoesNotContain("\"dpi\"", listJson, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task ActualizaYDesactivaSinEliminarRegistro()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var created = await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado());
        var empleado = await created.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>();
        Assert.NotNull(empleado);
        var updated = await client.PutAsJsonAsync($"/api/empleados/{empleado.IdEmpleado}",
            new { idEmpleado = 999, activo = false, idSucursal = 1,
                nombres = "  María  ", apellidos = " Nuevo ", dpi = "DPI-2",
                tipoEmpleado = "Enfermera" });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var result = await updated.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>();
        Assert.NotNull(result);
        Assert.Equal(empleado.IdEmpleado, result.IdEmpleado);
        Assert.True(result.Activo);
        Assert.Equal("María", result.Nombres);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/empleados/9999", ActualizarEmpleado())).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/empleados/{empleado.IdEmpleado}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/empleados/{empleado.IdEmpleado}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/empleados/{empleado.IdEmpleado}",
                ActualizarEmpleado())).StatusCode);
        using var scope = factory.Services.CreateScope();
        var stored = await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Empleados.SingleAsync();
        Assert.False(stored.Activo);
        Assert.Equal("DPI-2", stored.DPI);
    }

    [Fact]
    public async Task ConservaConsultaHistoricaYRechazaNuevaConsultaConMedicoInactivo()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var created = await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado(tipo: "Medico"));
        var medico = await created.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>();
        Assert.NotNull(medico);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Pacientes.Add(new Paciente { IdPaciente = 1, Nombres = "P", Apellidos = "Uno", FechaNacimiento = new DateOnly(2000, 1, 1), Activo = true });
            await db.SaveChangesAsync();
            db.Consultas.Add(new Consulta { IdPaciente = 1, IdMedico = medico.IdEmpleado,
                IdSucursal = 1, FechaConsulta = DateTime.UtcNow });
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/empleados/{medico.IdEmpleado}",
                ActualizarEmpleado(tipo: "Enfermera"))).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/empleados/{medico.IdEmpleado}")).StatusCode);
        using var scopeVerificacion = factory.Services.CreateScope();
        var context = scopeVerificacion.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(medico.IdEmpleado, (await context.Consultas.SingleAsync()).IdMedico);
        Assert.False((await context.Empleados.SingleAsync()).Activo);
        context.Consultas.Add(new Consulta { IdPaciente = 1, IdMedico = medico.IdEmpleado,
            IdSucursal = 1, FechaConsulta = DateTime.UtcNow });
        await Assert.ThrowsAsync<AppValidationException>(() => context.SaveChangesAsync());
        Assert.Equal(1, await context.Consultas.AsNoTracking().CountAsync());
    }

    [Fact]
    public async Task ExigeJwtYPermisosActualesPorOperacion()
    {
        using var factory = new EmpleadoApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/empleados")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PutAsJsonAsync("/api/empleados/1", ActualizarEmpleado())).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.DeleteAsync("/api/empleados/1")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/empleados")).StatusCode);

        await factory.GrantReadAsync();
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/empleados")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado())).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            Assert.Empty(await db.Empleados.ToListAsync());
            (await db.Permisos.SingleAsync()).PuedeCrear = true;
            await db.SaveChangesAsync();
        }
        var created = await client.PostAsJsonAsync("/api/empleados", NuevoEmpleado());
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var empleado = await created.Content.ReadFromJsonAsync<EmpleadoDetalleResponse>();
        Assert.NotNull(empleado);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync($"/api/empleados/{empleado.IdEmpleado}",
                ActualizarEmpleado())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.DeleteAsync($"/api/empleados/{empleado.IdEmpleado}")).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permission = await db.Permisos.SingleAsync();
            permission.PuedeModificar = true;
            permission.PuedeEliminar = true;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync($"/api/empleados/{empleado.IdEmpleado}",
                ActualizarEmpleado())).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/empleados/{empleado.IdEmpleado}")).StatusCode);
    }

    [Fact]
    public void MapeoEmpleadoConservaCatorceColumnasYCincoRelaciones()
    {
        using var factory = new EmpleadoApiFactory();
        using var scope = factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var entity = context.Model.FindEntityType(typeof(Empleado));
        Assert.NotNull(entity);
        Assert.Equal("Empleado", entity.GetTableName());
        Assert.Equal(14, entity.GetProperties().Count());
        Assert.All(entity.GetProperties(), property => Assert.NotNull(property.PropertyInfo));
        Assert.Equal(3, entity.GetForeignKeys().Count());
        Assert.Equal(2, entity.GetReferencingForeignKeys().Count());
        Assert.All(entity.GetForeignKeys(), fk => Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior));
        Assert.All(entity.GetReferencingForeignKeys(), fk => Assert.Equal(DeleteBehavior.NoAction, fk.DeleteBehavior));
        Assert.Contains(entity.GetIndexes(), index => index.IsUnique &&
            index.Properties.Count == 1 && index.Properties[0].Name == nameof(Empleado.DPI));
    }

    private static Dictionary<string, object?> CuerpoBase() => new()
    {
        ["idSucursal"] = 1, ["nombres"] = "Ana", ["apellidos"] = "Pérez",
        ["dpi"] = "DPI-1", ["tipoEmpleado"] = "Medico"
    };

    private static CrearEmpleadoRequest NuevoEmpleado(string dpi = "DPI-1", string tipo = "Medico") => new()
    {
        IdSucursal = 1, Nombres = "Ana", Apellidos = "Pérez", DPI = dpi, TipoEmpleado = tipo
    };

    private static ActualizarEmpleadoRequest ActualizarEmpleado(
        string dpi = "DPI-1", string tipo = "Medico") => new()
    {
        IdSucursal = 1, Nombres = "Ana", Apellidos = "Pérez", DPI = dpi, TipoEmpleado = tipo
    };

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "empleados.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class EmpleadoApiFactory : WebApplicationFactory<Program>
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
                IdUsuario = 1, IdRol = 1, Username = "empleados.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task SeedOptionalRelationsAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Especialidades.Add(new Especialidad { IdEspecialidad = 2, Nombre = "Prueba", Activa = true });
            db.Turnos.Add(new Turno { IdTurno = 3, Nombre = "Día", Codigo = "D", Jornada = "Diurna",
                HoraEntrada = new TimeOnly(8, 0), HoraSalida = new TimeOnly(16, 0), Activo = true });
            await db.SaveChangesAsync();
        }

        public async Task GrantReadAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Empleados", PuedeConsultar = true });
            await db.SaveChangesAsync();
        }

        public async Task GrantAllAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Empleados",
                PuedeConsultar = true, PuedeCrear = true, PuedeModificar = true, PuedeEliminar = true });
            await db.SaveChangesAsync();
        }
    }
}
