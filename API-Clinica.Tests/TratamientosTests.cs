using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
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

namespace API_Clinica.Tests;

public sealed class TratamientosTests
{
    private static readonly DateOnly Inicio = new(2026, 6, 1);

    [Fact]
    public async Task CrearValidoDerivaMedicoYNoMueveInventario()
    {
        using var factory = new TratamientoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var response = await client.PostAsJsonAsync("/api/tratamientos", Nuevo(
            idLote: 1, cantidad: 2));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<TratamientoResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdConsulta);
        Assert.Equal(1, dto.IdPaciente);
        Assert.Equal(1, dto.IdMedico);
        Assert.Equal(1, dto.IdLote);
        Assert.Equal((short?)2, dto.Cantidad);
        Assert.Equal("Tratamiento indicado", dto.Descripcion);
        Assert.Equal("Tomar con agua", dto.Indicaciones);
        Assert.Equal(50, await factory.StockAsync());
        Assert.Equal(0, await factory.MovimientosAsync());
    }

    [Fact]
    public async Task LoteYCantidadSonOpcionalesIndependientementeSegunContratoSql()
    {
        using var factory = new TratamientoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var sinAmbos = await client.PostAsJsonAsync("/api/tratamientos", Nuevo());
        var soloLote = await client.PostAsJsonAsync("/api/tratamientos", Nuevo(idLote: 1));
        var soloCantidad = await client.PostAsJsonAsync("/api/tratamientos", Nuevo(cantidad: 3));
        Assert.Equal(HttpStatusCode.Created, sinAmbos.StatusCode);
        Assert.Equal(HttpStatusCode.Created, soloLote.StatusCode);
        Assert.Equal(HttpStatusCode.Created, soloCantidad.StatusCode);
        var sin = await sinAmbos.Content.ReadFromJsonAsync<TratamientoResponseDto>();
        var lote = await soloLote.Content.ReadFromJsonAsync<TratamientoResponseDto>();
        var cantidad = await soloCantidad.Content.ReadFromJsonAsync<TratamientoResponseDto>();
        Assert.NotNull(sin);
        Assert.Null(sin.IdLote);
        Assert.Null(sin.Cantidad);
        Assert.NotNull(lote);
        Assert.Equal(1, lote.IdLote);
        Assert.Null(lote.Cantidad);
        Assert.NotNull(cantidad);
        Assert.Null(cantidad.IdLote);
        Assert.Equal((short?)3, cantidad.Cantidad);
        Assert.Equal(50, await factory.StockAsync());
        Assert.Equal(0, await factory.MovimientosAsync());
    }

    [Fact]
    public async Task RechazaConsultaLoteCantidadYDatosInvalidos()
    {
        using var factory = new TratamientoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PostAsJsonAsync("/api/tratamientos",
                Nuevo(idConsulta: 999))).StatusCode);
        var invalidos = new[]
        {
            Nuevo(idLote: 999), Nuevo(cantidad: 0), Nuevo(cantidad: -1),
            Nuevo(cantidad: 32768), Nuevo(descripcion: "   "),
            Nuevo(descripcion: new string('x', 301)),
            Nuevo(indicaciones: new string('x', 301)),
            Nuevo(fin: new DateOnly(2026, 5, 31)),
            new TratamientoCreateDto { IdConsulta = 1, Descripcion = "Prueba" }
        };
        foreach (var request in invalidos)
            Assert.Equal(HttpStatusCode.BadRequest,
                (await client.PostAsJsonAsync("/api/tratamientos", request)).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task RechazaMedicoInactivoYMedicoDeOtroUsuario()
    {
        using var factory = new TratamientoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 2);
        await factory.GrantAsync(crear: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/tratamientos", Nuevo())).StatusCode);
        await factory.SetUserEmployeeAsync(1);
        await factory.SetEmployeeActiveAsync(1, false);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PostAsJsonAsync("/api/tratamientos", Nuevo())).StatusCode);
        Assert.Equal(0, await factory.CountAsync());
    }

    [Fact]
    public async Task ListadoFiltraPaginaYObtieneDetalle()
    {
        using var factory = new TratamientoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedTratamientosAsync();
        await factory.GrantAsync(consultar: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        var page = await client.GetFromJsonAsync<PagedResponse<TratamientoResponseDto>>(
            "/api/tratamientos?idConsulta=1&page=2&pageSize=1");
        Assert.NotNull(page);
        Assert.Equal(2, page.TotalCount);
        Assert.Equal(2, page.TotalPages);
        Assert.Equal(2, Assert.Single(page.Items).IdTratamiento);
        var detail = await client.GetFromJsonAsync<TratamientoResponseDto>(
            "/api/tratamientos/1");
        Assert.NotNull(detail);
        Assert.Equal(1, detail.IdMedico);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.GetAsync("/api/tratamientos/999")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/tratamientos?idConsulta=0")).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.GetAsync("/api/tratamientos?pageSize=101")).StatusCode);
    }

    [Fact]
    public async Task ActualizacionConservaConsultaYNoDescuentaLote()
    {
        using var factory = new TratamientoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        await factory.SeedTratamientosAsync();
        await factory.GrantAsync(modificar: true);
        using var client = factory.CreateClient();
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/tratamientos/1", new
            {
                IdConsulta = 2, Descripcion = "Cambio", FechaInicio = Inicio
            })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await client.PutAsJsonAsync("/api/tratamientos/1",
                Actualizar(idLote: 999))).StatusCode);
        var response = await client.PutAsJsonAsync("/api/tratamientos/1",
            Actualizar(idLote: 1, cantidad: 4));
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var dto = await response.Content.ReadFromJsonAsync<TratamientoResponseDto>();
        Assert.NotNull(dto);
        Assert.Equal(1, dto.IdConsulta);
        Assert.Equal(1, dto.IdMedico);
        Assert.Equal(1, dto.IdLote);
        Assert.Equal((short?)4, dto.Cantidad);
        Assert.Equal("Tratamiento revisado", dto.Descripcion);
        Assert.Equal(1, (await factory.GetTratamientoAsync(1)).IdConsulta);
        Assert.Equal(50, await factory.StockAsync());
        Assert.Equal(0, await factory.MovimientosAsync());
        await factory.SetUserEmployeeAsync(2);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/tratamientos/1", Actualizar())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound,
            (await client.PutAsJsonAsync("/api/tratamientos/999", Actualizar())).StatusCode);
    }

    [Fact]
    public async Task JwtPermisosYUsuarioActivoProtegenRutas()
    {
        using var factory = new TratamientoApiFactory();
        var password = await factory.SeedAsync(idEmpleadoUsuario: 1);
        using var client = factory.CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/tratamientos")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.PostAsJsonAsync("/api/tratamientos", Nuevo())).StatusCode);
        await LoginAsync(client, password);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/tratamientos")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PostAsJsonAsync("/api/tratamientos", Nuevo())).StatusCode);
        await factory.GrantAsync(consultar: true, crear: true);
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/tratamientos")).StatusCode);
        Assert.Equal(HttpStatusCode.Created,
            (await client.PostAsJsonAsync("/api/tratamientos", Nuevo())).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.PutAsJsonAsync("/api/tratamientos/1", Actualizar())).StatusCode);
        await factory.SetUserActiveAsync(false);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/tratamientos")).StatusCode);
    }

    [Fact]
    public void ModeloEfConservaOchoColumnasDosFkYMedicoNoPersistente()
    {
        using var db = new ClinicaDbContext(new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);
        var entity = db.Model.FindEntityType(typeof(Tratamiento));
        Assert.NotNull(entity);
        Assert.Equal(8, entity.GetProperties().Count());
        Assert.Equal(2, entity.GetForeignKeys().Count());
        Assert.Null(entity.FindProperty(nameof(Tratamiento.IdMedico)));
        Assert.False(entity.FindProperty(nameof(Tratamiento.IdLote))!.IsShadowProperty());
        Assert.False(entity.FindProperty(nameof(Tratamiento.Cantidad))!.IsShadowProperty());
    }

    private static TratamientoCreateDto Nuevo(
        int idConsulta = 1, int? idLote = null, int? cantidad = null,
        string descripcion = " Tratamiento   indicado ",
        string? indicaciones = " Tomar   con agua ", DateOnly? fin = null) => new()
    {
        IdConsulta = idConsulta, IdLote = idLote, Cantidad = cantidad,
        Descripcion = descripcion, Indicaciones = indicaciones,
        FechaInicio = Inicio, FechaFin = fin ?? new DateOnly(2026, 6, 5)
    };

    private static TratamientoUpdateDto Actualizar(int? idLote = null, int? cantidad = null) => new()
    {
        Descripcion = " Tratamiento   revisado ", Indicaciones = "Con alimento",
        FechaInicio = Inicio, FechaFin = new DateOnly(2026, 6, 6),
        IdLote = idLote, Cantidad = cantidad
    };

    private static async Task LoginAsync(HttpClient client, string password)
    {
        var login = await client.PostAsJsonAsync("/api/auth/login",
            new LoginRequest { Username = "tratamientos.prueba", Password = password });
        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
        var response = await login.Content.ReadFromJsonAsync<LoginResponse>();
        Assert.NotNull(response);
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", response.AccessToken);
    }

    private sealed class TratamientoApiFactory : WebApplicationFactory<Program>
    {
        private readonly string databaseName = Guid.NewGuid().ToString("N");
        private readonly string signingKey = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Development");
            builder.ConfigureLogging(logging => logging.ClearProviders());
            builder.ConfigureAppConfiguration((_, configuration) =>
                configuration.AddInMemoryCollection(new Dictionary<string, string?>
                {
                    ["ConnectionStrings:DefaultConnection"] = "Server=(local);Database=NotUsedInMemory;Trusted_Connection=True;TrustServerCertificate=True",
                    ["Jwt:Issuer"] = "API-Clinica.Tests",
                    ["Jwt:Audience"] = "API-Clinica.Tests.Client",
                    ["Jwt:SigningKey"] = signingKey,
                    ["Jwt:ExpirationMinutes"] = "60",
                    ["Logging:EventLog:LogLevel:Default"] = "None"
                }));
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<DbContextOptions<ClinicaDbContext>>();
                services.RemoveAll<ClinicaDbContext>();
                services.AddSingleton(new DbContextOptionsBuilder<ClinicaDbContext>()
                    .UseInMemoryDatabase(databaseName).Options);
                services.AddScoped<ClinicaDbContext>();
            });
        }

        public async Task<string> SeedAsync(int? idEmpleadoUsuario)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher<Usuario>>();
            var password = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
            db.Roles.Add(new Rol { IdRol = 1, Nombre = "Prueba", Activo = true });
            db.Sucursales.Add(new Sucursal { IdSucursal = 1, Nombre = "Prueba", Activa = true });
            db.Empleados.AddRange(Empleado(1, true), Empleado(2, true));
            var user = new Usuario
            {
                IdUsuario = 1, IdRol = 1, IdEmpleado = idEmpleadoUsuario,
                Username = "tratamientos.prueba", Activo = true
            };
            user.PasswordHash = hasher.HashPassword(user, password);
            db.Usuarios.Add(user);
            db.Pacientes.Add(new Paciente
            {
                IdPaciente = 1, Nombres = "Prueba", Apellidos = "Paciente",
                FechaNacimiento = new DateOnly(2000, 1, 1),
                FechaRegistro = DateTime.UtcNow, Activo = true
            });
            db.Categorias.Add(new Categoria { IdCategoria = 1, Nombre = "Prueba", Activa = true });
            db.Marcas.Add(new Marca { IdMarca = 1, Nombre = "Prueba", Activa = true });
            db.Medicamentos.Add(new Medicamento
            {
                IdMedicamento = 1, IdCategoria = 1, IdMarca = 1,
                Codigo = "TRAT-MED-1", Nombre = "Prueba", PrecioVenta = 10, Activo = true
            });
            await db.SaveChangesAsync();
            db.LoteMedicamentos.Add(new LoteMedicamento
            {
                IdLote = 1, IdMedicamento = 1, NumeroLote = "TRAT-LOTE-1",
                FechaIngreso = new DateOnly(2026, 1, 1),
                FechaVencimiento = new DateOnly(2027, 1, 1), CantidadDisponible = 50
            });
            db.Consultas.AddRange(
                new Consulta { IdConsulta = 1, IdPaciente = 1, IdMedico = 1,
                    IdSucursal = 1, FechaConsulta = DateTime.UtcNow },
                new Consulta { IdConsulta = 2, IdPaciente = 1, IdMedico = 2,
                    IdSucursal = 1, FechaConsulta = DateTime.UtcNow });
            await db.SaveChangesAsync();
            return password;
        }

        public async Task GrantAsync(bool consultar = false, bool crear = false,
            bool modificar = false)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            var permiso = await db.Permisos.SingleOrDefaultAsync(p => p.Modulo == "Historial");
            if (permiso is null)
                db.Permisos.Add(new Permiso { IdRol = 1, Modulo = "Historial",
                    PuedeConsultar = consultar, PuedeCrear = crear, PuedeModificar = modificar });
            else
            {
                permiso.PuedeConsultar |= consultar;
                permiso.PuedeCrear |= crear;
                permiso.PuedeModificar |= modificar;
            }
            await db.SaveChangesAsync();
        }

        public async Task SeedTratamientosAsync()
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            db.Tratamientos.AddRange(
                new Tratamiento { IdTratamiento = 1, IdConsulta = 1,
                    Descripcion = "Uno", FechaInicio = Inicio },
                new Tratamiento { IdTratamiento = 2, IdConsulta = 1,
                    Descripcion = "Dos", FechaInicio = Inicio },
                new Tratamiento { IdTratamiento = 3, IdConsulta = 2,
                    Descripcion = "Tres", FechaInicio = Inicio });
            await db.SaveChangesAsync();
        }

        public async Task<Tratamiento> GetTratamientoAsync(int id)
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Tratamientos.AsNoTracking().SingleAsync(t => t.IdTratamiento == id);
        }

        public async Task<int> StockAsync()
        {
            using var scope = Services.CreateScope();
            return (await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .LoteMedicamentos.AsNoTracking().SingleAsync()).CantidadDisponible;
        }

        public async Task<int> MovimientosAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .MovimientosInventario.CountAsync();
        }

        public async Task<int> CountAsync()
        {
            using var scope = Services.CreateScope();
            return await scope.ServiceProvider.GetRequiredService<ClinicaDbContext>()
                .Tratamientos.CountAsync();
        }

        public async Task SetUserEmployeeAsync(int id)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).IdEmpleado = id;
            await db.SaveChangesAsync();
        }

        public async Task SetEmployeeActiveAsync(int id, bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Empleados.SingleAsync(e => e.IdEmpleado == id)).Activo = active;
            await db.SaveChangesAsync();
        }

        public async Task SetUserActiveAsync(bool active)
        {
            using var scope = Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ClinicaDbContext>();
            (await db.Usuarios.SingleAsync()).Activo = active;
            await db.SaveChangesAsync();
        }

        private static Empleado Empleado(int id, bool activo) => new()
        {
            IdEmpleado = id, IdSucursal = 1, Nombres = "Prueba", Apellidos = "Médico",
            DPI = $"TRATAMIENTO-TEST-{id}", TipoEmpleado = "Medico", Activo = activo
        };
    }
}
