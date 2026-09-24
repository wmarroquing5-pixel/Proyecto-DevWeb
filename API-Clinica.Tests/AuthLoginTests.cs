using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace API_Clinica.Tests;

public sealed class AuthLoginTests
{
    [Fact]
    public async Task ValidLoginReturnsSignedJwtWithRequiredClaims()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync(withEmployee: true);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Username = "usuario.prueba",
            Password = password
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = await response.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(result);
        Assert.Equal("Bearer", result.TokenType);
        Assert.True(result.ExpiresAtUtc > DateTimeOffset.UtcNow);

        var principal = new JwtSecurityTokenHandler().ValidateToken(
            result.AccessToken,
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = "API-Clinica.Tests",
                ValidateAudience = true,
                ValidAudience = "API-Clinica.Tests.Client",
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(factory.SigningKey)),
                ValidateLifetime = true,
                ClockSkew = TimeSpan.Zero
            },
            out _);

        Assert.Equal("1", principal.FindFirst("IdUsuario")?.Value);
        Assert.Equal("1", principal.FindFirst("IdRol")?.Value);
        Assert.Equal("usuario.prueba", principal.FindFirst("Username")?.Value);
        Assert.Equal("7", principal.FindFirst("IdEmpleado")?.Value);
    }

    [Fact]
    public async Task WrongPasswordReturnsUnauthorized()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Username = "usuario.prueba",
            Password = password + "-incorrecta"
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task UnknownUserReturnsUnauthorized()
    {
        using var factory = new AuthApiFactory();
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Username = "no.existe",
            Password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16))
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task InactiveUserReturnsUnauthorized()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync(userActive: false);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Username = "usuario.prueba",
            Password = password
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    public async Task MissingOrInactiveRoleReturnsUnauthorized(bool roleExists, bool roleActive)
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync(roleExists: roleExists, roleActive: roleActive);
        using var client = factory.CreateClient();

        var response = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Username = "usuario.prueba",
            Password = password
        });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    private sealed class AuthApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");

        public string SigningKey { get; } = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, configuration) =>
            {
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["Jwt:Issuer"] = "API-Clinica.Tests",
                    ["Jwt:Audience"] = "API-Clinica.Tests.Client",
                    ["Jwt:SigningKey"] = SigningKey,
                    ["Jwt:ExpirationMinutes"] = "60",
                    ["Logging:EventLog:LogLevel:Default"] = "None"
                });
            });
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<ClinicaDbContext>>();
                services.RemoveAll<ClinicaDbContext>();
                services.AddSingleton(new DbContextOptionsBuilder<ClinicaDbContext>()
                    .UseInMemoryDatabase(databaseName).Options);
                services.AddScoped<ClinicaDbContext>();
            });
        }

        public async Task<string> SeedUserAsync(
            bool userActive = true,
            bool roleExists = true,
            bool roleActive = true,
            bool withEmployee = false)
        {
            using var scope = Services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));

            if (roleExists)
            {
                context.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = roleActive });
            }

            if (withEmployee)
            {
                context.Sucursales.Add(new Sucursal { IdSucursal = 1, Nombre = "Prueba", Activa = true });
                context.Empleados.Add(new Empleado
                {
                    IdEmpleado = 7,
                    IdSucursal = 1,
                    Nombres = "Prueba",
                    Apellidos = "Local",
                    DPI = "TEST",
                    TipoEmpleado = "Medico",
                    Activo = true
                });
            }

            var usuario = new Usuario
            {
                IdUsuario = 1,
                IdRol = 1,
                IdEmpleado = withEmployee ? 7 : null,
                Username = "usuario.prueba",
                Activo = userActive
            };
            usuario.PasswordHash = hasher.HashPassword(usuario, password);
            context.Usuarios.Add(usuario);
            await context.SaveChangesAsync();
            return password;
        }
    }
}
