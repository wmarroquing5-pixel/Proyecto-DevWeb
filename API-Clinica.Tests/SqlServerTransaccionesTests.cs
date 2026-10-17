using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Data.Common;
using API_Clinica.DTOs;
using Microsoft.Data.SqlClient;
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
}
