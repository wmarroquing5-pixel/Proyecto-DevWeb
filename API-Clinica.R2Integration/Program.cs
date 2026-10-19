using API_Clinica.R2Integration;

const string ExecuteFlag = "--execute-real-r2";

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
var options = R2TestOptions.FromEnvironment();
var status = options.Validate();

Console.WriteLine("API-Clinica R2 Integration Runner");
Console.WriteLine($"Campos R2TEST presentes: {status.PresentFieldCount}/4.");
Console.WriteLine($"Estado de configuración: {status.State}.");
Console.WriteLine(status.Message);
Console.WriteLine($"Operaciones remotas: {(executionAuthorized ? "SOLICITADAS" : "BLOQUEADAS")}.");

if (status.State == R2TestConfigurationState.Invalid)
    return 2;

if (!executionAuthorized)
{
    Console.WriteLine("Modo preparación: no se creó un cliente S3 ni se realizó ninguna conexión remota.");
    PrintUsage();
    return 0;
}

if (status.State != R2TestConfigurationState.Ready)
{
    Console.Error.WriteLine("La ejecución real requiere los cuatro valores R2TEST.");
    return 2;
}

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};

using var runner = new R2IntegrationRunner(options);
return await runner.RunAsync(cancellation.Token);

static void PrintUsage()
{
    Console.WriteLine("Variables requeridas para una ejecución futura:");
    Console.WriteLine("  R2TEST__AccountId");
    Console.WriteLine("  R2TEST__AccessKeyId");
    Console.WriteLine("  R2TEST__SecretAccessKey");
    Console.WriteLine("  R2TEST__BucketName (debe ser distinto de clinica-fotos)");
    Console.WriteLine("Ejecución remota, únicamente con autorización: --execute-real-r2");
}
