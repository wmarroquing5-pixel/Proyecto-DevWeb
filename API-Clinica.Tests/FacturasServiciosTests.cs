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
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace API_Clinica.Tests;

public sealed class FacturasServiciosTests
{
    private static CrearFacturaServiciosRequest Solicitud(params (int Id, int Cantidad)[] items) => new()
    {
        IdSucursal = 1,
        IdPaciente = 1,
        Nit = "1234-5",
        NombreFacturacion = "Paciente de prueba",
        Servicios = items.Select(i => new CrearFacturaServicioItemRequest
            { IdServicio = i.Id, Cantidad = i.Cantidad }).ToList()
    };

    private static CrearFacturaServiciosRequest SolicitudMedicamento(int cantidad) => new()
    {
        IdSucursal = 1,
        IdPaciente = 1,
        Medicamentos = [new CrearFacturaMedicamentoItemRequest
            { IdMedicamento = 1, Cantidad = cantidad }]
    };

    [Fact]
    public async Task UnServicioUsaPrecioActualYCamposControladosPorServidor()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/facturas", new
        {
            idFactura = 999, idUsuario = 999, tipoFactura = "Venta Publica",
            fechaFactura = new DateTime(2000, 1, 1), total = 0.01m,
            idSucursal = 1, idPaciente = 1,
            nit = "  1234-5  ", nombreFacturacion = " Paciente   de prueba ",
            servicios = new[] { new
            {
                idServicio = 1, cantidad = 2, idLote = 10,
                precioUnitario = 0.01m, subtotal = 0.02m
            } }
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var factura = await response.Content.ReadFromJsonAsync<FacturaServiciosResponse>();
        Assert.NotNull(factura);
        Assert.NotEqual(999, factura.IdFactura);
        Assert.Equal(1, factura.IdUsuario);
        Assert.Equal(1, factura.IdPaciente);
        Assert.Equal("Estancia Medica", factura.TipoFactura);
        Assert.Equal("1234-5", factura.Nit);
        Assert.Equal("Paciente de prueba", factura.NombreFacturacion);
        Assert.Equal(200m, factura.Total);
        Assert.True(factura.FechaFactura > new DateTime(2020, 1, 1));
        var linea = Assert.Single(factura.Detalles);
        Assert.Equal(1, linea.IdServicio);
        Assert.Equal(2, linea.Cantidad);
        Assert.Equal(100m, linea.PrecioUnitario);
        Assert.Equal(200m, linea.Subtotal);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var cabecera = await db.Ventas.SingleAsync();
        var detalle = await db.VentaDetalles.SingleAsync();
        Assert.Equal(factura.IdFactura, cabecera.IdVenta);
        Assert.Equal(1, db.Entry(cabecera).Property<int?>("IdPaciente").CurrentValue);
        Assert.Equal("1234-5", db.Entry(cabecera).Property<string?>("Nit").CurrentValue);
        Assert.Equal(factura.IdFactura, detalle.IdVenta);
        Assert.Null(detalle.IdLote);
        Assert.Equal(1, db.Entry(detalle).Property<int?>("IdServicio").CurrentValue);
        Assert.Equal(10, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task VariosServiciosCalculanCadaSubtotalYTotal()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/facturas",
            Solicitud((1, 2), (2, 3)));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var factura = await response.Content.ReadFromJsonAsync<FacturaServiciosResponse>();
        Assert.NotNull(factura);
        Assert.Equal(311.75m, factura.Total);
        Assert.Equal(2, factura.Detalles.Count);
        Assert.Equal(new int?[] { 1, 2 }, factura.Detalles.Select(d => d.IdServicio));
        Assert.Equal(factura.Total, factura.Detalles.Sum(d => d.Subtotal));
        Assert.All(factura.Detalles, d => Assert.Equal(d.Cantidad * d.PrecioUnitario, d.Subtotal));
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var detalles = await db.VentaDetalles.ToListAsync();
        Assert.Equal(2, detalles.Count);
        Assert.All(detalles, d => Assert.Null(d.IdLote));
        Assert.Equal(new int?[] { 1, 2 }, detalles.OrderBy(d => d.IdVentaDetalle)
            .Select(d => db.Entry(d).Property<int?>("IdServicio").CurrentValue));
        Assert.Equal(10, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
    }

    [Theory]
    [InlineData(999)]
    [InlineData(3)]
    [InlineData(4)]
    public async Task RechazaServicioInexistenteInactivoOGratuito(int idServicio)
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((idServicio, 1)))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task RechazaCantidadNoPositiva(int cantidad)
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, cantidad)))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task RechazaListaVaciaYPacienteInexistente()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud())).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", new
            {
                idSucursal = 1, idPaciente = 999,
                servicios = new[] { new { idServicio = 1, cantidad = 1 } }
            })).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Theory]
    [InlineData(2)]
    [InlineData(999)]
    public async Task RechazaSucursalInactivaOInexistente(int idSucursal)
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", new
            {
                idSucursal, idPaciente = 1,
                servicios = new[] { new { idServicio = 1, cantidad = 1 } }
            })).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task RechazaImporteQueExcedeDecimalSqlSinGuardar()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        await factory.SetPrecioAsync(1, 9_999_999_999_999_999.99m);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 2)))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task RechazaLongitudesDeDatosDeFacturacion()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        foreach (var request in new object[]
        {
            new { idSucursal = 1, idPaciente = 1, nit = new string('N', 51),
                servicios = new[] { new { idServicio = 1, cantidad = 1 } } },
            new { idSucursal = 1, idPaciente = 1,
                nombreFacturacion = new string('N', 151),
                servicios = new[] { new { idServicio = 1, cantidad = 1 } } }
        })
            Assert.Equal(HttpStatusCode.BadRequest,
                (await client.PostAsJsonAsync("/api/facturas", request)).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task RequiereJwtYPermisoFacturasActualSinReutilizarVentas()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
        await factory.GrantVentasAsync();
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
        await factory.GrantFacturasAsync();
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
        await factory.RevokeFacturasAsync();
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
    }

    [Fact]
    public async Task UsuarioORolInactivoNoPuedeFacturar()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        await factory.SetUsuarioActivoAsync(false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
        await factory.SetUsuarioActivoAsync(true);
        await factory.SetRolActivoAsync(false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task FalloAlGuardarNoPersisteFacturaNiDetalles()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        factory.FailNextFacturaSave();
        Assert.Equal(HttpStatusCode.InternalServerError,
            (await client.PostAsJsonAsync("/api/facturas", Solicitud((1, 1)))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task SoloMedicamentosUsaPrecioActualYLoteSinServicio()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/facturas", new
        {
            idSucursal = 1, idPaciente = 1, idUsuario = 999, total = 0.01m,
            medicamentos = new[] { new
            {
                idMedicamento = 1, cantidad = 2, idLote = 999,
                precioUnitario = 0.01m, subtotal = 0.02m
            } }
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var factura = await response.Content.ReadFromJsonAsync<FacturaServiciosResponse>();
        Assert.NotNull(factura);
        Assert.Equal(1, factura.IdUsuario);
        Assert.Equal("Estancia Medica", factura.TipoFactura);
        Assert.Equal(10m, factura.Total);
        var linea = Assert.Single(factura.Detalles);
        Assert.Null(linea.IdServicio);
        Assert.Equal(1, linea.IdMedicamento);
        Assert.Equal(1, linea.IdLote);
        Assert.Equal(2, linea.Cantidad);
        Assert.Equal(5m, linea.PrecioUnitario);
        Assert.Equal(10m, linea.Subtotal);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var detalle = await db.VentaDetalles.SingleAsync();
        Assert.Null(db.Entry(detalle).Property<int?>("IdServicio").CurrentValue);
        Assert.Equal(1, detalle.IdLote);
        Assert.Equal(8, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        var movimiento = await db.MovimientosInventario.SingleAsync();
        Assert.Equal(1, movimiento.IdLote);
        Assert.Equal(2, movimiento.Cantidad);
        Assert.Equal("Venta Publica", movimiento.TipoMovimiento);
        Assert.Equal(1, movimiento.IdUsuario);
        Assert.Equal(1, movimiento.IdSucursal);
        Assert.True(movimiento.FechaMovimiento > new DateTime(2020, 1, 1));
    }

    [Fact]
    public async Task FacturaMixtaConservaAmbosTiposDeDetalleYTotal()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var request = Solicitud((1, 1));
        request.Medicamentos.Add(new CrearFacturaMedicamentoItemRequest
            { IdMedicamento = 1, Cantidad = 2 });

        var response = await client.PostAsJsonAsync("/api/facturas", request);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var factura = await response.Content.ReadFromJsonAsync<FacturaServiciosResponse>();
        Assert.NotNull(factura);
        Assert.Equal(110m, factura.Total);
        Assert.Equal(2, factura.Detalles.Count);
        Assert.Contains(factura.Detalles, d => d.IdServicio == 1 && d.IdLote is null &&
            d.IdMedicamento is null && d.Subtotal == 100m);
        Assert.Contains(factura.Detalles, d => d.IdServicio is null && d.IdLote == 1 &&
            d.IdMedicamento == 1 && d.Subtotal == 10m);
        Assert.Equal(factura.Total, factura.Detalles.Sum(d => d.Subtotal));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(2, await db.VentaDetalles.CountAsync());
        Assert.Equal(8, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        var movimiento = await db.MovimientosInventario.SingleAsync();
        Assert.Equal(1, movimiento.IdLote);
        Assert.Equal(2, movimiento.Cantidad);
        Assert.Equal("Venta Publica", movimiento.TipoMovimiento);
    }

    [Fact]
    public async Task FefoExcluyeLoteVencidoYDistribuyeEntreLotesVigentes()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await factory.AddLoteAsync(2, today.AddDays(-5), today.AddDays(2), 3);
        await factory.AddLoteAsync(3, today.AddDays(-4), today.AddDays(4), 5);
        await factory.AddLoteAsync(4, today.AddDays(-10), today, 100);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var response = await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(7));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var factura = await response.Content.ReadFromJsonAsync<FacturaServiciosResponse>();
        Assert.NotNull(factura);
        Assert.Equal(35m, factura.Total);
        Assert.Equal(new int?[] { 2, 3 }, factura.Detalles.Select(d => d.IdLote));
        Assert.Equal(new[] { 3, 4 }, factura.Detalles.Select(d => d.Cantidad));
        Assert.All(factura.Detalles, d => Assert.Null(d.IdServicio));

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Equal(10, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 1)).CantidadDisponible);
        Assert.Equal(0, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 2)).CantidadDisponible);
        Assert.Equal(1, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 3)).CantidadDisponible);
        Assert.Equal(100, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 4)).CantidadDisponible);
        var movimientos = await db.MovimientosInventario.OrderBy(m => m.IdLote).ToListAsync();
        Assert.Equal(new[] { 2, 3 }, movimientos.Select(m => m.IdLote));
        Assert.Equal(new[] { 3, 4 }, movimientos.Select(m => m.Cantidad));
        Assert.All(movimientos, m => Assert.Equal("Venta Publica", m.TipoMovimiento));
    }

    [Fact]
    public async Task StockInsuficienteCancelaFacturaMixtaCompleta()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var request = Solicitud((1, 1));
        request.Medicamentos.Add(new CrearFacturaMedicamentoItemRequest
            { IdMedicamento = 1, Cantidad = 11 });

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/facturas", request)).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task LoteVencidoNoAportaStock()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        await factory.SetLoteCantidadAsync(1, 0);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        await factory.AddLoteAsync(2, today.AddDays(-10), today, 20);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(1))).StatusCode);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Empty(await db.Ventas.ToListAsync());
        Assert.Empty(await db.VentaDetalles.ToListAsync());
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
        Assert.Equal(20, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 2)).CantidadDisponible);
    }

    [Fact]
    public async Task MedicamentoInactivoOPrecioCeroSeRechaza()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        await factory.SetMedicamentoActivoAsync(false);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(1))).StatusCode);
        await factory.SetMedicamentoActivoAsync(true);
        await factory.SetMedicamentoPrecioAsync(0m);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(1))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task RechazaCantidadInvalidaDeMedicamento(int cantidad)
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(cantidad))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task FacturaConMedicamentosRequiereJwtYPermisoFacturas()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(1))).StatusCode);
        await LoginAsync(client, password);
        await factory.GrantVentasAsync();
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(1))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task FalloAlGuardarRevierteFacturaMixtaYStock()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var request = Solicitud((1, 1));
        request.Medicamentos.Add(new CrearFacturaMedicamentoItemRequest
            { IdMedicamento = 1, Cantidad = 2 });
        factory.FailNextFacturaSave();

        Assert.Equal(HttpStatusCode.InternalServerError,
            (await client.PostAsJsonAsync("/api/facturas", request)).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    [Fact]
    public async Task FalloDelMovimientoImpideFacturaYDescuento()
    {
        using var factory = new FacturaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantFacturasAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        factory.FailNextMovementSave();

        Assert.Equal(HttpStatusCode.InternalServerError,
            (await client.PostAsJsonAsync("/api/facturas", SolicitudMedicamento(2))).StatusCode);
        await factory.AssertSinFacturaAsync();
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "facturas.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class FacturaApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        private readonly FailFacturaSave failSave = new();

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
                    .UseInMemoryDatabase(databaseName).AddInterceptors(failSave).Options);
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
                IdUsuario = 1, IdRol = 1, Username = "facturas.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            db.Pacientes.Add(new Paciente
            {
                IdPaciente = 1, Nombres = "Paciente", Apellidos = "Prueba",
                FechaNacimiento = new DateOnly(1990, 1, 1), FechaRegistro = DateTime.UtcNow,
                Activo = true
            });
            db.Servicios.AddRange(
                new Servicio { IdServicio = 1, Codigo = "SERV-1", Nombre = "Consulta",
                    PrecioBase = 100m, TipoServicio = "Consulta", Activo = true },
                new Servicio { IdServicio = 2, Codigo = "SERV-2", Nombre = "Examen",
                    PrecioBase = 37.25m, TipoServicio = "Examen", Activo = true },
                new Servicio { IdServicio = 3, Codigo = "SERV-3", Nombre = "Inactivo",
                    PrecioBase = 20m, TipoServicio = "Otro", Activo = false },
                new Servicio { IdServicio = 4, Codigo = "SERV-4", Nombre = "Gratuito",
                    PrecioBase = 0m, TipoServicio = "Otro", Activo = true });
            db.Categorias.Add(new Categoria { IdCategoria = 1, Nombre = "Prueba", Activa = true });
            db.Marcas.Add(new Marca { IdMarca = 1, Nombre = "Prueba", Activa = true });
            db.Medicamentos.Add(new Medicamento
            {
                IdMedicamento = 1, IdCategoria = 1, IdMarca = 1,
                Codigo = "MED-1", Nombre = "Prueba", PrecioVenta = 5m, Activo = true
            });
            db.LoteMedicamentos.Add(new LoteMedicamento
            {
                IdLote = 1, IdMedicamento = 1, NumeroLote = "LOT-1",
                FechaIngreso = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-10)),
                FechaVencimiento = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(10)),
                CantidadDisponible = 10
            });
            await db.SaveChangesAsync();
            return password;
        }

        public async Task GrantFacturasAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleOrDefaultAsync(p => p.Modulo == "Facturas");
            if (permiso is null)
                db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Facturas", PuedeCrear = true });
            else permiso.PuedeCrear = true;
            await db.SaveChangesAsync();
        }

        public async Task GrantVentasAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Ventas", PuedeCrear = true });
            await db.SaveChangesAsync();
        }

        public async Task RevokeFacturasAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Permisos.SingleAsync(p => p.Modulo == "Facturas")).PuedeCrear = false;
            await db.SaveChangesAsync();
        }

        public async Task SetUsuarioActivoAsync(bool activo)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).Activo = activo;
            await db.SaveChangesAsync();
        }

        public async Task SetRolActivoAsync(bool activo)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Roles.SingleAsync()).Activo = activo;
            await db.SaveChangesAsync();
        }

        public async Task SetPrecioAsync(int idServicio, decimal precio)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Servicios.SingleAsync(s => s.IdServicio == idServicio)).PrecioBase = precio;
            await db.SaveChangesAsync();
        }

        public async Task SetMedicamentoActivoAsync(bool activo)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Medicamentos.SingleAsync()).Activo = activo;
            await db.SaveChangesAsync();
        }

        public async Task SetMedicamentoPrecioAsync(decimal precio)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Medicamentos.SingleAsync()).PrecioVenta = precio;
            await db.SaveChangesAsync();
        }

        public async Task SetLoteCantidadAsync(int idLote, int cantidad)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == idLote)).CantidadDisponible = cantidad;
            await db.SaveChangesAsync();
        }

        public async Task AddLoteAsync(int idLote, DateOnly ingreso, DateOnly vencimiento, int cantidad)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.LoteMedicamentos.Add(new LoteMedicamento
            {
                IdLote = idLote, IdMedicamento = 1, NumeroLote = $"LOT-{idLote}",
                FechaIngreso = ingreso, FechaVencimiento = vencimiento,
                CantidadDisponible = cantidad
            });
            await db.SaveChangesAsync();
        }

        public void FailNextFacturaSave() => failSave.FailNext();
        public void FailNextMovementSave() => failSave.FailNextMovement();

        public async Task AssertSinFacturaAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            Assert.Empty(await db.Ventas.ToListAsync());
            Assert.Empty(await db.VentaDetalles.ToListAsync());
            Assert.Equal(10, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == 1)).CantidadDisponible);
            Assert.Empty(await db.MovimientosInventario.ToListAsync());
        }

        private sealed class FailFacturaSave : SaveChangesInterceptor
        {
            private int failNext;
            private int failNextMovement;
            public void FailNext() => Interlocked.Exchange(ref failNext, 1);
            public void FailNextMovement() => Interlocked.Exchange(ref failNextMovement, 1);

            public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
                DbContextEventData eventData, InterceptionResult<int> result,
                CancellationToken cancellationToken = default)
            {
                if (eventData.Context?.ChangeTracker.Entries<MovimientoInventario>()
                        .Any(e => e.State == EntityState.Added) == true &&
                    Interlocked.Exchange(ref failNextMovement, 0) == 1)
                    throw new InvalidOperationException("Fallo simulado del movimiento.");
                if (eventData.Context?.ChangeTracker.Entries<Venta>()
                        .Any(e => e.State == EntityState.Added) == true &&
                    Interlocked.Exchange(ref failNext, 0) == 1)
                    throw new InvalidOperationException("Fallo simulado antes de persistir.");
                return base.SavingChangesAsync(eventData, result, cancellationToken);
            }
        }
    }
}
