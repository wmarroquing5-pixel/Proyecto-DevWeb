using API_Clinica.Data;
using API_Clinica.Common;
using API_Clinica.Services;
using API_Clinica.Interfaces;
using API_Clinica.Hubs;
using Microsoft.AspNetCore.Cors.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddSignalR();

builder.Services.AddCors();
builder.Services.AddOptions<ApiCorsOptions>()
    .BindConfiguration(ApiCorsOptions.SectionName)
    .Validate(options => options.IsValid(),
        "Cors:AllowedOrigins debe contener orígenes HTTP/HTTPS exactos, únicos y sin rutas, comodines ni barra final.")
    .ValidateOnStart();
builder.Services.AddOptions<CorsOptions>()
    .Configure<IOptions<ApiCorsOptions>>((options, configured) =>
    {
        options.AddPolicy(ApiCorsOptions.PolicyName, policy =>
        {
            if (configured.Value.AllowedOrigins.Length > 0)
                policy.WithOrigins(configured.Value.AllowedOrigins)
                    .AllowAnyHeader()
                    .AllowAnyMethod()
                    .AllowCredentials();
        });
    });

builder.Services.AddScoped<IMenuService, MenuService>();

builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
    options.AddOperationTransformer<BearerSecurityRequirementTransformer>();
});

builder.Services.AddApplicationServices();
builder.Services.AddAuthenticationServices(builder.Configuration);
builder.Services.AddDbContext<ClinicaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddOptions<DatabaseConnectionOptions>()
    .BindConfiguration("ConnectionStrings")
    .Validate(options => !string.IsNullOrWhiteSpace(options.DefaultConnection),
        "Falta configurar ConnectionStrings:DefaultConnection.")
    .ValidateOnStart();
builder.Services.AddOptions<ApiHealthOptions>()
    .BindConfiguration(ApiHealthOptions.SectionName)
    .Validate(options => options.IsValid(),
        "HealthChecks:DatabaseTimeoutSeconds debe estar entre 1 y 30.")
    .ValidateOnStart();
builder.Services.AddHealthChecks()
    .AddCheck<DatabaseReadinessHealthCheck>(
        "database", tags: ["ready"]);

var app = builder.Build();

app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi().AllowAnonymous();
    app.MapGet("/api/health/database", async (ClinicaDbContext context, CancellationToken cancellationToken) =>
    {
        try
        {
            if (!await context.Database.CanConnectAsync(cancellationToken))
            {
                return Results.Json(new { database = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
            }
            await context.Sucursales.AsNoTracking().AnyAsync(cancellationToken);
            return Results.Ok(new
            {
                database = "available",
                provider = context.Database.ProviderName
            });
        }
        catch (Exception)
        {
            return Results.Json(new { database = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
        }
    }).AllowAnonymous();
}

app.UseHttpsRedirection();
app.UseRouting();

app.UseCors(ApiCorsOptions.PolicyName);

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<HabitacionHub>("/hubs/habitaciones");
app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = WriteMinimalHealthResponse
}).AllowAnonymous();
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = WriteMinimalHealthResponse
}).AllowAnonymous();

static Task WriteMinimalHealthResponse(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";
    return context.Response.WriteAsJsonAsync(new
    {
        status = report.Status == HealthStatus.Healthy
            ? "available"
            : "unavailable"
    });
}

app.Run();

public partial class Program;
