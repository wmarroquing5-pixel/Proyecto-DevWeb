using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class ServicioService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : IServicioService
{
    private static readonly HashSet<string> TiposPermitidos =
        ["Consulta", "Examen", "Habitacion", "Procedimiento", "Otro"];
    private const decimal MaximoPrecio = 9999999999999999.99m;

    public async Task<PagedResponse<ServicioResponseDto>> ListarAsync(
        int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        var query = context.Servicios.AsNoTracking();
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(s => s.IdServicio)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(s => new ServicioResponseDto(s.IdServicio, s.Codigo, s.Nombre,
                s.Descripcion, s.PrecioBase, s.TipoServicio, s.Activo))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<ServicioResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Servicios.AsNoTracking()
            .Where(s => s.IdServicio == id)
            .Select(s => new ServicioResponseDto(s.IdServicio, s.Codigo, s.Nombre,
                s.Descripcion, s.PrecioBase, s.TipoServicio, s.Activo))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Servicio no encontrado.");

    public async Task<ServicioResponseDto> CrearAsync(
        ServicioCreateDto request, CancellationToken cancellationToken)
    {
        var servicio = new Servicio { Activo = true };
        await AplicarDatosAsync(servicio, request, cancellationToken);
        context.Servicios.Add(servicio);
        await GuardarAsync(cancellationToken);
        return ToResponse(servicio);
    }

    public async Task<ServicioResponseDto> ActualizarAsync(
        int id, ServicioUpdateDto request, CancellationToken cancellationToken)
    {
        var servicio = await context.Servicios.SingleOrDefaultAsync(
            s => s.IdServicio == id, cancellationToken)
            ?? throw new NotFoundException("Servicio no encontrado.");
        await AplicarDatosAsync(servicio, request, cancellationToken);
        await GuardarAsync(cancellationToken);
        return ToResponse(servicio);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var servicio = await context.Servicios.SingleOrDefaultAsync(
            s => s.IdServicio == id, cancellationToken)
            ?? throw new NotFoundException("Servicio no encontrado.");
        if (!servicio.Activo) return;
        servicio.Activo = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task AplicarDatosAsync(
        Servicio servicio, ServicioDatosRequest request, CancellationToken cancellationToken)
    {
        var codigo = NormalizarEspacios(request.Codigo);
        var nombre = NormalizarEspacios(request.Nombre);
        var descripcion = NormalizarEspacios(request.Descripcion);
        var tipo = NormalizarEspacios(request.TipoServicio);
        ValidarLongitud(codigo, "Codigo", 50, true);
        ValidarLongitud(nombre, "Nombre", 150, true);
        ValidarLongitud(descripcion, "Descripcion", 300, false);
        ValidarLongitud(tipo, "TipoServicio", 50, true);

        if (request.PrecioBase < 0 || request.PrecioBase > MaximoPrecio ||
            decimal.Round(request.PrecioBase, 2) != request.PrecioBase)
            throw Invalid("PrecioBase", "Debe estar entre 0 y 9999999999999999.99 con máximo dos decimales.");
        if (!TiposPermitidos.Contains(tipo))
            throw Invalid("TipoServicio", "El tipo de servicio no está permitido por la base de datos.");
        if (await context.Servicios.AsNoTracking().AnyAsync(
            s => s.Codigo == codigo && s.IdServicio != servicio.IdServicio, cancellationToken))
            throw new ConflictException("El código del servicio ya está registrado.");

        servicio.Codigo = codigo;
        servicio.Nombre = nombre;
        servicio.Descripcion = descripcion.Length == 0 ? null : descripcion;
        servicio.PrecioBase = request.PrecioBase;
        servicio.TipoServicio = tipo;
    }

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627)
        {
            throw new ConflictException("El código del servicio ya está registrado.");
        }
    }

    private static void ValidarLongitud(string valor, string campo, int maximo, bool obligatorio)
    {
        if ((obligatorio && valor.Length == 0) || valor.Length > maximo)
            throw Invalid(campo, $"Debe contener entre {(obligatorio ? 1 : 0)} y {maximo} caracteres.");
    }

    private static string NormalizarEspacios(string? valor) =>
        string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del servicio no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static ServicioResponseDto ToResponse(Servicio s) =>
        new(s.IdServicio, s.Codigo, s.Nombre, s.Descripcion,
            s.PrecioBase, s.TipoServicio, s.Activo);
}
