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
    public async Task CatalogoFiltraMedicamentosYCalculaSoloExistenciaVigente()
    {
        using var factory = new FarmaciaApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/medicamentos/catalogo")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/medicamentos/catalogo/1")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/medicamentos/catalogo")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/medicamentos/catalogo/1")).StatusCode);
        await factory.GrantAllAsync();

        var category = await CreateCategoryAsync(client);
        var brand = await CreateBrandAsync(client);
        var anotherCategory = await client.PostAsJsonAsync("/api/categorias",
            new GuardarCatalogoFarmaciaRequest { Nombre = "Antibióticos" });
        var anotherBrand = await client.PostAsJsonAsync("/api/marcas",
            new GuardarCatalogoFarmaciaRequest { Nombre = "Otra marca" });
        Assert.Equal(HttpStatusCode.Created, anotherCategory.StatusCode);
        Assert.Equal(HttpStatusCode.Created, anotherBrand.StatusCode);
        var category2 = await anotherCategory.Content.ReadFromJsonAsync<CategoriaResponse>();
        var brand2 = await anotherBrand.Content.ReadFromJsonAsync<MarcaResponse>();
        Assert.NotNull(category2);
        Assert.NotNull(brand2);

        var medicineResponse = await client.PostAsJsonAsync("/api/medicamentos",
            new GuardarMedicamentoRequest
            {
                IdCategoria = category.IdCategoria, IdMarca = brand.IdMarca,
                Codigo = "MED-CAT-1", Nombre = "Paracetamol",
                Descripcion = "Tabletas", ImagenURL = "https://example.test/med.png",
                PrecioVenta = 12.50m
            });
        var otherResponse = await client.PostAsJsonAsync("/api/medicamentos",
            new GuardarMedicamentoRequest
            {
                IdCategoria = category2.IdCategoria, IdMarca = brand2.IdMarca,
                Codigo = "MED-CAT-2", Nombre = "Amoxicilina", PrecioVenta = 20m
            });
        var inactiveResponse = await client.PostAsJsonAsync("/api/medicamentos",
            new GuardarMedicamentoRequest
            {
                IdCategoria = category.IdCategoria, IdMarca = brand.IdMarca,
                Codigo = "MED-CAT-3", Nombre = "Inactivo", PrecioVenta = 10m,
                Activo = false
            });
        Assert.Equal(HttpStatusCode.Created, medicineResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, otherResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Created, inactiveResponse.StatusCode);
        var medicine = await medicineResponse.Content.ReadFromJsonAsync<MedicamentoResponse>();
        var inactive = await inactiveResponse.Content.ReadFromJsonAsync<MedicamentoResponse>();
        Assert.NotNull(medicine);
        Assert.NotNull(inactive);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var lots = new[]
        {
            Lot(medicine.IdMedicamento, 5, "CAT-1"),
            Lot(medicine.IdMedicamento, 2, "CAT-2"),
            Lot(medicine.IdMedicamento, 0, "CAT-3"),
            Lot(medicine.IdMedicamento, 0, "CAT-4", today.AddDays(-10), today.AddDays(-1)),
            Lot(medicine.IdMedicamento, 0, "CAT-5", today.AddDays(-1), today)
        };
        foreach (var lot in lots)
            Assert.Equal(HttpStatusCode.Created,
                (await client.PostAsJsonAsync("/api/lotes-medicamento", lot)).StatusCode);

        var catalog = await client.GetFromJsonAsync<PagedResponse<CatalogoMedicamentoResponse>>(
            "/api/medicamentos/catalogo?page=1&pageSize=1");
        Assert.NotNull(catalog);
        Assert.Equal(2, catalog.TotalCount);
        var item = Assert.Single(catalog.Items);
        Assert.Equal(medicine.IdMedicamento, item.IdMedicamento);
        Assert.Equal("MED-CAT-1", item.Codigo);
        Assert.Equal("Paracetamol", item.Nombre);
        Assert.Equal(12.50m, item.PrecioVenta);
        Assert.Equal("Laboratorio", item.Marca);
        Assert.Equal("Analgésicos", item.Categoria);
        Assert.Equal("Tabletas", item.Descripcion);
        Assert.Equal("https://example.test/med.png", item.ImagenURL);
        Assert.Equal(7, item.ExistenciaTotal);
        var secondPage = await client.GetFromJsonAsync<PagedResponse<CatalogoMedicamentoResponse>>(
            "/api/medicamentos/catalogo?page=2&pageSize=1");
        Assert.NotNull(secondPage);
        Assert.Equal(2, secondPage.TotalCount);
        Assert.Equal(0, Assert.Single(secondPage.Items).ExistenciaTotal);

        var filtered = await client.GetFromJsonAsync<PagedResponse<CatalogoMedicamentoResponse>>(
            $"/api/medicamentos/catalogo?nombre=PARA&categoriaId={category.IdCategoria}&marcaId={brand.IdMarca}");
        Assert.NotNull(filtered);
        Assert.Equal(1, filtered.TotalCount);
        Assert.Equal(medicine.IdMedicamento, Assert.Single(filtered.Items).IdMedicamento);
        var none = await client.GetFromJsonAsync<PagedResponse<CatalogoMedicamentoResponse>>(
            $"/api/medicamentos/catalogo?categoriaId={category2.IdCategoria}&marcaId={brand.IdMarca}");
        Assert.NotNull(none);
        Assert.Empty(none.Items);

        var detail = await client.GetFromJsonAsync<CatalogoMedicamentoResponse>(
            $"/api/medicamentos/catalogo/{medicine.IdMedicamento}");
        Assert.NotNull(detail);
        Assert.Equal(7, detail.ExistenciaTotal);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync($"/api/medicamentos/catalogo/{inactive.IdMedicamento}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/medicamentos/catalogo?page=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/medicamentos/catalogo?categoriaId=0")).StatusCode);
    }

    [Fact]
    public async Task CatalogoUsaFechaUtcControladaYExcluyeLotesNoDisponiblesSinModificarInventario()
    {
        var ahora = new DateTimeOffset(2026, 6, 15, 23, 59, 0, TimeSpan.Zero);
        var hoy = DateOnly.FromDateTime(ahora.UtcDateTime);
        using var factory = new FarmaciaApiFactory(ahora);
        var password = await factory.SeedAsync();
        await factory.GrantAsync("Medicamentos");
        await factory.SeedCatalogoConFechasAsync(hoy);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var inventarioAntes = await factory.ReadInventoryAsync();

        var catalogo = await client.GetFromJsonAsync<PagedResponse<CatalogoMedicamentoResponse>>(
            "/api/medicamentos/catalogo");
        var detalle = await client.GetFromJsonAsync<CatalogoMedicamentoResponse>(
            "/api/medicamentos/catalogo/1");

        Assert.NotNull(catalogo);
        Assert.Equal(2, catalogo.TotalCount);
        var disponible = Assert.Single(catalogo.Items, item => item.IdMedicamento == 1);
        var soloFuturo = Assert.Single(catalogo.Items, item => item.IdMedicamento == 2);
        Assert.Equal(7, disponible.ExistenciaTotal);
        Assert.Equal(12.50m, disponible.PrecioVenta);
        Assert.Equal(0, soloFuturo.ExistenciaTotal);
        Assert.NotNull(detalle);
        Assert.Equal(disponible.ExistenciaTotal, detalle.ExistenciaTotal);
        Assert.Equal(disponible.PrecioVenta, detalle.PrecioVenta);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/medicamentos/catalogo/3")).StatusCode);
        Assert.Equal(inventarioAntes, await factory.ReadInventoryAsync());
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
            Lot(medicine.IdMedicamento, 0));
        Assert.Equal(HttpStatusCode.Created, createdLot.StatusCode);
        var lot = await createdLot.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(lot);
        Assert.Equal(0, lot.CantidadDisponible);

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
            UpdateLot(medicine.IdMedicamento, 0, expected: 0));
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
            Lot(999, 1)
        };
        foreach (var request in invalidLots)
            Assert.Equal(HttpStatusCode.BadRequest,
                (await client.PostAsJsonAsync("/api/lotes-medicamento", request)).StatusCode);

        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/lotes-medicamento",
                Lot(medicine.IdMedicamento, 1, numero: "LOTE-FUTURO",
                    ingreso: ingreso.AddDays(1),
                    vencimiento: ingreso.AddDays(30)))).StatusCode);

        var lotResponse = await client.PostAsJsonAsync("/api/lotes-medicamento",
            Lot(medicine.IdMedicamento, 1));
        var lot = await lotResponse.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(lot);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/lotes-medicamento/{lot.IdLote}",
                UpdateLot(medicine.IdMedicamento, 1, expected: 1,
                    ingreso: ingreso, vencimiento: ingreso))).StatusCode);

        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/medicamentos/{medicine.IdMedicamento}")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync($"/api/lotes-medicamento/{lot.IdLote}",
                UpdateLot(medicine.IdMedicamento, 1, expected: 1))).StatusCode);
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
        FechaVencimiento = vencimiento ?? DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1)),
        IdSucursal = quantity > 0 ? 1 : null,
        Observaciones = quantity > 0 ? "Existencia inicial de prueba" : null
    };

    private static ActualizarLoteMedicamentoRequest UpdateLot(
        int idMedicamento, int quantity, int expected,
        DateOnly? ingreso = null, DateOnly? vencimiento = null) => new()
    {
        IdMedicamento = idMedicamento,
        CantidadDisponible = quantity,
        CantidadEsperada = expected,
        NumeroLote = "LOTE-001",
        FechaIngreso = ingreso ?? DateOnly.FromDateTime(DateTime.UtcNow),
        FechaVencimiento = vencimiento ?? DateOnly.FromDateTime(DateTime.UtcNow.AddYears(1)),
        IdSucursal = quantity != expected ? 1 : null,
        Observaciones = quantity != expected ? "Ajuste de prueba" : null
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
        private readonly TimeProvider timeProvider;

        public FarmaciaApiFactory(DateTimeOffset? utcNow = null)
        {
            timeProvider = utcNow.HasValue
                ? new FixedTimeProvider(utcNow.Value)
                : TimeProvider.System;
        }

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
                services.RemoveAll<TimeProvider>();
                services.AddSingleton(new DbContextOptionsBuilder<ClinicaDbContext>()
                    .UseInMemoryDatabase(databaseName).Options);
                services.AddScoped<ClinicaDbContext>();
                services.AddSingleton(timeProvider);
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

        public async Task SeedCatalogoConFechasAsync(DateOnly hoy)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Categorias.Add(new Categoria
                { IdCategoria = 1, Nombre = "Analgésicos", Activa = true });
            db.Marcas.Add(new Marca
                { IdMarca = 1, Nombre = "Laboratorio", Activa = true });
            db.Medicamentos.AddRange(
                new Medicamento
                {
                    IdMedicamento = 1, IdCategoria = 1, IdMarca = 1,
                    Codigo = "CAT-FECHA-1", Nombre = "Disponible",
                    PrecioVenta = 12.50m, Activo = true
                },
                new Medicamento
                {
                    IdMedicamento = 2, IdCategoria = 1, IdMarca = 1,
                    Codigo = "CAT-FECHA-2", Nombre = "Ingreso futuro",
                    PrecioVenta = 20m, Activo = true
                },
                new Medicamento
                {
                    IdMedicamento = 3, IdCategoria = 1, IdMarca = 1,
                    Codigo = "CAT-FECHA-3", Nombre = "Inactivo",
                    PrecioVenta = 30m, Activo = false
                });
            db.LoteMedicamentos.AddRange(
                new LoteMedicamento
                {
                    IdLote = 1, IdMedicamento = 1, NumeroLote = "VIGENTE",
                    FechaIngreso = hoy.AddDays(-1), FechaVencimiento = hoy.AddDays(2),
                    CantidadDisponible = 5
                },
                new LoteMedicamento
                {
                    IdLote = 2, IdMedicamento = 1, NumeroLote = "INGRESA-HOY",
                    FechaIngreso = hoy, FechaVencimiento = hoy.AddDays(3),
                    CantidadDisponible = 2
                },
                new LoteMedicamento
                {
                    IdLote = 3, IdMedicamento = 1, NumeroLote = "FUTURO",
                    FechaIngreso = hoy.AddDays(1), FechaVencimiento = hoy.AddDays(4),
                    CantidadDisponible = 11
                },
                new LoteMedicamento
                {
                    IdLote = 4, IdMedicamento = 1, NumeroLote = "VENCIDO",
                    FechaIngreso = hoy.AddDays(-5), FechaVencimiento = hoy,
                    CantidadDisponible = 13
                },
                new LoteMedicamento
                {
                    IdLote = 5, IdMedicamento = 1, NumeroLote = "SIN-STOCK",
                    FechaIngreso = hoy.AddDays(-1), FechaVencimiento = hoy.AddDays(2),
                    CantidadDisponible = 0
                },
                new LoteMedicamento
                {
                    IdLote = 6, IdMedicamento = 2, NumeroLote = "SOLO-FUTURO",
                    FechaIngreso = hoy.AddDays(1), FechaVencimiento = hoy.AddDays(5),
                    CantidadDisponible = 17
                },
                new LoteMedicamento
                {
                    IdLote = 7, IdMedicamento = 3, NumeroLote = "MED-INACTIVO",
                    FechaIngreso = hoy, FechaVencimiento = hoy.AddDays(5),
                    CantidadDisponible = 19
                });
            await db.SaveChangesAsync();
        }

        public async Task<List<InventorySnapshot>> ReadInventoryAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .LoteMedicamentos.AsNoTracking()
                .OrderBy(lote => lote.IdLote)
                .Select(lote => new InventorySnapshot(
                    lote.IdLote, lote.CantidadDisponible,
                    lote.FechaIngreso, lote.FechaVencimiento))
                .ToListAsync();
        }
    }

    private sealed record InventorySnapshot(
        int IdLote, int CantidadDisponible,
        DateOnly FechaIngreso, DateOnly FechaVencimiento);

    private sealed class FixedTimeProvider(DateTimeOffset utcNow) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => utcNow;
    }
}
