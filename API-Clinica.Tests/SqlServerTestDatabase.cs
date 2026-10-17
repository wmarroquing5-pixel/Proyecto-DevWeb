using System.Security.Cryptography;
using System.Text.RegularExpressions;
using API_Clinica.Data;
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
    private readonly string databaseName = "APIClinica_B4_" + Guid.NewGuid().ToString("N");
    private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private bool created;

    private SqlServerTestDatabase() { }

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

    public WebApplicationFactory<Program> CreateFactory(IInterceptor? interceptor = null) =>
        new SqlApiFactory(ConnectionString, signingKey, interceptor);

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
            await using var localCheck = new SqlCommand(
                "SELECT CONVERT(nvarchar(128), SERVERPROPERTY('MachineName'))", master);
            var machine = (string?)await localCheck.ExecuteScalarAsync();
            if (!string.Equals(machine, Environment.MachineName, StringComparison.OrdinalIgnoreCase))
                throw new InvalidOperationException("Las pruebas requieren SQL Server en este equipo.");

            // El nombre contiene exclusivamente un prefijo fijo y un GUID generado para esta ejecución.
            await using var create = new SqlCommand($"CREATE DATABASE [{databaseName}]", master);
            await create.ExecuteNonQueryAsync();
            created = true;
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
        created = false;
        SqlConnection.ClearAllPools();
        await using var master = new SqlConnection(ConnectionStringFor("master"));
        await master.OpenAsync();
        await using var drop = new SqlCommand(
            $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; " +
            $"DROP DATABASE [{databaseName}]", master);
        await drop.ExecuteNonQueryAsync();
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
        string connectionString, string jwtKey, IInterceptor? interceptor)
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
            });
        }
    }
}
