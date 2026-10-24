using System.Security.Claims;
using API_Clinica.Common;
using API_Clinica.Controllers;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using API_Clinica.Services;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Tests;

public sealed class RecetasFarmaciaTests
{
    private static readonly ClaimsPrincipal Principal = new(
        new ClaimsIdentity([new Claim("IdUsuario", "1")], "prueba"));

    [Fact]
    public void AmbosGetExigenVentasConsultar()
    {
        foreach (var metodo in new[] { nameof(RecetasFarmaciaController.Listar),
                     nameof(RecetasFarmaciaController.Obtener) })
        {
            var action = typeof(RecetasFarmaciaController).GetMethod(metodo)!;
            var permiso = Assert.Single(action.GetCustomAttributes(typeof(PermisoRequeridoAttribute), true)
                .Cast<PermisoRequeridoAttribute>());
            Assert.Equal("Permiso:Ventas:Consultar", permiso.Policy);
        }
    }

    [Fact]
    public async Task ListaSoloSucursalAutorizadaConDatosDelCatalogoYPaginacion()
    {
        await using var db = CrearContexto();
        await SembrarAsync(db);
        var servicio = CrearServicio(db);

        var pagina = await servicio.ListarAsync(1, 1, null, Principal, default);
        Assert.Equal(2, pagina.TotalCount);
        Assert.Equal(2, pagina.TotalPages);
        var receta = Assert.Single(pagina.Items);
        Assert.Equal(12, receta.IdReceta);
        Assert.Equal(101, receta.IdConsulta);
        Assert.Equal("Paciente Uno", receta.NombrePaciente);
        Assert.Equal("Doctora Uno", receta.NombreMedicoPrescriptor);
        Assert.Equal("Vigente", receta.Estado);
        var linea = Assert.Single(receta.Medicamentos);
        Assert.Equal("Medicamento sintético", linea.NombreMedicamento);
        Assert.Equal("Caja", linea.Presentacion);
        Assert.Equal(4, linea.CantidadPrescritaUnidades);

        var segunda = await servicio.ListarAsync(2, 1, null, Principal, default);
        Assert.Equal(11, Assert.Single(segunda.Items).IdReceta);
        var filtrada = await servicio.ListarAsync(1, 10, 101, Principal, default);
        Assert.Equal(1, filtrada.TotalCount);
        Assert.Equal(12, Assert.Single(filtrada.Items).IdReceta);
        Assert.Empty((await servicio.ListarAsync(3, 10, null, Principal, default)).Items);
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task DetalleDeOtraSucursalNoSeRevela()
    {
        await using var db = CrearContexto();
        await SembrarAsync(db);
        var servicio = CrearServicio(db);
        await Assert.ThrowsAsync<NotFoundException>(() =>
            servicio.ObtenerAsync(13, Principal, default));
        Assert.Equal(12, (await servicio.ObtenerAsync(12, Principal, default)).IdReceta);
    }

    [Fact]
    public async Task DetalleIncluyeTodasLasLineasEnOrdenSinModificarExistencias()
    {
        await using var db = CrearContexto();
        await SembrarAsync(db);
        db.RecetaLineas.Add(new RecetaLinea
        {
            IdRecetaLinea = 4, IdReceta = 12, IdMedicamento = 5,
            Orden = 2, CantidadPrescritaUnidades = 9
        });
        await db.SaveChangesAsync();

        var detalle = await CrearServicio(db).ObtenerAsync(12, Principal, default);
        Assert.Equal(new[] { 4, 9 }, detalle.Medicamentos
            .Select(linea => linea.CantidadPrescritaUnidades));
        Assert.Empty(await db.MovimientosInventario.ToListAsync());
    }

    [Fact]
    public async Task SinPermisoOEmpleadoActivoNoLeeRecetas()
    {
        await using var db = CrearContexto();
        await SembrarAsync(db);
        var servicio = CrearServicio(db);
        (await db.Permisos.SingleAsync()).PuedeConsultar = false;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            servicio.ListarAsync(1, 10, null, Principal, default));

        (await db.Permisos.SingleAsync()).PuedeConsultar = true;
        (await db.Empleados.SingleAsync(e => e.IdEmpleado == 1)).Activo = false;
        await db.SaveChangesAsync();
        await Assert.ThrowsAsync<ForbiddenException>(() =>
            servicio.ObtenerAsync(12, Principal, default));
    }

    [Fact]
    public async Task RechazaPaginacionYFiltroInvalidos()
    {
        await using var db = CrearContexto();
        var servicio = CrearServicio(db);
        await Assert.ThrowsAsync<AppValidationException>(() =>
            servicio.ListarAsync(0, 10, null, Principal, default));
        await Assert.ThrowsAsync<AppValidationException>(() =>
            servicio.ListarAsync(1, 101, null, Principal, default));
        await Assert.ThrowsAsync<AppValidationException>(() =>
            servicio.ListarAsync(1, 10, 0, Principal, default));
    }

