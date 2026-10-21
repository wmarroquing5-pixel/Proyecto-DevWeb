using System.IdentityModel.Tokens.Jwt;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using API_Clinica.Common;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;

namespace API_Clinica.Tests;

public sealed class MenuTests
{
    private static readonly ClaimsPrincipal Principal = new(
        new ClaimsIdentity([new Claim("Username", "usuario.prueba")], "Test"));

    public static TheoryData<string, string> ModulosYRutas => new()
    {
        { "Pacientes", "/pacientes" },
        { "Consultas", "/consultas" },
        { "Medicamentos", "/medicamentos" },
        { "LotesMedicamento", "/inventario/lotes" },
        { "Habitaciones", "/habitaciones" },
        { "Ventas", "/ventas" },
        { "Facturas", "/facturas" },
        { "Sucursales", "/admin/sucursales" },
        { "Clinicas", "/admin/clinicas" },
        { "Especialidades", "/admin/especialidades" },
        { "Turnos", "/admin/turnos" },
        { "Servicios", "/admin/servicios" },
        { "Categorias", "/admin/categorias" },
        { "Marcas", "/admin/marcas" },
        { "Usuarios", "/admin/usuarios" },
        { "Roles", "/admin/roles" },
        { "Empleados", "/admin/empleados" },
        { "Permisos", "/admin/permisos" }
    };

    [Fact]
    public void CatalogoContieneSoloRutasFuncionalesEnOrdenPredecible()
    {
        var rutas = Aplanar(MenuCompleto.Items).Select(item => item.Route).ToArray();

        Assert.Equal(new[]
        {
            "/dashboard", "/pacientes", "/consultas", "/medicamentos",
            "/inventario/lotes", "/habitaciones", "/ventas",
            "/facturas",
            "/admin/sucursales", "/admin/clinicas", "/admin/especialidades",
            "/admin/turnos", "/admin/servicios", "/admin/categorias",
            "/admin/marcas",
            "/admin/usuarios", "/admin/roles", "/admin/empleados",
            "/admin/permisos"
        }, rutas);
        Assert.Equal(rutas.Length, rutas.Distinct(StringComparer.Ordinal).Count());
        Assert.DoesNotContain("/citas", rutas);
        Assert.DoesNotContain("/reportes/citas", rutas);
        Assert.DoesNotContain("/reportes/pacientes", rutas);
        Assert.All(Aplanar(MenuCompleto.Items), item =>
        {
            Assert.False(string.IsNullOrWhiteSpace(item.Label));
            Assert.False(string.IsNullOrWhiteSpace(item.Route));
            Assert.StartsWith("/", item.Route, StringComparison.Ordinal);
        });
    }

