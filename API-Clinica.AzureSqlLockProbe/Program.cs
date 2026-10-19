using System.Data;
using System.Globalization;
using System.Text.Json;
using Microsoft.Data.SqlClient;

return await AzureSqlLockProbe.RunAsync(args);

internal static class AzureSqlLockProbe
{
    private const string ExecuteArgument = "--execute-production-lock-probe";
    private const string AuthorizationVariable = "AZURESQL_LOCK_PROBE_AUTHORIZATION";
    private const string AuthorizationValue = "API-12G5-AUTHORIZED";
    private const string ExpectedServer = "tcp:srwemg.database.windows.net,1433";
    private const string ExpectedDatabase = "db_Clinica";
    private const string UserSecretsId = "677db73a-e9ea-4302-b910-6a385ddf4de0";
    private const int FirstWaitMilliseconds = 1_000;
    private const int SecondWaitMilliseconds = 5_000;

    public static async Task<int> RunAsync(string[] args)
    {
        if (args.Length == 0)
        {
            Write(new { status = "PREPARATION_ONLY", remoteOperations = false });
            return 0;
        }

        if (args.Length != 1 || !string.Equals(args[0], ExecuteArgument, StringComparison.Ordinal))
        {
            Write(new { status = "INVALID_ARGUMENT", remoteOperations = false });
            return 2;
        }

        if (!string.Equals(
                Environment.GetEnvironmentVariable(AuthorizationVariable),
                AuthorizationValue,
                StringComparison.Ordinal))
        {
            Write(new { status = "EXPLICIT_AUTHORIZATION_REQUIRED", remoteOperations = false });
            return 3;
        }

        var connectionString = await ReadConnectionStringAsync();
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            Write(new { status = "CONFIGURATION_MISSING", remoteOperations = false });
            return 4;
        }

        var builder = new SqlConnectionStringBuilder(connectionString)
        {
            ConnectTimeout = 30,
            ConnectRetryCount = 0
        };
        if (!string.Equals(builder.DataSource, ExpectedServer, StringComparison.OrdinalIgnoreCase) ||
            !string.Equals(builder.InitialCatalog, ExpectedDatabase, StringComparison.Ordinal) ||
            !builder.Encrypt || builder.TrustServerCertificate)
        {
            Write(new { status = "DESTINATION_OR_TLS_MISMATCH", remoteOperations = false });
            return 5;
        }

        var runId = Guid.NewGuid().ToString("N", CultureInfo.InvariantCulture);
        var resource = $"API-Clinica:Foto:{runId}/foto.webp";
        var heldByA = false;
        var heldByB = false;
        await using var connectionA = new SqlConnection(builder.ConnectionString);
        await using var connectionB = new SqlConnection(builder.ConnectionString);