    private static ClinicaDbContext CrearContexto() => new(
        new DbContextOptionsBuilder<ClinicaDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N")).Options);

    private static RecetaFarmaciaService CrearServicio(ClinicaDbContext db) =>
        new(db, new AccesoDoble(db), new CommonParameterValidator());

    private static async Task SembrarAsync(ClinicaDbContext db)
    {
        db.Empleados.AddRange(
            new Empleado { IdEmpleado = 1, IdSucursal = 1, Nombres = "Farmacia", Apellidos = "Uno", DPI = "1", TipoEmpleado = "Administrativo", Activo = true },
            new Empleado { IdEmpleado = 2, IdSucursal = 1, Nombres = "Doctora", Apellidos = "Uno", DPI = "2", TipoEmpleado = "Medico", Activo = true },
            new Empleado { IdEmpleado = 3, IdSucursal = 2, Nombres = "Doctor", Apellidos = "Dos", DPI = "3", TipoEmpleado = "Medico", Activo = true });
        await db.SaveChangesAsync();
        db.Usuarios.AddRange(
            new Usuario { IdUsuario = 1, IdRol = 1, IdEmpleado = 1, Username = "farmacia", PasswordHash = "prueba", Activo = true },
            new Usuario { IdUsuario = 2, IdRol = 2, IdEmpleado = 2, Username = "medico1", PasswordHash = "prueba", Activo = true },
            new Usuario { IdUsuario = 3, IdRol = 2, IdEmpleado = 3, Username = "medico2", PasswordHash = "prueba", Activo = true });
        db.Permisos.Add(new Permiso { IdPermiso = 1, IdRol = 1, Modulo = "Ventas", PuedeConsultar = true });
        db.Pacientes.Add(new Paciente { IdPaciente = 1, Nombres = "Paciente", Apellidos = "Uno", FechaNacimiento = new DateOnly(1990, 1, 1), Activo = true });
        db.Consultas.AddRange(
            new Consulta { IdConsulta = 100, IdPaciente = 1, IdMedico = 2, IdSucursal = 1, FechaConsulta = new DateTime(2026, 10, 20) },
            new Consulta { IdConsulta = 101, IdPaciente = 1, IdMedico = 2, IdSucursal = 1, FechaConsulta = new DateTime(2026, 10, 21) },
            new Consulta { IdConsulta = 102, IdPaciente = 1, IdMedico = 3, IdSucursal = 2, FechaConsulta = new DateTime(2026, 10, 22) });
        db.Tratamientos.AddRange(
            new Tratamiento { IdTratamiento = 20, IdConsulta = 100, IdMedico = 2, Descripcion = "Prueba", FechaInicio = new DateOnly(2026, 10, 20) },
            new Tratamiento { IdTratamiento = 21, IdConsulta = 101, IdMedico = 2, Descripcion = "Prueba", FechaInicio = new DateOnly(2026, 10, 21) },
            new Tratamiento { IdTratamiento = 22, IdConsulta = 102, IdMedico = 3, Descripcion = "Prueba", FechaInicio = new DateOnly(2026, 10, 22) });
        db.RecetasClinicas.AddRange(
            Receta(11, 20, 2, 20), Receta(12, 21, 2, 21), Receta(13, 22, 3, 22));
        db.Medicamentos.Add(new Medicamento
        {
            IdMedicamento = 5, IdCategoria = 1, IdMarca = 1, Codigo = "M-5",
            Nombre = "Medicamento sintético", PrecioVenta = 1, Activo = true
        });
        db.Entry(db.Medicamentos.Local.Single()).Property("Presentacion").CurrentValue = "Caja";
        db.RecetaLineas.AddRange(
            new RecetaLinea { IdRecetaLinea = 1, IdReceta = 11, IdMedicamento = 5, Orden = 1, CantidadPrescritaUnidades = 2 },
            new RecetaLinea { IdRecetaLinea = 2, IdReceta = 12, IdMedicamento = 5, Orden = 1, CantidadPrescritaUnidades = 4 },
            new RecetaLinea { IdRecetaLinea = 3, IdReceta = 13, IdMedicamento = 5, Orden = 1, CantidadPrescritaUnidades = 7 });
        await db.SaveChangesAsync();
    }

    private static RecetaClinica Receta(int id, int tratamiento, int prescriptor, int dia) => new()
    {
        IdReceta = id, IdTratamiento = tratamiento, IdDiagnostico = 1,
        IdUsuarioPrescriptor = prescriptor, NumeroVersion = 1, Estado = "Vigente",
        FechaPrescripcionUtc = new DateTime(2026, 10, dia),
        ClaveOperacion = Guid.NewGuid(), HashSolicitud = new byte[32]
    };

    private sealed class AccesoDoble(ClinicaDbContext db) : IAccesoActualService
    {
        public Task<Usuario?> ObtenerUsuarioActivoAsync(ClaimsPrincipal principal, CancellationToken ct) =>
            db.Usuarios.AsNoTracking().SingleOrDefaultAsync(u => u.IdUsuario == 1, ct)!;

        public Task<IReadOnlyList<PermisoActualResponse>> ObtenerPermisosAsync(
            ClaimsPrincipal principal, CancellationToken ct) =>
            Task.FromResult<IReadOnlyList<PermisoActualResponse>>([]);
    }
}
