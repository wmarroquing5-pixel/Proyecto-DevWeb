using System.Reflection;

namespace API_Clinica.Common;

public static class PermisoModuleCatalog
{
    private static readonly IReadOnlyList<string> Modules = Array.AsReadOnly(DiscoverModules());

    public static IReadOnlyList<string> All => Modules;

    public static bool TryNormalize(string? value, out string module)
    {
        var candidate = value?.Trim();
        module = Modules.FirstOrDefault(item =>
            string.Equals(item, candidate, StringComparison.OrdinalIgnoreCase)) ?? string.Empty;
        return module.Length > 0;
    }

    private static string[] DiscoverModules() =>
        typeof(PermisoModuleCatalog).Assembly.DefinedTypes
            .SelectMany(type => type.GetCustomAttributes<PermisoRequeridoAttribute>(inherit: true)
                .Concat(type.DeclaredMethods.SelectMany(method =>
                    method.GetCustomAttributes<PermisoRequeridoAttribute>(inherit: true))))
            .Select(attribute => ParseModule(attribute.Policy))
            .Where(module => module is not null)
            .Select(module => module!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(module => module, StringComparer.Ordinal)
            .ToArray();

    private static string? ParseModule(string? policy)
    {
        if (policy is null ||
            !policy.StartsWith(PermisoRequeridoAttribute.Prefix, StringComparison.Ordinal))
            return null;

        var operationSeparator = policy.LastIndexOf(':');
        if (operationSeparator <= PermisoRequeridoAttribute.Prefix.Length)
            return null;

        return policy[PermisoRequeridoAttribute.Prefix.Length..operationSeparator];
    }
}
