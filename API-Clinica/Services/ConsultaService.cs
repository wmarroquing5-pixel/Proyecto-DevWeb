using System.Linq.Expressions;
using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class ConsultaService(
    ClinicaDbContext context,
    ICommonParameterValidator parameterValidator,
    IAccesoActualService accesoActual) : IConsultaService
{
    private static readonly Expression<Func<Consulta, ConsultaListadoDto>> Listado = c =>
        new ConsultaListadoDto(c.IdConsulta, c.IdPaciente, c.IdMedico,
            c.IdSucursal, c.IdClinica, c.FechaConsulta);

    private static readonly Expression<Func<Consulta, ConsultaDetalleDto>> Detalle = c =>
        new ConsultaDetalleDto(c.IdConsulta, c.IdPaciente, c.IdMedico,
            c.IdSucursal, c.IdClinica, c.FechaConsulta, c.MotivoConsulta,
            c.Sintomas, c.Observaciones, c.PesoLb, c.PresionDiastolica,
            c.PresionSistolica, c.AlturaCm);

    public async Task<PagedResponse<ConsultaListadoDto>> ListarAsync(
        ConsultaFiltroDto filtro, CancellationToken cancellationToken)
    {
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        ValidarFiltroId(filtro.IdPaciente, nameof(filtro.IdPaciente));
        ValidarFiltroId(filtro.IdMedico, nameof(filtro.IdMedico));
        ValidarFiltroId(filtro.IdSucursal, nameof(filtro.IdSucursal));
        ValidarFiltroId(filtro.IdClinica, nameof(filtro.IdClinica));
        if (filtro.Desde.HasValue && filtro.Hasta.HasValue && filtro.Desde > filtro.Hasta)
            throw Invalid(nameof(filtro.Hasta), "Debe ser posterior o igual a Desde.");

        var query = context.Consultas.AsNoTracking();
        if (filtro.IdPaciente.HasValue)
            query = query.Where(c => c.IdPaciente == filtro.IdPaciente.Value);
        if (filtro.IdMedico.HasValue)
            query = query.Where(c => c.IdMedico == filtro.IdMedico.Value);
        if (filtro.IdSucursal.HasValue)
            query = query.Where(c => c.IdSucursal == filtro.IdSucursal.Value);
        if (filtro.IdClinica.HasValue)
            query = query.Where(c => c.IdClinica == filtro.IdClinica.Value);
        if (filtro.Desde.HasValue)
            query = query.Where(c => c.FechaConsulta >= filtro.Desde.Value);
        if (filtro.Hasta.HasValue)
            query = query.Where(c => c.FechaConsulta <= filtro.Hasta.Value);

        var total = await query.LongCountAsync(cancellationToken);
        var items = await query.OrderBy(c => c.IdConsulta)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(Listado).ToListAsync(cancellationToken);
        return new(items, filtro.Page, filtro.PageSize, total);
    }

    public async Task<ConsultaDetalleDto> ObtenerAsync(int id, CancellationToken cancellationToken) =>
        await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == id)
            .Select(Detalle).SingleOrDefaultAsync(cancellationToken)
        ?? throw new NotFoundException("Consulta no encontrada.");

    public async Task<ConsultaDetalleDto> CrearAsync(
        ConsultaCreateDto request, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var usuario = await ObtenerUsuarioAsync(principal, cancellationToken);
        var idMedico = await ResolverMedicoAsync(usuario, request.IdMedico, null,
            cancellationToken);
        var consulta = new Consulta();
        await AplicarDatosAsync(consulta, request, idMedico, cancellationToken);
        context.Consultas.Add(consulta);
        await GuardarAsync(cancellationToken);
        return ToDetalle(consulta);
    }

    public async Task<ConsultaDetalleDto> ActualizarAsync(
        int id, ConsultaUpdateDto request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var usuario = await ObtenerUsuarioAsync(principal, cancellationToken);
        var consulta = await context.Consultas.SingleOrDefaultAsync(
            c => c.IdConsulta == id, cancellationToken)
            ?? throw new NotFoundException("Consulta no encontrada.");
        var idMedico = await ResolverMedicoAsync(usuario, request.IdMedico,
            consulta.IdMedico, cancellationToken);

        if ((consulta.IdPaciente != request.IdPaciente || consulta.IdMedico != idMedico ||
            consulta.IdSucursal != request.IdSucursal || consulta.IdClinica != request.IdClinica) &&
            await TieneRegistrosClinicosAsync(id, cancellationToken))
            throw new ConflictException(
                "Una consulta con registros clínicos no puede cambiar sus asociaciones.");

        await AplicarDatosAsync(consulta, request, idMedico, cancellationToken);
        await GuardarAsync(cancellationToken);
        return ToDetalle(consulta);
    }

    private async Task<Usuario> ObtenerUsuarioAsync(
        ClaimsPrincipal principal, CancellationToken cancellationToken) =>
        await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");

    private async Task<int> ResolverMedicoAsync(
        Usuario usuario, int? solicitado, int? medicoActual,
        CancellationToken cancellationToken)
    {
        if (usuario.IdEmpleado is int vinculado)
        {
            var tipo = await context.Empleados.AsNoTracking()
                .Where(e => e.IdEmpleado == vinculado)
                .Select(e => e.TipoEmpleado)
                .SingleOrDefaultAsync(cancellationToken);
            if (tipo == "Medico")
            {
                if (medicoActual.HasValue && medicoActual.Value != vinculado)
                    throw new ForbiddenException("No puede modificar la consulta de otro médico.");
                if (solicitado.HasValue && solicitado.Value != vinculado)
                    throw Invalid("IdMedico",
                        "El médico debe coincidir con el usuario autenticado.");
                return vinculado;
            }
        }

        if (solicitado is not > 0)
            throw Invalid("IdMedico", "Debe indicar un médico válido.");
        return solicitado.Value;
    }

    private async Task AplicarDatosAsync(
        Consulta consulta, ConsultaDatosRequest request, int idMedico,
        CancellationToken cancellationToken)
    {
        if (request.IdPaciente <= 0 || !await context.Pacientes.AsNoTracking()
            .AnyAsync(p => p.IdPaciente == request.IdPaciente, cancellationToken))
            throw Invalid(nameof(request.IdPaciente), "El paciente indicado no existe.");
        if (request.IdSucursal <= 0 || !await context.Sucursales.AsNoTracking()
            .AnyAsync(s => s.IdSucursal == request.IdSucursal, cancellationToken))
            throw Invalid(nameof(request.IdSucursal), "La sucursal indicada no existe.");
        if (request.IdClinica is int idClinica)
        {
            if (idClinica <= 0)
                throw Invalid(nameof(request.IdClinica), "La clínica indicada no existe.");
            var sucursalClinica = await context.Clinicas.AsNoTracking()
                .Where(c => c.IdClinica == idClinica)
                .Select(c => (int?)c.IdSucursal)
                .SingleOrDefaultAsync(cancellationToken);
            if (sucursalClinica is null)
                throw Invalid(nameof(request.IdClinica), "La clínica indicada no existe.");
            if (sucursalClinica != request.IdSucursal)
                throw Invalid(nameof(request.IdClinica),
                    "La clínica debe pertenecer a la sucursal indicada.");
        }
        if (request.FechaConsulta == default)
            throw Invalid(nameof(request.FechaConsulta), "Debe indicar la fecha de consulta.");

        consulta.IdPaciente = request.IdPaciente;
        consulta.IdMedico = idMedico;
        consulta.IdSucursal = request.IdSucursal;
        consulta.IdClinica = request.IdClinica;
        consulta.FechaConsulta = request.FechaConsulta;
        consulta.MotivoConsulta = TextoOpcional(request.MotivoConsulta,
            nameof(request.MotivoConsulta));
        consulta.Sintomas = TextoOpcional(request.Sintomas, nameof(request.Sintomas));
        consulta.Observaciones = TextoOpcional(request.Observaciones,
            nameof(request.Observaciones));
        consulta.PesoLb = Finito(request.PesoLb, nameof(request.PesoLb));
        consulta.PresionDiastolica = Finito(request.PresionDiastolica,
            nameof(request.PresionDiastolica));
        consulta.PresionSistolica = Finito(request.PresionSistolica,
            nameof(request.PresionSistolica));
        consulta.AlturaCm = request.AlturaCm;
    }

    private async Task<bool> TieneRegistrosClinicosAsync(int id, CancellationToken ct) =>
        await context.Diagnosticos.AsNoTracking().AnyAsync(d => d.IdConsulta == id, ct) ||
        await context.Examenes.AsNoTracking().AnyAsync(e => e.IdConsulta == id, ct) ||
        await context.Tratamientos.AsNoTracking().AnyAsync(t => t.IdConsulta == id, ct) ||
        await context.HistorialesMedicos.AsNoTracking().AnyAsync(h => h.IdConsulta == id, ct);

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number == 547)
        {
            throw new ConflictException("Alguna referencia de la consulta ya no existe.");
        }
    }

    private static void ValidarFiltroId(int? id, string campo)
    {
        if (id is <= 0)
            throw Invalid(campo, "Debe ser mayor que cero.");
    }

    private static string? TextoOpcional(string? valor, string campo)
    {
        var texto = string.Join(' ', (valor ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));
        if (texto.Length > 300)
            throw Invalid(campo, "Máximo 300 caracteres.");
        return texto.Length == 0 ? null : texto;
    }

    private static double? Finito(double? valor, string campo)
    {
        if (valor.HasValue && !double.IsFinite(valor.Value))
            throw Invalid(campo, "Debe ser un número finito.");
        return valor;
    }

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos de la consulta no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static ConsultaDetalleDto ToDetalle(Consulta c) =>
        new(c.IdConsulta, c.IdPaciente, c.IdMedico, c.IdSucursal,
            c.IdClinica, c.FechaConsulta, c.MotivoConsulta, c.Sintomas,
            c.Observaciones, c.PesoLb, c.PresionDiastolica,
            c.PresionSistolica, c.AlturaCm);
}
