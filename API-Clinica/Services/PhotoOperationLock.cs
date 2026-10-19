using System.Collections.Concurrent;
using System.Data;
using System.Data.Common;
using API_Clinica.Data;
using API_Clinica.Exceptions;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class PhotoOperationLock
{
    private const int DefaultLockTimeoutMilliseconds = 30_000;
    private readonly ClinicaDbContext context;
    private readonly PhotoOperationLockRegistry localRegistry;
    private readonly ILogger<PhotoOperationLock> logger;
    private readonly int lockTimeoutMilliseconds;

    public PhotoOperationLock(
        ClinicaDbContext context,
        PhotoOperationLockRegistry localRegistry,
        ILogger<PhotoOperationLock> logger)
        : this(context, localRegistry, logger, DefaultLockTimeoutMilliseconds)
    {
    }

    internal PhotoOperationLock(
        ClinicaDbContext context,
        PhotoOperationLockRegistry localRegistry,
        ILogger<PhotoOperationLock> logger,
        int lockTimeoutMilliseconds)
    {
        this.context = context;
        this.localRegistry = localRegistry;
        this.logger = logger;
        if (lockTimeoutMilliseconds < 0)
            throw new ArgumentOutOfRangeException(nameof(lockTimeoutMilliseconds));
        this.lockTimeoutMilliseconds = lockTimeoutMilliseconds;
    }

    public async Task<IAsyncDisposable> AcquireAsync(
        string key, CancellationToken cancellationToken)
    {
        ValidatePhotoKey(key);
        if (!context.Database.IsSqlServer())
            return await localRegistry.AcquireAsync(key, cancellationToken);

        var connection = context.Database.GetDbConnection();
        var openedHere = connection.State != ConnectionState.Open;
        try
        {
            if (openedHere)
                await context.Database.OpenConnectionAsync(cancellationToken);

            var resource = $"API-Clinica:Foto:{key}";
            int result;
            try
            {
                result = await ExecuteApplicationLockAsync(
                    connection, resource, acquire: true,
                    lockTimeoutMilliseconds, cancellationToken);
            }
            catch (DbException exception) when (cancellationToken.IsCancellationRequested)
            {
                throw new OperationCanceledException(
                    "Se canceló la espera del bloqueo de fotografía.",
                    exception, cancellationToken);
            }
            if (result < 0)
            {
                if (openedHere)
                    await context.Database.CloseConnectionAsync();
                if (result == -2)
                {
                    cancellationToken.ThrowIfCancellationRequested();
                    throw new OperationCanceledException(
                        "SQL Server canceló la espera del bloqueo de fotografía.",
                        cancellationToken);
                }
                throw result is -1 or -3
                    ? new ConflictException("Otra operación está modificando la fotografía.")
                    : new ExternalDependencyException(
                        "No fue posible coordinar la operación de fotografía.");
            }

            return new SqlApplicationLockHandle(
                context, connection, resource, openedHere, logger);
        }
        catch
        {
            if (openedHere && connection.State == ConnectionState.Open)
                await context.Database.CloseConnectionAsync();
            throw;
        }
    }

    private static async Task<int> ExecuteApplicationLockAsync(
        DbConnection connection,
        string resource,
        bool acquire,
        int lockTimeoutMilliseconds,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandTimeout = 35;
        command.CommandText = acquire
            ? """
              DECLARE @result int;
              EXEC @result = sys.sp_getapplock
                  @Resource = @resource,
                  @LockMode = 'Exclusive',
                  @LockOwner = 'Session',
                  @LockTimeout = @timeout;
              SELECT @result;
              """
            : """
              DECLARE @result int;
              EXEC @result = sys.sp_releaseapplock
                  @Resource = @resource,
                  @LockOwner = 'Session';
              SELECT @result;
              """;
        AddParameter(command, "@resource", DbType.String, resource);
        if (acquire)
            AddParameter(command, "@timeout", DbType.Int32, lockTimeoutMilliseconds);
        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        if (scalar is null or DBNull)
            throw new ExternalDependencyException(
                "SQL Server no devolvió el resultado del bloqueo de fotografía.");
        return Convert.ToInt32(scalar, System.Globalization.CultureInfo.InvariantCulture);
    }

    private static void ValidatePhotoKey(string key)
    {
        var isPatient = key.StartsWith("pacientes/", StringComparison.Ordinal) &&
            key.EndsWith("/foto.webp", StringComparison.Ordinal);
        var isMedicine = key.StartsWith("medicamentos/", StringComparison.Ordinal) &&
            key.EndsWith("/foto.webp", StringComparison.Ordinal);
        if ((!isPatient && !isMedicine) || key.Contains("..", StringComparison.Ordinal) ||
            key.Contains('\\'))
            throw new ArgumentException(
                "El recurso del bloqueo no corresponde a una fotografía válida.", nameof(key));
    }

    private static void AddParameter(
        DbCommand command, string name, DbType type, object value)
    {
        var parameter = command.CreateParameter();
        parameter.ParameterName = name;
        parameter.DbType = type;
        parameter.Value = value;
        command.Parameters.Add(parameter);
    }

    private sealed class SqlApplicationLockHandle(
        ClinicaDbContext context,
        DbConnection connection,
        string resource,
        bool closeConnection,
        ILogger logger) : IAsyncDisposable
    {
        private int released;

        public async ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref released, 1) != 0)
                return;

            try
            {
                if (connection.State == ConnectionState.Open)
                {
                    var result = await ExecuteApplicationLockAsync(
                        connection, resource, acquire: false,
                        lockTimeoutMilliseconds: 0, CancellationToken.None);
                    if (result < 0)
                        logger.LogCritical(
                            "SQL Server no confirmó la liberación del bloqueo de fotografía. Código {LockResult}.",
                            result);
                }
            }
            catch (Exception exception)
            {
                logger.LogCritical(
                    "Falló la liberación del bloqueo distribuido de fotografía. Tipo {ErrorType}.",
                    exception.GetType().Name);
            }
            finally
            {
                if (closeConnection && connection.State != ConnectionState.Closed)
                    await context.Database.CloseConnectionAsync();
            }
        }
    }
}

public sealed class PhotoOperationLockRegistry
{
    private readonly ConcurrentDictionary<string, SemaphoreSlim> locks =
        new(StringComparer.Ordinal);

    public async Task<IAsyncDisposable> AcquireAsync(
        string key, CancellationToken cancellationToken)
    {
        var semaphore = locks.GetOrAdd(key, static _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync(cancellationToken);
        return new Releaser(semaphore);
    }

    private sealed class Releaser(SemaphoreSlim semaphore) : IAsyncDisposable
    {
        private int released;

        public ValueTask DisposeAsync()
        {
            if (Interlocked.Exchange(ref released, 1) == 0)
                semaphore.Release();
            return ValueTask.CompletedTask;
        }
    }
}
