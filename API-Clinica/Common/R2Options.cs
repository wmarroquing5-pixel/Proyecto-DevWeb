namespace API_Clinica.Common;

public sealed class R2Options
{
    public const string SectionName = "R2";
    public const string ExpectedBucketName = "fotos-clinica";

    public string AccountId { get; init; } = string.Empty;
    public string AccessKeyId { get; init; } = string.Empty;
    public string SecretAccessKey { get; init; } = string.Empty;
    public string BucketName { get; init; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AccountId) &&
        !string.IsNullOrWhiteSpace(AccessKeyId) &&
        !string.IsNullOrWhiteSpace(SecretAccessKey) &&
        !string.IsNullOrWhiteSpace(BucketName);

    public bool IsValid()
    {
        var values = new[] { AccountId, AccessKeyId, SecretAccessKey, BucketName };
        if (values.All(string.IsNullOrWhiteSpace))
            return true;

        return IsConfigured &&
            AccountId.All(character => char.IsLetterOrDigit(character)) &&
            string.Equals(BucketName, ExpectedBucketName, StringComparison.Ordinal);
    }

    public string GetServiceUrl() =>
        $"https://{AccountId}.r2.cloudflarestorage.com";
}
