using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class RecetaFarmaciaService(
    ClinicaDbContext context,
    IAccesoActualService accesoActual,
    ICommonParameterValidator parametros) : IRecetaFarmaciaService
{
    public async Task<PagedResponse<RecetaFarmaciaDto>> ListarAsync(
        int page, int pageSize, int? idConsulta, ClaimsPrincipal principal,
        CancellationToken ct)
    {
        var pagination = parametros.ValidatePagination(page, pageSize);
        if (idConsulta is <= 0)
            throw new AppValidationException("La consulta no es válida.",
                new Dictionary<string, string[]> { ["IdConsulta"] = ["Debe ser mayor que cero."] });

        var sucursal = await SucursalAutorizadaAsync(principal, ct);
        var query = CabecerasAutorizadas(sucursal);
        if (idConsulta.HasValue)
            query = query.Where(receta => receta.IdConsulta == idConsulta.Value);

        var total = await query.LongCountAsync(ct);
        var cabeceras = await query.OrderByDescending(receta => receta.FechaPrescripcionUtc)
            .ThenByDescending(receta => receta.IdReceta)
            .Skip(pagination.Skip).Take(pagination.PageSize).ToListAsync(ct);
        var items = await AgregarLineasAsync(cabeceras, ct);
        return new(items, page, pageSize, total);
    }

    public async Task<RecetaFarmaciaDto> ObtenerAsync(
        int idReceta, ClaimsPrincipal principal, CancellationToken ct)
    {
        if (idReceta <= 0) throw new NotFoundException("Receta no encontrada.");
        var sucursal = await SucursalAutorizadaAsync(principal, ct);
        var cabecera = await CabecerasAutorizadas(sucursal)
            .SingleOrDefaultAsync(receta => receta.IdReceta == idReceta, ct)
            ?? throw new NotFoundException("Receta no encontrada.");
        return (await AgregarLineasAsync([cabecera], ct))[0];
    }

    private async Task<int> SucursalAutorizadaAsync(ClaimsPrincipal principal, CancellationToken ct)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
            ?? throw new ForbiddenException("Acceso denegado.");
        var permisos = await context.Permisos.AsNoTracking()
            .Where(permiso => permiso.IdRol == usuario.IdRol && permiso.Modulo == "Ventas")
            .Take(2).ToListAsync(ct);
        if (permisos.Count != 1 || !permisos[0].PuedeConsultar || !usuario.IdEmpleado.HasValue)
            throw new ForbiddenException("No tienes acceso a recetas de farmacia.");

        return await context.Empleados.AsNoTracking()
            .Where(empleado => empleado.IdEmpleado == usuario.IdEmpleado.Value && empleado.Activo)
            .Select(empleado => (int?)empleado.IdSucursal)
            .SingleOrDefaultAsync(ct)
            ?? throw new ForbiddenException("No tienes una sucursal activa asignada.");
    }

    private IQueryable<Cabecera> CabecerasAutorizadas(int idSucursal) =>
        from receta in context.RecetasClinicas.AsNoTracking()
        join tratamiento in context.Tratamientos.AsNoTracking()
            on receta.IdTratamiento equals tratamiento.IdTratamiento
        join consulta in context.Consultas.AsNoTracking()
            on tratamiento.IdConsulta equals consulta.IdConsulta
        join paciente in context.Pacientes.AsNoTracking()
            on consulta.IdPaciente equals paciente.IdPaciente
        join usuario in context.Usuarios.AsNoTracking()
            on receta.IdUsuarioPrescriptor equals usuario.IdUsuario
        join medico in context.Empleados.AsNoTracking()
            on usuario.IdEmpleado equals (int?)medico.IdEmpleado into medicos
        from medico in medicos.DefaultIfEmpty()
        where consulta.IdSucursal == idSucursal
        select new Cabecera(
            receta.IdReceta, consulta.IdConsulta,
            paciente.Nombres + " " + paciente.Apellidos,
            medico == null ? null : medico.Nombres + " " + medico.Apellidos,
            receta.FechaPrescripcionUtc, receta.Estado);

    private async Task<IReadOnlyList<RecetaFarmaciaDto>> AgregarLineasAsync(
        IReadOnlyList<Cabecera> cabeceras, CancellationToken ct)
    {
        if (cabeceras.Count == 0) return [];
        var ids = cabeceras.Select(receta => receta.IdReceta).ToArray();
        var lineas = await (
            from linea in context.RecetaLineas.AsNoTracking()
            join medicamento in context.Medicamentos.AsNoTracking()
                on linea.IdMedicamento equals medicamento.IdMedicamento
            where ids.Contains(linea.IdReceta)
            orderby linea.IdReceta, linea.Orden
            select new
            {
                linea.IdReceta,
                Linea = new RecetaFarmaciaLineaDto(linea.IdMedicamento, medicamento.Nombre,
                    EF.Property<string?>(medicamento, "Presentacion"),
                    linea.CantidadPrescritaUnidades)
            }).ToListAsync(ct);
        var porReceta = lineas.GroupBy(linea => linea.IdReceta)
            .ToDictionary(grupo => grupo.Key,
                grupo => (IReadOnlyList<RecetaFarmaciaLineaDto>)grupo.Select(x => x.Linea).ToArray());
        return cabeceras.Select(receta => new RecetaFarmaciaDto(
            receta.IdReceta, receta.IdConsulta, receta.NombrePaciente,
            receta.NombreMedicoPrescriptor,
            DateTime.SpecifyKind(receta.FechaPrescripcionUtc, DateTimeKind.Utc),
            receta.Estado,
            porReceta.GetValueOrDefault(receta.IdReceta) ?? [])).ToArray();
    }

    private sealed record Cabecera(
        int IdReceta, int IdConsulta, string NombrePaciente,
        string? NombreMedicoPrescriptor, DateTime FechaPrescripcionUtc, string Estado);
}
