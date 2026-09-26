using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using System.Security.Claims;
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
    public async Task UnknownUserAndWrongPasswordReturnSameGenericResponse()
    {
        using var factory = new AuthApiFactory();
        await factory.SeedUserAsync();
        using var client = factory.CreateClient();

        var unknown = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "no.existe", Password = "incorrecta" });
        var wrong = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = "incorrecta" });

        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(unknown.StatusCode, wrong.StatusCode);
        using var unknownBody = System.Text.Json.JsonDocument.Parse(
            await unknown.Content.ReadAsStringAsync());
        using var wrongBody = System.Text.Json.JsonDocument.Parse(
            await wrong.Content.ReadAsStringAsync());
        Assert.Equal(unknownBody.RootElement.GetProperty("detail").GetString(),
            wrongBody.RootElement.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task IncompatibleThirteenCharacterHashReturnsGenericUnauthorized()
    {
        using var factory = new AuthApiFactory();
        await factory.SeedUserAsync(passwordHashOverride: "legacy-format");
        using var client = factory.CreateClient();

        var incompatible = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = "incorrecta" });
        var unknown = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "no.existe", Password = "incorrecta" });

        Assert.Equal(HttpStatusCode.Unauthorized, incompatible.StatusCode);
        Assert.Equal(unknown.StatusCode, incompatible.StatusCode);
        using var incompatibleBody = System.Text.Json.JsonDocument.Parse(
            await incompatible.Content.ReadAsStringAsync());
        using var unknownBody = System.Text.Json.JsonDocument.Parse(
            await unknown.Content.ReadAsStringAsync());
        Assert.Equal(unknownBody.RootElement.GetProperty("detail").GetString(),
            incompatibleBody.RootElement.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task ProtectedEndpointRequiresTokenAndAcceptsValidToken()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync(withEmployee: true);
        using var client = factory.CreateClient();

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/auth/me")).StatusCode);

        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var token = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.AccessToken);
        var me = await client.GetAsync("/api/auth/me");
        Assert.True(me.StatusCode == HttpStatusCode.OK,
            $"Status: {me.StatusCode}; WWW-Authenticate: {me.Headers.WwwAuthenticate}");
        var body = await me.Content.ReadAsStringAsync();
        Assert.Contains("usuario.prueba", body);
        Assert.DoesNotContain("PasswordHash", body);
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task ProtectedEndpointRejectsExpiredOrWrongSignatureToken(bool expired)
    {
        using var factory = new AuthApiFactory();
        using var client = factory.CreateClient();
        var key = expired ? factory.SigningKey :
            Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var now = DateTime.UtcNow;
        var token = new JwtSecurityToken(
            issuer: "API-Clinica.Tests",
            audience: "API-Clinica.Tests.Client",
            claims: [new Claim("IdUsuario", "1"), new Claim("IdRol", "1")],
            notBefore: now.AddMinutes(-10),
            expires: expired ? now.AddMinutes(-1) : now.AddMinutes(10),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256));
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", new JwtSecurityTokenHandler().WriteToken(token));

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/auth/me")).StatusCode);
    }

    [Fact]
    public async Task LoginRateLimitReturns429()
    {
        using var factory = new AuthApiFactory();
        using var client = factory.CreateClient();
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var response = await client.PostAsJsonAsync("/api/auth/login",
                new LoginRequest { Username = "no.existe", Password = "incorrecta" });
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        var rejected = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "no.existe", Password = "incorrecta" });
        Assert.Equal(HttpStatusCode.TooManyRequests, rejected.StatusCode);
    }

    [Fact]
    public async Task DevelopmentSwaggerDocumentsBearerScheme()
    {
        using var factory = new AuthApiFactory();
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/swagger/v1/swagger.json");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadAsStringAsync();
        Assert.Contains("\"Bearer\"", body);
        Assert.Contains("\"bearer\"", body);
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

    [Fact]
    public async Task PermissionChangesApplyToExistingJwtAndMenu()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync();
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = password });
        var token = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/usuarios")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/roles")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/permisos")).StatusCode);
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Permisos.Add(new Permiso
            {
                IdRol = 1, Modulo = "Usuarios", PuedeConsultar = true
            });
            await context.SaveChangesAsync();
        }

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/usuarios")).StatusCode);
        var menu = await client.GetFromJsonAsync<List<PermisoActualResponse>>("/api/auth/permisos");
        Assert.NotNull(menu);
        Assert.Single(menu);
        Assert.True(menu[0].PuedeConsultar);

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await context.Permisos.SingleAsync();
            permiso.PuedeConsultar = false;
            await context.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/usuarios")).StatusCode);
    }

    [Fact]
    public async Task DuplicatePermissionRowsDenyAccess()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Permisos.AddRange(
                new Permiso { IdRol = 1, Modulo = "Usuarios", PuedeConsultar = true },
                new Permiso { IdRol = 1, Modulo = "Usuarios", PuedeConsultar = false });
            await context.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = password });
        var token = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/usuarios")).StatusCode);
        var menu = await client.GetFromJsonAsync<List<PermisoActualResponse>>("/api/auth/permisos");
        Assert.Empty(menu!);
    }

    [Fact]
    public async Task CreatingUserInDifferentRoleRequiresRoleManagementPermission()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Roles.Add(new Rol { IdRol = 2, Nombre = "Otro", Activo = true });
            context.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Usuarios", PuedeCrear = true });
            await context.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = password });
        var token = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        var newPassword = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var denied = await client.PostAsJsonAsync("/api/usuarios", new CrearUsuarioRequest
        {
            Username = "otro.usuario", Password = newPassword, IdRol = 2
        });
        Assert.Equal(HttpStatusCode.Forbidden, denied.StatusCode);
        using var verificationScope = factory.Services.CreateScope();
        Assert.Equal(1, await verificationScope.ServiceProvider
            .GetRequiredService<ClinicaDbContext>().Usuarios.CountAsync());
    }

    [Fact]
    public async Task InactiveUserOrRoleRevokesExistingJwt()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            context.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Usuarios", PuedeConsultar = true });
            await context.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = password });
        var token = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync("/api/usuarios")).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await context.Usuarios.SingleAsync()).Activo = false;
            await context.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/usuarios")).StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await context.Usuarios.SingleAsync()).Activo = true;
            (await context.Roles.SingleAsync()).Activo = false;
            await context.SaveChangesAsync();
        }
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/usuarios")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync("/api/auth/permisos")).StatusCode);
    }

    [Fact]
    public async Task AdministrationCrudUsesPermissionsAndHashesNewUser()
    {
        using var factory = new AuthApiFactory();
        var password = await factory.SeedUserAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            foreach (var modulo in new[] { "Usuarios", "Roles", "Permisos" })
                context.Permisos.Add(new Permiso
                {
                    IdRol = 1, Modulo = modulo, PuedeConsultar = true,
                    PuedeCrear = true, PuedeModificar = true, PuedeEliminar = true
                });
            await context.SaveChangesAsync();
        }
        using var client = factory.CreateClient();
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "usuario.prueba", Password = password });
        var token = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.AccessToken);

        var newRole = await client.PostAsJsonAsync("/api/roles", new GuardarRolRequest { Nombre = "Nuevo" });
        Assert.Equal(HttpStatusCode.Created, newRole.StatusCode);
        var role = await newRole.Content.ReadFromJsonAsync<RolResponse>();
        Assert.NotNull(role);

        var newPermission = await client.PostAsJsonAsync("/api/permisos", new GuardarPermisoRequest
        {
            IdRol = role.IdRol, Modulo = "Pacientes", PuedeConsultar = true
        });
        Assert.Equal(HttpStatusCode.Created, newPermission.StatusCode);
        var permission = await newPermission.Content.ReadFromJsonAsync<PermisoResponse>();
        Assert.NotNull(permission);

        var newPassword = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var newUser = await client.PostAsJsonAsync("/api/usuarios", new CrearUsuarioRequest
        {
            Username = "nuevo.usuario", Password = newPassword, IdRol = role.IdRol
        });
        Assert.Equal(HttpStatusCode.Created, newUser.StatusCode);
        var user = await newUser.Content.ReadFromJsonAsync<UsuarioResponse>();
        Assert.NotNull(user);
        Assert.DoesNotContain("PasswordHash", await newUser.Content.ReadAsStringAsync());
        using (var scope = factory.Services.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var stored = await context.Usuarios.SingleAsync(u => u.IdUsuario == user.IdUsuario);
            Assert.NotEqual(newPassword, stored.PasswordHash);
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            Assert.NotEqual(PasswordVerificationResult.Failed,
                hasher.VerifyHashedPassword(stored, stored.PasswordHash, newPassword));
        }

        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/api/usuarios/{user.IdUsuario}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync($"/api/permisos/{permission.IdPermiso}",
            new GuardarPermisoRequest { IdRol = role.IdRol, Modulo = "Pacientes", PuedeCrear = true })).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/usuarios/{user.IdUsuario}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/permisos/{permission.IdPermiso}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/api/roles/{role.IdRol}")).StatusCode);
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
                    ["ConnectionStrings:DefaultConnection"] = "Server=(local);Database=NotUsedInMemory;Trusted_Connection=True;TrustServerCertificate=True",
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
            bool withEmployee = false,
            string? passwordHashOverride = null)
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
            usuario.PasswordHash = passwordHashOverride ?? hasher.HashPassword(usuario, password);
            context.Usuarios.Add(usuario);
            await context.SaveChangesAsync();
            return password;
        }
    }
}
