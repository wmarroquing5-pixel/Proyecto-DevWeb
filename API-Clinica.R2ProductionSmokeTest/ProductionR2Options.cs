using System.Text.RegularExpressions;

namespace API_Clinica.R2ProductionSmokeTest;

internal sealed class ProductionR2Options
{
    public const string RequiredBucketName = "clinica-fotos";

    public string AccountId { get; init; } = string.Empty;
    public string AccessKeyId { get; init; } = string.Empty;
    public string SecretAccessKey { get; init; } = string.Empty;
    public string BucketName { get; init; } = string.Empty;

    public static ProductionR2Options FromEnvironment() => new()
    {
        AccountId = Read("R2__AccountId"),
        AccessKeyId = Read("R2__AccessKeyId"),
        SecretAccessKey = Read("R2__SecretAccessKey"),
        BucketName = Read("R2__BucketName")
    };

    public ProductionR2ConfigurationStatus Validate()
    {
        var values = new[] { AccountId, AccessKeyId, SecretAccessKey, BucketName };
        var present = values.Count(value => !string.IsNullOrWhiteSpace(value));
        if (present != values.Length)
            return new(false, present, "La configuración R2 productiva está incompleta.");

        if (!Regex.IsMatch(AccountId, "^[A-Za-z0-9]+$", RegexOptions.CultureInvariant))
            return new(false, present, "El Account ID tiene un formato inválido.");

        if (!string.Equals(BucketName, RequiredBucketName, StringComparison.Ordinal))
            return new(false, present, "El bucket debe coincidir exactamente con clinica-fotos.");

        return new(true, present, "La configuración está completa y el bucket productivo fue validado.");
    }

    public string GetServiceUrl() =>
        $"https://{AccountId}.r2.cloudflarestorage.com";

    private static string Read(string name) =>
        Environment.GetEnvironmentVariable(name)?.Trim() ?? string.Empty;
}

internal sealed record ProductionR2ConfigurationStatus(
    bool IsReady,
    int PresentFieldCount,
    string Message);