        try
        {
            await connectionA.OpenAsync();
            var currentDatabase = await GetCurrentDatabaseAsync(connectionA);
            if (!string.Equals(currentDatabase, ExpectedDatabase, StringComparison.Ordinal))
                throw new InvalidOperationException("La conexión A no abrió la base esperada.");

            var firstAcquireA = await AcquireAsync(
                connectionA, resource, SecondWaitMilliseconds, CancellationToken.None);
            EnsureAcquired(firstAcquireA, "A");
            heldByA = true;

            await connectionB.OpenAsync();
            var firstAcquireB = await AcquireAsync(
                connectionB, resource, FirstWaitMilliseconds, CancellationToken.None);
            if (firstAcquireB != -1)
            {
                if (firstAcquireB >= 0)
                    heldByB = true;
                throw new InvalidOperationException(
                    "La conexión B no respetó la exclusividad esperada.");
            }

            var releaseA = await ReleaseAsync(connectionA, resource, CancellationToken.None);
            EnsureReleased(releaseA, "A");
            heldByA = false;

            var secondAcquireB = await AcquireAsync(
                connectionB, resource, SecondWaitMilliseconds, CancellationToken.None);
            EnsureAcquired(secondAcquireB, "B");
            heldByB = true;

            var releaseB = await ReleaseAsync(connectionB, resource, CancellationToken.None);
            EnsureReleased(releaseB, "B");
            heldByB = false;

            Write(new
            {
                status = "LOCK_PROBE_SUCCEEDED",
                database = currentDatabase,
                runId,
                connectionAAcquireCode = firstAcquireA,
                connectionBBlockedCode = firstAcquireB,
                connectionAReleaseCode = releaseA,
                connectionBAcquireCode = secondAcquireB,
                connectionBReleaseCode = releaseB
            });
            return 0;
        }
        catch (SqlException exception)
        {
            Write(new
            {
                status = "SQL_FAILURE",
                exception.Number,
                exception.Class,
                exception.State,
                exception.ClientConnectionId
            });
            return 6;
        }
        catch (Exception exception)
        {
            Write(new
            {
                status = "PROBE_FAILURE",
                exceptionType = exception.GetType().FullName
            });
            return 7;
        }
        finally
        {
            if (heldByB && connectionB.State == ConnectionState.Open)
                await TryReleaseAsync(connectionB, resource, "B");
            if (heldByA && connectionA.State == ConnectionState.Open)
                await TryReleaseAsync(connectionA, resource, "A");
            await connectionB.CloseAsync();
            await connectionA.CloseAsync();
        }
    }

    private static async Task<string?> ReadConnectionStringAsync()
    {
        var environmentValue =
            Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnection");
        if (!string.IsNullOrWhiteSpace(environmentValue))
            return environmentValue;

        var secretsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "Microsoft", "UserSecrets", UserSecretsId, "secrets.json");
        if (!File.Exists(secretsPath))
            return null;

        using var document = JsonDocument.Parse(
            await File.ReadAllTextAsync(secretsPath));
        if (document.RootElement.TryGetProperty(
                "ConnectionStrings:DefaultConnection", out var flatValue))
            return flatValue.GetString();
        if (document.RootElement.TryGetProperty("ConnectionStrings", out var section) &&
            section.TryGetProperty("DefaultConnection", out var nestedValue))
            return nestedValue.GetString();
        return null;
    }

    private static async Task<string?> GetCurrentDatabaseAsync(SqlConnection connection)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT DB_NAME();";
        command.CommandTimeout = 15;
        return Convert.ToString(
            await command.ExecuteScalarAsync(), CultureInfo.InvariantCulture);
    }

    private static async Task<int> AcquireAsync(
        SqlConnection connection,
        string resource,
        int timeoutMilliseconds,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock
                @Resource = @resource,
                @LockMode = 'Exclusive',
                @LockOwner = 'Session',
                @LockTimeout = @timeout;
            SELECT @result;
            """;
        command.CommandTimeout = 10;
        command.Parameters.Add(new SqlParameter("@resource", SqlDbType.NVarChar, 255)
        {
            Value = resource
        });
        command.Parameters.Add(new SqlParameter("@timeout", SqlDbType.Int)
        {
            Value = timeoutMilliseconds
        });
        return Convert.ToInt32(
            await command.ExecuteScalarAsync(cancellationToken),
            CultureInfo.InvariantCulture);
    }

    private static async Task<int> ReleaseAsync(
        SqlConnection connection,
        string resource,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = """
            DECLARE @result int;
            EXEC @result = sys.sp_releaseapplock
                @Resource = @resource,
                @LockOwner = 'Session';
            SELECT @result;
            """;
        command.CommandTimeout = 10;
        command.Parameters.Add(new SqlParameter("@resource", SqlDbType.NVarChar, 255)
        {
            Value = resource
        });
        return Convert.ToInt32(
            await command.ExecuteScalarAsync(cancellationToken),
            CultureInfo.InvariantCulture);
    }

    private static void EnsureAcquired(int result, string connectionName)
    {
        if (result < 0)
            throw new InvalidOperationException(
                $"La conexión {connectionName} no adquirió el bloqueo.");
    }

    private static void EnsureReleased(int result, string connectionName)
    {
        if (result < 0)
            throw new InvalidOperationException(
                $"La conexión {connectionName} no liberó el bloqueo.");
    }

    private static async Task TryReleaseAsync(
        SqlConnection connection,
        string resource,
        string connectionName)
    {
        try
        {
            var result = await ReleaseAsync(connection, resource, CancellationToken.None);
            Write(new
            {
                status = "FINALLY_RELEASE",
                connection = connectionName,
                releaseSucceeded = result >= 0,
                releaseCode = result
            });
        }
        catch (Exception exception)
        {
            Write(new
            {
                status = "FINALLY_RELEASE_FAILED",
                connection = connectionName,
                exceptionType = exception.GetType().FullName
            });
        }
    }

    private static void Write(object value) =>
        Console.WriteLine(JsonSerializer.Serialize(value));
}
