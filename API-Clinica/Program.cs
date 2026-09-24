using API_Clinica.Data;
using API_Clinica.Services;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();
builder.Services.AddApplicationServices();
builder.Services.AddAuthenticationServices();
builder.Services.AddDbContext<ClinicaDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

app.UseExceptionHandler();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
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
    });
}

app.UseHttpsRedirection();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

public partial class Program;
