using API_Clinica.Common;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using System.Threading.RateLimiting;

namespace API_Clinica.Services;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddApplicationServices(this IServiceCollection services)
    {
        services.AddSingleton<ICommonParameterValidator, CommonParameterValidator>();
        services.AddScoped<IAdministracionService, AdministracionService>();
        services.AddScoped<ISucursalService, SucursalService>();
        services.AddScoped<IEspecialidadService, EspecialidadService>();
        services.AddScoped<HabitacionTransactionCoordinator>();
        services.AddSingleton<IHabitacionEstadoNotifier, HabitacionEstadoNotifier>();
        services.AddScoped<IHabitacionService, HabitacionService>();
        services.AddScoped<IAsignacionHabitacionService, AsignacionHabitacionService>();
        services.AddScoped<IDiagnosticoService, DiagnosticoService>();
        services.AddScoped<ICategoriaService, CategoriaService>();
        services.AddScoped<IMarcaService, MarcaService>();
        services.AddScoped<IMedicamentoService, MedicamentoService>();
        services.AddScoped<ILoteMedicamentoService, LoteMedicamentoService>();
        services.AddHttpContextAccessor();
        services.AddExceptionHandler<GlobalExceptionHandler>();
        services.AddProblemDetails();

        return services;
    }

    public static IServiceCollection AddAuthenticationServices(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddOptions<JwtOptions>()
            .BindConfiguration(JwtOptions.SectionName)
            .Validate(options => options.IsValid(),
                "La configuración Jwt requiere Issuer, Audience, SigningKey de al menos 32 bytes y ExpirationMinutes entre 1 y 1440.")
            .ValidateOnStart();

        services.AddScoped<IAuthService, AuthService>();
        services.AddSingleton<IJwtTokenService, JwtTokenService>();
        services.Configure<PasswordHasherOptions>(options => options.IterationCount = 210_000);
        services.AddScoped<IPasswordHasher<Usuario>, PasswordHasher<Usuario>>();
        services.AddScoped<IPasswordVerificationService, PasswordVerificationService>();
        services.AddSingleton<ILegacyPasswordVerifier, UnsupportedLegacyPasswordVerifier>();
        services.AddScoped<IAccesoActualService, AccesoActualService>();
        services.AddSingleton<IAuthorizationPolicyProvider, PermisoPolicyProvider>();
        services.AddScoped<IAuthorizationHandler, PermisoAuthorizationHandler>();

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer();
        services.AddSingleton<IConfigureOptions<JwtBearerOptions>, ConfigureJwtBearerOptions>();
        services.AddAuthorization(options =>
            options.FallbackPolicy = new AuthorizationPolicyBuilder()
                .RequireAuthenticatedUser().Build());
        var permitLimit = configuration.GetValue("RateLimiting:Login:PermitLimit", 10);
        var windowSeconds = configuration.GetValue("RateLimiting:Login:WindowSeconds", 60);
        if (permitLimit < 1 || windowSeconds < 1)
        {
            throw new InvalidOperationException("La configuración RateLimiting:Login debe tener valores positivos.");
        }
        services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.AddPolicy("login", context =>
                RateLimitPartition.GetFixedWindowLimiter(
                    context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                    _ => new FixedWindowRateLimiterOptions
                    {
                        PermitLimit = permitLimit,
                        Window = TimeSpan.FromSeconds(windowSeconds),
                        QueueLimit = 0,
                        AutoReplenishment = true
                    }));
        });

        return services;
    }
}
