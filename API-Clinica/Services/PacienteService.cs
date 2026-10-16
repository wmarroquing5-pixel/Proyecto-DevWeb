using System.ComponentModel.DataAnnotations;
using System.Linq.Expressions;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class PacienteService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : IPacienteService
{
    private static readonly EmailAddressAttribute EmailValidator = new();

    private static readonly Expression<Func<Paciente, PacienteResponse>> Proyeccion = p =>
        new PacienteResponse(p.IdPaciente, p.Nombres, p.Apellidos, p.DPI,
            p.FechaNacimiento, p.Sexo, p.Telefono, p.Correo, p.FechaRegistro,
            p.Activo, p.TipoSangre, p.Nit, p.NombreFacturacion, p.Direccion, p.UrlFoto);

    private static readonly Expression<Func<Paciente, PacienteListadoResponse>> ProyeccionListado = p =>
        new PacienteListadoResponse(p.IdPaciente, p.Nombres, p.Apellidos, p.Activo);

    public async Task<PagedResponse<PacienteListadoResponse>> ListarAsync(
        string? nombre, bool? activo, int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var nombreFiltrado = TextoOpcional(nombre, nameof(nombre), 100);
        var query = context.Pacientes.AsNoTracking();
        if (activo.HasValue)
            query = query.Where(p => p.Activo == activo.Value);
        if (nombreFiltrado is not null)
        {
            var patron = nombreFiltrado.ToLowerInvariant();
            query = query.Where(p => p.Nombres.ToLower().Contains(patron) ||
                p.Apellidos.ToLower().Contains(patron));
        }

        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(p => p.IdPaciente)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(ProyeccionListado).ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<PacienteResponse> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Pacientes.AsNoTracking()
            .Where(p => p.IdPaciente == id)
            .Select(Proyeccion)
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Paciente no encontrado.");

    public async Task<PacienteResponse> CrearAsync(
        GuardarPacienteRequest request, CancellationToken cancellationToken)
    {
        var paciente = new Paciente { FechaRegistro = DateTime.UtcNow, Activo = true };
        AplicarDatos(paciente, request);
        context.Pacientes.Add(paciente);
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(paciente);
    }

    public async Task<PacienteResponse> ActualizarAsync(
        int id, GuardarPacienteRequest request, CancellationToken cancellationToken)
    {
        var paciente = await context.Pacientes.SingleOrDefaultAsync(
            p => p.IdPaciente == id, cancellationToken)
            ?? throw new NotFoundException("Paciente no encontrado.");
        if (!paciente.Activo)
            throw new ConflictException("No se puede modificar un paciente inactivo.");

        AplicarDatos(paciente, request);
        await context.SaveChangesAsync(cancellationToken);
        return ToResponse(paciente);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var paciente = await context.Pacientes.SingleOrDefaultAsync(
            p => p.IdPaciente == id, cancellationToken)
            ?? throw new NotFoundException("Paciente no encontrado.");
        if (!paciente.Activo) return;
        paciente.Activo = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private static void AplicarDatos(Paciente paciente, GuardarPacienteRequest request)
    {
        paciente.Nombres = TextoObligatorio(request.Nombres, nameof(request.Nombres), 100);
        paciente.Apellidos = TextoObligatorio(request.Apellidos, nameof(request.Apellidos), 100);
        paciente.DPI = TextoOpcional(request.DPI, nameof(request.DPI), 20);
        paciente.FechaNacimiento = FechaValida(request.FechaNacimiento);
        paciente.Sexo = TextoOpcional(request.Genero, nameof(request.Genero), 1);
        paciente.Telefono = TextoOpcional(request.Telefono, nameof(request.Telefono), 20);
        paciente.Correo = TextoOpcional(request.Correo, nameof(request.Correo), 100);
        if (paciente.Correo is not null && !EmailValidator.IsValid(paciente.Correo))
            throw Invalid(nameof(request.Correo), "El correo no tiene un formato válido.");
        paciente.TipoSangre = TextoOpcional(request.TipoSangre, nameof(request.TipoSangre), 10);
        paciente.Nit = TextoOpcional(request.Nit, nameof(request.Nit), 50);
        paciente.NombreFacturacion = TextoOpcional(request.NombreFacturacion, nameof(request.NombreFacturacion), 150);
        paciente.Direccion = TextoOpcional(request.Direccion, nameof(request.Direccion), 150);
        paciente.UrlFoto = TextoOpcional(request.UrlFoto, nameof(request.UrlFoto), 500);
    }

    private static DateOnly FechaValida(DateOnly fecha)
    {
        if (fecha == DateOnly.MinValue || fecha > DateOnly.FromDateTime(DateTime.UtcNow))
            throw Invalid("FechaNacimiento", "La fecha de nacimiento debe existir y no ser futura.");
        return fecha;
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
        new("Datos del paciente no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static PacienteResponse ToResponse(Paciente p) =>
        new(p.IdPaciente, p.Nombres, p.Apellidos, p.DPI, p.FechaNacimiento,
            p.Sexo, p.Telefono, p.Correo, p.FechaRegistro, p.Activo,
            p.TipoSangre, p.Nit, p.NombreFacturacion, p.Direccion, p.UrlFoto);
}
