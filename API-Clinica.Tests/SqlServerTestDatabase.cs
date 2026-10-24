using System.Security.Cryptography;
using System.Text.RegularExpressions;
using API_Clinica.Data;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Xunit.Sdk;

namespace API_Clinica.Tests;

internal sealed class SqlServerTestDatabase : IAsyncDisposable
{
    private const string LocalServer = @".\SQLEXPRESS";
    private const string InvVentScope = "INV-VENT-SQL-01";
    private const string InvVentPrefix = "APIClinica_INVVENT_SQL01_";
    private const string HabSigScope = "HAB-SIG-QA-01";
    private const string HabSigPrefix = "APIClinica_HABSIG_QA01_";
    private readonly bool invVentScope =
        Environment.GetEnvironmentVariable("CLINICA_SQL_TEST_SCOPE") == InvVentScope;
    private readonly bool habSigScope =
        Environment.GetEnvironmentVariable("CLINICA_SQL_TEST_SCOPE") == HabSigScope;
    private bool RestrictedScope => invVentScope || habSigScope;
    private readonly string databaseName;
    private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private bool created;
    private int? createdDatabaseId;
    private Guid? createdBrokerGuid;

    private SqlServerTestDatabase()
    {
        databaseName = (invVentScope ? InvVentPrefix : habSigScope ? HabSigPrefix : "APIClinica_B4_") +
            Guid.NewGuid().ToString("N");
    }

    public string ConnectionString => ConnectionStringFor(databaseName);
    public int IdLote { get; private set; }
    public int IdMedicamento { get; private set; }
    public int IdServicio { get; private set; }
    public int IdSucursal { get; private set; }
    public int IdPaciente { get; private set; }
    public int IdUsuario { get; private set; }
    public string Password { get; private set; } = string.Empty;

    public static async Task<SqlServerTestDatabase> CreateAsync()
    {
        if (Environment.GetEnvironmentVariable("CLINICA_SQL_INTEGRATION") != "1")
            throw SkipException.ForSkip(
                "Prueba SQL aislada: establecer CLINICA_SQL_INTEGRATION=1 con SQLEXPRESS local disponible.");
        if (Environment.GetEnvironmentVariable("CLINICA_SQL_TEST_SCOPE") == InvVentScope &&
            Environment.GetEnvironmentVariable("CLINICA_INVVENT_SQL01_AUTHORIZED") != "1")
            throw SkipException.ForSkip(
                "INV-VENT-SQL-01 requiere autorización específica para crear y eliminar bases temporales.");
        if (Environment.GetEnvironmentVariable("CLINICA_SQL_TEST_SCOPE") == HabSigScope &&
            Environment.GetEnvironmentVariable("CLINICA_HABSIG_QA01_AUTHORIZED") != "1")
            throw SkipException.ForSkip(
                "HAB-SIG-QA-01 requiere autorización específica para crear y eliminar bases temporales.");

        var database = new SqlServerTestDatabase();
        try
        {
            await database.InitializeAsync();
            return database;
        }
        catch
        {
            await database.DisposeAsync();
            throw;
        }
    }

    public WebApplicationFactory<Program> CreateFactory(
        IInterceptor? interceptor = null, IHabitacionEstadoNotifier? notifier = null) =>
        new SqlApiFactory(ConnectionString, signingKey, interceptor, notifier);

    public ClinicaDbContext OpenContext() => new(
        new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseSqlServer(ConnectionString).Options);

    public async Task SeedAsync(IServiceProvider services, int initialStock = 3)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var rol = new Rol { Nombre = "Pruebas SQL", Activo = true };
        var sucursal = new Sucursal { Nombre = "Sucursal sintética", Activa = true };
        var paciente = new Paciente
        {
            Nombres = "Paciente", Apellidos = "Sintético",
            FechaNacimiento = new DateOnly(1990, 1, 1),
            FechaRegistro = DateTime.UtcNow, Activo = true
        };
        var categoria = new Categoria { Nombre = "Categoría sintética", Activa = true };
        var marca = new Marca { Nombre = "Marca sintética", Activa = true };
        var servicio = new Servicio
        {
            Codigo = "SERV-SQL", Nombre = "Consulta sintética",
            TipoServicio = "Consulta", PrecioBase = 100m, Activo = true
        };
        db.AddRange(rol, sucursal, paciente, categoria, marca, servicio);
        await db.SaveChangesAsync();

