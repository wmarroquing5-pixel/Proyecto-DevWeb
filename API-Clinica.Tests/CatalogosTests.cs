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

public sealed class CatalogosTests
{
    [Theory]
    [InlineData("/api/sucursales", "Sucursales")]
    [InlineData("/api/especialidades", "Especialidades")]
    public async Task CatalogRequiresCurrentPermission(string route, string module)
    {
        using var factory = new CatalogApiFactory();
        var password = await factory.SeedUserAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(route)).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(route)).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Permisos.Add(new Permiso { IdRol = 1, Modulo = module, PuedeConsultar = true });
            await context.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(route)).StatusCode);
    }

    [Fact]
    public async Task SucursalCrudKeepsRowOnDeleteAndValidatesInput()
    {
        using var factory = new CatalogApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync("Sucursales");
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var invalid = await client.PostAsJsonAsync("/api/sucursales",
            new GuardarSucursalRequest { Nombre = "   " });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var created = await client.PostAsJsonAsync("/api/sucursales",
            new GuardarSucursalRequest { Nombre = "  Centro  ", Direccion = "  Calle 1  " });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var sucursal = await created.Content.ReadFromJsonAsync<SucursalResponse>();
        Assert.NotNull(sucursal);
        Assert.Equal("Centro", sucursal.Nombre);
        Assert.Equal("Calle 1", sucursal.Direccion);
        Assert.True(sucursal.Activa);

        var updated = await client.PutAsJsonAsync($"/api/sucursales/{sucursal.IdSucursal}",
            new GuardarSucursalRequest { Nombre = "Centro Norte", Direccion = null });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var current = await updated.Content.ReadFromJsonAsync<SucursalResponse>();
        Assert.NotNull(current);
        Assert.Null(current.Direccion);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/sucursales/{sucursal.IdSucursal}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/sucursales/{sucursal.IdSucursal}")).StatusCode);
        var persisted = await client.GetFromJsonAsync<SucursalResponse>(
            $"/api/sucursales/{sucursal.IdSucursal}");
        Assert.NotNull(persisted);
        Assert.False(persisted.Activa);

        var list = await client.GetFromJsonAsync<PagedResponse<SucursalResponse>>(
            "/api/sucursales?page=1&pageSize=1");
        Assert.NotNull(list);
        Assert.Equal(1, list.TotalCount);
        Assert.Single(list.Items);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/sucursales/9999")).StatusCode);
    }

    [Fact]
    public async Task EspecialidadCrudChecksUniqueNameAndSoftDeletesWithEmployeeReference()
    {
        using var factory = new CatalogApiFactory();
        var password = await factory.SeedUserAsync();
        await factory.GrantAllAsync("Especialidades");
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var created = await client.PostAsJsonAsync("/api/especialidades",
            new GuardarEspecialidadRequest { Nombre = "  Cardiología  " });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var especialidad = await created.Content.ReadFromJsonAsync<EspecialidadResponse>();
        Assert.NotNull(especialidad);
        Assert.Equal("Cardiología", especialidad.Nombre);
        Assert.True(especialidad.Activa);

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/especialidades",
                new GuardarEspecialidadRequest { Nombre = "Cardiología" })).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Sucursales.Add(new Sucursal { Nombre = "Referencia", Activa = true });
            await context.SaveChangesAsync();
            var idSucursal = await context.Sucursales.Select(s => s.IdSucursal).SingleAsync();
            context.Empleados.Add(new Empleado
            {
                IdSucursal = idSucursal, IdEspecialidad = especialidad.IdEspecialidad,
                Nombres = "Prueba", Apellidos = "Referencia", DPI = "CATALOGO-TEST",
                TipoEmpleado = "Medico", Activo = true
            });
            await context.SaveChangesAsync();
        }

        var updated = await client.PutAsJsonAsync($"/api/especialidades/{especialidad.IdEspecialidad}",
            new GuardarEspecialidadRequest { Nombre = "Medicina interna" });
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/especialidades/{especialidad.IdEspecialidad}")).StatusCode);
        var persisted = await client.GetFromJsonAsync<EspecialidadResponse>(
            $"/api/especialidades/{especialidad.IdEspecialidad}");
        Assert.NotNull(persisted);
        Assert.False(persisted.Activa);
        using var verifyScope = factory.Services.CreateScope();
        var verifyContext = verifyScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(especialidad.IdEspecialidad,
            (await verifyContext.Empleados.SingleAsync()).IdEspecialidad);
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "catalogos.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class CatalogApiFactory : WebApplicationFactory<Program>
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
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            context.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            var usuario = new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "catalogos.prueba", Activo = true
            };
            usuario.PasswordHash = hasher.HashPassword(usuario, password);
            context.Usuarios.Add(usuario);
            await context.SaveChangesAsync();
            return password;
        }

        public async Task GrantAllAsync(string module)
        {
            using var scope = Services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Permisos.Add(new Permiso
            {
                IdRol = 1, Modulo = module,
                PuedeConsultar = true, PuedeCrear = true,
                PuedeModificar = true, PuedeEliminar = true
            });
            await context.SaveChangesAsync();
        }
    }
}
