using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class SqlServerConsumoClinicoTests
{
    [Fact]
    public async Task ConsumoDescuentaLoteExactoYRegistraUnSoloMovimiento()
    {
        await using var fixture = await CreateAsync();
        var otroLote = await fixture.Database.AddLotAsync(9, 5, 2);
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);

        var response = await ConsumirAsync(client, fixture.IdTratamiento, 2);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ConsumoClinicoResponseDto>();
        Assert.NotNull(body);
        Assert.Equal(fixture.Database.IdLote, body.IdLote);
        Assert.Equal(fixture.Database.IdSucursal, body.IdSucursal);
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(1, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == fixture.Database.IdLote)).CantidadDisponible);
        Assert.Equal(9, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == otroLote)).CantidadDisponible);
        var movement = Assert.Single(await db.MovimientosInventario.AsNoTracking().ToListAsync());
        Assert.Equal(body.IdMovimiento, movement.IdMovimiento);
        Assert.Equal("Uso Interno", movement.TipoMovimiento);
        Assert.Equal(2, movement.Cantidad);
        Assert.Equal(fixture.Database.IdUsuario, movement.IdUsuario);
        Assert.Equal(fixture.Database.IdSucursal, movement.IdSucursal);
        Assert.Equal(fixture.Database.IdLote, movement.IdLote);
        Assert.Equal(fixture.Database.IdLote,
            (await db.Tratamientos.SingleAsync()).IdLote);
    }

    [Fact]
    public async Task SinJwtSinPermisoYUsuarioInactivoNoEscriben()
    {
        await using var fixture = await CreateAsync();
        using var anonymous = fixture.Factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await ConsumirAsync(anonymous, fixture.IdTratamiento, 1)).StatusCode);
        anonymous.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "token-invalido");
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await ConsumirAsync(anonymous, fixture.IdTratamiento, 1)).StatusCode);

        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        await using (var db = fixture.Database.OpenContext())
        {
            var permission = await db.Permisos.SingleAsync(p => p.Modulo == "ConsumoClinico");
            permission.PuedeCrear = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ConsumirAsync(client, fixture.IdTratamiento, 1)).StatusCode);
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Permisos.SingleAsync(p => p.Modulo == "ConsumoClinico")).PuedeCrear = true;
            (await db.Roles.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ConsumirAsync(client, fixture.IdTratamiento, 1)).StatusCode);
        await using (var db = fixture.Database.OpenContext())
        {
            (await db.Roles.SingleAsync()).Activo = true;
            (await db.Usuarios.SingleAsync()).Activo = false;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ConsumirAsync(client, fixture.IdTratamiento, 1)).StatusCode);
        await AssertUnchangedAsync(fixture);
    }

    [Theory]
    [InlineData("sin-lote", HttpStatusCode.Conflict)]
    [InlineData("sin-stock", HttpStatusCode.Conflict)]
    [InlineData("vencido", HttpStatusCode.Conflict)]
    [InlineData("futuro", HttpStatusCode.Conflict)]
    [InlineData("medicamento-inactivo", HttpStatusCode.Conflict)]
    [InlineData("medico-inactivo", HttpStatusCode.Forbidden)]
    [InlineData("empleado-no-medico", HttpStatusCode.Forbidden)]
    [InlineData("usuario-sin-medico", HttpStatusCode.Forbidden)]
    [InlineData("otro-medico", HttpStatusCode.Forbidden)]
    public async Task CondicionesInvalidasNoDescuentanNiRegistran(
        string condition, HttpStatusCode expected)
    {
        await using var fixture = await CreateAsync();
        await using (var db = fixture.Database.OpenContext())
        {
            var treatment = await db.Tratamientos.SingleAsync();
            var lot = await db.LoteMedicamentos.SingleAsync();
            var employee = await db.Empleados.SingleAsync();
            var user = await db.Usuarios.SingleAsync();
            switch (condition)
            {
                case "sin-lote": treatment.IdLote = null; break;
                case "sin-stock": lot.CantidadDisponible = 0; break;
                case "vencido": lot.FechaVencimiento = DateOnly.FromDateTime(DateTime.UtcNow); break;
                case "futuro": lot.FechaIngreso = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(1);
                    lot.FechaVencimiento = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(2); break;
                case "medicamento-inactivo": (await db.Medicamentos.SingleAsync()).Activo = false; break;
                case "medico-inactivo": employee.Activo = false; break;
                case "empleado-no-medico": employee.TipoEmpleado = "Enfermera"; break;
                case "usuario-sin-medico": user.IdEmpleado = null; break;
                case "otro-medico":
                    var other = new Empleado
                    {
                        IdSucursal = fixture.Database.IdSucursal,
                        Nombres = "Otro", Apellidos = "Medico", DPI = "DPI-OTRO-1",
                        TipoEmpleado = "Medico", Activo = true
                    };
                    db.Empleados.Add(other);
                    await db.SaveChangesAsync();
                    user.IdEmpleado = other.IdEmpleado;
                    break;
            }
            await db.SaveChangesAsync();
        }
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        Assert.Equal(expected,
            (await ConsumirAsync(client, fixture.IdTratamiento, 1)).StatusCode);
        await using var verify = fixture.Database.OpenContext();
        Assert.Empty(await verify.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task CantidadInvalidaTratamientoInexistenteYStockInsuficienteNoEscriben()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await ConsumirAsync(client, fixture.IdTratamiento, 0)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync($"/api/tratamientos/{fixture.IdTratamiento}/consumos",
                new { cantidad = 1, idLote = fixture.Database.IdLote })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await ConsumirAsync(client, int.MaxValue, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await ConsumirAsync(client, fixture.IdTratamiento, 4)).StatusCode);
        await AssertUnchangedAsync(fixture);
    }

    [Fact]
    public async Task ErrorSqlEnMovimientoRevierteDescuento()
    {
        await using var fixture = await CreateAsync();
        await fixture.Database.ExecuteAsync(
            "ALTER TABLE [MovimientoInventario] ADD CONSTRAINT [CK_Test_UsoInterno_Fallo] CHECK ([Cantidad] < 0)");
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        var response = await ConsumirAsync(client, fixture.IdTratamiento, 2);
        Assert.NotEqual(HttpStatusCode.Created, response.StatusCode);
        await AssertUnchangedAsync(fixture);
    }

    [Fact]
    public async Task DosConsumosSimultaneosNoProducenStockNegativo()
    {
        await using var fixture = await CreateAsync();
        using var first = fixture.Factory.CreateClient();
        using var second = fixture.Factory.CreateClient();
        await LoginAsync(first, fixture.Database);
        await LoginAsync(second, fixture.Database);
        using var gate = new ManualResetEventSlim(false);
        var one = Task.Run(async () => { gate.Wait(); return await ConsumirAsync(first, fixture.IdTratamiento, 2); });
        var two = Task.Run(async () => { gate.Wait(); return await ConsumirAsync(second, fixture.IdTratamiento, 2); });
        gate.Set();
        var results = await Task.WhenAll(one, two);
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(1, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        Assert.Single(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task VentaYConsumoSimultaneosCompartenInventarioSinSobregiro()
    {
        await using var fixture = await CreateAsync();
        using var consumption = fixture.Factory.CreateClient();
        using var sale = fixture.Factory.CreateClient();
        await LoginAsync(consumption, fixture.Database);
        await LoginAsync(sale, fixture.Database);
        using var gate = new ManualResetEventSlim(false);
        var one = Task.Run(async () => { gate.Wait(); return await ConsumirAsync(consumption, fixture.IdTratamiento, 2); });
        var two = Task.Run(async () =>
        {
            gate.Wait();
            return await sale.PostAsJsonAsync("/api/ventas", new CrearVentaRequest
            {
                IdSucursal = fixture.Database.IdSucursal,
                Items = [new CrearVentaItemRequest
                {
                    IdMedicamento = fixture.Database.IdMedicamento, Cantidad = 2
                }]
            });
        });
        gate.Set();
        var results = await Task.WhenAll(one, two);
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, results.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(1, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        Assert.Single(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task DosSolicitudesIgualesRegistranDosConsumosSinIdempotencia()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        Assert.Equal(HttpStatusCode.Created,
            (await ConsumirAsync(client, fixture.IdTratamiento, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Created,
            (await ConsumirAsync(client, fixture.IdTratamiento, 1)).StatusCode);
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(1, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        Assert.Equal(2, await db.MovimientosInventario.CountAsync());
    }

    [Fact]
    public async Task PrescribirTratamientoNoDescuentaNiCreaMovimiento()
    {
        await using var fixture = await CreateAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        await using var db = fixture.Database.OpenContext();
        var existing = await db.Tratamientos.SingleAsync();
        var response = await client.PostAsJsonAsync("/api/tratamientos", new TratamientoCreateDto
        {
            IdConsulta = existing.IdConsulta,
            IdLote = fixture.Database.IdLote,
            Cantidad = 2,
            Descripcion = "Nueva prescripción sin consumo",
            FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
        });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        await AssertUnchangedAsync(fixture);
        await using var verify = fixture.Database.OpenContext();
        Assert.Equal(2, await verify.Tratamientos.CountAsync());
    }

    [Fact]
    public async Task NoPermiteCambiarMedicamentoDeLoteReferenciadoPorTratamiento()
    {
        await using var fixture = await CreateAsync();
        await using var db = fixture.Database.OpenContext();
        var current = await db.Medicamentos.SingleAsync();
        var another = new Medicamento
        {
            IdCategoria = current.IdCategoria, IdMarca = current.IdMarca,
            Codigo = "MED-OTRO", Nombre = "Otro medicamento", PrecioVenta = 5m, Activo = true
        };
        db.Medicamentos.Add(another);
        await db.SaveChangesAsync();
        using var client = fixture.Factory.CreateClient();
        await LoginAsync(client, fixture.Database);
        var request = new ActualizarLoteMedicamentoRequest
        {
            IdMedicamento = another.IdMedicamento,
            NumeroLote = "LOT-SQL-1",
            FechaIngreso = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(-5),
            FechaVencimiento = DateOnly.FromDateTime(DateTime.UtcNow).AddDays(10),
            CantidadDisponible = 3,
            CantidadEsperada = 3
        };
        var response = await client.PutAsJsonAsync(
            $"/api/lotes-medicamento/{fixture.Database.IdLote}", request);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        await using var verify = fixture.Database.OpenContext();
        Assert.Equal(fixture.Database.IdMedicamento,
            (await verify.LoteMedicamentos.SingleAsync()).IdMedicamento);
    }

    private static async Task<Fixture> CreateAsync()
    {
        var database = await SqlServerTestDatabase.CreateAsync();
        var factory = database.CreateFactory();
        try
        {
            await database.SeedAsync(factory.Services);
            await using var db = database.OpenContext();
            var medico = new Empleado
            {
                IdSucursal = database.IdSucursal,
                Nombres = "Médico", Apellidos = "Sintético", DPI = "DPI-MEDICO-1",
                TipoEmpleado = "Medico", Activo = true
            };
            db.Empleados.Add(medico);
            await db.SaveChangesAsync();
            (await db.Usuarios.SingleAsync()).IdEmpleado = medico.IdEmpleado;
            db.Permisos.AddRange(
                new Permiso { IdRol = (await db.Usuarios.SingleAsync()).IdRol,
                    Modulo = "ConsumoClinico", PuedeCrear = true },
                new Permiso { IdRol = (await db.Usuarios.SingleAsync()).IdRol,
                    Modulo = "LotesMedicamento", PuedeModificar = true });
            db.Permisos.Add(new Permiso
            {
                IdRol = (await db.Usuarios.SingleAsync()).IdRol,
                Modulo = "Historial", PuedeCrear = true
            });
            var consulta = new Consulta
            {
                IdPaciente = database.IdPaciente, IdMedico = medico.IdEmpleado,
                IdSucursal = database.IdSucursal, FechaConsulta = DateTime.UtcNow
            };
            db.Consultas.Add(consulta);
            await db.SaveChangesAsync();
            var tratamiento = new Tratamiento
            {
                IdConsulta = consulta.IdConsulta, IdLote = database.IdLote,
                Cantidad = 2, Descripcion = "Tratamiento sintético",
                FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            db.Tratamientos.Add(tratamiento);
            await db.SaveChangesAsync();
            return new Fixture(database, factory, tratamiento.IdTratamiento);
        }
        catch
        {
            factory.Dispose();
            await database.DisposeAsync();
            throw;
        }
    }

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

    private static Task<HttpResponseMessage> ConsumirAsync(
        HttpClient client, int idTratamiento, int cantidad) =>
        client.PostAsJsonAsync($"/api/tratamientos/{idTratamiento}/consumos",
            new ConsumoClinicoCreateDto { Cantidad = cantidad });

    private static async Task AssertUnchangedAsync(Fixture fixture)
    {
        await using var db = fixture.Database.OpenContext();
        Assert.Equal(3, (await db.LoteMedicamentos.SingleAsync()).CantidadDisponible);
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    private sealed record Fixture(
        SqlServerTestDatabase Database,
        Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> Factory,
        int IdTratamiento) : IAsyncDisposable
    {
        public async ValueTask DisposeAsync()
        {
            Factory.Dispose();
            await Database.DisposeAsync();
        }
    }
}
