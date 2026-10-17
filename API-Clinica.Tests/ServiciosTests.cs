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

public sealed class ServiciosTests
{
    private static ServicioCreateDto ValidCreate(string codigo = "SRV-1") => new()
    {
        Codigo = codigo, Nombre = "Consulta general", TipoServicio = "Consulta",
        Descripcion = "Atención médica", PrecioBase = 150.25m
    };

    [Fact]
    public async Task CreaNormalizadoConEstadoControladoPorServidor()
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/servicios", new
        {
            idServicio = 999, activo = false, codigo = "  SRV-1  ",
            nombre = " Consulta   general ", descripcion = " Atención   médica ",
            precioBase = 150.25m, tipoServicio = " Consulta "
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<ServicioResponseDto>();
        Assert.NotNull(dto);
        Assert.NotEqual(999, dto.IdServicio);
        Assert.True(dto.Activo);
        Assert.Equal("SRV-1", dto.Codigo);
        Assert.Equal("Consulta general", dto.Nombre);
        Assert.Equal("Atención médica", dto.Descripcion);
        Assert.Equal("Consulta", dto.TipoServicio);
        Assert.Equal($"/api/servicios/{dto.IdServicio}", response.Headers.Location?.AbsolutePath);
    }

    [Theory]
    [InlineData("   ", "Nombre", "Consulta", 10)]
    [InlineData("SRV-1", "   ", "Consulta", 10)]
    [InlineData("SRV-1", "Nombre", "   ", 10)]
    [InlineData("SRV-1", "Nombre", "No definido", 10)]
    [InlineData("SRV-1", "Nombre", "Consulta", -1)]
    [InlineData("SRV-1", "Nombre", "Consulta", 10.123)]
    [InlineData("SRV-1", "Nombre", "Consulta", 10000000000000000d)]
    public async Task RechazaValoresInvalidos(
        string codigo, string nombre, string tipo, double precio)
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/servicios", new
        {
            codigo, nombre, tipoServicio = tipo, precioBase = precio
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var scope = factory.Services.CreateScope();
        Assert.Empty(await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
            .Servicios.ToListAsync());
    }

