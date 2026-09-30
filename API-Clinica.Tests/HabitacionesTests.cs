using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
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

public sealed class HabitacionesTests
{
    [Fact]
    public async Task PublicaEstadosSoloTrasOperacionesConfirmadas()
    {
        using var factory = new RoomApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var created = await client.PostAsJsonAsync("/api/habitaciones",
            new CrearHabitacionRequest { IdSucursal = 1, NumeroHabitacion = "104" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var room = await created.Content.ReadFromJsonAsync<HabitacionResponse>();
        Assert.NotNull(room);
        Assert.Equal([(room.IdHabitacion, "Libre")], factory.Notifier.Events.ToArray());

        var assignmentRequest = new CrearAsignacionHabitacionRequest
        {
            IdHabitacion = room.IdHabitacion, IdPaciente = 1
        };
        var assigned = await client.PostAsJsonAsync("/api/asignaciones-habitacion", assignmentRequest);
        Assert.Equal(HttpStatusCode.Created, assigned.StatusCode);
        var assignment = await assigned.Content.ReadFromJsonAsync<AsignacionHabitacionResponse>();
        Assert.NotNull(assignment);
        Assert.Equal([(room.IdHabitacion, "Libre"), (room.IdHabitacion, "Ocupada")],
            factory.Notifier.Events.ToArray());

        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/asignaciones-habitacion", assignmentRequest)).StatusCode);
        Assert.Equal(2, factory.Notifier.Events.Count);

        var discharged = await client.PostAsync(
            $"/api/asignaciones-habitacion/{assignment.IdAsignacion}/egreso", null);
        Assert.Equal(HttpStatusCode.OK, discharged.StatusCode);
        Assert.Equal((room.IdHabitacion, "En limpieza"), factory.Notifier.Events.Last());

        var cleaned = await client.PutAsJsonAsync($"/api/habitaciones/{room.IdHabitacion}",
            new ActualizarHabitacionRequest
            {
                IdSucursal = 1, NumeroHabitacion = "104", Estado = "Libre"
            });
        Assert.Equal(HttpStatusCode.OK, cleaned.StatusCode);
        Assert.Equal((room.IdHabitacion, "Libre"), factory.Notifier.Events.Last());
        Assert.Equal(4, factory.Notifier.Events.Count);
    }

    [Fact]
    public async Task HubRequiereAutenticacionYPermisoDeConsulta()
    {
        using var factory = new RoomApiFactory();
        var password = await factory.SeedAsync(grantPermissions: false);
        using var client = factory.CreateClient();
        const string negotiate = "/hubs/habitaciones/negotiate?negotiateVersion=1";
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsync(negotiate, null)).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.PostAsync(negotiate, null)).StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Habitaciones", PuedeConsultar = true });
        await db.SaveChangesAsync();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync(negotiate, null)).StatusCode);
    }

    [Fact]
    public async Task HubEntregaEventoConIdentificadorYEstado()
    {
        using var factory = new RoomApiFactory(useRealNotifier: true);
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var token = client.DefaultRequestHeaders.Authorization?.Parameter;
        Assert.NotNull(token);
        var wsClient = factory.Server.CreateWebSocketClient();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        using var socket = await wsClient.ConnectAsync(
            new Uri($"ws://localhost/hubs/habitaciones?access_token={Uri.EscapeDataString(token)}"),
            timeout.Token);
        var handshake = Encoding.UTF8.GetBytes("{\"protocol\":\"json\",\"version\":1}\u001e");
        await socket.SendAsync(handshake, WebSocketMessageType.Text, true, timeout.Token);
        var buffer = new byte[4096];
        var handshakeResult = await socket.ReceiveAsync(buffer, timeout.Token);
        Assert.Equal("{}\u001e", Encoding.UTF8.GetString(buffer, 0, handshakeResult.Count));

        var created = await client.PostAsJsonAsync("/api/habitaciones",
            new CrearHabitacionRequest { IdSucursal = 1, NumeroHabitacion = "105" }, timeout.Token);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var room = await created.Content.ReadFromJsonAsync<HabitacionResponse>(timeout.Token);
        Assert.NotNull(room);

        var received = await socket.ReceiveAsync(buffer, timeout.Token);
        var message = Encoding.UTF8.GetString(buffer, 0, received.Count).TrimEnd('\u001e');
        using var json = JsonDocument.Parse(message);
        var root = json.RootElement;
        Assert.Equal("ActualizarEstadoHabitacion", root.GetProperty("target").GetString());
        var payload = root.GetProperty("arguments")[0];
        Assert.Equal(2, payload.EnumerateObject().Count());
        Assert.Equal(room.IdHabitacion, payload.GetProperty("habitacionId").GetInt32());
        Assert.Equal("Libre", payload.GetProperty("estado").GetString());
    }

    [Fact]
    public async Task AsignacionEgresoYLimpiezaMantienenEstadoConsistente()
    {
        using var factory = new RoomApiFactory();
        var password = await factory.SeedAsync();
        using var client = factory.CreateClient();
        await LoginAsync(client, password);

        var createdRoom = await client.PostAsJsonAsync("/api/habitaciones",
            new CrearHabitacionRequest { IdSucursal = 1, NumeroHabitacion = "101" });
        Assert.Equal(HttpStatusCode.Created, createdRoom.StatusCode);
        var room = await createdRoom.Content.ReadFromJsonAsync<HabitacionResponse>();
        Assert.NotNull(room);
        Assert.Equal("Libre", room.Estado);

        var assignmentRequest = new CrearAsignacionHabitacionRequest
        {
            IdHabitacion = room.IdHabitacion, IdPaciente = 1, Observaciones = "Ingreso"
        };
        var first = await client.PostAsJsonAsync("/api/asignaciones-habitacion", assignmentRequest);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        var assignment = await first.Content.ReadFromJsonAsync<AsignacionHabitacionResponse>();
        Assert.NotNull(assignment);
        Assert.True(assignment.IdAsignacion > 0);
        Assert.Null(assignment.FechaEgreso);

        var occupied = await client.GetFromJsonAsync<HabitacionResponse>(
            $"/api/habitaciones/{room.IdHabitacion}");
        Assert.Equal("Ocupada", occupied?.Estado);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/asignaciones-habitacion", assignmentRequest)).StatusCode);

        var secondRoomResponse = await client.PostAsJsonAsync("/api/habitaciones",
            new CrearHabitacionRequest { IdSucursal = 1, NumeroHabitacion = "103" });
        var secondRoom = await secondRoomResponse.Content.ReadFromJsonAsync<HabitacionResponse>();
        Assert.NotNull(secondRoom);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/asignaciones-habitacion",
                new CrearAsignacionHabitacionRequest
                {
                    IdHabitacion = secondRoom.IdHabitacion, IdPaciente = 1
                })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/habitaciones/{room.IdHabitacion}",
                new ActualizarHabitacionRequest
                {
                    IdSucursal = 1, NumeroHabitacion = "101", Estado = "Libre"
                })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/habitaciones/{room.IdHabitacion}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.DeleteAsync($"/api/asignaciones-habitacion/{assignment.IdAsignacion}")).StatusCode);

        var updatedNotes = await client.PutAsJsonAsync(
            $"/api/asignaciones-habitacion/{assignment.IdAsignacion}",
            new ActualizarAsignacionHabitacionRequest { Observaciones = "Seguimiento" });
        Assert.Equal(HttpStatusCode.OK, updatedNotes.StatusCode);

        var discharged = await client.PostAsync(
            $"/api/asignaciones-habitacion/{assignment.IdAsignacion}/egreso", null);
        Assert.Equal(HttpStatusCode.OK, discharged.StatusCode);
        var egress = await discharged.Content.ReadFromJsonAsync<AsignacionHabitacionResponse>();
        Assert.NotNull(egress?.FechaEgreso);
        Assert.Equal("Seguimiento", egress.Observaciones);
        Assert.Equal("En limpieza", (await client.GetFromJsonAsync<HabitacionResponse>(
            $"/api/habitaciones/{room.IdHabitacion}"))?.Estado);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/asignaciones-habitacion", assignmentRequest)).StatusCode);

        var cleaned = await client.PutAsJsonAsync($"/api/habitaciones/{room.IdHabitacion}",
            new ActualizarHabitacionRequest
            {
                IdSucursal = 1, NumeroHabitacion = "101", Estado = "Libre"
            });
        Assert.Equal(HttpStatusCode.OK, cleaned.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/asignaciones-habitacion/{assignment.IdAsignacion}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/habitaciones/{room.IdHabitacion}")).StatusCode);
        Assert.False((await client.GetFromJsonAsync<HabitacionResponse>(
            $"/api/habitaciones/{room.IdHabitacion}"))?.Activa);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Empty(await db.AsignacionesHabitacion.Where(a => a.FechaEgreso == null).ToListAsync());
    }

    [Fact(Skip = "Pendiente SQL Server aislado: EF InMemory no reproduce los bloqueos transaccionales de habitaciones.")]
    public async Task DosSolicitudesSimultaneasNoDejanDosAsignacionesActivas()
    {
        using var factory = new RoomApiFactory();
        var password = await factory.SeedAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Pacientes.Add(new Paciente
            {
                IdPaciente = 2, Nombres = "Segundo", Apellidos = "Paciente",
                FechaNacimiento = new DateOnly(2000, 1, 1),
                FechaRegistro = DateTime.UtcNow, Activo = true
            });
            await db.SaveChangesAsync();
        }
        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        await LoginAsync(firstClient, password);
        await LoginAsync(secondClient, password);
        var created = await firstClient.PostAsJsonAsync("/api/habitaciones",
            new CrearHabitacionRequest { IdSucursal = 1, NumeroHabitacion = "Concurrente" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var room = await created.Content.ReadFromJsonAsync<HabitacionResponse>();
        Assert.NotNull(room);

        var responses = await Task.WhenAll(
            firstClient.PostAsJsonAsync("/api/asignaciones-habitacion",
                new CrearAsignacionHabitacionRequest { IdHabitacion = room.IdHabitacion, IdPaciente = 1 }),
            secondClient.PostAsJsonAsync("/api/asignaciones-habitacion",
                new CrearAsignacionHabitacionRequest { IdHabitacion = room.IdHabitacion, IdPaciente = 2 }));
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Created));
        Assert.Equal(1, responses.Count(r => r.StatusCode == HttpStatusCode.Conflict));
        using var verifyScope = factory.Services.CreateScope();
        var verify = verifyScope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        Assert.Single(await verify.AsignacionesHabitacion
            .Where(a => a.IdHabitacion == room.IdHabitacion && a.FechaEgreso == null).ToListAsync());
        Assert.Equal("Ocupada", (await verify.Habitaciones.SingleAsync()).Estado);
    }

    [Fact]
    public async Task AsignacionRechazaPacienteInactivoYEstadoForzado()
    {
        using var factory = new RoomApiFactory();
        var password = await factory.SeedAsync(patientActive: false);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var createdRoom = await client.PostAsJsonAsync("/api/habitaciones",
            new CrearHabitacionRequest { IdSucursal = 1, NumeroHabitacion = "102" });
        var room = await createdRoom.Content.ReadFromJsonAsync<HabitacionResponse>();
        Assert.NotNull(room);

        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/asignaciones-habitacion",
                new CrearAsignacionHabitacionRequest
                {
                    IdHabitacion = room.IdHabitacion, IdPaciente = 1
                })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PutAsJsonAsync($"/api/habitaciones/{room.IdHabitacion}",
                new ActualizarHabitacionRequest
                {
                    IdSucursal = 1, NumeroHabitacion = "102", Estado = "Ocupada"
                })).StatusCode);
        Assert.Equal("Libre", (await client.GetFromJsonAsync<HabitacionResponse>(
            $"/api/habitaciones/{room.IdHabitacion}"))?.Estado);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Pacientes.SingleAsync()).Activo = true;
            await db.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.NoContent,
            (await client.DeleteAsync($"/api/habitaciones/{room.IdHabitacion}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict,
            (await client.PostAsJsonAsync("/api/asignaciones-habitacion",
                new CrearAsignacionHabitacionRequest
                {
                    IdHabitacion = room.IdHabitacion, IdPaciente = 1
                })).StatusCode);
    }

    [Fact]
    public async Task HabitacionesYAsignacionesRequierenPermisosActuales()
    {
        using var factory = new RoomApiFactory();
        var password = await factory.SeedAsync(grantPermissions: false);
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/habitaciones")).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/habitaciones")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/asignaciones-habitacion")).StatusCode);
    }

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "habitaciones.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class RoomApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        private readonly bool useRealNotifier;
        public RecordingHabitacionEstadoNotifier Notifier { get; } = new();

        public RoomApiFactory(bool useRealNotifier = false) => this.useRealNotifier = useRealNotifier;

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
                if (!useRealNotifier) // La prueba de WebSocket usa la publicación real.
                {
                    services.RemoveAll<IHabitacionEstadoNotifier>();
                    services.AddSingleton<IHabitacionEstadoNotifier>(Notifier);
                }
            });
        }

        public async Task<string> SeedAsync(bool patientActive = true, bool grantPermissions = true)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            db.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, Username = "habitaciones.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            db.Sucursales.Add(new Sucursal { IdSucursal = 1, Nombre = "Prueba", Activa = true });
            db.Pacientes.Add(new Paciente
            {
                IdPaciente = 1, Nombres = "Prueba", Apellidos = "Paciente",
                FechaNacimiento = new DateOnly(2000, 1, 1),
                FechaRegistro = DateTime.UtcNow, Activo = patientActive
            });
            if (grantPermissions)
            {
                foreach (var module in new[] { "Habitaciones", "AsignacionesHabitacion" })
                    db.Permisos.Add(new Permiso
                    {
                        IdRol = 1, Modulo = module,
                        PuedeConsultar = true, PuedeCrear = true,
                        PuedeModificar = true, PuedeEliminar = true
                    });
            }
            await db.SaveChangesAsync();
            return password;
        }
    }

    private sealed class RecordingHabitacionEstadoNotifier : IHabitacionEstadoNotifier
    {
        public ConcurrentQueue<(int HabitacionId, string Estado)> Events { get; } = new();

        public Task PublicarAsync(int habitacionId, string estado)
        {
            Events.Enqueue((habitacionId, estado));
            return Task.CompletedTask;
        }
    }
}
