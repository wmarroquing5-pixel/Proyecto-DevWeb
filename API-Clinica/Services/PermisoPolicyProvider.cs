using API_Clinica.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Options;

namespace API_Clinica.Services;

public sealed class PermisoPolicyProvider(IOptions<AuthorizationOptions> options)
    : DefaultAuthorizationPolicyProvider(options)
{
    public override Task<AuthorizationPolicy?> GetPolicyAsync(string policyName)
    {
        if (!policyName.StartsWith(PermisoRequeridoAttribute.Prefix, StringComparison.Ordinal))
            return base.GetPolicyAsync(policyName);

        var segments = policyName[PermisoRequeridoAttribute.Prefix.Length..].Split(':');
        if (segments.Length != 2 || string.IsNullOrWhiteSpace(segments[0]) ||
            segments[0].Length > 50 ||
            !Enum.TryParse<Operacion>(segments[1], false, out var operation) ||
            !Enum.IsDefined(operation))
            return Task.FromResult<AuthorizationPolicy?>(null);

        var policy = new AuthorizationPolicyBuilder()
            .RequireAuthenticatedUser()
            .AddRequirements(new PermisoRequirement(segments[0], operation))
            .Build();
        return Task.FromResult<AuthorizationPolicy?>(policy);
    }
}
