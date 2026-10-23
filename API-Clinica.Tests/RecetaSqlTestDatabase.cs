using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using API_Clinica.Data;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;

namespace API_Clinica.Tests;

internal sealed class RecetaSqlTestDatabase : IAsyncDisposable
{
    private const string Server = @".\SQLEXPRESS";
    private const string Prefix = "APIClinica_TratReceta_";
    private const string BaseHash = "12F94878902F74C817C4DCA95EF91DF6FBE8047F193F0DC350160BE9A0335614";
    private const string ClinicalHash = "7991A8FF9206C937F50700F001D0795DC5C601117B63B74AC697310595C81432";
    private readonly string databaseName = Prefix + Guid.NewGuid().ToString("N");
    private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
    private bool created;

    private RecetaSqlTestDatabase() { }
    public string DatabaseName => databaseName;
    public string ConnectionString => ConnectionStringFor(databaseName);
    public const int ConsultaAbierta = 1, ConsultaSeguimiento = 2, ConsultaCerrada = 3, ConsultaAjena = 4;
    public const int DiagnosticoAbierto = 1, DiagnosticoSeguimiento = 2, DiagnosticoCerrado = 3, DiagnosticoAjeno = 4;
    public const int MedicamentoUno = 1, MedicamentoDos = 2;

    public static async Task<RecetaSqlTestDatabase> CreateAsync()
    {
        if (Environment.GetEnvironmentVariable("CLINICA_SQL_INTEGRATION") != "1")
            throw new InvalidOperationException("La integración SQL solo se ejecuta con CLINICA_SQL_INTEGRATION=1.");
        var fixture = new RecetaSqlTestDatabase();
        try { await fixture.InitializeAsync(); return fixture; }
        catch { await fixture.DisposeAsync(); throw; }
    }

    public WebApplicationFactory<Program> CreateFactory(IInterceptor? interceptor = null) =>
        new LocalApiFactory(ConnectionString, signingKey, interceptor);

    public string Token(WebApplicationFactory<Program> factory, int idUsuario, int idRol, int idEmpleado)
    {
        var service = factory.Services.GetRequiredService<IJwtTokenService>();
        return service.CreateToken(new Usuario
        {
            IdUsuario = idUsuario, IdRol = idRol, IdEmpleado = idEmpleado,
            Username = "medico." + idUsuario, Activo = true
        }).AccessToken;
    }

