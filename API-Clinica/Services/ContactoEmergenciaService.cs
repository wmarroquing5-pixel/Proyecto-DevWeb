using System.ComponentModel.DataAnnotations;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class ContactoEmergenciaService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator) : IContactoEmergenciaService
{
    private static readonly EmailAddressAttribute EmailValidator = new();

    public async Task<PagedResponse<ContactoEmergenciaResponseDto>> ListarAsync(
        int? idPaciente, int page, int pageSize, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(page, pageSize);
        if (idPaciente is <= 0)
            throw Invalid(nameof(idPaciente), "Debe ser mayor que cero.");

        var query = context.ContactosEmergencia.AsNoTracking();
        if (idPaciente.HasValue)
            query = query.Where(c => c.IdPaciente == idPaciente.Value);

        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(c => c.IdContacto)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(c => new ContactoEmergenciaResponseDto(c.IdContacto, c.Nombres,
                c.Apellidos, c.Telefono, c.Direccion, c.CorreoElectronico,
                c.Parentesco, c.Activo, c.IdPaciente))
            .ToListAsync(cancellationToken);
        return new(items, page, pageSize, total);
    }

    public async Task<ContactoEmergenciaResponseDto> ObtenerAsync(
        int id, CancellationToken cancellationToken) =>
        await context.ContactosEmergencia.AsNoTracking()
            .Where(c => c.IdContacto == id)
            .Select(c => new ContactoEmergenciaResponseDto(c.IdContacto, c.Nombres,
                c.Apellidos, c.Telefono, c.Direccion, c.CorreoElectronico,
                c.Parentesco, c.Activo, c.IdPaciente))
            .SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Contacto de emergencia no encontrado.");

    public async Task<ContactoEmergenciaResponseDto> CrearAsync(
        ContactoEmergenciaCreateDto request, CancellationToken cancellationToken)
    {
        var contacto = new ContactoEmergencia { Activo = true };
        await AplicarDatosAsync(contacto, request, cancellationToken);
        context.ContactosEmergencia.Add(contacto);
        await GuardarAsync(cancellationToken);
        return ToResponse(contacto);
    }

    public async Task<ContactoEmergenciaResponseDto> ActualizarAsync(
        int id, ContactoEmergenciaUpdateDto request, CancellationToken cancellationToken)
    {
        var contacto = await context.ContactosEmergencia.SingleOrDefaultAsync(
            c => c.IdContacto == id, cancellationToken)
            ?? throw new NotFoundException("Contacto de emergencia no encontrado.");
        await AplicarDatosAsync(contacto, request, cancellationToken);
        await GuardarAsync(cancellationToken);
        return ToResponse(contacto);
    }

    public async Task DesactivarAsync(int id, CancellationToken cancellationToken)
    {
        var contacto = await context.ContactosEmergencia.SingleOrDefaultAsync(
            c => c.IdContacto == id, cancellationToken)
            ?? throw new NotFoundException("Contacto de emergencia no encontrado.");
        if (!contacto.Activo) return;
        contacto.Activo = false;
        await context.SaveChangesAsync(cancellationToken);
    }

    private async Task AplicarDatosAsync(
        ContactoEmergencia contacto, ContactoEmergenciaDatosRequest request,
        CancellationToken cancellationToken)
    {
        var nombres = TextoObligatorio(request.Nombres, nameof(request.Nombres), 100);
        var apellidos = TextoObligatorio(request.Apellidos, nameof(request.Apellidos), 100);
        var telefono = TextoObligatorio(request.Telefono, nameof(request.Telefono), 20);
        var direccion = TextoObligatorio(request.Direccion, nameof(request.Direccion), 150);
        var correo = TextoOpcional(request.CorreoElectronico,
            nameof(request.CorreoElectronico), 75);
        var parentesco = TextoOpcional(request.Parentesco, nameof(request.Parentesco), 50);
        if (correo is not null && !EmailValidator.IsValid(correo))
            throw Invalid(nameof(request.CorreoElectronico),
                "El correo no tiene un formato válido.");
        if (request.IdPaciente is int idPaciente &&
            (idPaciente <= 0 || !await context.Pacientes.AsNoTracking()
                .AnyAsync(p => p.IdPaciente == idPaciente, cancellationToken)))
            throw Invalid(nameof(request.IdPaciente), "El paciente indicado no existe.");

        contacto.Nombres = nombres;
        contacto.Apellidos = apellidos;
        contacto.Telefono = telefono;
        contacto.Direccion = direccion;
        contacto.CorreoElectronico = correo;
        contacto.Parentesco = parentesco;
        contacto.IdPaciente = request.IdPaciente;
    }

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number == 547)
        {
            throw new ConflictException("El paciente indicado ya no está disponible.");
        }
    }

    private static string TextoObligatorio(string? valor, string campo, int maximo)
    {
        var texto = NormalizarEspacios(valor);
        if (texto.Length is 0 || texto.Length > maximo)
            throw Invalid(campo, $"Debe contener entre 1 y {maximo} caracteres.");
        return texto;
    }

    private static string? TextoOpcional(string? valor, string campo, int maximo)
    {
        var texto = NormalizarEspacios(valor);
        if (texto.Length > maximo)
            throw Invalid(campo, $"Máximo {maximo} caracteres.");
        return texto.Length == 0 ? null : texto;
    }

    private static string NormalizarEspacios(string? valor) =>
        string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos del contacto de emergencia no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static ContactoEmergenciaResponseDto ToResponse(ContactoEmergencia c) =>
        new(c.IdContacto, c.Nombres, c.Apellidos, c.Telefono, c.Direccion,
            c.CorreoElectronico, c.Parentesco, c.Activo, c.IdPaciente);
}
