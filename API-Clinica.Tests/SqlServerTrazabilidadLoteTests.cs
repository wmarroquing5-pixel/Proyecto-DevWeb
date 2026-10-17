using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class SqlServerTrazabilidadLoteTests
{
    [Fact]
    public async Task LoteSinExistenciaSeCreaSinMovimiento()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await client.PostAsJsonAsync(
            "/api/lotes-medicamento", Request(fixture.Database, 0));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(2, await db.LoteMedicamentos.CountAsync());
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task ExistenciaInicialFuturaRegistraUnAjusteConIdentidadYSucursal()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = Request(fixture.Database, 5,
            ingreso: today.AddDays(2), vencimiento: today.AddDays(30),
            observaciones: "  Apertura controlada  ");

        var response = await client.PostAsJsonAsync(
            "/api/lotes-medicamento", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(body);
        Assert.Equal(5, body.CantidadDisponible);
        Assert.Equal(today.AddDays(2), body.FechaIngreso);
        await using var db = fixture.Database.OpenContext();
        var movement = Assert.Single(await db.MovimientosInventario.ToListAsync());
        Assert.Equal(body.IdLote, movement.IdLote);
        Assert.Equal(fixture.Database.IdUsuario, movement.IdUsuario);
        Assert.Equal(fixture.Database.IdSucursal, movement.IdSucursal);
        Assert.Equal("Ajuste", movement.TipoMovimiento);
        Assert.Equal(5, movement.Cantidad);
        Assert.Equal("Existencia inicial | Apertura controlada", movement.Observaciones);
    }

    [Theory]
    [InlineData("sin-sucursal")]
    [InlineData("sin-observaciones")]
    [InlineData("sucursal-inactiva")]
    [InlineData("vencido")]
    public async Task ExistenciaInicialInvalidaNoCreaLoteNiMovimiento(string scenario)
    {
        await using var fixture = await CreateAsync();
        if (scenario == "sucursal-inactiva")
        {
            await using var prepare = fixture.Database.OpenContext();
            (await prepare.Sucursales.SingleAsync()).Activa = false;
            await prepare.SaveChangesAsync();
        }
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var request = Request(
            fixture.Database, 5,
            ingreso: scenario == "vencido" ? today.AddDays(-10) : today,
            vencimiento: scenario == "vencido" ? today : today.AddDays(10),
            includeBranch: scenario != "sin-sucursal",
            observaciones: scenario == "sin-observaciones" ? "   " : "Apertura");

        var response = await client.PostAsJsonAsync(
            "/api/lotes-medicamento", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await using var db = fixture.Database.OpenContext();
        Assert.Single(await db.LoteMedicamentos.ToListAsync());
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task FalloAlInsertarMovimientoRevierteLaCreacionDelLote()
    {
        await using var fixture = await CreateAsync();
        await fixture.Database.ExecuteAsync(
            "ALTER TABLE [MovimientoInventario] ADD CONSTRAINT [CK_Test_Trazabilidad_Ajuste] CHECK ([TipoMovimiento] <> 'Ajuste')");
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await client.PostAsJsonAsync(
            "/api/lotes-medicamento", Request(fixture.Database, 5));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await using var db = fixture.Database.OpenContext();
        Assert.Single(await db.LoteMedicamentos.ToListAsync());
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task MovimientoImpideCambiarMedicamentoYEliminarLote()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        var created = await client.PostAsJsonAsync(
            "/api/lotes-medicamento", Request(fixture.Database, 5));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var lot = await created.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(lot);

        int otherMedicine;
        await using (var prepare = fixture.Database.OpenContext())
        {
            var original = await prepare.Medicamentos.AsNoTracking().SingleAsync();
            var medicine = new Medicamento
            {
                IdCategoria = original.IdCategoria,
                IdMarca = original.IdMarca,
                Codigo = "MED-TRAZA-2",
                Nombre = "Medicamento alterno",
                PrecioVenta = 10m,
                Activo = true
            };
            prepare.Medicamentos.Add(medicine);
            await prepare.SaveChangesAsync();
            otherMedicine = medicine.IdMedicamento;
        }

        var update = new ActualizarLoteMedicamentoRequest
        {
            IdMedicamento = otherMedicine,
            NumeroLote = lot.NumeroLote,
            FechaIngreso = lot.FechaIngreso,
            FechaVencimiento = lot.FechaVencimiento,
            CantidadDisponible = lot.CantidadDisponible,
            CantidadEsperada = lot.CantidadDisponible
        };
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync(
                $"/api/lotes-medicamento/{lot.IdLote}", update)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.DeleteAsync(
                $"/api/lotes-medicamento/{lot.IdLote}")).StatusCode);

        await using var db = fixture.Database.OpenContext();
        var persisted = await db.LoteMedicamentos.SingleAsync(
            item => item.IdLote == lot.IdLote);
        Assert.Equal(fixture.Database.IdMedicamento, persisted.IdMedicamento);
        Assert.Equal(5, persisted.CantidadDisponible);
        Assert.Single(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task JwtUsuarioRolYPermisoSiguenVigentes()
    {
        await using var fixture = await CreateAsync();
        using var anonymous = fixture.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.PostAsJsonAsync(
                "/api/lotes-medicamento", Request(fixture.Database, 5))).StatusCode);
        using var invalid = fixture.Factory.CreateClient();
        invalid.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "jwt-invalido");
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await invalid.PostAsJsonAsync(
                "/api/lotes-medicamento", Request(fixture.Database, 5))).StatusCode);

        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Permisos.SingleAsync(
                permission => permission.Modulo == "LotesMedicamento")).PuedeCrear = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync(
                "/api/lotes-medicamento", Request(fixture.Database, 5))).StatusCode);

        await using (var db = fixture.Database.OpenContext())
        {
            var permission = await db.Permisos.SingleAsync(
                item => item.Modulo == "LotesMedicamento");
            permission.PuedeCrear = true;
            (await db.Usuarios.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync(
                "/api/lotes-medicamento", Request(fixture.Database, 5))).StatusCode);

        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Usuarios.SingleAsync()).Activo = true;
            (await db.Roles.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync(
                "/api/lotes-medicamento", Request(fixture.Database, 5))).StatusCode);
        await using var verify = fixture.Database.OpenContext();
        Assert.Single(await verify.LoteMedicamentos.ToListAsync());
        Assert.Empty(await verify.MovimientosInventario.ToListAsync());
    }

    private static async Task<Fixture> CreateAsync()
    {
        var database = await SqlServerTestDatabase.CreateAsync();
        var factory = database.CreateFactory();
        try
        {
            await database.SeedAsync(factory.Services);
            await using var db = database.OpenContext();
            var roleId = (await db.Usuarios.SingleAsync()).IdRol;
            db.Permisos.Add(new Permiso
            {
                IdRol = roleId,
                Modulo = "LotesMedicamento",
                PuedeConsultar = true,
                PuedeCrear = true,
                PuedeModificar = true,
                PuedeEliminar = true
            });
            await db.SaveChangesAsync();
            return new Fixture(database, factory);
        }
        catch
        {
            factory.Dispose();
            await database.DisposeAsync();
            throw;
        }
    }

    private static GuardarLoteMedicamentoRequest Request(
        SqlServerTestDatabase database, int quantity,
        DateOnly? ingreso = null, DateOnly? vencimiento = null,
        bool includeBranch = true, string? observaciones = "Apertura de prueba")
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return new GuardarLoteMedicamentoRequest
        {
            IdMedicamento = database.IdMedicamento,
            NumeroLote = "LOT-TRAZA-" + Guid.NewGuid().ToString("N")[..12],
            FechaIngreso = ingreso ?? today,
            FechaVencimiento = vencimiento ?? today.AddDays(30),
            CantidadDisponible = quantity,
            IdSucursal = quantity > 0 && includeBranch
                ? database.IdSucursal
                : null,
            Observaciones = quantity > 0 ? observaciones : null
        };
    }

    private static async Task LoginAsync(
        HttpClient client, SqlServerTestDatabase database)
    {
        var response = await client.PostAsJsonAsync(
            "/api/auth/login", new LoginRequest
            {
                Username = "sql.prueba",
                Password = database.Password
            });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }

    private sealed record Fixture(
        SqlServerTestDatabase Database,
        Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Factory)
        : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Factory.Dispose();
            await Database.DisposeAsync();
        }
    }
}
