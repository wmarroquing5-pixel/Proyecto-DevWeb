using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class SqlServerAjusteLoteTests
{
    [Fact]
    public async Task PutValidoUsaStockEsperadoYGetReflejaCambio()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        var get = await client.GetFromJsonAsync<LoteMedicamentoResponse>(
            $"/api/lotes-medicamento/{fixture.Database.IdLote}");
        Assert.NotNull(get);
        Assert.Equal(3, get.CantidadDisponible);

        var response = await PutAsync(client, fixture.Database, 5, get.CantidadDisponible);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<LoteMedicamentoResponse>();
        Assert.NotNull(body);
        Assert.Equal(5, body.CantidadDisponible);
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(5, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        var movement = Assert.Single(await db.MovimientosInventario.ToListAsync());
        Assert.Equal("Ajuste", movement.TipoMovimiento);
        Assert.Equal(2, movement.Cantidad);
        Assert.Equal(fixture.Database.IdUsuario, movement.IdUsuario);
        Assert.Equal(fixture.Database.IdSucursal, movement.IdSucursal);
        Assert.Equal("Ajuste de prueba API-11F2", movement.Observaciones);
    }

    [Fact]
    public async Task PrecondicionAusenteNegativaYStockFinalNegativoDan400()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        foreach (var request in new[]
        {
            Request(fixture.Database, 5, null),
            Request(fixture.Database, 5, -1),
            Request(fixture.Database, -1, 3)
        })
        {
            var response = await client.PutAsJsonAsync(
                $"/api/lotes-medicamento/{fixture.Database.IdLote}", request);
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
        await AssertStockAsync(fixture.Database, 3);
    }

    [Fact]
    public async Task VentaConfirmadaAntesDelPutHaceObsoletaLaPrecondicion()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        Assert.Equal(HttpStatusCode.Created,
            (await VentaAsync(client, fixture.Database, 1)).StatusCode);
        var response = await PutAsync(client, fixture.Database, 5, expected: 3);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertStockAsync(fixture.Database, 2);
        await using var db = fixture.Database.OpenContext();
        Assert.Single(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task DosAjustesConcurrentesConLaMismaPrecondicionSoloPermitenUno()
    {
        await using var fixture = await CreateAsync();
        using var first = fixture.Factory.CreateClient();
        using var second = fixture.Factory.CreateClient();
        await LoginAsync(first, fixture.Database);
        await LoginAsync(second, fixture.Database);
        using var gate = new ManualResetEventSlim(false);
        var one = Task.Run(async () => { gate.Wait(); return await PutAsync(first, fixture.Database, 5, 3); });
        var two = Task.Run(async () => { gate.Wait(); return await PutAsync(second, fixture.Database, 6, 3); });
        gate.Set();
        var responses = await Task.WhenAll(one, two);
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.OK));
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        await using var db = fixture.Database.OpenContext();
        var stock = (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible;
        Assert.Contains(stock, new[] { 5, 6 });
        var movement = Assert.Single(await db.MovimientosInventario.ToListAsync());
        Assert.Equal("Ajuste", movement.TipoMovimiento);
        Assert.Equal(stock - 3, movement.Cantidad);
    }

    [Theory]
    [InlineData("venta")]
    [InlineData("factura")]
    [InlineData("consumo")]
    public async Task AjusteConcurrenteConSalidaNoPierdeDescuentoConfirmado(string salida)
    {
        await using var fixture = await CreateAsync(clinical: salida == "consumo");
        using var adjuster = fixture.Factory.CreateClient();
        using var dispatcher = fixture.Factory.CreateClient();
        await LoginAsync(adjuster, fixture.Database);
        await LoginAsync(dispatcher, fixture.Database);
        using var gate = new ManualResetEventSlim(false);
        var adjustment = Task.Run(async () =>
        {
            gate.Wait();
            return await PutAsync(adjuster, fixture.Database, 4, 3);
        });
        var dispatch = Task.Run(async () =>
        {
            gate.Wait();
            return salida switch
            {
                "venta" => await VentaAsync(dispatcher, fixture.Database, 2),
                "factura" => await FacturaAsync(dispatcher, fixture.Database, 2),
                _ => await dispatcher.PostAsJsonAsync(
                    $"/api/tratamientos/{fixture.IdTratamiento}/consumos", new { cantidad = 2 })
            };
        });
        gate.Set();
        var adjusted = await adjustment;
        var dispatched = await dispatch;
        Assert.Contains(adjusted.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });
        Assert.Contains(dispatched.StatusCode, new[] { HttpStatusCode.Created, HttpStatusCode.Conflict });
        Assert.True(adjusted.StatusCode == HttpStatusCode.OK ||
            dispatched.StatusCode == HttpStatusCode.Created);
        await using var db = fixture.Database.OpenContext();
        var stock = (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible;
        var movements = await db.MovimientosInventario.ToListAsync();
        if (dispatched.StatusCode == HttpStatusCode.Created)
        {
            Assert.Single(movements, movement =>
                movement.TipoMovimiento is "Venta Publica" or "Uso Interno");
            Assert.Equal(adjusted.StatusCode == HttpStatusCode.OK ? 2 : 1, stock);
        }
        else
        {
            Assert.Equal(4, stock);
        }
        var adjustments = movements.Where(movement =>
            movement.TipoMovimiento == "Ajuste").ToList();
        Assert.Equal(adjusted.StatusCode == HttpStatusCode.OK ? 1 : 0,
            adjustments.Count);
        if (adjusted.StatusCode == HttpStatusCode.OK)
            Assert.Equal(1, Assert.Single(adjustments).Cantidad);
    }

    [Fact]
    public async Task ErrorSqlRevierteTodosLosCamposDelPut()
    {
        await using var fixture = await CreateAsync();
        await fixture.Database.ExecuteAsync(
            "ALTER TABLE [MovimientoInventario] ADD CONSTRAINT [CK_Test_Ajuste_Fallo] CHECK ([TipoMovimiento] <> 'Ajuste')");
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        var request = Request(fixture.Database, 5, 3, "LOTE-MODIFICADO");
        var response = await client.PutAsJsonAsync(
            $"/api/lotes-medicamento/{fixture.Database.IdLote}", request);
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        await using var db = fixture.Database.OpenContext();
        var lot = await db.LoteMedicamentos.SingleAsync();
        Assert.Equal(3, lot.CantidadDisponible);
        Assert.Equal("LOT-SQL-1", lot.NumeroLote);
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task AjusteNegativoYActualizacionSinVariacionRegistranSoloLaDiferencia()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var decrease = await PutAsync(client, fixture.Database, 1, 3);
        Assert.Equal(HttpStatusCode.OK, decrease.StatusCode);
        var unchanged = await PutAsync(client, fixture.Database, 1, 1);
        Assert.Equal(HttpStatusCode.OK, unchanged.StatusCode);

        await using var db = fixture.Database.OpenContext();
        Assert.Equal(1, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        var movement = Assert.Single(await db.MovimientosInventario.ToListAsync());
        Assert.Equal("Ajuste", movement.TipoMovimiento);
        Assert.Equal(-2, movement.Cantidad);
    }

    [Fact]
    public async Task CambioDeExistenciaExigeSucursalYJustificacion()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var missingBranch = Request(
            fixture.Database, 4, 3, includeBranch: false);
        var missingReason = Request(
            fixture.Database, 4, 3, observations: "   ");
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync(
                $"/api/lotes-medicamento/{fixture.Database.IdLote}",
                missingBranch)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync(
                $"/api/lotes-medicamento/{fixture.Database.IdLote}",
                missingReason)).StatusCode);
        await AssertStockAsync(fixture.Database, 3);
        await using var db = fixture.Database.OpenContext();
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task JwtYPermisoSiguenSiendoObligatorios()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await PutAsync(client, fixture.Database, 5, 3)).StatusCode);
        await LoginAsync(client, fixture.Database);
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Permisos.SingleAsync(p => p.Modulo == "LotesMedicamento")).PuedeModificar = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await PutAsync(client, fixture.Database, 5, 3)).StatusCode);
        await AssertStockAsync(fixture.Database, 3);
    }

    private static async Task<Fixture> CreateAsync(bool clinical = false)
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
                IdRol = roleId, Modulo = "LotesMedicamento",
                PuedeConsultar = true, PuedeModificar = true
            });
            if (!clinical)
            {
                await db.SaveChangesAsync();
                return new Fixture(database, factory, null);
            }

            var doctor = new Empleado
            {
                IdSucursal = database.IdSucursal, Nombres = "Médico",
                Apellidos = "Sintético", DPI = "DPI-AJUSTE-1",
                TipoEmpleado = "Medico", Activo = true
            };
            db.Empleados.Add(doctor);
            db.Permisos.Add(new Permiso
            {
                IdRol = roleId, Modulo = "ConsumoClinico", PuedeCrear = true
            });
            await db.SaveChangesAsync();
            (await db.Usuarios.SingleAsync()).IdEmpleado = doctor.IdEmpleado;
            var consultation = new Consulta
            {
                IdPaciente = database.IdPaciente, IdMedico = doctor.IdEmpleado,
                IdSucursal = database.IdSucursal, FechaConsulta = DateTime.UtcNow
            };
            db.Consultas.Add(consultation);
            await db.SaveChangesAsync();
            var treatment = new Tratamiento
            {
                IdConsulta = consultation.IdConsulta, IdLote = database.IdLote,
                Descripcion = "Tratamiento de prueba",
                FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            db.Tratamientos.Add(treatment);
            await db.SaveChangesAsync();
            return new Fixture(database, factory, treatment.IdTratamiento);
        }
        catch
        {
            factory.Dispose();
            await database.DisposeAsync();
            throw;
        }
    }

    private static ActualizarLoteMedicamentoRequest Request(
        SqlServerTestDatabase database, int quantity, int? expected,
        string number = "LOT-SQL-1", bool includeBranch = true,
        string? observations = "Ajuste de prueba API-11F2") => new()
    {
        IdMedicamento = database.IdMedicamento,
        NumeroLote = number,
        FechaIngreso = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-5),
        FechaVencimiento = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(10),
        CantidadDisponible = quantity,
        CantidadEsperada = expected,
        IdSucursal = expected.HasValue && quantity != expected.Value && includeBranch
            ? database.IdSucursal
            : null,
        Observaciones = expected.HasValue && quantity != expected.Value
            ? observations
            : null
    };

    private static Task<HttpResponseMessage> PutAsync(
        HttpClient client, SqlServerTestDatabase database, int quantity, int? expected) =>
        client.PutAsJsonAsync($"/api/lotes-medicamento/{database.IdLote}",
            Request(database, quantity, expected));

    private static Task<HttpResponseMessage> VentaAsync(
        HttpClient client, SqlServerTestDatabase database, int quantity) =>
        client.PostAsJsonAsync("/api/ventas", new CrearVentaRequest
        {
            IdSucursal = database.IdSucursal,
            Items = [new CrearVentaItemRequest
            {
                IdMedicamento = database.IdMedicamento, Cantidad = quantity
            }]
        });

    private static Task<HttpResponseMessage> FacturaAsync(
        HttpClient client, SqlServerTestDatabase database, int quantity) =>
        client.PostAsJsonAsync("/api/facturas", new CrearFacturaServiciosRequest
        {
            IdSucursal = database.IdSucursal,
            IdPaciente = database.IdPaciente,
            Servicios = [],
            Medicamentos = [new CrearFacturaMedicamentoItemRequest
            {
                IdMedicamento = database.IdMedicamento, Cantidad = quantity
            }]
        });

    private static async Task LoginAsync(HttpClient client, SqlServerTestDatabase database)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Username = "sql.prueba", Password = database.Password
        });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }

    private static async Task AssertStockAsync(SqlServerTestDatabase database, int expected)
    {
        await using var db = database.OpenContext();
        Assert.Equal(expected, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
    }

    private sealed record Fixture(
        SqlServerTestDatabase Database,
        Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Factory,
        int? IdTratamiento) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Factory.Dispose();
            await Database.DisposeAsync();
        }
    }
}
