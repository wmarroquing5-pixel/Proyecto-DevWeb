using System.Data;
using System.Security.Claims;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class DiagnosticoService(
    ClinicaDbContext context,
    IAccesoActualService accesoActual,
    ICommonParameterValidator parameterValidator,
    ConsultaLecturaScope lecturaScope) : IDiagnosticoService
{
    public async Task<PagedResponse<DiagnosticoResponse>> ListarAsync(
        DiagnosticoFiltroDto filtro, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var idMedico = await lecturaScope.ObtenerMedicoAsync(principal, cancellationToken);
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        if (filtro.IdConsulta is <= 0)
            throw Invalid(nameof(filtro.IdConsulta), "La consulta debe ser válida.");

        var query = lecturaScope.DiagnosticosVisibles(idMedico);
        if (filtro.IdConsulta is int idConsulta)
            query = query.Where(d => d.IdConsulta == idConsulta);

        var total = await query.LongCountAsync(cancellationToken);
        var items = await ConMedico(query.OrderBy(d => d.IdDiagnostico)
            .Skip(pagination.Skip).Take(pagination.PageSize))
            .ToListAsync(cancellationToken);
        return new(items, filtro.Page, filtro.PageSize, total);
    }

    public async Task<DiagnosticoResponse> ObtenerAsync(
        int id, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var idMedico = await lecturaScope.ObtenerMedicoAsync(principal, cancellationToken);
        return await ConMedico(lecturaScope.DiagnosticosVisibles(idMedico)
            .Where(d => d.IdDiagnostico == id))
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Diagnóstico no encontrado.");
    }

    private IQueryable<DiagnosticoResponse> ConMedico(IQueryable<Diagnostico> query) =>
        query.Join(context.Consultas.AsNoTracking(), d => d.IdConsulta,
            c => c.IdConsulta, (d, c) => new DiagnosticoResponse(
                d.IdDiagnostico, d.IdConsulta, c.IdMedico,
                d.Descripcion, d.FechaRegistro));

    public async Task<DiagnosticoResponse> CrearAsync(
        CrearDiagnosticoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");

        var descripcion = ValidarDescripcion(request.Descripcion);

        if (request.IdConsulta <= 0)
            throw Invalid("IdConsulta", "La consulta debe ser válida.");

        var consulta = await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == request.IdConsulta)
            .Select(c => new { c.IdMedico, c.EstadoConsulta })
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Consulta no encontrada.");

        if (consulta.EstadoConsulta == "Cerrada")
            throw new ConflictException("La consulta está cerrada.");

        await ValidarMedicoConsultaAsync(consulta.IdMedico, cancellationToken);

        var idMedico = await ResolverMedicoAsync(usuario, request.IdMedico, cancellationToken);
        if (idMedico != consulta.IdMedico)
            throw Invalid("IdMedico", "El médico debe corresponder a la consulta.");
        var diagnostico = new Diagnostico
        {
            IdConsulta = request.IdConsulta,
            IdMedico = idMedico,
            Descripcion = descripcion,
            FechaRegistro = DateTime.UtcNow
        };
        context.Diagnosticos.Add(diagnostico);
        await context.SaveChangesAsync(cancellationToken);

        return new DiagnosticoResponse(diagnostico.IdDiagnostico, diagnostico.IdConsulta,
            consulta.IdMedico, diagnostico.Descripcion, diagnostico.FechaRegistro);
    }

    public async Task<DiagnosticoResponse> CrearConExamenAsync(
        CrearDiagnosticoConExamenRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        if (request.IdConsulta <= 0)
            throw Invalid("IdConsulta", "La consulta debe ser válida.");
        if (request.IdExamen <= 0)
            throw Invalid("IdExamen", "El examen debe ser válido.");
        var descripcion = ValidarDescripcion(request.Descripcion);
        if (!context.Database.IsSqlServer())
            throw new NotSupportedException("La asociación transaccional requiere SQL Server.");

        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, cancellationToken);

            var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
                ?? throw new ForbiddenException("Acceso denegado.");
            var consulta = await context.Consultas
                .FromSqlInterpolated($"SELECT * FROM [Consulta] WITH (UPDLOCK, HOLDLOCK) WHERE [IdConsulta] = {request.IdConsulta}")
                .AsNoTracking().SingleOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundException("Consulta no encontrada.");
            if (consulta.EstadoConsulta == "Cerrada")
                throw new ConflictException("La consulta está cerrada.");
            await ValidarMedicoConsultaAsync(consulta.IdMedico, cancellationToken);
            var idMedico = await ResolverMedicoAsync(usuario, request.IdMedico, cancellationToken);
            if (idMedico != consulta.IdMedico)
                throw Invalid("IdMedico", "El médico debe corresponder a la consulta.");

            var examen = await context.Examenes
                .FromSqlInterpolated($"SELECT * FROM [Examen] WITH (UPDLOCK, HOLDLOCK) WHERE [IdExamen] = {request.IdExamen} AND [IdConsulta] = {request.IdConsulta}")
                .AsNoTracking().SingleOrDefaultAsync(cancellationToken)
                ?? throw new NotFoundException("Examen no encontrado en esta consulta.");
            if (examen.IdDiagnostico is not null)
                throw new ConflictException("El examen ya tiene un diagnóstico relacionado.");

            var diagnostico = new Diagnostico
            {
                IdConsulta = request.IdConsulta,
                IdMedico = idMedico,
                Descripcion = descripcion,
                FechaRegistro = DateTime.UtcNow
            };
            context.Diagnosticos.Add(diagnostico);
            await context.SaveChangesAsync(cancellationToken);
            var updated = await context.Examenes
                .Where(e => e.IdExamen == request.IdExamen && e.IdConsulta == request.IdConsulta
                    && e.IdDiagnostico == null)
                .ExecuteUpdateAsync(setters => setters.SetProperty(
                    e => e.IdDiagnostico, diagnostico.IdDiagnostico), cancellationToken);
            if (updated != 1)
                throw new ConflictException("El examen cambió durante el registro. No se creó el diagnóstico.");

            await transaction.CommitAsync(cancellationToken);
            return new DiagnosticoResponse(diagnostico.IdDiagnostico, diagnostico.IdConsulta,
                consulta.IdMedico, diagnostico.Descripcion, diagnostico.FechaRegistro);
        }
        catch (SqlException ex) when (ex.Number is 1205 or 1222 or 547)
        {
            throw new ConflictException("La relación clínica cambió durante el registro. Intente nuevamente.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222 or 547)
        {
            throw new ConflictException("La relación clínica cambió durante el registro. Intente nuevamente.");
        }
    }

    public async Task<DiagnosticoResponse> ActualizarAsync(
        int id, ActualizarDiagnosticoRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");
        var diagnostico = await context.Diagnosticos.SingleOrDefaultAsync(
            d => d.IdDiagnostico == id, cancellationToken)
            ?? throw new NotFoundException("Diagnóstico no encontrado.");
        var idMedicoConsulta = await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == diagnostico.IdConsulta)
            .Select(c => (int?)c.IdMedico)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ConflictException("La consulta del diagnóstico no existe.");

        await ValidarMedicoConsultaAsync(idMedicoConsulta, cancellationToken);
        if (usuario.IdEmpleado is int idEmpleado &&
            await context.Empleados.AsNoTracking().AnyAsync(
                e => e.IdEmpleado == idEmpleado && e.TipoEmpleado == "Medico",
                cancellationToken) && idEmpleado != idMedicoConsulta)
            throw new ForbiddenException("No puede modificar el diagnóstico de otro médico.");

        // IdConsulta y FechaRegistro conservan la atribución histórica y nunca se modifican aquí.
        diagnostico.Descripcion = ValidarDescripcion(request.Descripcion);
        await context.SaveChangesAsync(cancellationToken);
        return new DiagnosticoResponse(diagnostico.IdDiagnostico, diagnostico.IdConsulta,
            idMedicoConsulta, diagnostico.Descripcion, diagnostico.FechaRegistro);
    }

    private static string ValidarDescripcion(string? valor)
    {
        var descripcion = valor?.Trim();
        if (string.IsNullOrWhiteSpace(descripcion))
            throw Invalid("Descripcion", "La descripción es obligatoria.");
        if (descripcion.Length > 300)
            throw Invalid("Descripcion", "Máximo 300 caracteres.");
        return descripcion;
    }

    private async Task ValidarMedicoConsultaAsync(int idMedico, CancellationToken cancellationToken)
    {
        if (!await context.Empleados.AsNoTracking().AnyAsync(
            e => e.IdEmpleado == idMedico && e.Activo && e.TipoEmpleado == "Medico",
            cancellationToken))
            throw Invalid("IdMedico", "El médico de la consulta debe existir, estar activo y ser de tipo Medico.");
    }

    private async Task<int> ResolverMedicoAsync(
        Usuario usuario, int? solicitado, CancellationToken cancellationToken)
    {
        if (usuario.IdEmpleado is int idEmpleado)
        {
            var vinculado = await context.Empleados.AsNoTracking()
                .Where(e => e.IdEmpleado == idEmpleado)
                .Select(e => new { e.IdEmpleado, e.TipoEmpleado, e.Activo })
                .SingleOrDefaultAsync(cancellationToken);

            if (vinculado?.TipoEmpleado == "Medico")
            {
                if (!vinculado.Activo)
                    throw Invalid("IdMedico", "El médico vinculado al usuario está inactivo.");
                if (solicitado.HasValue && solicitado.Value != vinculado.IdEmpleado)
                    throw Invalid("IdMedico", "El médico debe coincidir con el usuario autenticado.");
                return vinculado.IdEmpleado;
            }
        }

        if (solicitado is not > 0)
            throw Invalid("IdMedico", "Debe indicar un médico válido.");

        if (!await context.Empleados.AsNoTracking()
            .AnyAsync(e => e.IdEmpleado == solicitado.Value && e.Activo &&
                e.TipoEmpleado == "Medico", cancellationToken))
            throw Invalid("IdMedico", "El empleado indicado debe existir, estar activo y ser de tipo Medico.");

        return solicitado.Value;
    }

    private static AppValidationException Invalid(string field, string message) =>
        new("Datos no válidos.", new Dictionary<string, string[]> { [field] = [message] });
}
