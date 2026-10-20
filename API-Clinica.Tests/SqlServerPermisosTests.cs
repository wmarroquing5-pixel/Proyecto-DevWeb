using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace API_Clinica.Tests;

public sealed class SqlServerPermisosTests
{
    [Fact]
    public async Task DosSolicitudesSimultaneasMismaCombinacionConfirmanUnaYRechazanOtra()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        var targetRoleId = await PreparePermissionAdministrationAsync(database, activeTargetRole: true);
        var before = await ReadPermissionsAsync(database);

        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        await AuthenticateAsync(firstClient, database.Password);
        await AuthenticateAsync(secondClient, database.Password);

        var first = firstClient.PostAsJsonAsync("/api/permisos", Request(targetRoleId, "Categorias"));
        var second = secondClient.PostAsJsonAsync("/api/permisos", Request(targetRoleId, "Categorias"));
        var responses = await Task.WhenAll(first, second);

        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Created);
        Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);

        await using var verification = database.OpenContext();
        Assert.Equal(1, await verification.Permisos.CountAsync(
            permission => permission.IdRol == targetRoleId &&
                          permission.Modulo == "Categorias"));
        Assert.Equal(before.Count + 1, await verification.Permisos.CountAsync());
        AssertPreviousPermissionsUnchanged(before, await verification.Permisos
            .Where(permission => permission.Modulo != "Categorias" || permission.IdRol != targetRoleId)
            .AsNoTracking().ToListAsync());
    }

    [Fact]
    public async Task SolicitudesSimultaneasCombinacionesDistintasSeConfirmanSinDuplicados()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        var targetRoleId = await PreparePermissionAdministrationAsync(database, activeTargetRole: true);

        using var firstClient = factory.CreateClient();
        using var secondClient = factory.CreateClient();
        await AuthenticateAsync(firstClient, database.Password);
        await AuthenticateAsync(secondClient, database.Password);

        var responses = await Task.WhenAll(
            firstClient.PostAsJsonAsync("/api/permisos", Request(targetRoleId, "Marcas")),
            secondClient.PostAsJsonAsync("/api/permisos", Request(targetRoleId, "Medicamentos")));

        Assert.All(responses, response => Assert.Equal(HttpStatusCode.Created, response.StatusCode));

        await using var verification = database.OpenContext();
        var created = await verification.Permisos.AsNoTracking()
            .Where(permission => permission.IdRol == targetRoleId &&
                (permission.Modulo == "Marcas" ||
                 permission.Modulo == "Medicamentos"))
            .ToListAsync();
        Assert.Equal(2, created.Count);
        Assert.Equal(2, created.Select(permission => permission.Modulo).Distinct().Count());
    }

    [Fact]
    public async Task RolInexistenteOInactivoNoCreaPermisos()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        var inactiveRoleId = await PreparePermissionAdministrationAsync(database, activeTargetRole: false);
        var before = await ReadPermissionsAsync(database);

        using var client = factory.CreateClient();
        await AuthenticateAsync(client, database.Password);

        var inactive = await client.PostAsJsonAsync(
            "/api/permisos", Request(inactiveRoleId, "Clinicas"));
        var missing = await client.PostAsJsonAsync(
            "/api/permisos", Request(int.MaxValue, "Consultas"));

        Assert.Equal(HttpStatusCode.BadRequest, inactive.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        AssertPreviousPermissionsUnchanged(before, await ReadPermissionsAsync(database));
    }

    [Fact]
    public async Task FalloDePersistenciaRevierteLaCreacionYConservaPermisosPrevios()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using (var seedFactory = database.CreateFactory())
        {
            await database.SeedAsync(seedFactory.Services);
            await PreparePermissionAdministrationAsync(database, activeTargetRole: true);
        }
        var before = await ReadPermissionsAsync(database);

        using var factory = database.CreateFactory(new FailPermissionSaveInterceptor("Servicios"));
        using var client = factory.CreateClient();
        await AuthenticateAsync(client, database.Password);
        int targetRoleId;
        await using (var context = database.OpenContext())
            targetRoleId = await context.Roles.Where(role => role.Nombre == "Rol destino")
                .Select(role => role.IdRol).SingleAsync();

        var response = await client.PostAsJsonAsync(
            "/api/permisos", Request(targetRoleId, "Servicios"));

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        AssertPreviousPermissionsUnchanged(before, await ReadPermissionsAsync(database));
    }

    [Fact]
    public async Task EdicionYEliminacionSimultaneasSeSerializanSinEscriturasParciales()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        var targetRoleId = await PreparePermissionAdministrationAsync(database, activeTargetRole: true);
        int targetPermissionId;
        await using (var context = database.OpenContext())
        {
            var target = new Permiso
            {
                IdRol = targetRoleId,
                Modulo = "Pacientes",
                PuedeConsultar = true
            };
            context.Permisos.Add(target);
            await context.SaveChangesAsync();
            targetPermissionId = target.IdPermiso;
        }

        using var updateClient = factory.CreateClient();
        using var deleteClient = factory.CreateClient();
        await AuthenticateAsync(updateClient, database.Password);
        await AuthenticateAsync(deleteClient, database.Password);

        var responses = await Task.WhenAll(
            updateClient.PutAsJsonAsync($"/api/permisos/{targetPermissionId}",
                new GuardarPermisoRequest
                {
                    IdRol = targetRoleId,
                    Modulo = "Pacientes",
                    PuedeConsultar = true,
                    PuedeModificar = true
                }),
            deleteClient.DeleteAsync($"/api/permisos/{targetPermissionId}"));

        Assert.Contains(responses, response => response.StatusCode == HttpStatusCode.NoContent);
        Assert.Contains(responses, response => response.StatusCode is HttpStatusCode.OK
            or HttpStatusCode.NotFound);
        Assert.DoesNotContain(responses, response =>
            response.StatusCode == HttpStatusCode.InternalServerError);

        await using var verification = database.OpenContext();
        Assert.False(await verification.Permisos.AnyAsync(
            permission => permission.IdPermiso == targetPermissionId));
        var administrative = await verification.Permisos.AsNoTracking().SingleAsync(
            permission => permission.Modulo == "Permisos");
        Assert.True(administrative.PuedeConsultar);
        Assert.True(administrative.PuedeCrear);
        Assert.True(administrative.PuedeModificar);
        Assert.True(administrative.PuedeEliminar);
    }

    [Fact]
    public async Task UltimaCapacidadAdministrativaEfectivaNoPuedeRevocarse()
    {
        await using var database = await SqlServerTestDatabase.CreateAsync();
        using var factory = database.CreateFactory();
        await database.SeedAsync(factory.Services);
        await PreparePermissionAdministrationAsync(database, activeTargetRole: true);
        int permissionId;
        int actorRoleId;
        await using (var context = database.OpenContext())
        {
            permissionId = await context.Permisos.Where(permission =>
                    permission.Modulo == "Permisos")
                .Select(permission => permission.IdPermiso).SingleAsync();
            actorRoleId = await context.Usuarios.Where(user => user.IdUsuario == database.IdUsuario)
                .Select(user => user.IdRol).SingleAsync();
        }

        using var client = factory.CreateClient();
        await AuthenticateAsync(client, database.Password);

        var update = await client.PutAsJsonAsync($"/api/permisos/{permissionId}",
            new GuardarPermisoRequest
            {
                IdRol = actorRoleId,
                Modulo = "Permisos",
                PuedeConsultar = true,
                PuedeCrear = true,
                PuedeModificar = true,
                PuedeEliminar = false
            });
        var delete = await client.DeleteAsync($"/api/permisos/{permissionId}");

        Assert.Equal(HttpStatusCode.Conflict, update.StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, delete.StatusCode);
        await using var verification = database.OpenContext();
        var permission = await verification.Permisos.AsNoTracking()
            .SingleAsync(item => item.IdPermiso == permissionId);
        Assert.True(permission.PuedeConsultar);
        Assert.True(permission.PuedeCrear);
        Assert.True(permission.PuedeModificar);
        Assert.True(permission.PuedeEliminar);
    }

    private static GuardarPermisoRequest Request(int idRol, string modulo) => new()
    {
        IdRol = idRol,
        Modulo = modulo,
        PuedeConsultar = true
    };

    private static async Task<int> PreparePermissionAdministrationAsync(
        SqlServerTestDatabase database, bool activeTargetRole)
    {
        await using var context = database.OpenContext();
        var actorRoleId = await context.Usuarios.Where(user => user.IdUsuario == database.IdUsuario)
            .Select(user => user.IdRol).SingleAsync();
        context.Permisos.Add(new Permiso
        {
            IdRol = actorRoleId,
            Modulo = "Permisos",
            PuedeConsultar = true,
            PuedeCrear = true,
            PuedeModificar = true,
            PuedeEliminar = true
        });
        var targetRole = new Rol { Nombre = "Rol destino", Activo = activeTargetRole };
        context.Roles.Add(targetRole);
        await context.SaveChangesAsync();
        return targetRole.IdRol;
    }

    private static async Task AuthenticateAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest
        {
            Username = "sql.prueba",
            Password = password
        });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var token = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(token);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.AccessToken);
    }

    private static async Task<List<PermissionSnapshot>> ReadPermissionsAsync(
        SqlServerTestDatabase database)
    {
        await using var context = database.OpenContext();
        return await context.Permisos.AsNoTracking().OrderBy(permission => permission.IdPermiso)
            .Select(permission => new PermissionSnapshot(
                permission.IdPermiso, permission.IdRol, permission.Modulo,
                permission.PuedeConsultar, permission.PuedeCrear,
                permission.PuedeModificar, permission.PuedeEliminar))
            .ToListAsync();
    }

    private static void AssertPreviousPermissionsUnchanged(
        IReadOnlyList<PermissionSnapshot> expected,
        IReadOnlyList<Permiso> actual)
    {
        var snapshots = actual.OrderBy(permission => permission.IdPermiso)
            .Select(permission => new PermissionSnapshot(
                permission.IdPermiso, permission.IdRol, permission.Modulo,
                permission.PuedeConsultar, permission.PuedeCrear,
                permission.PuedeModificar, permission.PuedeEliminar))
            .ToList();
        Assert.Equal(expected, snapshots);
    }

    private static void AssertPreviousPermissionsUnchanged(
        IReadOnlyList<PermissionSnapshot> expected,
        IReadOnlyList<PermissionSnapshot> actual) => Assert.Equal(expected, actual);

    private sealed record PermissionSnapshot(
        int IdPermiso,
        int IdRol,
        string Modulo,
        bool PuedeConsultar,
        bool PuedeCrear,
        bool PuedeModificar,
        bool PuedeEliminar);

    private sealed class FailPermissionSaveInterceptor(string module) : SaveChangesInterceptor
    {
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData,
            InterceptionResult<int> result,
            CancellationToken cancellationToken = default)
        {
            if (eventData.Context?.ChangeTracker.Entries<Permiso>().Any(entry =>
                    entry.State == EntityState.Added && entry.Entity.Modulo == module) == true)
                throw new DbUpdateException("Fallo sintético de persistencia.");

            return base.SavingChangesAsync(eventData, result, cancellationToken);
        }
    }
}
