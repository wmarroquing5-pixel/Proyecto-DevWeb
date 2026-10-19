using System.Diagnostics;
using API_Clinica.R2ProductionSmokeTest;

const string ExecuteFlag = "--execute-production-smoke-test";

if (args.Length > 1 || (args.Length == 1 && args[0] is not ExecuteFlag and not "--help"))
{
    Console.Error.WriteLine("Argumentos no reconocidos. Use --help.");
    return 2;
}

if (args is ["--help"])
{
    PrintUsage();
    return 0;
}

var executionAuthorized = args is [ExecuteFlag];
var options = ProductionR2Options.FromEnvironment();
var status = options.Validate();

Console.WriteLine("API-Clinica R2 Production Smoke Test");
Console.WriteLine($"R2__AccountId={(string.IsNullOrWhiteSpace(options.AccountId) ? "ausente" : "presente")}");
Console.WriteLine($"R2__AccessKeyId={(string.IsNullOrWhiteSpace(options.AccessKeyId) ? "ausente" : "presente")}");
Console.WriteLine($"R2__SecretAccessKey={(string.IsNullOrWhiteSpace(options.SecretAccessKey) ? "ausente" : "presente")}");
Console.WriteLine($"R2__BucketName={(string.IsNullOrWhiteSpace(options.BucketName) ? "ausente" : "presente")}");
Console.WriteLine($"Estado de configuración: {(status.IsReady ? "LISTA" : "BLOQUEADA")}.");
Console.WriteLine(status.Message);
Console.WriteLine($"Operaciones remotas: {(executionAuthorized ? "SOLICITADAS" : "BLOQUEADAS")}.");

if (!status.IsReady)
    return 2;

if (!executionAuthorized)
{
    Console.WriteLine("Modo seguro: no se creó un cliente S3 ni se realizó ninguna conexión remota.");
    PrintUsage();
    return 0;
}

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};

try
{
    using var runner = new ProductionR2SmokeTestRunner(options);
    return await runner.RunAsync(cancellation.Token);
}
catch (Exception exception)
{
    Console.Error.WriteLine(
        $"INICIALIZACION_FALLIDA: tipo={exception.GetType().Name}; ubicación={GetSafeLocation(exception)}; " +
        "cliente-creado=False; solicitud-remota-enviada=False; estado-remoto=SIN_ESCRITURAS.");
    return 6;
}

static void PrintUsage()
{
    Console.WriteLine("Variables requeridas: R2__AccountId, R2__AccessKeyId, R2__SecretAccessKey y R2__BucketName=clinica-fotos.");
    Console.WriteLine("La ejecución real exige autorización expresa y el indicador --execute-production-smoke-test.");
}

static string GetSafeLocation(Exception exception)
{
    var frame = new StackTrace(exception, true).GetFrames()?
        .FirstOrDefault(candidate => candidate.GetFileLineNumber() > 0);
    return frame is null
        ? "no-disponible"
        : $"{Path.GetFileName(frame.GetFileName())}:{frame.GetFileLineNumber()}";
}
