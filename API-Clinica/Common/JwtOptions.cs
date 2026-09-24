using System.Text;

namespace API_Clinica.Common;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public string SigningKey { get; set; } = string.Empty;
    public int ExpirationMinutes { get; set; } = 60;

    public bool IsValid() =>
        !string.IsNullOrWhiteSpace(Issuer) &&
        !string.IsNullOrWhiteSpace(Audience) &&
        !string.IsNullOrEmpty(SigningKey) &&
        Encoding.UTF8.GetByteCount(SigningKey) >= 32 &&
        ExpirationMinutes is >= 1 and <= 1440;
}