        var usuario = new Usuario
        {
            IdRol = rol.IdRol, Username = "sql.prueba", Activo = true
        };
        Password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        usuario.PasswordHash = hasher.HashPassword(usuario, Password);
        var medicamento = new Medicamento
        {
            IdCategoria = categoria.IdCategoria, IdMarca = marca.IdMarca,
            Codigo = "MED-SQL", Nombre = "Medicamento sintético",
            PrecioVenta = 12.50m, Activo = true
        };
        db.AddRange(usuario, medicamento);
        await db.SaveChangesAsync();

        db.Permisos.AddRange(
            new Permiso { IdRol = rol.IdRol, Modulo = "Ventas",
                PuedeConsultar = true, PuedeCrear = true },
            new Permiso { IdRol = rol.IdRol, Modulo = "Facturas",
                PuedeConsultar = true, PuedeCrear = true });
        var lote = new LoteMedicamento
        {
            IdMedicamento = medicamento.IdMedicamento, NumeroLote = "LOT-SQL-1",
            FechaIngreso = today.AddDays(-5), FechaVencimiento = today.AddDays(10),
            CantidadDisponible = initialStock
        };
        db.LoteMedicamentos.Add(lote);
        await db.SaveChangesAsync();

        IdLote = lote.IdLote;
        IdMedicamento = medicamento.IdMedicamento;
        IdServicio = servicio.IdServicio;
        IdSucursal = sucursal.IdSucursal;
        IdPaciente = paciente.IdPaciente;
        IdUsuario = usuario.IdUsuario;
    }

    public async Task<int> AddLotAsync(int stock, int daysToExpiry, int daysSinceEntry)
    {
        await using var db = OpenContext();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var lote = new LoteMedicamento
        {
            IdMedicamento = IdMedicamento,
            NumeroLote = "LOT-SQL-" + Guid.NewGuid().ToString("N")[..12],
            FechaIngreso = today.AddDays(-daysSinceEntry),
            FechaVencimiento = today.AddDays(daysToExpiry),
            CantidadDisponible = stock
        };
        db.LoteMedicamentos.Add(lote);
        await db.SaveChangesAsync();
        return lote.IdLote;
    }

    public async Task ExecuteAsync(string sql)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection);
        await command.ExecuteNonQueryAsync();
    }

    private async Task InitializeAsync()
    {
        await using (var master = new SqlConnection(ConnectionStringFor("master")))
        {
            await master.OpenAsync();
            if (RestrictedScope)
            {
                var before = await CheckScopedTargetAsync(master);
                if (before.DatabaseId is not null)
                    throw new InvalidOperationException("La base temporal ya existe; no se sobrescribirá.");
            }
            await using var localCheck = new SqlCommand(
                "SELECT CONVERT(nvarchar(128), SERVERPROPERTY('MachineName'))", master);
            var machine = (string?)await localCheck.ExecuteScalarAsync();
            if (!string.Equals(machine, Environment.MachineName, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Las pruebas requieren SQL Server en este equipo.");

            // El nombre contiene exclusivamente un prefijo fijo y un GUID generado para esta ejecución.
            await using var create = new SqlCommand($"CREATE DATABASE [{databaseName}]", master);
            await create.ExecuteNonQueryAsync();
            created = true;
            if (RestrictedScope)
            {
                var after = await CheckScopedTargetAsync(master);
                createdDatabaseId = after.DatabaseId ??
                    throw new InvalidOperationException("No se pudo verificar la base temporal creada.");
                createdBrokerGuid = after.BrokerGuid ??
                    throw new InvalidOperationException("No se pudo identificar la base temporal creada.");
            }
        }

        await using var context = OpenContext();
        var script = context.Database.GenerateCreateScript();
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        foreach (var batch in Regex.Split(script, @"(?im)^[ \t]*GO[ \t]*(?:\r?\n|$)"))
        {
            if (string.IsNullOrWhiteSpace(batch)) continue;
            await using var command = new SqlCommand(batch, connection);
            command.CommandTimeout = 60;
            await command.ExecuteNonQueryAsync();
        }
    }

    public async ValueTask DisposeAsync()
    {
        if (!created) return;
        SqlConnection.ClearAllPools();
        await using var master = new SqlConnection(ConnectionStringFor("master"));
        await master.OpenAsync();
        if (RestrictedScope)
        {
            for (var attempt = 0; ; attempt++)
            {
                var current = await CheckScopedTargetAsync(master);
                if (current.DatabaseId != createdDatabaseId ||
                    current.BrokerGuid != createdBrokerGuid)
                    throw new InvalidOperationException(
                        "No se eliminará la base temporal: cambió su identidad.");
                if (current.ActiveSessions == 0) break;
                if (attempt == 9)
                    throw new InvalidOperationException(
                        "No se eliminará la base temporal: conserva sesiones activas.");
                await Task.Delay(500);
            }
            await using var safeDrop = new SqlCommand($"DROP DATABASE [{databaseName}]", master);
            await safeDrop.ExecuteNonQueryAsync();
            created = false;
            return;
        }
        await using var drop = new SqlCommand(
            $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; " +
            $"DROP DATABASE [{databaseName}]", master);
        await drop.ExecuteNonQueryAsync();
        created = false;
    }

    private async Task<(int? DatabaseId, Guid? BrokerGuid, int ActiveSessions)>
        CheckScopedTargetAsync(SqlConnection master)
    {
        var expectedPrefix = invVentScope ? InvVentPrefix : HabSigPrefix;
        if (!RestrictedScope || !Regex.IsMatch(databaseName,
            $@"^{expectedPrefix}[0-9a-f]{{32}}$"))
            throw new InvalidOperationException("Nombre de base temporal no autorizado.");

        const string sql = """
            SELECT CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')),
                   CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')),
                   CONVERT(int, SERVERPROPERTY('EngineEdition')),
                   ORIGINAL_LOGIN(), d.database_id, d.service_broker_guid,
                   (SELECT COUNT(*) FROM sys.dm_exec_sessions s
                    WHERE s.database_id = d.database_id AND s.session_id <> @@SPID)
            FROM (SELECT 1 AS marker) AS marker
            LEFT JOIN sys.databases d ON d.name = @name;
            """;
        await using var check = new SqlCommand(sql, master);
        check.Parameters.AddWithValue("@name", databaseName);
        await using var reader = await check.ExecuteReaderAsync();
        if (!await reader.ReadAsync() ||
            !string.Equals(reader.GetString(0), "DESKTOP-QTDJOHF", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(reader.GetString(1), "SQLEXPRESS", StringComparison.OrdinalIgnoreCase) ||
            reader.GetInt32(2) != 4 ||
            !string.Equals(reader.GetString(3), @"DESKTOP-QTDJOHF\DESARROLLO", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Servidor, edición o identidad de pruebas no autorizados.");

        return (reader.IsDBNull(4) ? null : reader.GetInt32(4),
            reader.IsDBNull(5) ? null : reader.GetGuid(5),
            reader.IsDBNull(6) ? 0 : reader.GetInt32(6));
    }

    private static string ConnectionStringFor(string databaseName) =>
        new SqlConnectionStringBuilder
        {
            DataSource = LocalServer,
            InitialCatalog = databaseName,
            IntegratedSecurity = true,
            Encrypt = true,
            TrustServerCertificate = true,
            Pooling = false,
            ConnectTimeout = 10
        }.ConnectionString;

    private sealed class SqlApiFactory(
        string connectionString, string jwtKey, IInterceptor? interceptor,
        IHabitacionEstadoNotifier? notifier)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = connectionString,
                    ["Jwt:Issuer"] = "API-Clinica.SqlTests",
                    ["Jwt:Audience"] = "API-Clinica.SqlTests.Client",
                    ["Jwt:SigningKey"] = jwtKey,
                    ["Jwt:ExpirationMinutes"] = "60",
                    ["Logging:EventLog:LogLevel:Default"] = "None"
                }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<ClinicaDbContext>>();
                services.RemoveAll<ClinicaDbContext>();
                services.AddDbContext<ClinicaDbContext>(options =>
                {
                    options.UseSqlServer(connectionString);
                    if (interceptor is not null) options.AddInterceptors(interceptor);
                });
                if (notifier is not null)
                {
                    services.RemoveAll<IHabitacionEstadoNotifier>();
                    services.AddSingleton(notifier);
                }
            });
        }
    }
}
