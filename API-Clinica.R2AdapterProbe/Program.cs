using API_Clinica.R2AdapterProbe;
using API_Clinica.Services;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

var gate = ProbeExecutionGate.Evaluate(args, Environment.GetEnvironmentVariable);
Console.WriteLine($"status={gate.Status}; remote-operations={gate.CanExecute.ToString().ToLowerInvariant()}");

if (!gate.CanExecute)
{
    if (gate.Status == "PREPARATION_ONLY")
    {
        Console.WriteLine(
            "Modo seguro: no se leyó configuración R2, no se creó cliente S3 y no hubo conexiones.");
    }
    return gate.ExitCode;
}

var r2Options = R2AdapterProbeOptions.FromEnvironment(
    Environment.GetEnvironmentVariable);
Console.WriteLine($"R2__AccountId={(string.IsNullOrWhiteSpace(r2Options.AccountId) ? "ausente" : "presente")}");
Console.WriteLine($"R2__AccessKeyId={(string.IsNullOrWhiteSpace(r2Options.AccessKeyId) ? "ausente" : "presente")}");
Console.WriteLine($"R2__SecretAccessKey={(string.IsNullOrWhiteSpace(r2Options.SecretAccessKey) ? "ausente" : "presente")}");
Console.WriteLine($"R2__BucketName={(string.IsNullOrWhiteSpace(r2Options.BucketName) ? "ausente" : "presente")}");

if (!R2AdapterProbeOptions.IsReady(r2Options))
{
    Console.Error.WriteLine("status=CONFIGURATION_INVALID; remote-operations=false");
    return 5;
}

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};

using var storage = new CloudflareR2PhotoStorageService(
    Options.Create(r2Options),
    NullLogger<CloudflareR2PhotoStorageService>.Instance);
var runner = new R2AdapterProbeRunner(storage);
return await runner.RunAsync(cancellation.Token);
