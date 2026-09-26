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

public sealed class FarmaciaTests
{
    [Theory]
    [InlineData("/api/categorias", "Categorias")]
    [InlineData("/api/marcas", "Marcas")]
    [InlineData("/api/medicamentos", "Medicamentos")]
    [InlineData("/api/lotes-medicamento", "LotesMedicamento")]
    public async Task CrudExigeJwtYPermisoActual(string route, string module)
    {
        using var factory = new FarmaciaApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(route)).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync(route)).StatusCode);
        await factory.GrantAsync(module);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync(route)).StatusCode);
    }

    [Fact]
    public async Task CrudMantieneRelacionesYAplicaBajasLogicas()
    {
        using var factory = new FarmaciaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var category = await CreateCategoryAsync(client);
        var brand = await CreateBrandAsync(client);
        var updatedCategory = await client.PutAsJsonAsync($"/api/categorias/{category.IdCategoria}",
            new GuardarCatalogoFarmaciaRequest { Nombre = "Medicinas" });
        Assert.Equal(HttpStatusCode.OK, updatedCategory.StatusCode);
        Assert.Equal("Medicinas", (await updatedCategory.Content.ReadFromJsonAsync<CategoriaResponse>())?.Nombre);
        var updatedBrand = await client.PutAsJsonAsync($"/api/marcas/{brand.IdMarca}",
            new GuardarCatalogoFarmaciaRequest { Nombre = "Laboratorio nuevo" });
        Assert.Equal(HttpStatusCode.OK, updatedBrand.StatusCode);
        Assert.Equal("Laboratorio nuevo", (await updatedBrand.Content.ReadFromJsonAsync<MarcaResponse>())?.Nombre);
        var createdMedicine = await client.PostAsJsonAsync("/api/medicamentos",
            Medicine(category.IdCategoria, brand.IdMarca));
        Assert.Equal(HttpStatusCode.Created, createdMedicine.StatusCode);
        var medicine = await createdMedicine.Content.ReadFromJsonAsync<MedicamentoResponse>();
        Assert.NotNull(medicine);
        Assert.True(medicine.Activo);
        Assert.Equal("MED-001", medicine.Codigo);

        var createdLot = await client.PostAsJsonAsync("/api/lotes-medicamento",
            Lot(medicine.IdMedicamento, 5));
        Assert.Equal(HttpStatusCode.Created, createdLot.StatusCode);
        var lot = await createdLot.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(lot);
        Assert.Equal(5, lot.CantidadDisponible);

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/categorias/{category.IdCategoria}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/marcas/{brand.IdMarca}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/categorias/{category.IdCategoria}",
                new GuardarCatalogoFarmaciaRequest
                {
                    Nombre = "Medicinas", Activa = false
                })).StatusCode);

        var updatedLot = await client.PutAsJsonAsync($"/api/lotes-medicamento/{lot.IdLote}",
            Lot(medicine.IdMedicamento, 0));
        Assert.Equal(HttpStatusCode.OK, updatedLot.StatusCode);
        Assert.Equal(0, (await updatedLot.Content.ReadFromJsonAsync<LoteMedicamentoResponse>())?.CantidadDisponible);

        var updatedMedicine = await client.PutAsJsonAsync($"/api/medicamentos/{medicine.IdMedicamento}",
            Medicine(category.IdCategoria, brand.IdMarca, price: 18.75m));
        Assert.Equal(HttpStatusCode.OK, updatedMedicine.StatusCode);
        Assert.Equal(18.75m, (await updatedMedicine.Content.ReadFromJsonAsync<MedicamentoResponse>())?.PrecioVenta);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/medicamentos/{medicine.IdMedicamento}")).StatusCode);
        Assert.False((await client.GetFromJsonAsync<MedicamentoResponse>(
            $"/api/medicamentos/{medicine.IdMedicamento}"))?.Activo);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/lotes-medicamento",
                Lot(medicine.IdMedicamento, 1))).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/categorias/{category.IdCategoria}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/marcas/{brand.IdMarca}")).StatusCode);
        Assert.False((await client.GetFromJsonAsync<CategoriaResponse>(
            $"/api/categorias/{category.IdCategoria}"))?.Activa);
        Assert.False((await client.GetFromJsonAsync<MarcaResponse>(
            $"/api/marcas/{brand.IdMarca}"))?.Activa);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/medicamentos/{medicine.IdMedicamento}",
                new GuardarMedicamentoRequest
                {
                    IdCategoria = category.IdCategoria, IdMarca = brand.IdMarca,
                    Codigo = medicine.Codigo, Nombre = medicine.Nombre,
                    PrecioVenta = 18.75m, Activo = true
                })).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/lotes-medicamento/{lot.IdLote}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/lotes-medicamento/{lot.IdLote}")).StatusCode);
    }

    [Fact]
    public async Task RechazaDatosInvalidosYRelacionesInactivas()
    {
        using var factory = new FarmaciaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/categorias",
                new GuardarCatalogoFarmaciaRequest { Nombre = "   " })).StatusCode);
        var category = await CreateCategoryAsync(client);
        var brand = await CreateBrandAsync(client);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/medicamentos",
                Medicine(999, brand.IdMarca))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/medicamentos",
                Medicine(category.IdCategoria, brand.IdMarca, price: 0))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/medicamentos",
                Medicine(category.IdCategoria, brand.IdMarca, price: 1.234m))).StatusCode);

        var medicineResponse = await client.PostAsJsonAsync("/api/medicamentos",
            Medicine(category.IdCategoria, brand.IdMarca));
        var medicine = await medicineResponse.Content.ReadFromJsonAsync<MedicamentoResponse>();
        Assert.NotNull(medicine);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/medicamentos",
                Medicine(category.IdCategoria, brand.IdMarca))).StatusCode);

        var ingreso = DateOnly.FromDateTime(DateTime.UtcNow);
        var invalidLots = new[]
        {
            Lot(medicine.IdMedicamento, -1),
            Lot(medicine.IdMedicamento, 1, numero: "   "),
            Lot(medicine.IdMedicamento, 1, ingreso: DateOnly.MinValue),
            Lot(medicine.IdMedicamento, 1, ingreso: ingreso, vencimiento: ingreso),
            Lot(medicine.IdMedicamento, 1, ingreso: ingreso.AddDays(1)),
            Lot(999, 1)
        };
        foreach (var request in invalidLots)
            Assert.Equal(HttpStatusCode.BadRequest,
                (await client.PostAsJsonAsync("/api/lotes-medicamento", request)).StatusCode);

        var lotResponse = await client.PostAsJsonAsync("/api/lotes-medicamento",
            Lot(medicine.IdMedicamento, 1));
        var lot = await lotResponse.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(lot);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/lotes-medicamento/{lot.IdLote}",
                Lot(medicine.IdMedicamento, 1, ingreso: ingreso, vencimiento: ingreso))).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/medicamentos/{medicine.IdMedicamento}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/lotes-medicamento/{lot.IdLote}",
                Lot(medicine.IdMedicamento, 1))).StatusCode);
    }

    [Fact]
    public async Task VentaDetalleRechazaMedicamentoInactivoYProtegeLoteVendido()
    {
        using var factory = new FarmaciaApiFactory();
        var password = await factory.SeedAsync();
        await factory.GrantAllAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var category = await CreateCategoryAsync(client);
        var brand = await CreateBrandAsync(client);
        var medicineResponse = await client.PostAsJsonAsync("/api/medicamentos",
            Medicine(category.IdCategoria, brand.IdMarca));
        var medicine = await medicineResponse.Content.ReadFromJsonAsync<MedicamentoResponse>();
        Assert.NotNull(medicine);
        var lotResponse = await client.PostAsJsonAsync("/api/lotes-medicamento",
            Lot(medicine.IdMedicamento, 5));
        var lot = await lotResponse.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(lot);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Ventas.Add(new Venta
            {
                IdVenta = 1, IdUsuario = 1, IdSucursal = 1,
                FechaVenta = DateTime.UtcNow, Total = 10m
            });
            await db.SaveChangesAsync();
            db.VentaDetalles.Add(new VentaDetalle
            {
                IdVentaDetalle = 1, IdVenta = 1, IdLote = lot.IdLote,
                Cantidad = 1, PrecioUnitario = 10m, Subtotal = 10m
            });
            await db.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/lotes-medicamento/{lot.IdLote}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/medicamentos/{medicine.IdMedicamento}")).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.VentaDetalles.Add(new VentaDetalle
            {
                IdVenta = 1, IdLote = lot.IdLote,
                Cantidad = 1, PrecioUnitario = 10m, Subtotal = 10m
            });
            await Assert.ThrowsAsync<AppValidationException>(() => db.SaveChangesAsync());
        }
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.VentaDetalles.SingleAsync()).Cantidad = 2;
            await Assert.ThrowsAsync<AppValidationException>(() => db.SaveChangesAsync());
        }
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var detail = await db.VentaDetalles.SingleAsync();
            Assert.Equal(1, detail.Cantidad);
        }
    }

    private static GuardarMedicamentoRequest Medicine(
        int idCategoria, int idMarca, decimal price = 12.50m) => new()
    {
        IdCategoria = idCategoria, IdMarca = idMarca,
        Codigo = "MED-001", Nombre = "Prueba", PrecioVenta = price
    };

    private static GuardarLoteMedicamentoRequest Lot(
        int idMedicamento, int quantity, string numero = "LOTE-001",
        DateOnly? ingreso = null, DateOnly? vencimiento = null) => new()
    {
        IdMedicamento = idMedicamento, CantidadDisponible = quantity,
        NumeroLote = numero,
        FechaIngreso = ingreso ?? DateOnly.FromDateTime(DateTime.UtcNow),
        FechaVencimiento = vencimiento ?? DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1))
    };

    private static async Task<CategoriaResponse> CreateCategoryAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/categorias",
            new GuardarCatalogoFarmaciaRequest { Nombre = "  Analgésicos  " });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var category = await response.Content.ReadFromJsonAsync<CategoriaResponse>();
        Assert.NotNull(category);
        Assert.Equal("Analgésicos", category.Nombre);
        return category;
    }

    private static async Task<MarcaResponse> CreateBrandAsync(HttpClient client)
    {
        var response = await client.PostAsJsonAsync("/api/marcas",
            new GuardarCatalogoFarmaciaRequest { Nombre = "  Laboratorio  " });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var brand = await response.Content.ReadFromJsonAsync<MarcaResponse>();
        Assert.NotNull(brand);
        Assert.Equal("Laboratorio", brand.Nombre);
        return brand;
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "farmacia.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class FarmaciaApiFactory : WebApplicationFactory<Program>
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
                IdUsuario = 1, IdRol = 1, Username = "farmacia.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            await db.SaveChangesAsync();
            return password;
        }

        public async Task GrantAllAsync()
        {
            foreach (var module in new[] { "Categorias", "Marcas", "Medicamentos", "LotesMedicamento" })
                await GrantAsync(module);
        }

        public async Task GrantAsync(string module)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Permisos.Add(new Permiso
            {
                IdRol = 1, Modulo = module,
                PuedeConsultar = true, PuedeCrear = true,
                PuedeModificar = true, PuedeEliminar = true
            });
            await db.SaveChangesAsync();
        }
    }
}
