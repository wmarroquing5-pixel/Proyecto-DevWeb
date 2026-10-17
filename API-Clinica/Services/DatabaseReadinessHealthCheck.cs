using API_Clinica.Common;
using API_Clinica.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

namespace API_Clinica.Services;

public sealed class DatabaseReadinessHealthCheck(
    IServiceScopeFactory scopeFactory,
    IOptions<ApiHealthOptions> options) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(options.Value.DatabaseTimeoutSeconds));
        try
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            if (!await dbContext.Database.CanConnectAsync(timeout.Token))
                return HealthCheckResult.Unhealthy();

            await dbContext.Sucursales.AsNoTracking().AnyAsync(timeout.Token);
            return HealthCheckResult.Healthy();
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            return HealthCheckResult.Unhealthy();
        }
        catch (Exception)
        {
            return HealthCheckResult.Unhealthy();
        }
    }
}
