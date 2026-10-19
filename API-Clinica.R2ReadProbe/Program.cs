using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Text.RegularExpressions;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

const string ExpectedBucket = "clinica-fotos";
var timeoutDuration = TimeSpan.FromSeconds(30);

var accountId = Read("R2__AccountId");
var accessKeyId = Read("R2__AccessKeyId");
var secretAccessKey = Read("R2__SecretAccessKey");
var bucketName = Read("R2__BucketName");

var values = new Dictionary<string, string>(StringComparer.Ordinal)
{
    ["R2__AccountId"] = accountId,
    ["R2__AccessKeyId"] = accessKeyId,
    ["R2__SecretAccessKey"] = secretAccessKey,
    ["R2__BucketName"] = bucketName
};

Console.WriteLine("API-Clinica R2 Production Read Probe");
foreach (var item in values)
    Console.WriteLine($"{item.Key}={(string.IsNullOrWhiteSpace(item.Value) ? "ausente" : "presente")}");

var presentCount = values.Count(item => !string.IsNullOrWhiteSpace(item.Value));
if (presentCount != values.Count)
{
    Console.Error.WriteLine($"CONFIGURACION_INCOMPLETA: {presentCount}/4 variables presentes.");
    return 2;
}

if (!Regex.IsMatch(accountId, "^[A-Za-z0-9]+$", RegexOptions.CultureInvariant))
{
    Console.Error.WriteLine("CONFIGURACION_INVALIDA: formato de Account ID no admitido.");
    return 2;
}

if (!string.Equals(bucketName, ExpectedBucket, StringComparison.Ordinal))
{
    Console.Error.WriteLine("BUCKET_RECHAZADO: el bucket no coincide exactamente con clinica-fotos.");
    return 2;
}

var endpoint = new Uri($"https://{accountId}.r2.cloudflarestorage.com", UriKind.Absolute);
if (!string.Equals(endpoint.Scheme, Uri.UriSchemeHttps, StringComparison.Ordinal))
{
    Console.Error.WriteLine("HTTPS_INVALIDO: el endpoint no utiliza HTTPS.");
    return 2;
}

using var cancellation = new CancellationTokenSource(timeoutDuration);
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};

try
{
    var dnsTimer = Stopwatch.StartNew();
    var addresses = await Dns.GetHostAddressesAsync(endpoint.Host, cancellation.Token);
    dnsTimer.Stop();
    if (addresses.Length == 0)
    {
        Console.Error.WriteLine("DNS_FALLIDO: el endpoint no devolvió direcciones.");
        return 3;
    }
    Console.WriteLine($"DNS_OK: {dnsTimer.ElapsedMilliseconds} ms.");
}
catch (SocketException)
{
    Console.Error.WriteLine("DNS_FALLIDO: no se pudo resolver el endpoint.");
    return 3;
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("DNS_TIMEOUT: la resolución excedió 30 segundos.");
    return 7;
}

var configuration = new AmazonS3Config
{
    ServiceURL = endpoint.AbsoluteUri.TrimEnd('/'),
    ForcePathStyle = true,
    AuthenticationRegion = "auto",
    MaxErrorRetry = 0,
    MaxStaleConnectionRetries = 0,
    Timeout = timeoutDuration
};

Console.WriteLine("CLIENTE_OK: HTTPS, SigV4, región auto, ForcePathStyle y cero reintentos.");

using var client = new AmazonS3Client(
    new BasicAWSCredentials(accessKeyId, secretAccessKey), configuration);

