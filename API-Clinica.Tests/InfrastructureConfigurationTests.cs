using System.Net;
using System.Text.Json;
using API_Clinica.Data;
using API_Clinica.Common;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace API_Clinica.Tests;

public sealed class InfrastructureConfigurationTests
{
    [Fact]
    public async Task CorsDevelopmentPermiteOrigenLocalConfigurado()
    {
        using var factory = new InfrastructureFactory("Development");
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/auth/login");
        request.Headers.Add("Origin", "http://localhost:4200");
        request.Headers.Add("Access-Control-Request-Method", "POST");

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        Assert.Equal("http://localhost:4200",
            Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
        Assert.Equal("true",
            Assert.Single(response.Headers.GetValues("Access-Control-Allow-Credentials")));
    }

    [Fact]
    public async Task CorsProductionUsaOrigenExternoConfigurado()
    {
        const string origin = "https://cliente.example.test";
        using var factory = new InfrastructureFactory("Production", [origin]);
        Assert.Equal(origin, Assert.Single(factory.Services
            .GetRequiredService<IOptions<ApiCorsOptions>>().Value.AllowedOrigins));
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add("Origin", origin);

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(origin,
            Assert.Single(response.Headers.GetValues("Access-Control-Allow-Origin")));
        Assert.Equal("true",
            Assert.Single(response.Headers.GetValues("Access-Control-Allow-Credentials")));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("https://no-autorizado.example.test")]
    public async Task CorsProductionRechazaOrigenNoConfigurado(string? configuredOrigin)
    {
        var configured = configuredOrigin is null
            ? Array.Empty<string>()
            : new[] { "https://permitido.example.test" };
        using var factory = new InfrastructureFactory("Production", configured);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, "/health/live");
        request.Headers.Add("Origin", configuredOrigin ?? "https://origen.example.test");

        var response = await client.SendAsync(request);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Access-Control-Allow-Origin"));
        Assert.False(response.Headers.Contains("Access-Control-Allow-Credentials"));
    }

    [Fact]
    public async Task LivenessEsMinimoYNoConsultaBaseDeDatos()
    {
        using var factory = new InfrastructureFactory(
            "Production", unavailableDatabase: true);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/live");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("available", await ReadStatusAsync(response));
        await AssertNoSensitiveContentAsync(response);
    }

    [Fact]
    public async Task ReadinessDisponibleUsaConsultaDeSoloLectura()
    {
        using var factory = new InfrastructureFactory("Production");
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("available", await ReadStatusAsync(response));
        await AssertNoSensitiveContentAsync(response);
    }

    [Fact]
    public async Task ReadinessNoDisponibleDevuelve503SinDetallesInternos()
    {
        using var factory = new InfrastructureFactory(
            "Production", unavailableDatabase: true);
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/health/ready");
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);
        Assert.Equal("unavailable", await ReadStatusAsync(response));
        await AssertNoSensitiveContentAsync(response);
    }

    private static async Task<string?> ReadStatusAsync(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Single(json.RootElement.EnumerateObject());
        return json.RootElement.GetProperty("status").GetString();
    }

    private static async Task AssertNoSensitiveContentAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        Assert.DoesNotContain("connection", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("server", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("database", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("exception", body, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("stack", body, StringComparison.OrdinalIgnoreCase);
    }

    private sealed class InfrastructureFactory(
        string environment,
        string[]? allowedOrigins = null,
        bool unavailableDatabase = false) : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment(environment);
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                var values = new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = unavailableDatabase
                        ? "Server=127.0.0.1,1;Database=NoDisponible;User ID=none;Password=none;Encrypt=False;Connect Timeout=1"
                        : "Server=(local);Database=NotUsedInMemory;Trusted_Connection=True;TrustServerCertificate=True",
                    ["Jwt:Issuer"] = "API-Clinica.Tests",
                    ["Jwt:Audience"] = "API-Clinica.Tests.Client",
                    ["Jwt:SigningKey"] = Convert.ToHexString(
                        System.Security.Cryptography.RandomNumberGenerator.GetBytes(32)),
                    ["Jwt:ExpirationMinutes"] = "60",
                    ["HealthChecks:DatabaseTimeoutSeconds"] = "1",
                    ["Logging:EventLog:LogLevel:Default"] = "None"
                };
                if (allowedOrigins is not null)
                {
                    values["Cors:AllowedOrigins"] = null;
                    for (var index = 0; index < allowedOrigins.Length; index++)
                        values[$"Cors:AllowedOrigins:{index}"] = allowedOrigins[index];
                }
                configuration.AddInMemoryCollection(values);
            });
            if (!unavailableDatabase)
            {
                builder.ConfigureTestServices(services =>
                {
                    services.RemoveAll<DbContextOptions<ClinicaDbContext>>();
                    services.RemoveAll<ClinicaDbContext>();
                    services.AddSingleton(new DbContextOptionsBuilder<ClinicaDbContext>()
                        .UseInMemoryDatabase(databaseName).Options);
                    services.AddScoped<ClinicaDbContext>();
                });
            }
        }
    }
}