    public async Task<int> ScalarAsync(string sql)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection);
        return Convert.ToInt32(await command.ExecuteScalarAsync());
    }

    public async Task ExecuteAsync(string sql)
    {
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(sql, connection) { CommandTimeout = 60 };
        await command.ExecuteNonQueryAsync();
    }

    private async Task InitializeAsync()
    {
        ValidateName();
        // La comprobación de la instancia ocurre antes de CREATE y otra vez antes de DROP.
        await using (var master = new SqlConnection(ConnectionStringFor("master")))
        {
            await master.OpenAsync();
            await CheckServerAsync(master, "master");
            await using var existing = new SqlCommand("SELECT COUNT(*) FROM sys.databases WHERE name = @name", master);
            existing.Parameters.AddWithValue("@name", databaseName);
            if (Convert.ToInt32(await existing.ExecuteScalarAsync()) != 0)
                throw new InvalidOperationException("La base temporal ya existe.");
            await using var create = new SqlCommand($"CREATE DATABASE [{databaseName}]", master);
            await create.ExecuteNonQueryAsync();
            created = true;
        }

        await using var local = new SqlConnection(ConnectionString);
        await local.OpenAsync();
        await CheckServerAsync(local, databaseName);
        var root = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        var baseSql = VerifiedBody(Path.Combine(root, "WEB-TRAT-06B", "ESQUEMA-SINTETICO-REVISADO.sql"),
            BaseHash, "CREATE TABLE dbo.Sucursal (", 14);
        var clinicalSql = VerifiedBody(Path.Combine(root, "WEB-TRAT-06B", "DDL-ALTERNATIVA-C.sql"),
            ClinicalHash, "CREATE TABLE dbo.RecetaClinica (", 6);
        await ExecuteAsync(baseSql);
        await ExecuteAsync(File.ReadAllText(Path.Combine(root, "API-TRAT-03", "ESQUEMA-APOYO-API.sql")));
        await ExecuteAsync(clinicalSql);
        // Solo en la base efímera ya verificada: simula el contrato propuesto
        // sin editar ni ejecutar el DDL histórico o el script para Azure.
        await ExecuteAsync("""
            ALTER TABLE dbo.RecetaLinea DROP CONSTRAINT CK_RecetaLinea_Cantidades;
            ALTER TABLE dbo.RecetaLinea DROP CONSTRAINT CK_RecetaLinea_Texto;
            ALTER TABLE dbo.RecetaLinea ALTER COLUMN UnidadInventario nvarchar(30) NULL;
            ALTER TABLE dbo.RecetaLinea ALTER COLUMN Dosis decimal(12,3) NULL;
            ALTER TABLE dbo.RecetaLinea ALTER COLUMN UnidadDosis nvarchar(30) NULL;
            ALTER TABLE dbo.RecetaLinea ALTER COLUMN Via nvarchar(40) NULL;
            ALTER TABLE dbo.RecetaLinea ALTER COLUMN Frecuencia nvarchar(100) NULL;
            ALTER TABLE dbo.RecetaLinea ALTER COLUMN DuracionDias smallint NULL;
            ALTER TABLE dbo.RecetaLinea WITH CHECK ADD CONSTRAINT CK_RecetaLinea_Cantidades
                CHECK (Orden > 0 AND CantidadPrescritaUnidades > 0 AND Dosis > 0 AND DuracionDias > 0);
            ALTER TABLE dbo.RecetaLinea WITH CHECK ADD CONSTRAINT CK_RecetaLinea_Texto
                CHECK (LEN(TRIM(UnidadInventario)) > 0
                       AND LEN(TRIM(UnidadDosis)) > 0
                       AND LEN(TRIM(Via)) > 0
                       AND LEN(TRIM(Frecuencia)) > 0);
            """);
        await SeedAsync();
    }

    private static string VerifiedBody(string path, string expectedHash, string marker, int tableCount)
    {
        var bytes = File.ReadAllBytes(path);
        if (!Convert.ToHexString(SHA256.HashData(bytes)).Equals(expectedHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException($"Cambió el DDL fuente: {Path.GetFileName(path)}");
        var source = Encoding.UTF8.GetString(bytes);
        if (!source.Contains("THROW ", StringComparison.Ordinal))
            throw new InvalidOperationException("El DDL fuente perdió su barrera.");
        var index = source.IndexOf(marker, StringComparison.Ordinal);
        if (index < 0) throw new InvalidOperationException("No se encontró el inicio del DDL verificado.");
        var body = source[index..];
        if (Regex.Matches(body, @"(?im)^CREATE TABLE dbo\.").Count != tableCount ||
            Regex.IsMatch(body, @"(?im)^\s*(GO\s*$|CREATE\s+DATABASE\b|USE\s+\[)", RegexOptions.IgnoreCase))
            throw new InvalidOperationException("El DDL fuente no coincide con el número o alcance esperado.");
        return body;
    }

    private static async Task CheckServerAsync(SqlConnection connection, string expectedDatabase)
    {
        await using var command = new SqlCommand("SELECT CONVERT(nvarchar(128), SERVERPROPERTY('MachineName')), " +
            "CONVERT(nvarchar(128), SERVERPROPERTY('InstanceName')), " +
            "CONVERT(int, SERVERPROPERTY('EngineEdition')), DB_NAME()", connection);
        await using var reader = await command.ExecuteReaderAsync();
        if (!await reader.ReadAsync() ||
            !string.Equals(reader.GetString(0), "DESKTOP-QTDJOHF", StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(reader.GetString(0), Environment.MachineName, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(reader.GetString(1), "SQLEXPRESS", StringComparison.OrdinalIgnoreCase) ||
            reader.GetInt32(2) != 4 ||
            !string.Equals(reader.GetString(3), expectedDatabase, StringComparison.Ordinal))
            throw new InvalidOperationException("La conexión no corresponde a SQL Server Express local autorizado.");
    }

    private void ValidateName()
    {
        if (!Regex.IsMatch(databaseName, @"^APIClinica_TratReceta_[0-9a-f]{32}$", RegexOptions.CultureInvariant))
            throw new InvalidOperationException("Nombre de base temporal no autorizado.");
    }

    private async Task SeedAsync()
    {
        // Solo identidades y entidades sintéticas; ninguna fila procede de Azure.
        await ExecuteAsync("""
            INSERT dbo.Sucursal DEFAULT VALUES;
            INSERT dbo.Paciente DEFAULT VALUES;
            INSERT dbo.Rol (Nombre, Activo) VALUES (N'Medicos de prueba',1),(N'Sin permiso',1);
            INSERT dbo.Empleado (IdSucursal,Nombres,Apellidos,DPI,TipoEmpleado,Activo)
                VALUES (1,N'Médico',N'Uno',N'SYN-001',N'Medico',1),
                       (1,N'Médico',N'Dos',N'SYN-002',N'Medico',1);
            INSERT dbo.Usuario (IdRol,IdEmpleado,Username,PasswordHash,Activo)
                VALUES (1,1,N'medico.1',N'No se utiliza',1),
                       (1,2,N'medico.2',N'No se utiliza',1),
                       (2,1,N'medico.3',N'No se utiliza',1);
            INSERT dbo.Permiso (IdRol,Modulo,PuedeConsultar,PuedeCrear,PuedeModificar,PuedeEliminar)
                VALUES (1,N'Historial',1,1,0,0);
            INSERT dbo.Consulta (IdPaciente,IdMedico,IdSucursal,FechaConsulta,MotivoConsulta,EstadoConsulta)
                VALUES (1,1,1,SYSUTCDATETIME(),N'Prueba abierta',N'Abierta'),
                       (1,1,1,SYSUTCDATETIME(),N'Prueba seguimiento',N'En seguimiento'),
                       (1,1,1,SYSUTCDATETIME(),N'Prueba cerrada',N'Cerrada'),
                       (1,2,1,SYSUTCDATETIME(),N'Prueba ajena',N'Abierta');
            INSERT dbo.Diagnostico (IdConsulta,Descripcion)
                VALUES (1,N'Diagnóstico sintético A'),(2,N'Diagnóstico sintético B'),
                       (3,N'Diagnóstico sintético C'),(4,N'Diagnóstico sintético D');
            INSERT dbo.Categoria DEFAULT VALUES;
            INSERT dbo.Marca DEFAULT VALUES;
            INSERT dbo.Medicamento (IdCategoria,IdMarca,Codigo,Nombre,PrecioVenta,Activo,Presentacion)
                VALUES (1,1,N'MED-SYN-1',N'Medicamento sintético 1',12,1,N'Caja 99 x 500 mg'),
                       (1,1,N'MED-SYN-2',N'Medicamento sintético 2',15,1,N'Frasco 250 ml');
            INSERT dbo.LoteMedicamento (IdMedicamento,NumeroLote,FechaIngreso,FechaVencimiento,CantidadDisponible)
                VALUES (1,N'LOTE-SYN',DATEADD(day,-1,CONVERT(date,GETUTCDATE())),
                        DATEADD(day,30,CONVERT(date,GETUTCDATE())),25);
            """);
    }

    public async ValueTask DisposeAsync()
    {
        if (!created) return;
        ValidateName();
        SqlConnection.ClearAllPools();
        await using var master = new SqlConnection(ConnectionStringFor("master"));
        await master.OpenAsync();
        await CheckServerAsync(master, "master");
        await using var drop = new SqlCommand(
            $"ALTER DATABASE [{databaseName}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{databaseName}]", master);
        await drop.ExecuteNonQueryAsync();
        await using var verify = new SqlCommand("SELECT COUNT(*) FROM sys.databases WHERE name = @name", master);
        verify.Parameters.AddWithValue("@name", databaseName);
        if (Convert.ToInt32(await verify.ExecuteScalarAsync()) != 0)
            throw new InvalidOperationException("La base temporal sigue presente después de DROP.");
        created = false;
    }

    private static string ConnectionStringFor(string database) => new SqlConnectionStringBuilder
    {
        DataSource = Server, InitialCatalog = database, IntegratedSecurity = true,
        Encrypt = true, TrustServerCertificate = true, Pooling = false, ConnectTimeout = 10
    }.ConnectionString;

    private sealed class LocalApiFactory(string connectionString, string jwtKey, IInterceptor? interceptor)
        : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging =>
            {
                logging.ClearProviders();
                logging.AddConsole();
                logging.AddFilter("Microsoft.EntityFrameworkCore", LogLevel.None);
                logging.AddFilter("Microsoft.Hosting", LogLevel.None);
            });
            builder.ConfigureAppConfiguration((_, config) =>
                config.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = connectionString,
                    ["Jwt:Issuer"] = "API-Clinica.RecetaSqlTests",
                    ["Jwt:Audience"] = "API-Clinica.RecetaSqlTests.Client",
                    ["Jwt:SigningKey"] = jwtKey,
                    ["Jwt:ExpirationMinutes"] = "60"
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