try
{
    using var requestTimeout = CancellationTokenSource.CreateLinkedTokenSource(cancellation.Token);
    requestTimeout.CancelAfter(timeoutDuration);
    var requestTimer = Stopwatch.StartNew();
    var response = await client.ListObjectsV2Async(
        new ListObjectsV2Request
        {
            BucketName = bucketName,
            MaxKeys = 1
        }, requestTimeout.Token);
    requestTimer.Stop();

    Console.WriteLine($"HTTPS_OK: HTTP {(int)response.HttpStatusCode}, {requestTimer.ElapsedMilliseconds} ms.");
    Console.WriteLine("AUTENTICACION_OK: solicitud SigV4 aceptada.");
    Console.WriteLine("AUTORIZACION_LECTURA_OK: ListObjectsV2 permitido.");
    Console.WriteLine($"CONSULTA_OK: bucket {(response.KeyCount == 0 ? "vacío" : "con objetos")}; nombres no registrados.");
    Console.WriteLine("CERO_ESCRITURAS: no se invocaron operaciones de creación, reemplazo o eliminación.");
    return 0;
}
catch (AmazonS3Exception exception) when (
    exception.StatusCode == HttpStatusCode.Unauthorized ||
    exception.ErrorCode is "InvalidAccessKeyId" or "SignatureDoesNotMatch" or "InvalidToken")
{
    Console.Error.WriteLine(
        $"AUTENTICACION_FALLIDA: HTTP {(int)exception.StatusCode}; código={SanitizeCode(exception.ErrorCode)}.");
    return 4;
}
catch (AmazonS3Exception exception) when (
    exception.StatusCode == HttpStatusCode.Forbidden || exception.ErrorCode == "AccessDenied")
{
    Console.Error.WriteLine(
        $"AUTORIZACION_DENEGADA: HTTP {(int)exception.StatusCode}; código={SanitizeCode(exception.ErrorCode)}.");
    return 5;
}
catch (AmazonS3Exception exception) when (exception.StatusCode == HttpStatusCode.NotFound)
{
    Console.Error.WriteLine(
        $"BUCKET_NO_ENCONTRADO: HTTP {(int)exception.StatusCode}; código={SanitizeCode(exception.ErrorCode)}.");
    return 5;
}
catch (AmazonS3Exception exception) when (FindInner<AuthenticationException>(exception) is not null)
{
    Console.Error.WriteLine("TLS_FALLIDO: no se pudo establecer una sesión TLS válida.");
    return 6;
}
catch (AmazonS3Exception exception) when (FindInner<SocketException>(exception) is not null)
{
    Console.Error.WriteLine("CONECTIVIDAD_FALLIDA: no se pudo conectar con el endpoint resuelto.");
    return 8;
}
catch (AmazonS3Exception exception) when (
    FindInner<TaskCanceledException>(exception) is not null ||
    FindInner<OperationCanceledException>(exception) is not null)
{
    Console.Error.WriteLine("TIMEOUT: la consulta excedió 30 segundos o fue cancelada.");
    return 7;
}
catch (AmazonS3Exception exception)
{
    Console.Error.WriteLine(
        $"R2_ERROR: HTTP {(int)exception.StatusCode}; código={SanitizeCode(exception.ErrorCode)}.");
    return 9;
}
catch (HttpRequestException exception) when (FindInner<AuthenticationException>(exception) is not null)
{
    Console.Error.WriteLine("TLS_FALLIDO: no se pudo establecer una sesión TLS válida.");
    return 6;
}
catch (HttpRequestException exception) when (FindInner<SocketException>(exception) is not null)
{
    Console.Error.WriteLine("CONECTIVIDAD_FALLIDA: no se pudo conectar con el endpoint resuelto.");
    return 8;
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine("TIMEOUT: la consulta excedió 30 segundos o fue cancelada.");
    return 7;
}
catch (Exception exception)
{
    Console.Error.WriteLine($"ERROR_NO_CLASIFICADO: tipo={exception.GetType().Name}.");
    return 9;
}

static string Read(string name) =>
    Environment.GetEnvironmentVariable(name)?.Trim() ?? string.Empty;

static string SanitizeCode(string? code) =>
    string.IsNullOrWhiteSpace(code) ? "no-disponible" : code;

static TException? FindInner<TException>(Exception exception)
    where TException : Exception
{
    for (Exception? current = exception; current is not null; current = current.InnerException)
    {
        if (current is TException matched)
            return matched;
    }
    return null;
}
