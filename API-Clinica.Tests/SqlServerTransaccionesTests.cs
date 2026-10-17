using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.WebSockets;
using System.Data.Common;
using System.Text;
using System.Text.Json;
using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace API_Clinica.Tests;

public sealed class SqlServerTransaccionesTests
{
    [Fact]
    public async Task VentaSimplePersisteDetalleMovimientoYDescuentoEnSqlAislado()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        using var client = factory.CreateClient();
        await LoginAsync(client, database);

        var response = await client.PostAsJsonAsync("/api/ventas", Venta(database, 2));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var sale = await response.Content.ReadFromJsonAsync<VentaResponse>();
        Assert.NotNull(sale);
        Assert.Equal(25m, sale.Total);
        Assert.Equal(database.IdUsuario, sale.IdUsuario);

        await using var db = database.OpenContext();
        Assert.Single(await db.Ventas.AsNoTracking().ToListAsync());
        var detail = Assert.Single(await db.VentaDetalles.AsNoTracking().ToListAsync());
        Assert.Equal(database.IdLote, detail.IdLote);
        Assert.Equal(2, detail.Cantidad);
        var movement = Assert.Single(await db.MovimientosInventario.AsNoTracking().ToListAsync());
        Assert.Equal("Venta Publica", movement.TipoMovimiento);
        Assert.Equal(2, movement.Cantidad);
        Assert.Equal(1, (await db.LoteMedicamentos.AsNoTracking().SingleAsync()).CantidadDisponible);
    }

    [Theory]
    [InlineData("venta", "venta")]
    [InlineData("factura", "factura")]
    [InlineData("venta", "factura")]
    public async Task DosOperacionesSobreElMismoLoteNoSobrevenden(string first, string second)
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services, initialStock: 3);
        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        await LoginAsync(firstClient, database);
        await LoginAsync(secondClient, database);

        using var gate = new ManualResetEventSlim(false);
        var one = Task.Run(async () =>
        {
            gate.Wait();
            return await PostAsync(firstClient, database, first, 2);
        });
        var two = Task.Run(async () =>
        {
            gate.Wait();
            return await PostAsync(secondClient, database, second, 2);
        });
        gate.Set();
        var responses = await Task.WhenAll(one, two);
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));

        await using var db = database.OpenContext();
        Assert.Equal(1, (await db.LoteMedicamentos.AsNoTracking().SingleAsync()).CantidadDisponible);
        var invoice = Assert.Single(await db.Ventas.AsNoTracking().ToListAsync());
        Assert.Equal(25m, invoice.Total);
        var detail = Assert.Single(await db.VentaDetalles.AsNoTracking().ToListAsync());
        Assert.Equal(invoice.IdVenta, detail.IdVenta);
        Assert.Equal(2, detail.Cantidad);
        var movement = Assert.Single(await db.MovimientosInventario.AsNoTracking().ToListAsync());
        Assert.Equal(database.IdLote, movement.IdLote);
        Assert.Equal(2, movement.Cantidad);
    }

    [Fact]
    public async Task FacturaMixtaRespetaFefoYNoUsaLotesVencidos()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services, initialStock: 2);
        var laterLot = await database.AddLotAsync(3, daysToExpiry: 20, daysSinceEntry: 3);
        var expiredLot = await database.AddLotAsync(20, daysToExpiry: -1, daysSinceEntry: 30);
        using var client = factory.CreateClient();
        await LoginAsync(client, database);

        var response = await client.PostAsJsonAsync("/api/facturas", Factura(database, 4, 1));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var invoice = await response.Content.ReadFromJsonAsync<FacturaServiciosResponse>();
        Assert.NotNull(invoice);
        Assert.Equal(150m, invoice.Total);
        Assert.Equal(3, invoice.Detalles.Count);
        Assert.Equal(new[] { database.IdLote, laterLot },
            invoice.Detalles.Where(d => d.IdLote.HasValue).Select(d => d.IdLote!.Value));

        await using var db = database.OpenContext();
        var persisted = Assert.Single(await db.Ventas.AsNoTracking().ToListAsync());
        Assert.Equal(invoice.IdFactura, persisted.IdVenta);
        Assert.Equal(invoice.Total, persisted.Total);
        var details = await db.VentaDetalles.AsNoTracking().ToListAsync();
        Assert.Equal(3, details.Count);
        Assert.All(details, d =>
        {
            Assert.Equal(invoice.IdFactura, d.IdVenta);
            Assert.Equal(d.Cantidad * d.PrecioUnitario, d.Subtotal);
        });
        Assert.Equal(invoice.Total, details.Sum(d => d.Subtotal));
        var movements = await db.MovimientosInventario.AsNoTracking().OrderBy(m => m.IdLote).ToListAsync();
        Assert.Equal(2, movements.Count);
        Assert.Equal(new[] { 2, 2 }, movements.Select(m => m.Cantidad));
        Assert.All(movements, m => Assert.Equal("Venta Publica", m.TipoMovimiento));
        Assert.Equal(0, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == database.IdLote)).CantidadDisponible);
        Assert.Equal(1, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == laterLot)).CantidadDisponible);
        Assert.Equal(20, (await db.LoteMedicamentos.SingleAsync(l => l.IdLote == expiredLot)).CantidadDisponible);
    }

    [Fact]
    public async Task ConsultasDeVentasYFacturasFuncionanSobreSqlAisladoSinCambiarStock()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services, initialStock: 4);
        using var client = factory.CreateClient();
        await LoginAsync(client, database);

        var ventaResponse = await client.PostAsJsonAsync("/api/ventas", Venta(database, 1));
        var facturaResponse = await client.PostAsJsonAsync(
            "/api/facturas", Factura(database, medicineQuantity: 1, serviceQuantity: 1));
        var venta = await ventaResponse.Content.ReadFromJsonAsync<VentaResponse>();
        var factura = await facturaResponse.Content.ReadFromJsonAsync<FacturaServiciosResponse>();
        Assert.NotNull(venta);
        Assert.NotNull(factura);
        await using (var db = database.OpenContext())
            Assert.Equal(2, (await db.LoteMedicamentos.AsNoTracking().SingleAsync())
                .CantidadDisponible);

        var ventas = await client.GetFromJsonAsync<PagedResponse<VentaConsultaResumenResponse>>(
            $"/api/ventas?idVenta={venta.IdVenta}&idSucursal={database.IdSucursal}");
        var ventaDetalle = await client.GetFromJsonAsync<VentaConsultaResponse>(
            $"/api/ventas/{venta.IdVenta}");
        var facturas = await client.GetFromJsonAsync<PagedResponse<FacturaConsultaResumenResponse>>(
            $"/api/facturas?idFactura={factura.IdFactura}&idPaciente={database.IdPaciente}");
        var facturaDetalle = await client.GetFromJsonAsync<FacturaConsultaResponse>(
            $"/api/facturas/{factura.IdFactura}");

        Assert.NotNull(ventas);
        Assert.NotNull(ventaDetalle);
        Assert.NotNull(facturas);
        Assert.NotNull(facturaDetalle);
        Assert.Single(ventas.Items);
        Assert.Single(facturas.Items);
        Assert.Equal(12.50m, Assert.Single(ventaDetalle.Detalles).PrecioUnitario);
        Assert.Equal(2, facturaDetalle.Detalles.Count);
        Assert.Contains(facturaDetalle.Detalles, d => d.IdServicio == database.IdServicio);
        Assert.Contains(facturaDetalle.Detalles, d => d.IdMedicamento == database.IdMedicamento);
        await using var verify = database.OpenContext();
        Assert.Equal(2, (await verify.LoteMedicamentos.AsNoTracking().SingleAsync())
            .CantidadDisponible);
    }

    [Fact]
    public async Task HabitacionConcurrentePublicaEstadoConfirmadoADosClientesSignalR()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);

        int habitacionId;
        int segundoPacienteId;
        await using (var seed = database.OpenContext())
        {
            var idRol = await seed.Usuarios.Where(u => u.IdUsuario == database.IdUsuario)
                .Select(u => u.IdRol).SingleAsync();
            seed.Permisos.AddRange(
                new Permiso
                {
                    IdRol = idRol, Modulo = "Habitaciones",
                    PuedeConsultar = true, PuedeCrear = true,
                    PuedeModificar = true, PuedeEliminar = true
                },
                new Permiso
                {
                    IdRol = idRol, Modulo = "AsignacionesHabitacion",
                    PuedeConsultar = true, PuedeCrear = true,
                    PuedeModificar = true, PuedeEliminar = true
                });
            var segundoPaciente = new Paciente
            {
                Nombres = "Segundo", Apellidos = "Paciente sintético",
                FechaNacimiento = new DateOnly(1995, 1, 1),
                FechaRegistro = DateTime.UtcNow, Activo = true
            };
            var habitacion = new Habitacion
            {
                IdSucursal = database.IdSucursal,
                NumeroHabitacion = "SQL-CONCURRENTE",
                TipoHabitacion = "Prueba",
                Estado = EstadoHabitacion.Libre,
                Activa = true
            };
            seed.AddRange(segundoPaciente, habitacion);
            await seed.SaveChangesAsync();
            segundoPacienteId = segundoPaciente.IdPaciente;
            habitacionId = habitacion.IdHabitacion;
        }

        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        var firstToken = await LoginAsync(firstClient, database);
        var secondToken = await LoginAsync(secondClient, database);
        using var firstSocket = await ConnectHubAsync(factory, firstToken);
        using var secondSocket = await ConnectHubAsync(factory, secondToken);

        using var gate = new ManualResetEventSlim(false);
        var firstRequest = Task.Run(async () =>
        {
            gate.Wait();
            return await firstClient.PostAsJsonAsync("/api/asignaciones-habitacion",
                new CrearAsignacionHabitacionRequest
                {
                    IdHabitacion = habitacionId, IdPaciente = database.IdPaciente
                });
        });
        var secondRequest = Task.Run(async () =>
        {
            gate.Wait();
            return await secondClient.PostAsJsonAsync("/api/asignaciones-habitacion",
                new CrearAsignacionHabitacionRequest
                {
                    IdHabitacion = habitacionId, IdPaciente = segundoPacienteId
                });
        });
        gate.Set();
        var responses = await Task.WhenAll(firstRequest, secondRequest);
        var confirmed = Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, r => r.StatusCode == HttpStatusCode.Conflict);
        var assignment = await confirmed.Content
            .ReadFromJsonAsync<AsignacionHabitacionResponse>();
        Assert.NotNull(assignment);

        var firstEvent = await ReceiveRoomEventAsync(firstSocket);
        var secondEvent = await ReceiveRoomEventAsync(secondSocket);
        Assert.Equal((habitacionId, EstadoHabitacion.Ocupada), firstEvent);
        Assert.Equal(firstEvent, secondEvent);
        await using (var verify = database.OpenContext())
        {
            var active = await verify.AsignacionesHabitacion.AsNoTracking()
                .Where(a => a.IdHabitacion == habitacionId && a.FechaEgreso == null)
                .ToListAsync();
            Assert.Single(active);
            Assert.Equal(assignment.IdPaciente, active[0].IdPaciente);
            Assert.Equal(EstadoHabitacion.Ocupada,
                (await verify.Habitaciones.AsNoTracking()
                    .SingleAsync(h => h.IdHabitacion == habitacionId)).Estado);
        }

        using (var closeTimeout = new CancellationTokenSource(TimeSpan.FromSeconds(5)))
            await secondSocket.CloseAsync(WebSocketCloseStatus.NormalClosure,
                "Reconexión de prueba", closeTimeout.Token);
        using var reconnectedSocket = await ConnectHubAsync(factory, secondToken);
        var discharge = await firstClient.PostAsync(
            $"/api/asignaciones-habitacion/{assignment.IdAsignacion}/egreso", null);
        Assert.Equal(HttpStatusCode.OK, discharge.StatusCode);
        var firstDischargeEvent = await ReceiveRoomEventAsync(firstSocket);
        var reconnectedEvent = await ReceiveRoomEventAsync(reconnectedSocket);
        Assert.Equal((habitacionId, EstadoHabitacion.EnLimpieza), firstDischargeEvent);
        Assert.Equal(firstDischargeEvent, reconnectedEvent);
        await using var final = database.OpenContext();
        Assert.NotNull((await final.AsignacionesHabitacion.AsNoTracking()
            .SingleAsync(a => a.IdAsignacion == assignment.IdAsignacion)).FechaEgreso);
        Assert.Equal(EstadoHabitacion.EnLimpieza,
            (await final.Habitaciones.AsNoTracking()
                .SingleAsync(h => h.IdHabitacion == habitacionId)).Estado);
    }

    [Fact]
    public async Task ReintentoIdenticoDeFacturaCreaOtraFacturaSinClaveDeIdempotencia()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        using var client = factory.CreateClient();
        await LoginAsync(client, database);
        var request = Factura(database, 0, 1);
        var first = await client.PostAsJsonAsync("/api/facturas", request);
        var second = await client.PostAsJsonAsync("/api/facturas", request);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        await using var db = database.OpenContext();
        var invoices = await db.Ventas.AsNoTracking().OrderBy(v => v.IdVenta).ToListAsync();
        Assert.Equal(2, invoices.Count);
        Assert.NotEqual(invoices[0].IdVenta, invoices[1].IdVenta);
        Assert.Equal(2, await db.VentaDetalles.CountAsync());
    }

    [Theory]
    [InlineData("Factura", "Total")]
    [InlineData("FacturaDetalle", "Cantidad")]
    [InlineData("MovimientoInventario", "Cantidad")]
    public async Task FalloSqlEnCabeceraDetalleOMovimientoRevierteTodo(
        string table, string column)
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        // Restricción imposible solo en la base temporal, para provocar un error de escritura real.
        await database.ExecuteAsync(
            $"ALTER TABLE [{table}] ADD CONSTRAINT [CK_Test_Fallo] CHECK ([{column}] < 0)");
        using var client = factory.CreateClient();
        await LoginAsync(client, database);

        var response = await client.PostAsJsonAsync("/api/facturas", Factura(database, 2, 1));
        Assert.NotEqual(HttpStatusCode.Created, response.StatusCode);
        await AssertUnchangedAsync(database, initialStock: 3);
    }

    [Fact]
    public async Task FalloTrasSaveChangesRevierteEscriturasSqlPreviasAlCommit()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory(new FailAfterSaveInterceptor());
        await database.SeedAsync(factory.Services);
        using var client = factory.CreateClient();
        await LoginAsync(client, database);

        var response = await client.PostAsJsonAsync("/api/ventas", Venta(database, 2));
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        await AssertUnchangedAsync(database, initialStock: 3);
    }

    [Fact]
    public async Task FalloAntesDeCommitRevierteFacturaYMovimientos()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        var interceptor = new FailBeforeCommitInterceptor();
        using var factory = database.CreateFactory(interceptor);
        await database.SeedAsync(factory.Services);
        using var client = factory.CreateClient();
        await LoginAsync(client, database);
        interceptor.Enabled = true;

        var response = await client.PostAsJsonAsync("/api/facturas", Factura(database, 2, 1));
        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.True(interceptor.Triggered);
        await AssertUnchangedAsync(database, initialStock: 3);
    }

    [Fact]
    public async Task SqlServerAplicaFkUniqueCheckPrecisionEIdentity()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        Assert.True(database.IdLote > 0);
        Assert.True(database.IdMedicamento > 0);
        Assert.True(database.IdUsuario > 0);

        await Assert.ThrowsAsync<SqlException>(() => database.ExecuteAsync(
            $"UPDATE [LoteMedicamento] SET [IdMedicamento]=2147483647 WHERE [IdLote]={database.IdLote}"));
        await Assert.ThrowsAsync<SqlException>(() => database.ExecuteAsync(
            $"UPDATE [Medicamento] SET [Codigo]='MED-SQL' WHERE [IdMedicamento]={database.IdMedicamento}; " +
            "INSERT INTO [Medicamento] ([IdCategoria],[IdMarca],[Codigo],[Nombre],[PrecioVenta],[Activo],[Presentacion]) " +
            $"SELECT [IdCategoria],[IdMarca],[Codigo],'duplicado',12.50,1,[Presentacion] FROM [Medicamento] WHERE [IdMedicamento]={database.IdMedicamento}"));
        await Assert.ThrowsAsync<SqlException>(() => database.ExecuteAsync(
            $"UPDATE [LoteMedicamento] SET [CantidadDisponible]=-1 WHERE [IdLote]={database.IdLote}"));
        await Assert.ThrowsAsync<SqlException>(() => database.ExecuteAsync(
            $"UPDATE [Medicamento] SET [PrecioVenta]=99999999999999999.99 WHERE [IdMedicamento]={database.IdMedicamento}"));
        await using var db = database.OpenContext();
        Assert.Equal(3, (await db.LoteMedicamentos.AsNoTracking().SingleAsync()).CantidadDisponible);
        Assert.Single(await db.Medicamentos.AsNoTracking().ToListAsync());
        Assert.Equal(12.50m, (await db.Medicamentos.AsNoTracking().SingleAsync()).PrecioVenta);
    }

    private static async Task AssertUnchangedAsync(SqlServerTestDatabase database, int initialStock)
    {
        await using var db = database.OpenContext();
        Assert.Empty(await db.Ventas.AsNoTracking().ToListAsync());
        Assert.Empty(await db.VentaDetalles.AsNoTracking().ToListAsync());
        Assert.Empty(await db.MovimientosInventario.AsNoTracking().ToListAsync());
        Assert.Equal(initialStock,
            (await db.LoteMedicamentos.AsNoTracking().SingleAsync()).CantidadDisponible);
    }

    private sealed class FailAfterSaveInterceptor : SaveChangesInterceptor
    {
        public override ValueTask<int> SavedChangesAsync(
            SaveChangesCompletedEventData eventData, int result,
            CancellationToken cancellationToken = default)
        {
            if (eventData.Context?.ChangeTracker.Entries()
                .Any(e => e.Entity is API_Clinica.Models.Entities.Venta) == true)
                throw new InvalidOperationException("Fallo sintético tras SaveChanges.");
            return base.SavedChangesAsync(eventData, result, cancellationToken);
        }
    }

    private sealed class FailBeforeCommitInterceptor : DbTransactionInterceptor
    {
        public bool Enabled { get; set; }
        public bool Triggered { get; private set; }

        public override ValueTask<InterceptionResult> TransactionCommittingAsync(
            DbTransaction transaction, TransactionEventData eventData,
            InterceptionResult result, CancellationToken cancellationToken = default)
        {
            if (Enabled)
            {
                Enabled = false;
                Triggered = true;
                throw new InvalidOperationException("Fallo sintético antes del commit.");
            }
            return base.TransactionCommittingAsync(transaction, eventData, result, cancellationToken);
        }
    }

    private static CrearVentaRequest Venta(SqlServerTestDatabase database, int quantity) => new()
    {
        IdSucursal = database.IdSucursal,
        Items = [new CrearVentaItemRequest
        {
            IdMedicamento = database.IdMedicamento,
            Cantidad = quantity
        }]
    };

    private static CrearFacturaServiciosRequest Factura(
        SqlServerTestDatabase database, int medicineQuantity, int serviceQuantity = 0) => new()
    {
        IdSucursal = database.IdSucursal,
        IdPaciente = database.IdPaciente,
        Servicios = serviceQuantity == 0 ? [] : [new CrearFacturaServicioItemRequest
        {
            IdServicio = database.IdServicio, Cantidad = serviceQuantity
        }],
        Medicamentos = medicineQuantity == 0 ? [] : [new CrearFacturaMedicamentoItemRequest
        {
            IdMedicamento = database.IdMedicamento, Cantidad = medicineQuantity
        }]
    };

    private static Task<HttpResponseMessage> PostAsync(
        HttpClient client, SqlServerTestDatabase database, string kind, int quantity) =>
        kind == "venta"
            ? client.PostAsJsonAsync("/api/ventas", Venta(database, quantity))
            : client.PostAsJsonAsync("/api/facturas", Factura(database, quantity));

    private static async Task<string> LoginAsync(
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
        return login.AccessToken;
    }

    private static async Task<WebSocket> ConnectHubAsync(
        WebApplicationFactory<Program> factory, string token)
    {
        var client = factory.Server.CreateWebSocketClient();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var socket = await client.ConnectAsync(new Uri(
            $"ws://localhost/hubs/habitaciones?access_token={Uri.EscapeDataString(token)}"),
            timeout.Token);
        await socket.SendAsync(
            Encoding.UTF8.GetBytes("{\"protocol\":\"json\",\"version\":1}\u001e"),
            WebSocketMessageType.Text, true, timeout.Token);
        var buffer = new byte[256];
        var response = await socket.ReceiveAsync(buffer, timeout.Token);
        Assert.Equal("{}\u001e", Encoding.UTF8.GetString(buffer, 0, response.Count));
        return socket;
    }

    private static async Task<(int HabitacionId, string Estado)> ReceiveRoomEventAsync(
        WebSocket socket)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var buffer = new byte[4096];
        while (true)
        {
            var result = await socket.ReceiveAsync(buffer, timeout.Token);
            if (result.MessageType == WebSocketMessageType.Close)
                throw new InvalidOperationException("SignalR cerró la conexión antes del evento.");
            var messages = Encoding.UTF8.GetString(buffer, 0, result.Count)
                .Split('\u001e', StringSplitOptions.RemoveEmptyEntries);
            foreach (var message in messages)
            {
                using var json = JsonDocument.Parse(message);
                var root = json.RootElement;
                if (!root.TryGetProperty("target", out var target) ||
                    target.GetString() != "ActualizarEstadoHabitacion")
                    continue;
                var payload = root.GetProperty("arguments")[0];
                Assert.Equal(2, payload.EnumerateObject().Count());
                return (payload.GetProperty("habitacionId").GetInt32(),
                    payload.GetProperty("estado").GetString()!);
            }
        }
    }
}