    [Theory]
    [InlineData(51, 1, 1, 1)]
    [InlineData(1, 151, 1, 1)]
    [InlineData(1, 1, 301, 1)]
    [InlineData(1, 1, 1, 51)]
    public async Task RechazaLongitudesSql(int codigo, int nombre, int descripcion, int tipo)
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/servicios", new
        {
            codigo = new string('C', codigo), nombre = new string('N', nombre),
            descripcion = new string('D', descripcion),
            tipoServicio = new string('T', tipo), precioBase = 1m
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData("Consulta")]
    [InlineData("Examen")]
    [InlineData("Habitacion")]
    [InlineData("Procedimiento")]
    [InlineData("Otro")]
    public async Task AceptaTiposDelCheckSql(string tipo)
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("/api/servicios", new
        {
            codigo = "TIPO-1", nombre = "Servicio", tipoServicio = tipo, precioBase = 0m
        })).StatusCode);
    }

    [Fact]
    public async Task CodigoDuplicadoEsConflictoEnCreacionYActualizacion()
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedServiciosAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/servicios", ValidCreate())).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync("/api/servicios/2", new ServicioUpdateDto
            {
                Codigo = "SRV-1", Nombre = "Otro", TipoServicio = "Otro", PrecioBase = 1
            })).StatusCode);
    }

    [Fact]
    public async Task ListaPaginadaYConsultaPorId()
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedServiciosAsync();
        await factory.GrantAsync(true, false, false, false);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var page = await client.GetFromJsonAsync<PagedResponse<ServicioResponseDto>>(
            "/api/servicios?page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal("SRV-2", Assert.Single(page.Items).Codigo);
        Assert.Equal("SRV-2", (await client.GetFromJsonAsync<ServicioResponseDto>(
            "/api/servicios/2"))?.Codigo);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync("/api/servicios/999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("/api/servicios?page=0")).StatusCode);
    }

    [Fact]
    public async Task ActualizaCodigoYDatosSinCambiarEstado()
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedServiciosAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PutAsJsonAsync("/api/servicios/1", new
        {
            idServicio = 999, activo = false, codigo = " SRV-3 ",
            nombre = " Nuevo  nombre ", descripcion = "  ",
            precioBase = 0m, tipoServicio = "Examen"
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<ServicioResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdServicio);
        Assert.True(dto.Activo);
        Assert.Equal("SRV-3", dto.Codigo);
        Assert.Equal("Nuevo nombre", dto.Nombre);
        Assert.Null(dto.Descripcion);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/servicios/999", new ServicioUpdateDto
            {
                Codigo = "SRV-X", Nombre = "No existe", TipoServicio = "Otro"
            })).StatusCode);
    }

    [Fact]
    public async Task DesactivaSinBorradoFisicoNiPerderReferenciaDeFactura()
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedServiciosAsync();
        await factory.SeedFacturaDetalleAsync();
        await factory.GrantAsync(true, true, true, true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/servicios/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/servicios/1")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync("/api/servicios/999")).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.False((await db.Servicios.SingleAsync(s => s.IdServicio == 1)).Activo);
        var detalle = await db.VentaDetalles.SingleAsync();
        Assert.Equal(1, db.Entry(detalle).Property<int?>("IdServicio").CurrentValue);
        Assert.False((await client.GetFromJsonAsync<ServicioResponseDto>("/api/servicios/1"))!.Activo);
    }

    [Fact]
    public async Task ExigeJwtYPermisoActualPorOperacion()
    {
        using var factory = new ServicioApiFactory();
        var password = await factory.SeedAsync();
        await factory.SeedServiciosAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync("/api/servicios")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/servicios")).StatusCode);
        await factory.GrantAsync(true, false, false, false);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/servicios")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/servicios", ValidCreate("SRV-3"))).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/servicios/1", new ServicioUpdateDto
            {
                Codigo = "SRV-1", Nombre = "Prueba", TipoServicio = "Otro"
            })).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.DeleteAsync("/api/servicios/1")).StatusCode);
        await factory.GrantAsync(true, true, true, true);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/servicios", ValidCreate("SRV-3"))).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.PutAsJsonAsync("/api/servicios/1", new ServicioUpdateDto
            {
                Codigo = "SRV-1", Nombre = "Prueba", TipoServicio = "Otro"
            })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("/api/servicios/1")).StatusCode);
    }

    [Fact]
    public void MapeoConservaColumnasRestriccionesYRelacionEntrante()
    {
        using var factory = new ServicioApiFactory();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var entity = db.Model.FindEntityType(typeof(Servicio));
        Assert.NotNull(entity);
        Assert.Equal("Servicio", entity.GetTableName());
        Assert.Equal(7, entity.GetProperties().Count());
        Assert.All(entity.GetProperties(), p => Assert.NotNull(p.PropertyInfo));
        Assert.Equal("IdServicio", Assert.Single(entity.FindPrimaryKey()!.Properties).Name);
        Assert.True(entity.GetIndexes().Single(i => i.Properties.Single().Name == "Codigo").IsUnique);
        Assert.Equal("decimal(18,2)",
            entity.FindProperty("PrecioBase")!.FindAnnotation("Relational:ColumnType")?.Value);
        Assert.True(entity.FindProperty("Activo")!.GetDefaultValue() is true);
        var inbound = Assert.Single(entity.GetReferencingForeignKeys());
        Assert.Equal("FacturaDetalle", inbound.DeclaringEntityType.GetTableName());
        Assert.Equal("IdServicio", Assert.Single(inbound.Properties).Name);
        Assert.Equal(DeleteBehavior.NoAction, inbound.DeleteBehavior);
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "servicios.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class ServicioApiFactory : WebApplicationFactory<Program>
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
                IdUsuario = 1, IdRol = 1, Username = "servicios.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task SeedServiciosAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Servicios.AddRange(
                new Servicio { IdServicio = 1, Codigo = "SRV-1", Nombre = "Primero",
                    PrecioBase = 10, TipoServicio = "Consulta", Activo = true },
                new Servicio { IdServicio = 2, Codigo = "SRV-2", Nombre = "Segundo",
                    PrecioBase = 20, TipoServicio = "Examen", Activo = true });
            await db.SaveChangesAsync();
        }

        public async Task SeedFacturaDetalleAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Ventas.Add(new Venta
            {
                IdVenta = 1, IdUsuario = 1, IdSucursal = 1,
                FechaVenta = DateTime.UtcNow, Total = 10
            });
            var detail = new VentaDetalle
            {
                IdVentaDetalle = 1, IdVenta = 1, Cantidad = 1,
                PrecioUnitario = 10, Subtotal = 10
            };
            db.VentaDetalles.Add(detail);
            db.Entry(detail).Property<int?>("IdServicio").CurrentValue = 1;
            await db.SaveChangesAsync();
        }

        public async Task GrantAsync(bool consultar, bool crear, bool modificar, bool eliminar)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleOrDefaultAsync();
            if (permiso is null)
            {
                permiso = new Permiso { IdRol = 1, Modulo = "Servicios" };
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