    [Theory]
    [MemberData(nameof(ModulosYRutas))]
    public async Task PermisoConsultarExponeSoloLaRutaAsociada(string modulo, string ruta)
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [Permiso(1, modulo, consultar: true)]
        };
        var menu = await new MenuService(acceso).ObtenerMenuAsync(Principal, default);
        var rutas = Aplanar(menu).Select(item => item.Route).ToArray();

        Assert.Equal(new[] { "/dashboard", ruta }, rutas);
    }

    [Fact]
    public async Task ConsultasNoUtilizaHistorialComoEquivalente()
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [Permiso(1, "Historial", consultar: true)]
        };
        var service = new MenuService(acceso);

        Assert.Empty(await service.ObtenerMenuAsync(Principal, default));

        acceso.Permisos = [Permiso(2, "Consultas", consultar: true)];
        var rutas = Aplanar(await service.ObtenerMenuAsync(Principal, default))
            .Select(item => item.Route);
        Assert.Contains("/consultas", rutas);
    }

    [Fact]
    public async Task ModificarSinConsultarNoExponeElModulo()
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [new PermisoActualResponse(1, "Ventas", false, false, true, false)]
        };

        Assert.Empty(await new MenuService(acceso).ObtenerMenuAsync(Principal, default));
    }

    [Theory]
    [InlineData("Sucursales")]
    [InlineData("Clinicas")]
    [InlineData("Especialidades")]
    [InlineData("Turnos")]
    [InlineData("Servicios")]
    [InlineData("Categorias")]
    [InlineData("Marcas")]
    public async Task CatalogoSinConsultarNoExponeRutaNiGrupo(string modulo)
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [new PermisoActualResponse(1, modulo, false, true, true, true)]
        };

        Assert.Empty(await new MenuService(acceso).ObtenerMenuAsync(Principal, default));
    }

    [Fact]
    public async Task CatalogosSeAgrupanYFiltranDeFormaIndependiente()
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [
                Permiso(1, "Sucursales", consultar: true),
                Permiso(2, "Marcas", consultar: true)
            ]
        };

        var menu = await new MenuService(acceso).ObtenerMenuAsync(Principal, default);
        Assert.Equal(new[]
        {
            "Dashboard", "Catálogos organizativos", "Catálogos farmacéuticos"
        }, menu.Select(item => item.Label));

        Assert.Equal(new[] { "/admin/sucursales" },
            menu.Single(item => item.Label == "Catálogos organizativos")
                .Children!.Select(item => item.Route));
        Assert.Equal(new[] { "/admin/marcas" },
            menu.Single(item => item.Label == "Catálogos farmacéuticos")
                .Children!.Select(item => item.Route));
    }

    [Theory]
    [InlineData("Administrador")]
    [InlineData("PERSONAL_ADMON")]
    [InlineData("PERSONAL_FARMACIA")]
    [InlineData("BODEGERO")]
    public async Task FacturasConsultarExponeLaRutaSinDependerDelNombreDelRol(string rol)
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [Permiso(1, "Facturas", consultar: true)]
        };
        var principal = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.Role, rol)
        ], "Test"));

        var rutas = Aplanar(await new MenuService(acceso).ObtenerMenuAsync(principal, default))
            .Select(item => item.Route).ToArray();

        Assert.Equal(new[] { "/dashboard", "/facturas" }, rutas);
        Assert.DoesNotContain("/ventas", rutas);
    }

    [Fact]
    public async Task MedicoSinFacturasConsultarYCrearAisladoNoExponenLaRuta()
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [new PermisoActualResponse(1, "Facturas", false, true, false, false)]
        };
        var medico = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim(ClaimTypes.Role, "MEDICO")
        ], "Test"));

        Assert.Empty(await new MenuService(acceso).ObtenerMenuAsync(medico, default));
    }

    [Theory]
    [InlineData("")]
    [InlineData("ModuloInexistente")]
    public async Task PermisoInvalidoNoHabilitaNiDashboard(string modulo)
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [Permiso(1, modulo, consultar: true)]
        };

        Assert.Empty(await new MenuService(acceso).ObtenerMenuAsync(Principal, default));
    }

    [Fact]
    public async Task PermisosDuplicadosSeDenieganPorDefecto()
    {
        var acceso = new AccesoActualDoble
        {
            Permisos = [
                Permiso(1, "Pacientes", consultar: true),
                Permiso(2, "pacientes", consultar: true)
            ]
        };

        Assert.Empty(await new MenuService(acceso).ObtenerMenuAsync(Principal, default));
    }

    [Fact]
    public async Task ConcesionYRevocacionSeAplicanSinCacheNiPrivilegioPorNombre()
    {
        var acceso = new AccesoActualDoble();
        var service = new MenuService(acceso);
        var admin = new ClaimsPrincipal(new ClaimsIdentity([
            new Claim("Username", "admin"),
            new Claim(ClaimTypes.Role, "Admin")
        ], "Test"));

        Assert.Empty(await service.ObtenerMenuAsync(admin, default));

        acceso.Permisos = [Permiso(1, "Habitaciones", consultar: true)];
        Assert.Contains("/habitaciones", Aplanar(
            await service.ObtenerMenuAsync(admin, default)).Select(item => item.Route));

        acceso.Permisos = [Permiso(1, "Habitaciones", consultar: false)];
        Assert.Empty(await service.ObtenerMenuAsync(admin, default));
    }

    [Fact]
    public void DtoMantieneElContratoJsonConsumidoPorAngular()
    {
        var json = JsonSerializer.Serialize(new MenuItemDto
        {
            Label = "Habitaciones",
            Route = "/habitaciones",
            Icon = "fa-bed",
            Children = []
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web));

        Assert.Contains("\"label\":\"Habitaciones\"", json, StringComparison.Ordinal);
        Assert.Contains("\"route\":\"/habitaciones\"", json, StringComparison.Ordinal);
        Assert.Contains("\"icon\":\"fa-bed\"", json, StringComparison.Ordinal);
        Assert.Contains("\"children\":[]", json, StringComparison.Ordinal);
    }

    [Fact]
    public async Task EndpointSinSesionDevuelve401()
    {
        using var factory = new MenuApiFactory();
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/menu")).StatusCode);
    }

    [Fact]
    public async Task EndpointConUsuarioActivoSinPermisosDevuelveListaVacia()
    {
        using var factory = new MenuApiFactory();
        await factory.SeedAsync(userActive: true, roleActive: true, roleName: "Admin");
        using var client = factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/menu");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await response.Content.ReadFromJsonAsync<List<MenuItemDto>>())!);
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task EndpointRechazaUsuarioORolInactivo(bool userActive, bool roleActive)
    {
        using var factory = new MenuApiFactory();
        await factory.SeedAsync(userActive, roleActive, "Admin",
            Permiso(1, "Pacientes", consultar: true));
        using var client = factory.CreateAuthenticatedClient();

        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/menu")).StatusCode);
    }

    [Fact]
    public async Task EndpointFiltraDuplicadosYSerializaCamelCase()
    {
        using var factory = new MenuApiFactory();
        await factory.SeedAsync(true, true, "Admin",
            Permiso(1, "Pacientes", consultar: true),
            Permiso(2, "pacientes", consultar: true),
            Permiso(3, "Ventas", consultar: true));
        using var client = factory.CreateAuthenticatedClient();

        var response = await client.GetAsync("/api/menu");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"label\"", body, StringComparison.Ordinal);
        Assert.DoesNotContain("\"Label\"", body, StringComparison.Ordinal);
        var rutas = Aplanar((await response.Content.ReadFromJsonAsync<List<MenuItemDto>>())!)
            .Select(item => item.Route).ToArray();
        Assert.Equal(new[] { "/dashboard", "/ventas" }, rutas);
    }

    private static PermisoActualResponse Permiso(int id, string modulo, bool consultar) =>
        new(id, modulo, consultar, false, false, false);

    private static IEnumerable<MenuItemDto> Aplanar(IEnumerable<MenuItemDto> items)
    {
        foreach (var item in items)
        {
            if (item.Route is not null) yield return item;
            if (item.Children is not null)
            {
                foreach (var child in Aplanar(item.Children)) yield return child;
            }
        }
    }

    private sealed class AccesoActualDoble : IAccesoActualService
    {
        public IReadOnlyList<PermisoActualResponse> Permisos { get; set; } = [];

        public Task<Usuario?> ObtenerUsuarioActivoAsync(
            ClaimsPrincipal principal, CancellationToken cancellationToken) =>
            Task.FromResult<Usuario?>(new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "usuario.prueba", Activo = true
            });

        public Task<IReadOnlyList<PermisoActualResponse>> ObtenerPermisosAsync(
            ClaimsPrincipal principal, CancellationToken cancellationToken) =>
            Task.FromResult(Permisos);
    }

    private sealed class MenuApiFactory : WebApplicationFactory<Program>
    {
        private const string Issuer = "API-Clinica.Menu.Tests";
        private const string Audience = "API-Clinica.Menu.Tests.Client";
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
                    ["Jwt:Issuer"] = Issuer,
                    ["Jwt:Audience"] = Audience,
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

        public async Task SeedAsync(
            bool userActive, bool roleActive, string roleName,
            params PermisoActualResponse[] permisos)
        {
            using var scope = Services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Roles.Add(new Rol { IdRol = 1, Nombre = roleName, Activo = roleActive });
            context.Usuarios.Add(new Usuario
            {
                IdUsuario = 1,
                IdRol = 1,
                Username = "usuario.prueba",
                PasswordHash = "no-utilizado",
                Activo = userActive
            });
            context.Permisos.AddRange(permisos.Select(p => new Permiso
            {
                IdPermiso = p.IdPermiso,
                IdRol = 1,
                Modulo = p.Modulo,
                PuedeConsultar = p.PuedeConsultar,
                PuedeCrear = p.PuedeCrear,
                PuedeModificar = p.PuedeModificar,
                PuedeEliminar = p.PuedeEliminar
            }));
            await context.SaveChangesAsync();
        }

        public HttpClient CreateAuthenticatedClient()
        {
            var client = CreateClient();
            var now = DateTime.UtcNow;
            var token = new JwtSecurityToken(
                issuer: Issuer,
                audience: Audience,
                claims: [
                    new Claim("IdUsuario", "1"),
                    new Claim("IdRol", "1"),
                    new Claim("Username", "usuario.prueba")
                ],
                notBefore: now.AddMinutes(-1),
                expires: now.AddMinutes(10),
                signingCredentials: new SigningCredentials(
                    new SymmetricSecurityKey(Encoding.UTF8.GetBytes(signingKey)),
                    SecurityAlgorithms.HmacSha256));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
                "Bearer", new JwtSecurityTokenHandler().WriteToken(token));
            return client;
        }
    }
}
