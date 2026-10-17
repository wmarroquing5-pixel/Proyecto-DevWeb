using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace API_Clinica.Tests;

public sealed class Api11TransactionalEndToEndTests
{
    [Fact]
    public async Task E2E03_RecepcionYVentaConservanStockMovimientosYPrecioHistorico()
    {
        await using var fixture = await CreateOperationalFixtureAsync(
            initialStock: 2, includeClinical: false);
        using var factory = fixture.Database.CreateFactory();
        using var client = factory.CreateClient();
        await LoginAsync(client, "sql.prueba", fixture.Database.Password);

        var entryResponse = await EntradaAsync(client, fixture.Database, 4);
        Assert.Equal(HttpStatusCode.Created, entryResponse.StatusCode);
        var entry = await entryResponse.Content.ReadFromJsonAsync<EntradaInventarioResponse>();
        Assert.NotNull(entry);
        Assert.Equal(6, entry.CantidadDisponible);

        var saleResponse = await VentaAsync(client, fixture.Database, 3);
        Assert.Equal(HttpStatusCode.Created, saleResponse.StatusCode);
        var sale = await saleResponse.Content.ReadFromJsonAsync<VentaResponse>();
        Assert.NotNull(sale);
        Assert.Equal(37.50m, sale.Total);
        var responseDetail = Assert.Single(sale.Detalles);
        Assert.Equal(fixture.Database.IdLote, responseDetail.IdLote);
        Assert.Equal(3, responseDetail.Cantidad);
        Assert.Equal(12.50m, responseDetail.PrecioUnitario);
        Assert.Equal(37.50m, responseDetail.Subtotal);

        await using var db = fixture.Database.OpenContext();
        Assert.Equal(3, (await db.LoteMedicamentos.AsNoTracking().SingleAsync())
            .CantidadDisponible);
        var invoice = Assert.Single(await db.Ventas.AsNoTracking().ToListAsync());
        Assert.Equal("Venta Publica", invoice.TipoFactura);
        Assert.Equal(sale.IdVenta, invoice.IdVenta);
        Assert.Equal(37.50m, invoice.Total);
        var persistedDetail = Assert.Single(
            await db.VentaDetalles.AsNoTracking().ToListAsync());
        Assert.Equal(3, persistedDetail.Cantidad);
        Assert.Equal(12.50m, persistedDetail.PrecioUnitario);
        Assert.Equal(37.50m, persistedDetail.Subtotal);
        var movements = await db.MovimientosInventario.AsNoTracking()
            .OrderBy(movement => movement.IdMovimiento).ToListAsync();
        Assert.Equal(2, movements.Count);
        Assert.Equal(("Entrada", 4),
            (movements[0].TipoMovimiento, movements[0].Cantidad));
        Assert.Equal(("Venta Publica", 3),
            (movements[1].TipoMovimiento, movements[1].Cantidad));
        Assert.All(movements, movement =>
        {
            Assert.Equal(fixture.Database.IdLote, movement.IdLote);
            Assert.Equal(fixture.Database.IdUsuario, movement.IdUsuario);
            Assert.Equal(fixture.Database.IdSucursal, movement.IdSucursal);
        });
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public async Task E2E06_CincoOperacionesConcurrentesMantienenInvariantes(
        int repeticion)
    {
        _ = repeticion;
        await using var fixture = await CreateOperationalFixtureAsync(
            initialStock: 10, includeClinical: true);
        using var factory = fixture.Database.CreateFactory();
        using var entryClient = factory.CreateClient();
        using var saleClient = factory.CreateClient();
        using var invoiceClient = factory.CreateClient();
        using var clinicalClient = factory.CreateClient();
        using var adjustmentClient = factory.CreateClient();
        foreach (var client in new[]
        {
            entryClient, saleClient, invoiceClient, clinicalClient, adjustmentClient
        })
            await LoginAsync(client, "sql.prueba", fixture.Database.Password);

        var gate = new TaskCompletionSource<bool>(
            TaskCreationOptions.RunContinuationsAsynchronously);
        var entryTask = RunAfterGateAsync(gate.Task,
            () => EntradaAsync(entryClient, fixture.Database, 2));
        var saleTask = RunAfterGateAsync(gate.Task,
            () => VentaAsync(saleClient, fixture.Database, 2));
        var invoiceTask = RunAfterGateAsync(gate.Task,
            () => FacturaAsync(invoiceClient, fixture.Database, 2));
        var clinicalTask = RunAfterGateAsync(gate.Task,
            () => ConsumoAsync(clinicalClient, fixture.IdTratamiento!.Value, 2));
        var adjustmentTask = RunAfterGateAsync(gate.Task,
            () => AjusteAsync(adjustmentClient, fixture.Database, 8, 10));
        gate.SetResult(true);

        var entry = await entryTask;
        var sale = await saleTask;
        var invoice = await invoiceTask;
        var clinical = await clinicalTask;
        var adjustment = await adjustmentTask;
        Assert.Contains(entry.StatusCode,
            new[] { HttpStatusCode.Created, HttpStatusCode.Conflict });
        Assert.Contains(sale.StatusCode,
            new[] { HttpStatusCode.Created, HttpStatusCode.Conflict });
        Assert.Contains(invoice.StatusCode,
            new[] { HttpStatusCode.Created, HttpStatusCode.Conflict });
        Assert.Contains(clinical.StatusCode,
            new[] { HttpStatusCode.Created, HttpStatusCode.Conflict });
        Assert.Contains(adjustment.StatusCode,
            new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });

        var entryConfirmed = entry.StatusCode == HttpStatusCode.Created;
        var saleConfirmed = sale.StatusCode == HttpStatusCode.Created;
        var invoiceConfirmed = invoice.StatusCode == HttpStatusCode.Created;
        var clinicalConfirmed = clinical.StatusCode == HttpStatusCode.Created;
        var adjustmentConfirmed = adjustment.StatusCode == HttpStatusCode.OK;
        var confirmedOutputs = Convert.ToInt32(saleConfirmed) +
            Convert.ToInt32(invoiceConfirmed) + Convert.ToInt32(clinicalConfirmed);
        var movementOperations = Convert.ToInt32(entryConfirmed) + confirmedOutputs;
        var netMovement = (entryConfirmed ? 2 : 0) - (2 * confirmedOutputs);
        var expectedStock = (adjustmentConfirmed ? 8 : 10) + netMovement;

        await using var db = fixture.Database.OpenContext();
        var stock = (await db.LoteMedicamentos.AsNoTracking().SingleAsync())
            .CantidadDisponible;
        Assert.True(stock >= 0);
        Assert.Equal(expectedStock, stock);
        var movements = await db.MovimientosInventario.AsNoTracking().ToListAsync();
        Assert.Equal(movementOperations, movements.Count);
        Assert.Equal(movements.Count,
            movements.Select(movement => movement.IdMovimiento).Distinct().Count());
        Assert.All(movements, movement => Assert.Equal(2, movement.Cantidad));
        Assert.Equal(entryConfirmed ? 1 : 0,
            movements.Count(movement => movement.TipoMovimiento == "Entrada"));
        Assert.Equal(Convert.ToInt32(clinicalConfirmed),
            movements.Count(movement => movement.TipoMovimiento == "Uso Interno"));
        Assert.Equal(Convert.ToInt32(saleConfirmed) + Convert.ToInt32(invoiceConfirmed),
            movements.Count(movement => movement.TipoMovimiento == "Venta Publica"));

        var invoices = await db.Ventas.AsNoTracking().ToListAsync();
        var details = await db.VentaDetalles.AsNoTracking().ToListAsync();
        Assert.Equal(Convert.ToInt32(saleConfirmed) + Convert.ToInt32(invoiceConfirmed),
            invoices.Count);
        Assert.Equal(invoices.Count, details.Count);
        Assert.Equal(Convert.ToInt32(saleConfirmed),
            invoices.Count(item => item.TipoFactura == "Venta Publica"));
        Assert.Equal(Convert.ToInt32(invoiceConfirmed),
            invoices.Count(item => item.TipoFactura == "Estancia Medica"));
    }

