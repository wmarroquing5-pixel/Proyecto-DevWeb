using API_Clinica.Common;

namespace API_Clinica.R2AdapterProbe;

internal static class R2AdapterProbeOptions
{
    internal static R2Options FromEnvironment(Func<string, string?> readEnvironment) =>
        new()
        {
            AccountId = Read("R2__AccountId", readEnvironment),
            AccessKeyId = Read("R2__AccessKeyId", readEnvironment),
            SecretAccessKey = Read("R2__SecretAccessKey", readEnvironment),
            BucketName = Read("R2__BucketName", readEnvironment)
        };

    internal static bool IsReady(R2Options options) =>
        options.IsConfigured && options.IsValid() &&
        string.Equals(
            options.BucketName,
            R2Options.ExpectedBucketName,
            StringComparison.Ordinal);

    private static string Read(
        string name,
        Func<string, string?> readEnvironment) =>
        readEnvironment(name)?.Trim() ?? string.Empty;
}
