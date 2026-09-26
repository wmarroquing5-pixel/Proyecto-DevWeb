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

public sealed class VentasTests
{
    [Fact]
    public async Task VentaExigeJwtYPermisoActual()
    {
        using var factory = new VentaApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        var request = Request(1, (1, 1));

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/ventas", request)).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/ventas", request)).StatusCode);
        await factory.GrantAsync();
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/ventas", request)).StatusCode);
    }

    [Fact]
    public async Task DistribuyePorFefoYCalculaValoresDesdeLaBaseDeDatos()
    {
        using var factory = new VentaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var forgedRequest = new
        {
            idSucursal = 1,
            idUsuario = 999,
            total = 0.01m,
            items = new object[]
            {
                new { idMedicamento = 1, cantidad = 10, precioUnitario = 0.01m, subtotal = 0.10m },
                new { idMedicamento = 1, cantidad = 3, precioUnitario = 0.01m, subtotal = 0.03m },
                new { idMedicamento = 2, cantidad = 2, precioUnitario = 0.01m, subtotal = 0.02m }
            }
        };
        var created = await client.PostAsJsonAsync("/api/ventas", forgedRequest);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var sale = await created.Content.ReadFromJsonAsync<VentaResponse>();
        Assert.NotNull(sale);
        Assert.Equal(1, sale.IdUsuario);
        Assert.Equal(177.00m, sale.Total);
        Assert.Equal(new[] { 2, 3, 4, 5, 8 }, sale.Detalles.Select(d => d.IdLote));
        Assert.Equal(new[] { 5, 3, 4, 1, 2 }, sale.Detalles.Select(d => d.Cantidad));
        Assert.Equal(new[] { 12.50m, 12.50m, 12.50m, 12.50m, 7.25m },
            sale.Detalles.Select(d => d.PrecioUnitario));
        Assert.Equal(sale.Total, sale.Detalles.Sum(d => d.Subtotal));
        Assert.All(sale.Detalles, d => Assert.Equal(d.Cantidad * d.PrecioUnitario, d.Subtotal));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var persisted = await db.Ventas.SingleAsync();
        Assert.Equal(1, persisted.IdUsuario);
        Assert.Equal(177.00m, persisted.Total);
        Assert.Equal(5, await db.VentaDetalles.CountAsync());
        var stocks = await db.LoteMedicamentos.AsNoTracking()
            .OrderBy(l => l.IdLote).Select(l => l.CantidadDisponible).ToListAsync();
        Assert.Equal(new[] { 100, 0, 0, 0, 3, 100, 0, 1 }, stocks);
    }

    [Fact]
    public async Task StockInsuficienteCancelaTodaLaVentaSinDescontarOtrosMedicamentos()
    {
        using var factory = new VentaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/ventas", Request(1, (1, 2), (2, 4)))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/ventas", Request(1, (1, 17)))).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Empty(await db.Ventas.ToListAsync());
        Assert.Empty(await db.VentaDetalles.ToListAsync());
        Assert.Equal(5, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 2)).CantidadDisponible);
        Assert.Equal(3, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 8)).CantidadDisponible);
    }

    [Fact]
    public async Task VentaSiguienteNoPuedeReutilizarStockYaDescontado()
    {
        using var factory = new VentaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/ventas", Request(1, (1, 16)))).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/ventas", Request(1, (1, 1)))).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(1, await db.Ventas.CountAsync());
        Assert.Equal(0, await db.LoteMedicamentos.Where(l => l.IdMedicamento == 1 &&
            l.FechaVencimiento > DateOnly.FromDateTime(DateTime.UtcNow))
            .SumAsync(l => l.CantidadDisponible));
    }

    [Fact]
    public async Task AjusteDeStockConLecturaAntiguaSeRechaza()
    {
        using var factory = new VentaApiFactory();
        await factory.SeedAsync();
        using var firstScope = factory.Services.CreateScope();
        using var secondScope = factory.Services.CreateScope();
        var first = firstScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var second = secondScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var firstLot = await first.LoteMedicamentos.SingleAsync(l => l.IdLote == 2);
        var staleLot = await second.LoteMedicamentos.SingleAsync(l => l.IdLote == 2);

        firstLot.CantidadDisponible = 4;
        await first.SaveChangesAsync();
        staleLot.CantidadDisponible = 3;
        await Assert.ThrowsAsync<DbUpdateConcurrencyException>(() => second.SaveChangesAsync());

        using var verifyScope = factory.Services.CreateScope();
        var verify = verifyScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(4, (await verify.LoteMedicamentos.SingleAsync(l => l.IdLote == 2)).CantidadDisponible);
    }

    [Fact]
    public async Task ImporteQueExcedeDecimalDeLaBaseNoCreaVenta()
    {
        using var factory = new VentaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Medicamentos.SingleAsync(m => m.IdMedicamento == 1)).PrecioVenta =
                9_999_999_999_999_999.99m;
            await db.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/ventas", Request(1, (1, 2)))).StatusCode);
        using var verifyScope = factory.Services.CreateScope();
        var verify = verifyScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Empty(await verify.Ventas.ToListAsync());
        Assert.Equal(5, (await verify.LoteMedicamentos.SingleAsync(l => l.IdLote == 2)).CantidadDisponible);
    }

    [Fact]
    public async Task RechazaMedicamentoInactivoSucursalInactivaYEntradasInvalidas()
    {
        using var factory = new VentaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/ventas", Request(1, (3, 1)))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/ventas", Request(2, (1, 1)))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/ventas", Request(1, (1, 0)))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/ventas", new CrearVentaRequest
            {
                IdSucursal = 1, Items = []
            })).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Empty(await db.Ventas.ToListAsync());
    }

    private static CrearVentaRequest Request(int idSucursal, params (int Id, int Quantity)[] items) => new()
    {
        IdSucursal = idSucursal,
        Items = items.Select(x => new CrearVentaItemRequest
        {
            IdMedicamento = x.Id, Cantidad = x.Quantity
        }).ToList()
    };

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "ventas.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class VentaApiFactory : WebApplicationFactory<Program>
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
            db.Sucursales.AddRange(
                new Sucursal { IdSucursal = 1, Nombre = "Activa", Activa = true },
                new Sucursal { IdSucursal = 2, Nombre = "Inactiva", Activa = false });
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "ventas.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            db.Categorias.Add(new Categoria { IdCategoria = 1, Nombre = "Prueba", Activa = true });
            db.Marcas.Add(new Marca { IdMarca = 1, Nombre = "Prueba", Activa = true });
            db.Medicamentos.AddRange(
                Medicine(1, "MED-001", 12.50m, true),
                Medicine(2, "MED-002", 7.25m, true),
                Medicine(3, "MED-003", 5m, false));
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            db.LoteMedicamentos.AddRange(
                Lot(1, 1, 100, today.AddDays(-10), today.AddDays(-1)),
                Lot(2, 1, 5, today.AddDays(-2), today.AddDays(5)),
                Lot(3, 1, 3, today.AddDays(-3), today.AddDays(10)),
                Lot(4, 1, 4, today.AddDays(-1), today.AddDays(10)),
                Lot(5, 1, 4, today.AddDays(-1), today.AddDays(10)),
                Lot(6, 1, 100, today.AddDays(-1), today),
                Lot(7, 1, 0, today.AddDays(-1), today.AddDays(20)),
                Lot(8, 2, 3, today.AddDays(-1), today.AddDays(20)));
            await db.SaveChangesAsync();
            return password;
        }

        public async Task GrantAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Ventas", PuedeCrear = true });
            await db.SaveChangesAsync();
        }

        private static Medicamento Medicine(int id, string code, decimal price, bool active) => new()
        {
            IdMedicamento = id, IdCategoria = 1, IdMarca = 1,
            Codigo = code, Nombre = code, PrecioVenta = price, Activo = active
        };

        private static LoteMedicamento Lot(
            int id, int medicineId, int quantity, DateOnly ingreso, DateOnly vencimiento) => new()
        {
            IdLote = id, IdMedicamento = medicineId, NumeroLote = $"LOTE-{id}",
            FechaIngreso = ingreso, FechaVencimiento = vencimiento,
            CantidadDisponible = quantity
        };
    }
}
