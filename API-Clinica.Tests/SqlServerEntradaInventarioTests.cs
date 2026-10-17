using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class SqlServerEntradaInventarioTests
{
    [Fact]
    public async Task EntradaValidaIncrementaStockYRegistraMovimiento()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await EntradaAsync(client, fixture.Database, 4, "  Recepción controlada  ");
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<EntradaInventarioResponse>();
        Assert.NotNull(body);
        Assert.Equal(fixture.Database.IdLote, body.IdLote);
        Assert.Equal(fixture.Database.IdMedicamento, body.IdMedicamento);
        Assert.Equal(fixture.Database.IdSucursal, body.IdSucursal);
        Assert.Equal(4, body.Cantidad);
        Assert.Equal(7, body.CantidadDisponible);
        Assert.Equal("Recepción controlada", body.Observaciones);

        await using var db = fixture.Database.OpenContext();
        Assert.Equal(7, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        var movement = await db.MovimientosInventario.SingleAsync();
        Assert.Equal(body.IdMovimiento, movement.IdMovimiento);
        Assert.Equal(fixture.Database.IdUsuario, movement.IdUsuario);
        Assert.Equal(fixture.Database.IdSucursal, movement.IdSucursal);
        Assert.Equal("Entrada", movement.TipoMovimiento);
        Assert.Equal(4, movement.Cantidad);
        Assert.Equal("Recepción controlada", movement.Observaciones);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task CantidadNoPositivaNoModificaInventario(int cantidad)
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await EntradaAsync(client, fixture.Database, cantidad);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 3, 0);
    }

    [Fact]
    public async Task LoteInexistenteNoRegistraMovimiento()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await EntradaAsync(client, fixture.Database, 1, idLote: 999999);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 3, 0);
    }

    [Fact]
    public async Task MedicamentoInactivoImpideEntrada()
    {
        await using var fixture = await CreateAsync();
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Medicamentos.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await EntradaAsync(client, fixture.Database, 1);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 3, 0);
    }

    [Fact]
    public async Task JwtPermisoUsuarioYRolActivosSonObligatorios()
    {
        await using var fixture = await CreateAsync(grantPermission: false);
        using var client = fixture.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);

        await LoginAsync(client, fixture.Database);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);
        await using (var db = fixture.Database.OpenContext())
        {
            var roleId = (await db.Usuarios.SingleAsync()).IdRol;
            db.Permisos.Add(new Permiso
            {
                IdRol = roleId, Modulo = "LotesMedicamento",
                PuedeModificar = true
            });
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Created,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);

        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Usuarios.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Usuarios.SingleAsync()).Activo = true;
            (await db.Roles.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 4, 1);
    }

    [Theory]
    [InlineData("movimiento")]
    [InlineData("lote")]
    public async Task ErrorSqlRevierteStockYMovimiento(string fallo)
    {
        await using var fixture = await CreateAsync();
        var sql = fallo == "movimiento"
            ? "ALTER TABLE [MovimientoInventario] ADD CONSTRAINT [CK_Test_Entrada_Movimiento] CHECK ([TipoMovimiento] <> 'Entrada')"
            : "ALTER TABLE [LoteMedicamento] ADD CONSTRAINT [CK_Test_Entrada_Lote] CHECK ([CantidadDisponible] = 3)";
        await fixture.Database.ExecuteAsync(sql);
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await EntradaAsync(client, fixture.Database, 2);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 3, 0);
    }

    [Fact]
    public async Task DosEntradasConcurrentesSeAcumulanSinPerdidas()
    {
        await using var fixture = await CreateAsync();
        using var first = fixture.Factory.CreateClient();
        using var second = fixture.Factory.CreateClient();
        await LoginAsync(first, fixture.Database);
        await LoginAsync(second, fixture.Database);
        using var gate = new ManualResetEventSlim(false);
        var one = Task.Run(async () =>
        {
            gate.Wait();
            return await EntradaAsync(first, fixture.Database, 2);
        });
        var two = Task.Run(async () =>
        {
            gate.Wait();
            return await EntradaAsync(second, fixture.Database, 3);
        });
        gate.Set();

        var responses = await Task.WhenAll(one, two);
        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Created, response.StatusCode));
        await AssertStockYMovimientosAsync(fixture.Database, 8, 2);
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(5, await db.MovimientosInventario.SumAsync(m => m.Cantidad));
    }

    [Theory]
    [InlineData("venta")]
    [InlineData("factura")]
    [InlineData("consumo")]
    public async Task EntradaConcurrenteConSalidaConservaAmbasOperaciones(string salida)
    {
        await using var fixture = await CreateAsync(clinical: salida == "consumo");
        using var inbound = fixture.Factory.CreateClient();
        using var outbound = fixture.Factory.CreateClient();
        await LoginAsync(inbound, fixture.Database);
        await LoginAsync(outbound, fixture.Database);
        using var gate = new ManualResetEventSlim(false);
        var entry = Task.Run(async () =>
        {
            gate.Wait();
            return await EntradaAsync(inbound, fixture.Database, 2);
        });
        var exit = Task.Run(async () =>
        {
            gate.Wait();
            return salida switch
            {
                "venta" => await VentaAsync(outbound, fixture.Database, 2),
                "factura" => await FacturaAsync(outbound, fixture.Database, 2),
                _ => await outbound.PostAsJsonAsync(
                    $"/api/tratamientos/{fixture.IdTratamiento}/consumos",
                    new ConsumoClinicoCreateDto { Cantidad = 2 })
            };
        });
        gate.Set();

        Assert.Equal(HttpStatusCode.Created, (await entry).StatusCode);
        Assert.Equal(HttpStatusCode.Created, (await exit).StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 3, 2);
        await using var db = fixture.Database.OpenContext();
        Assert.Contains(await db.MovimientosInventario.ToListAsync(),
            m => m.TipoMovimiento == "Entrada" && m.Cantidad == 2);
    }

    [Fact]
    public async Task EntradaConcurrenteHaceObsoletaPrecondicionDeAjusteSinPerderStock()
    {
        await using var fixture = await CreateAsync();
        using var inbound = fixture.Factory.CreateClient();
        using var adjuster = fixture.Factory.CreateClient();
        await LoginAsync(inbound, fixture.Database);
        await LoginAsync(adjuster, fixture.Database);
        using var gate = new ManualResetEventSlim(false);
        var entry = Task.Run(async () =>
        {
            gate.Wait();
            return await EntradaAsync(inbound, fixture.Database, 2);
        });
        var adjustment = Task.Run(async () =>
        {
            gate.Wait();
            return await adjuster.PutAsJsonAsync(
                $"/api/lotes-medicamento/{fixture.Database.IdLote}",
                Ajuste(fixture.Database, 4, 3));
        });
        gate.Set();

        var entryResponse = await entry;
        var adjustmentResponse = await adjustment;
        Assert.Equal(HttpStatusCode.Created, entryResponse.StatusCode);
        Assert.Contains(adjustmentResponse.StatusCode,
            new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });
        await using var db = fixture.Database.OpenContext();
        var stock = (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible;
        Assert.Equal(adjustmentResponse.StatusCode == HttpStatusCode.OK ? 6 : 5, stock);
        var movements = await db.MovimientosInventario.ToListAsync();
        Assert.Equal(adjustmentResponse.StatusCode == HttpStatusCode.OK ? 2 : 1,
            movements.Count);
        if (adjustmentResponse.StatusCode == HttpStatusCode.OK)
            Assert.Contains(movements,
                movement => movement.TipoMovimiento == "Ajuste" && movement.Cantidad == 1);
    }

    [Theory]
    [InlineData("futuro")]
    [InlineData("vencido")]
    public async Task LoteNoVigenteNoRecibeEntrada(string estado)
    {
        await using var fixture = await CreateAsync();
        await using (var db = fixture.Database.OpenContext())
        {
            var lot = await db.LoteMedicamentos.SingleAsync();
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            if (estado == "futuro")
            {
                lot.FechaIngreso = today.AddDays(1);
                lot.FechaVencimiento = today.AddDays(2);
            }
            else
            {
                lot.FechaIngreso = today.AddDays(-2);
                lot.FechaVencimiento = today;
            }
            await db.SaveChangesAsync();
        }
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        Assert.Equal(HttpStatusCode.Conflict,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 3, 0);
    }

    [Fact]
    public async Task EntradaQueDesbordaIntSeRechazaSinMovimiento()
    {
        await using var fixture = await CreateAsync();
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible = int.MaxValue;
            await db.SaveChangesAsync();
        }
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, int.MaxValue, 0);
    }

    [Fact]
    public async Task SucursalInactivaImpideEntrada()
    {
        await using var fixture = await CreateAsync();
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Sucursales.SingleAsync()).Activa = false;
            await db.SaveChangesAsync();
        }
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await EntradaAsync(client, fixture.Database, 1)).StatusCode);
        await AssertStockYMovimientosAsync(fixture.Database, 3, 0);
    }

    private static async Task<Fixture> CreateAsync(
        bool clinical = false, bool grantPermission = true)
    {
        var database = await SqlServerTestDatabase.CreateAsync();
        var factory = database.CreateFactory();
        try
        {
            await database.SeedAsync(factory.Services);
            await using var db = database.OpenContext();
            var roleId = (await db.Usuarios.SingleAsync()).IdRol;
            if (grantPermission)
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
                Apellidos = "Entrada sintética", DPI = "DPI-ENTRADA-1",
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
                IdConsulta = consultation.IdConsulta,
                IdLote = database.IdLote,
                Descripcion = "Tratamiento para concurrencia de entrada",
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

    private static Task<HttpResponseMessage> EntradaAsync(
        HttpClient client, SqlServerTestDatabase database, int cantidad,
        string? observaciones = null, int? idLote = null) =>
        client.PostAsJsonAsync(
            $"/api/lotes-medicamento/{idLote ?? database.IdLote}/entradas",
            new RegistrarEntradaInventarioRequest
            {
                IdSucursal = database.IdSucursal,
                Cantidad = cantidad,
                Observaciones = observaciones
            });

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

    private static ActualizarLoteMedicamentoRequest Ajuste(
        SqlServerTestDatabase database, int quantity, int expected) => new()
    {
        IdMedicamento = database.IdMedicamento,
        NumeroLote = "LOT-SQL-1",
        FechaIngreso = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-5),
        FechaVencimiento = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(10),
        CantidadDisponible = quantity,
        CantidadEsperada = expected,
        IdSucursal = quantity != expected ? database.IdSucursal : null,
        Observaciones = quantity != expected
            ? "Ajuste concurrente de entrada API-11F2"
            : null
    };

    private static async Task LoginAsync(
        HttpClient client, SqlServerTestDatabase database)
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

    private static async Task AssertStockYMovimientosAsync(
        SqlServerTestDatabase database, int stock, int movementCount)
    {
        await using var db = database.OpenContext();
        Assert.Equal(stock, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        Assert.Equal(movementCount, await db.MovimientosInventario.CountAsync());
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
