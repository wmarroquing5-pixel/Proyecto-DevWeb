namespace API_Clinica.Common;

public sealed class ApiHealthOptions
{
    public const string SectionName = "HealthChecks";

    public int DatabaseTimeoutSeconds { get; init; } = 5;

    public bool IsValid() => DatabaseTimeoutSeconds is >= 1 and <= 30;
}
