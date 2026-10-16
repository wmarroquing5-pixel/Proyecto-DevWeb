using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class EmpleadoService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : IEmpleadoService
{
    private static readonly EmailAddressAttribute EmailValidator = new();
    private static readonly HashSet<string> TiposPermitidos =
        new(StringComparer.Ordinal) { "Medico", "Enfermera", "Administrativo" };

    private static readonly Expression<Func<Empleado, EmpleadoListadoResponse>> ProyeccionListado = e =>
        new EmpleadoListadoResponse(e.IdEmpleado, e.IdSucursal, e.Nombres,
            e.Apellidos, e.TipoEmpleado, e.Activo);

    private static readonly Expression<Func<Empleado, EmpleadoDetalleResponse>> ProyeccionDetalle = e =>
        new EmpleadoDetalleResponse(e.IdEmpleado, e.IdSucursal, e.IdEspecialidad,
            e.Nombres, e.Apellidos, e.DPI, e.TipoEmpleado, e.Activo,
            e.FechaIngreso, e.TipoSangre, e.IdTurno, e.Direccion,
            e.Telefono, e.CorreoElectronico);

    public async Task<PagedResponse<EmpleadoListadoResponse>> ListarAsync(
        string? nombre, string? tipoEmpleado, int? idSucursal, bool? activo,
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var nombreFiltrado = TextoOpcional(nombre, nameof(nombre), 100);
        var tipoFiltrado = TextoOpcional(tipoEmpleado, nameof(tipoEmpleado), 30);
        if (tipoFiltrado is not null) ValidarTipo(tipoFiltrado);
        if (idSucursal is <= 0)
            throw Invalid(nameof(idSucursal), "Debe ser mayor que cero.");

        var query = context.Empleados.AsNoTracking();
        if (activo.HasValue) query = query.Where(e => e.Activo == activo.Value);
        if (idSucursal.HasValue) query = query.Where(e => e.IdSucursal == idSucursal.Value);
        if (tipoFiltrado is not null) query = query.Where(e => e.TipoEmpleado == tipoFiltrado);
        if (nombreFiltrado is not null)
        {
            var patron = nombreFiltrado.ToLowerInvariant();
            query = query.Where(e => e.Nombres.ToLower().Contains(patron) ||
                e.Apellidos.ToLower().Contains(patron));
        }

        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(e => e.IdEmpleado)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(ProyeccionListado).ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<EmpleadoDetalleResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Empleados.AsNoTracking()
            .Where(e => e.IdEmpleado == id)
            .Select(ProyeccionDetalle)
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Empleado no encontrado.");

    public async Task<EmpleadoDetalleResponse> CrearAsync(
        CrearEmpleadoRequest request, CancellationToken cancellationToken)
    {
        var empleado = new Empleado { Activo = true };
        AplicarDatos(empleado, request);
        await ValidarRelacionesAsync(empleado, cancellationToken);
        await VerificarDpiDisponibleAsync(empleado.DPI, null, cancellationToken);
        context.Empleados.Add(empleado);
        await GuardarAsync(cancellationToken);
        return ToResponse(empleado);
    }

    public async Task<EmpleadoDetalleResponse> ActualizarAsync(
        int id, ActualizarEmpleadoRequest request, CancellationToken cancellationToken)
    {
        var empleado = await context.Empleados.SingleOrDefaultAsync(
            e => e.IdEmpleado == id, cancellationToken)
            ?? throw new NotFoundException("Empleado no encontrado.");
        if (!empleado.Activo)
            throw new ConflictException("No se puede modificar un empleado inactivo.");

        var eraMedico = empleado.TipoEmpleado == "Medico";
        AplicarDatos(empleado, request);
        if (eraMedico && empleado.TipoEmpleado != "Medico" &&
            await context.Consultas.AsNoTracking()
                .AnyAsync(c => c.IdMedico == id, cancellationToken))
            throw new ConflictException("Un médico con consultas registradas debe conservar su tipo de empleado.");

        await ValidarRelacionesAsync(empleado, cancellationToken);
        await VerificarDpiDisponibleAsync(empleado.DPI, id, cancellationToken);
        await GuardarAsync(cancellationToken);
        return ToResponse(empleado);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var empleado = await context.Empleados.SingleOrDefaultAsync(
            e => e.IdEmpleado == id, cancellationToken)
            ?? throw new NotFoundException("Empleado no encontrado.");
        if (!empleado.Activo) return;
        empleado.Activo = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task ValidarRelacionesAsync(Empleado empleado, CancellationToken cancellationToken)
    {
        if (empleado.IdSucursal <= 0 || !await context.Sucursales.AsNoTracking()
            .AnyAsync(s => s.IdSucursal == empleado.IdSucursal, cancellationToken))
            throw Invalid("IdSucursal", "La sucursal indicada no existe.");
        if (empleado.IdEspecialidad is int idEspecialidad &&
            (idEspecialidad <= 0 || !await context.Especialidades.AsNoTracking()
                .AnyAsync(e => e.IdEspecialidad == idEspecialidad, cancellationToken)))
            throw Invalid("IdEspecialidad", "La especialidad indicada no existe.");
        if (empleado.IdTurno is int idTurno &&
            (idTurno <= 0 || !await context.Turnos.AsNoTracking()
                .AnyAsync(t => t.IdTurno == idTurno, cancellationToken)))
            throw Invalid("IdTurno", "El turno indicado no existe.");
    }

    private async Task VerificarDpiDisponibleAsync(
        string dpi, int? idActual, CancellationToken cancellationToken)
    {
        if (await context.Empleados.AsNoTracking().AnyAsync(
            e => e.DPI == dpi && (!idActual.HasValue || e.IdEmpleado != idActual.Value),
            cancellationToken))
            throw new ConflictException("El DPI ya está registrado.");
    }

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627)
        {
            throw new ConflictException("El DPI ya está registrado.");
        }
    }

    private static void AplicarDatos(Empleado empleado, EmpleadoDatosRequest request)
    {
        empleado.IdSucursal = request.IdSucursal;
        empleado.IdEspecialidad = request.IdEspecialidad;
        empleado.Nombres = TextoObligatorio(request.Nombres, nameof(request.Nombres), 100);
        empleado.Apellidos = TextoObligatorio(request.Apellidos, nameof(request.Apellidos), 100);
        empleado.DPI = TextoObligatorio(request.DPI, nameof(request.DPI), 20);
        empleado.TipoEmpleado = TextoObligatorio(request.TipoEmpleado, nameof(request.TipoEmpleado), 30);
        ValidarTipo(empleado.TipoEmpleado);
        if (request.FechaIngreso == DateOnly.MinValue)
            throw Invalid(nameof(request.FechaIngreso), "La fecha de ingreso no es válida.");
        empleado.FechaIngreso = request.FechaIngreso;
        empleado.TipoSangre = TextoOpcional(request.TipoSangre, nameof(request.TipoSangre), 10);
        empleado.IdTurno = request.IdTurno;
        empleado.Direccion = TextoOpcional(request.Direccion, nameof(request.Direccion), 150);
        empleado.Telefono = TextoOpcional(request.Telefono, nameof(request.Telefono), 12);
        empleado.CorreoElectronico = TextoOpcional(request.CorreoElectronico, nameof(request.CorreoElectronico), 150);
        if (empleado.CorreoElectronico is not null &&
            !EmailValidator.IsValid(empleado.CorreoElectronico))
            throw Invalid(nameof(request.CorreoElectronico), "El correo no tiene un formato válido.");
    }

    private static void ValidarTipo(string tipo)
    {
        if (!TiposPermitidos.Contains(tipo))
            throw Invalid("TipoEmpleado", "Debe ser Medico, Enfermera o Administrativo.");
    }

    private static string TextoObligatorio(string? valor, string campo, int longitudMaxima)
    {
        var normalizado = NormalizarEspacios(valor);
        if (normalizado.Length is 0 || normalizado.Length > longitudMaxima)
            throw Invalid(campo, $"Debe contener entre 1 y {longitudMaxima} caracteres.");
        return normalizado;
    }

    private static string? TextoOpcional(string? valor, string campo, int longitudMaxima)
    {
        var normalizado = NormalizarEspacios(valor);
        if (normalizado.Length > longitudMaxima)
            throw Invalid(campo, $"Máximo {longitudMaxima} caracteres.");
        return normalizado.Length == 0 ? null : normalizado;
    }

    private static string NormalizarEspacios(string? valor) =>
        string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del empleado no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static EmpleadoDetalleResponse ToResponse(Empleado e) =>
        new(e.IdEmpleado, e.IdSucursal, e.IdEspecialidad, e.Nombres,
            e.Apellidos, e.DPI, e.TipoEmpleado, e.Activo, e.FechaIngreso,
            e.TipoSangre, e.IdTurno, e.Direccion, e.Telefono, e.CorreoElectronico);
}
