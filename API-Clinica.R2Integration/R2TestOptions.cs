using System.Text.RegularExpressions;

namespace API_Clinica.R2Integration;

internal sealed class R2TestOptions
{
    public const string ProductionBucketName = "clinica-fotos";

    public string AccountId { get; init; } = string.Empty;
    public string AccessKeyId { get; init; } = string.Empty;
    public string SecretAccessKey { get; init; } = string.Empty;
    public string BucketName { get; init; } = string.Empty;

    public static R2TestOptions FromEnvironment() => new()
    {
        AccountId = Read("R2TEST__AccountId"),
        AccessKeyId = Read("R2TEST__AccessKeyId"),
        SecretAccessKey = Read("R2TEST__SecretAccessKey"),
        BucketName = Read("R2TEST__BucketName")
    };

    public R2TestConfigurationStatus Validate()
    {
        var values = new[] { AccountId, AccessKeyId, SecretAccessKey, BucketName };
        var present = values.Count(value => !string.IsNullOrWhiteSpace(value));
        if (present == 0)
            return new(R2TestConfigurationState.Missing, present,
                "La configuración de pruebas R2 no está presente.");
        if (present != values.Length)
            return new(R2TestConfigurationState.Invalid, present,
                "La configuración R2TEST está incompleta.");
        if (!Regex.IsMatch(AccountId, "^[A-Za-z0-9]+$", RegexOptions.CultureInvariant))
            return new(R2TestConfigurationState.Invalid, present,
                "El Account ID de pruebas tiene un formato inválido.");
        if (!Regex.IsMatch(BucketName, "^(?!.*\\.\\.)(?!\\d{1,3}(?:\\.\\d{1,3}){3}$)[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$",
                RegexOptions.CultureInvariant))
            return new(R2TestConfigurationState.Invalid, present,
                "El nombre del bucket de pruebas tiene un formato inválido.");
        if (string.Equals(BucketName, ProductionBucketName, StringComparison.OrdinalIgnoreCase))
            return new(R2TestConfigurationState.Invalid, present,
                "El bucket productivo está prohibido para esta utilidad.");

        return new(R2TestConfigurationState.Ready, present,
            "La configuración local está completa y apunta a un bucket independiente.");
    }

    public string GetServiceUrl() =>
        $"https://{AccountId}.r2.cloudflarestorage.com";

    private static string Read(string name) =>
        Environment.GetEnvironmentVariable(name)?.Trim() ?? string.Empty;
}

internal sealed record R2TestConfigurationStatus(
    R2TestConfigurationState State,
    int PresentFieldCount,
    string Message);

internal enum R2TestConfigurationState
{
    Missing,
    Invalid,
    Ready
}
