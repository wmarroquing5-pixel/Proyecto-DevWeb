using API_Clinica.Data;
using API_Clinica.Common;
using API_Clinica.Services;
using API_Clinica.Interfaces;
using API_Clinica.Hubs;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();
builder.Services.AddSignalR();

// 👇 CONFIGURACIÓN DE CORS (SOLUCIONA EL BLOQUEO EN ANGULAR)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

builder.Services.AddScoped<IMenuService, MenuService>();

// 👇 USAR SOLO AddOpenApi() DE MICROSOFT (NO SWASHBUCKLE)
builder.Services.AddOpenApi();

builder.Services.AddApplicationServices();
builder.Services.AddAuthenticationServices(builder.Configuration);
builder.Services.AddDbContext<ClinicaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddOptions<DatabaseConnectionOptions>()
    .BindConfiguration("ConnectionStrings")
    .Validate(options => !string.IsNullOrWhiteSpace(options.DefaultConnection),
        "Falta configurar ConnectionStrings:DefaultConnection.")
    .ValidateOnStart();

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

// 👇 ACTIVAR CORS
app.UseCors();

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<HabitacionHub>("/hubs/habitaciones");

app.Run();

public partial class Program;
