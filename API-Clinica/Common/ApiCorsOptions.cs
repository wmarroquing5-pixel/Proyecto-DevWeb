namespace API_Clinica.Common;

public sealed class ApiCorsOptions
{
    public const string SectionName = "Cors";
    public const string PolicyName = "ApiCors";

    public string[] AllowedOrigins { get; init; } = [];

    public bool IsValid() => AllowedOrigins.All(IsValidOrigin) &&
        AllowedOrigins.Distinct(StringComparer.OrdinalIgnoreCase).Count() ==
        AllowedOrigins.Length;

    private static bool IsValidOrigin(string? value)
    {
        if (string.IsNullOrWhiteSpace(value) || value.Contains('*') ||
            !Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
            (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return false;

        return string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment) &&
            uri.AbsolutePath == "/" && !value.EndsWith('/');
    }
}