    [Fact]
    public async Task E2E07_SeguridadIntegralRechazaAccesosSinEfectos()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services, initialStock: 5);
        var security = await SeedSecurityScenarioAsync(database, factory.Services);
        using var anonymous = factory.CreateClient();
        using var invalid = factory.CreateClient();
        using var doctorA = factory.CreateClient();
        using var doctorB = factory.CreateClient();
        using var withoutPermissions = factory.CreateClient();
        invalid.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", "jwt-invalido");
        await LoginAsync(doctorA, security.UsernameA, security.PasswordA);
        await LoginAsync(doctorB, security.UsernameB, security.PasswordB);
        await LoginAsync(withoutPermissions,
            security.UsernameWithoutPermissions, security.PasswordWithoutPermissions);

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.GetAsync("/api/consultas")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await invalid.GetAsync("/api/consultas")).StatusCode);

        var own = await doctorA.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            "/api/consultas");
        Assert.NotNull(own);
        Assert.Equal(1, own.TotalCount);
        Assert.Equal(security.ConsultaA,
            Assert.Single(own.Items).IdConsulta);
        var manipulated = await doctorA.GetFromJsonAsync<PagedResponse<ConsultaListadoDto>>(
            $"/api/consultas?idMedico={security.MedicoB}");
        Assert.NotNull(manipulated);
        Assert.Empty(manipulated.Items);
        Assert.Equal(HttpStatusCode.NotFound,
            (await doctorA.GetAsync($"/api/consultas/{security.ConsultaB}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await doctorB.GetAsync($"/api/consultas/{security.ConsultaB}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await withoutPermissions.GetAsync("/api/consultas")).StatusCode);

        await SetUserActiveAsync(database, security.UsuarioA, false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await doctorA.GetAsync("/api/consultas")).StatusCode);
        await SetUserActiveAsync(database, security.UsuarioA, true);
        await SetRoleActiveAsync(database, security.RolMedico, false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await doctorA.GetAsync("/api/consultas")).StatusCode);
        await SetRoleActiveAsync(database, security.RolMedico, true);
        Assert.Equal(HttpStatusCode.OK,
            (await doctorA.GetAsync("/api/consultas")).StatusCode);

        var before = await ReadSecurityEffectsAsync(database);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await VentaAsync(withoutPermissions, database, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await EntradaAsync(withoutPermissions, database, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ConsumoAsync(withoutPermissions, security.TratamientoA, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await ConsumoAsync(doctorB, security.TratamientoA, 1)).StatusCode);
        Assert.Equal(before, await ReadSecurityEffectsAsync(database));

        var authorized = await ConsumoAsync(doctorA, security.TratamientoA, 1);
        Assert.Equal(HttpStatusCode.Created, authorized.StatusCode);
        await using var verify = database.OpenContext();
        Assert.Equal(4, (await verify.LoteMedicamentos.AsNoTracking().SingleAsync())
            .CantidadDisponible);
        var movement = Assert.Single(
            await verify.MovimientosInventario.AsNoTracking().ToListAsync());
        Assert.Equal("Uso Interno", movement.TipoMovimiento);
        Assert.Equal(security.UsuarioA, movement.IdUsuario);
    }

    private static async Task<OperationalFixture> CreateOperationalFixtureAsync(
        int initialStock, bool includeClinical)
    {
        var database = await SqlServerTestDatabase.CreateAsync();
        var factory = database.CreateFactory();
        try
        {
            await database.SeedAsync(factory.Services, initialStock);
            await using var db = database.OpenContext();
            var user = await db.Usuarios.SingleAsync();
            db.Permisos.Add(new Permiso
            {
                IdRol = user.IdRol, Modulo = "LotesMedicamento",
                PuedeConsultar = true, PuedeModificar = true
            });
            if (!includeClinical)
            {
                await db.SaveChangesAsync();
                factory.Dispose();
                return new OperationalFixture(database, null);
            }

            var doctor = new Empleado
            {
                IdSucursal = database.IdSucursal,
                Nombres = "Médico", Apellidos = "E2E concurrente",
                DPI = "E2E-CONCURRENTE", TipoEmpleado = "Medico", Activo = true
            };
            db.Empleados.Add(doctor);
            db.Permisos.Add(new Permiso
            {
                IdRol = user.IdRol, Modulo = "ConsumoClinico", PuedeCrear = true
            });
            await db.SaveChangesAsync();
            user.IdEmpleado = doctor.IdEmpleado;
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
                Cantidad = 2, Descripcion = "Tratamiento E2E concurrente",
                FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
            };
            db.Tratamientos.Add(treatment);
            await db.SaveChangesAsync();
            factory.Dispose();
            return new OperationalFixture(database, treatment.IdTratamiento);
        }
        catch
        {
            factory.Dispose();
            await database.DisposeAsync();
            throw;
        }
    }

    private static async Task<SecurityScenario> SeedSecurityScenarioAsync(
        SqlServerTestDatabase database, IServiceProvider services)
    {
        await using var scope = services.CreateAsyncScope();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
        await using var db = database.OpenContext();
        var medicalRole = new Rol { Nombre = "MEDICO", Activo = true };
        var noPermissionRole = new Rol { Nombre = "SIN PERMISOS E2E", Activo = true };
        var doctorA = new Empleado
        {
            IdSucursal = database.IdSucursal, Nombres = "Médico", Apellidos = "A",
            DPI = "E2E-SEG-A", TipoEmpleado = "Medico", Activo = true
        };
        var doctorB = new Empleado
        {
            IdSucursal = database.IdSucursal, Nombres = "Médico", Apellidos = "B",
            DPI = "E2E-SEG-B", TipoEmpleado = "Medico", Activo = true
        };
        db.AddRange(medicalRole, noPermissionRole, doctorA, doctorB);
        await db.SaveChangesAsync();

        var passwordA = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var passwordB = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var passwordWithoutPermissions = Convert.ToHexString(
            RandomNumberGenerator.GetBytes(16));
        var userA = new Usuario
        {
            IdRol = medicalRole.IdRol, IdEmpleado = doctorA.IdEmpleado,
            Username = "medico.a.e2e", Activo = true
        };
        var userB = new Usuario
        {
            IdRol = medicalRole.IdRol, IdEmpleado = doctorB.IdEmpleado,
            Username = "medico.b.e2e", Activo = true
        };
        var withoutPermissions = new Usuario
        {
            IdRol = noPermissionRole.IdRol,
            Username = "sin.permisos.e2e", Activo = true
        };
        userA.PasswordHash = hasher.HashPassword(userA, passwordA);
        userB.PasswordHash = hasher.HashPassword(userB, passwordB);
        withoutPermissions.PasswordHash = hasher.HashPassword(
            withoutPermissions, passwordWithoutPermissions);
        db.Usuarios.AddRange(userA, userB, withoutPermissions);
        db.Permisos.AddRange(
            new Permiso
            {
                IdRol = medicalRole.IdRol, Modulo = "Consultas",
                PuedeConsultar = true
            },
            new Permiso
            {
                IdRol = medicalRole.IdRol, Modulo = "ConsumoClinico",
                PuedeCrear = true
            });
        var consultationA = new Consulta
        {
            IdPaciente = database.IdPaciente, IdMedico = doctorA.IdEmpleado,
            IdSucursal = database.IdSucursal, FechaConsulta = DateTime.UtcNow
        };
        var consultationB = new Consulta
        {
            IdPaciente = database.IdPaciente, IdMedico = doctorB.IdEmpleado,
            IdSucursal = database.IdSucursal, FechaConsulta = DateTime.UtcNow
        };
        db.Consultas.AddRange(consultationA, consultationB);
        await db.SaveChangesAsync();
        var treatment = new Tratamiento
        {
            IdConsulta = consultationA.IdConsulta, IdLote = database.IdLote,
            Cantidad = 1, Descripcion = "Tratamiento de seguridad E2E",
            FechaInicio = DateOnly.FromDateTime(DateTime.UtcNow)
        };
        db.Tratamientos.Add(treatment);
        await db.SaveChangesAsync();
        return new SecurityScenario(
            medicalRole.IdRol, userA.IdUsuario, doctorB.IdEmpleado,
            consultationA.IdConsulta, consultationB.IdConsulta,
            treatment.IdTratamiento,
            userA.Username, passwordA, userB.Username, passwordB,
            withoutPermissions.Username, passwordWithoutPermissions);
    }

    private static async Task LoginAsync(
        HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = username, Password = password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var login = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(login);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", login.AccessToken);
    }

    private static Task<HttpResponseMessage> EntradaAsync(
        HttpClient client, SqlServerTestDatabase database, int quantity) =>
        client.PostAsJsonAsync(
            $"/api/lotes-medicamento/{database.IdLote}/entradas",
            new RegistrarEntradaInventarioRequest
            {
                IdSucursal = database.IdSucursal, Cantidad = quantity,
                Observaciones = "E2E-03/API-11E"
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

    private static Task<HttpResponseMessage> ConsumoAsync(
        HttpClient client, int treatmentId, int quantity) =>
        client.PostAsJsonAsync($"/api/tratamientos/{treatmentId}/consumos",
            new ConsumoClinicoCreateDto { Cantidad = quantity });

    private static Task<HttpResponseMessage> AjusteAsync(
        HttpClient client, SqlServerTestDatabase database,
        int quantity, int expected)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        return client.PutAsJsonAsync($"/api/lotes-medicamento/{database.IdLote}",
            new ActualizarLoteMedicamentoRequest
            {
                IdMedicamento = database.IdMedicamento,
                NumeroLote = "LOT-SQL-1",
                FechaIngreso = today.AddDays(-5),
                FechaVencimiento = today.AddDays(10),
                CantidadDisponible = quantity,
                CantidadEsperada = expected
            });
    }

    private static async Task<HttpResponseMessage> RunAfterGateAsync(
        Task gate, Func<Task<HttpResponseMessage>> operation)
    {
        await gate;
        return await operation();
    }

    private static async Task SetUserActiveAsync(
        SqlServerTestDatabase database, int id, bool active)
    {
        await using var db = database.OpenContext();
        (await db.Usuarios.SingleAsync(user => user.IdUsuario == id)).Activo = active;
        await db.SaveChangesAsync();
    }

    private static async Task SetRoleActiveAsync(
        SqlServerTestDatabase database, int id, bool active)
    {
        await using var db = database.OpenContext();
        (await db.Roles.SingleAsync(role => role.IdRol == id)).Activo = active;
        await db.SaveChangesAsync();
    }

    private static async Task<SecurityEffects> ReadSecurityEffectsAsync(
        SqlServerTestDatabase database)
    {
        await using var db = database.OpenContext();
        return new SecurityEffects(
            (await db.LoteMedicamentos.AsNoTracking().SingleAsync()).CantidadDisponible,
            await db.Ventas.AsNoTracking().CountAsync(),
            await db.VentaDetalles.AsNoTracking().CountAsync(),
            await db.MovimientosInventario.AsNoTracking().CountAsync());
    }

    private sealed record OperationalFixture(
        SqlServerTestDatabase Database, int? IdTratamiento) : IAsyncDisposable
    {
        public ValueTask DisposeAsync() => Database.DisposeAsync();
    }

    private sealed record SecurityScenario(
        int RolMedico, int UsuarioA, int MedicoB,
        int ConsultaA, int ConsultaB, int TratamientoA,
        string UsernameA, string PasswordA,
        string UsernameB, string PasswordB,
        string UsernameWithoutPermissions, string PasswordWithoutPermissions);

    private sealed record SecurityEffects(
        int Stock, int Invoices, int Details, int Movements);
}
