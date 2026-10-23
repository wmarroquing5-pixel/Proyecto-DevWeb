using System.Data;
using System.Security.Claims;
using System.Security.Cryptography;
using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class RecetaClinicaService(
    ClinicaDbContext context,
    IAccesoActualService accesoActual,
    IRecetaClinicaPreparador preparador,
    ICommonParameterValidator parametros,
    ILogger<RecetaClinicaService> logger) : IRecetaClinicaService
{
    private static readonly PoliticaPrescripcionAprobada Politica = new(
        new HashSet<string>(StringComparer.Ordinal) { "Abierta", "En seguimiento" },
        "Vigente", false,
        new Dictionary<int, EquivalenciaFarmaceuticaAprobada>());

    public async Task<RecetaCreacionResultado> CrearAsync(
        CrearRecetaClinicaRequest request, ClaimsPrincipal principal, CancellationToken ct)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (!context.Database.IsSqlServer())
            throw new NotSupportedException("La creación transaccional de recetas requiere SQL Server.");

        var hash = preparador.CalcularHashSolicitud(request).ToArray();
        var usuario = await UsuarioConPermisoAsync(principal, crear: true, ct);
        try
        {
            await using var transaction = await context.Database.BeginTransactionAsync(
                IsolationLevel.Serializable, ct);
            try
            {
                // UPDLOCK+HOLDLOCK sobre la clave UNIQUE serializa reintentos
                // concurrentes; la restricción SQL sigue siendo la última barrera.
                var existente = await context.RecetasClinicas
                    .FromSqlInterpolated($"SELECT * FROM [dbo].[RecetaClinica] WITH (UPDLOCK, HOLDLOCK) WHERE [ClaveOperacion] = {request.ClaveOperacion}")
                    .AsNoTracking().SingleOrDefaultAsync(ct);
                if (existente is not null)
                {
                    await ValidarReintentoAsync(existente, usuario, request.IdConsulta, hash, ct);
                    var original = await ObtenerCoreAsync(existente.IdReceta, ct);
                    await transaction.CommitAsync(ct);
                    return new(original, true);
                }

                var consulta = await context.Consultas
                    .FromSqlInterpolated($"SELECT * FROM [dbo].[Consulta] WITH (UPDLOCK, HOLDLOCK) WHERE [IdConsulta] = {request.IdConsulta}")
                    .AsNoTracking().SingleOrDefaultAsync(ct);
                var diagnostico = await context.Diagnosticos.AsNoTracking()
                    .SingleOrDefaultAsync(d => d.IdDiagnostico == request.IdDiagnostico, ct);
                var medico = consulta is null ? null : await context.Empleados.AsNoTracking()
                    .SingleOrDefaultAsync(e => e.IdEmpleado == consulta.IdMedico, ct);
                var idsMedicamentos = (request.Lineas ?? []).Where(l => l is not null)
                    .Select(l => l.IdMedicamento).Distinct().ToArray();
                var medicamentos = await context.Medicamentos.AsNoTracking()
                    .Where(m => idsMedicamentos.Contains(m.IdMedicamento))
                    .ToDictionaryAsync(m => m.IdMedicamento, ct);
                var preparado = preparador.Preparar(request, principal,
                    new(consulta, diagnostico, usuario, medico, true, medicamentos, Politica));

                var tratamiento = new Tratamiento
                {
                    IdConsulta = preparado.IdConsulta,
                    Descripcion = preparado.DescripcionTratamiento,
                    Indicaciones = preparado.IndicacionesGenerales,
                    FechaInicio = preparado.FechaInicio,
                    FechaFin = preparado.FechaFin,
                    IdLote = null,
                    Cantidad = null
                };
                context.Tratamientos.Add(tratamiento);
                await context.SaveChangesAsync(ct);

                var receta = new RecetaClinica
                {
                    IdTratamiento = tratamiento.IdTratamiento,
                    IdDiagnostico = preparado.IdDiagnostico,
                    IdUsuarioPrescriptor = preparado.IdUsuarioPrescriptor,
                    IdRecetaAnterior = null,
                    NumeroVersion = 1,
                    Estado = preparado.EstadoInicialReceta,
                    FechaPrescripcionUtc = DateTime.UtcNow,
                    ClaveOperacion = preparado.ClaveOperacion,
                    HashSolicitud = preparado.HashSolicitud.ToArray()
                };
                context.RecetasClinicas.Add(receta);
                await context.SaveChangesAsync(ct);
                foreach (var linea in preparado.Lineas)
                {
                    // La captura es directa: ninguna columna de equivalencia
                    // recibe un valor en este flujo ni se toca inventario.
                    context.RecetaLineas.Add(new RecetaLinea
                    {
                        IdReceta = receta.IdReceta,
                        IdMedicamento = linea.IdMedicamento,
                        Orden = linea.Orden,
                        CantidadPrescritaUnidades = linea.CantidadPrescritaUnidades,
                        UnidadInventario = linea.UnidadInventario,
                        DuracionDias = linea.DuracionDias,
                        DestinoMedicamento = linea.DestinoMedicamento,
                        Dosis = null,
                        UnidadDosis = null,
                        Via = null,
                        Frecuencia = null,
                        Indicaciones = null
                    });
                }
                await context.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                return new(await ObtenerCoreAsync(receta.IdReceta, ct), false);
            }
            catch
            {
                try { await transaction.RollbackAsync(CancellationToken.None); }
                catch (Exception rollbackError)
                {
                    logger.LogError(rollbackError,
                        "No se pudo confirmar el rollback de la receta clínica.");
                }
                throw;
            }
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 2601 or 2627)
        {
            context.ChangeTracker.Clear();
            var existente = await context.RecetasClinicas.AsNoTracking()
                .SingleOrDefaultAsync(r => r.ClaveOperacion == request.ClaveOperacion, ct);
            if (existente is null)
                throw new ConflictException("La receta cambió durante la confirmación. Intenta nuevamente.");
            await ValidarReintentoAsync(existente, usuario, request.IdConsulta, hash, ct);
            return new(await ObtenerCoreAsync(existente.IdReceta, ct), true);
        }
        catch (SqlException ex) when (ex.Number is 1205 or 1222)
        {
            throw new ConflictException("La receta está siendo confirmada por otra solicitud. Intenta nuevamente con la misma clave.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 547 or 1205 or 1222)
        {
            throw new ConflictException("Una referencia de la receta cambió durante la confirmación.");
        }
    }

    public async Task<RecetaClinicaDetalleDto> ObtenerAsync(
        int idReceta, ClaimsPrincipal principal, CancellationToken ct)
    {
        if (idReceta <= 0) throw new NotFoundException("Receta no encontrada.");
        var usuario = await UsuarioConPermisoAsync(principal, crear: false, ct);
        var consultaId = await context.RecetasClinicas.AsNoTracking()
            .Where(r => r.IdReceta == idReceta)
            .Join(context.Tratamientos.AsNoTracking(), r => r.IdTratamiento,
                t => t.IdTratamiento, (r, t) => (int?)t.IdConsulta)
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Receta no encontrada.");
        await ValidarAmbitoMedicoAsync(consultaId, usuario, ct);
        return await ObtenerCoreAsync(idReceta, ct);
    }

    public async Task<PagedResponse<RecetaClinicaResumenDto>> ListarPorConsultaAsync(
        int idConsulta, int page, int pageSize, ClaimsPrincipal principal, CancellationToken ct)
    {
        var pagination = parametros.ValidatePagination(page, pageSize);
        var usuario = await UsuarioConPermisoAsync(principal, crear: false, ct);
        await ValidarAmbitoMedicoAsync(idConsulta, usuario, ct);

        var query = context.RecetasClinicas.AsNoTracking()
            .Join(context.Tratamientos.AsNoTracking().Where(t => t.IdConsulta == idConsulta),
                r => r.IdTratamiento, t => t.IdTratamiento, (r, t) => new { r, t })
            .Join(context.Diagnosticos.AsNoTracking(), x => x.r.IdDiagnostico,
                d => d.IdDiagnostico, (x, d) => new { x.r, x.t, d });
        var total = await query.LongCountAsync(ct);
        var items = await query.OrderBy(x => x.r.FechaPrescripcionUtc)
            .ThenBy(x => x.r.IdReceta)
            .Skip(pagination.Skip).Take(pagination.PageSize)
            .Select(x => new RecetaClinicaResumenDto(
                x.r.IdReceta, x.t.IdConsulta, x.t.IdTratamiento, x.t.Descripcion,
                x.t.FechaInicio, x.t.FechaFin,
                x.d.IdDiagnostico, x.d.Descripcion, x.r.NumeroVersion, x.r.Estado,
                x.r.FechaPrescripcionUtc,
                context.RecetaLineas.Count(l => l.IdReceta == x.r.IdReceta)))
            .ToListAsync(ct);
        return new(items, page, pageSize, total);
    }

    private async Task ValidarReintentoAsync(
        RecetaClinica existente, Usuario usuario, int idConsulta, byte[] hash, CancellationToken ct)
    {
        if (existente.IdUsuarioPrescriptor != usuario.IdUsuario)
            throw new NotFoundException("Receta no encontrada.");
        if (!CryptographicOperations.FixedTimeEquals(existente.HashSolicitud, hash))
            throw new ConflictException("La clave de operación ya se usó con otro contenido.");
        var consultaDeReceta = await context.Tratamientos.AsNoTracking()
            .Where(t => t.IdTratamiento == existente.IdTratamiento)
            .Select(t => t.IdConsulta).SingleAsync(ct);
        if (consultaDeReceta != idConsulta)
            throw new ConflictException("La clave de operación corresponde a otra consulta.");
        await ValidarAmbitoMedicoAsync(consultaDeReceta, usuario, ct);
    }

    private async Task<Usuario> UsuarioConPermisoAsync(
        ClaimsPrincipal principal, bool crear, CancellationToken ct)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(principal, ct)
            ?? throw new ForbiddenException("Acceso denegado.");
        var permisos = await context.Permisos.AsNoTracking()
            .Where(p => p.IdRol == usuario.IdRol && p.Modulo == "Historial")
            .Take(2).ToListAsync(ct);
        if (permisos.Count != 1 || (crear ? !permisos[0].PuedeCrear : !permisos[0].PuedeConsultar))
            throw new ForbiddenException("No tienes permiso para esta operación clínica.");
        return usuario;
    }

    private async Task ValidarAmbitoMedicoAsync(int idConsulta, Usuario usuario, CancellationToken ct)
    {
        if (idConsulta <= 0) throw new NotFoundException("Consulta no encontrada.");
        var idMedico = await context.Consultas.AsNoTracking()
            .Where(c => c.IdConsulta == idConsulta)
            .Select(c => (int?)c.IdMedico).SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Consulta no encontrada.");
        if (usuario.IdEmpleado != idMedico ||
            !await context.Empleados.AsNoTracking().AnyAsync(e =>
                e.IdEmpleado == idMedico && e.Activo && e.TipoEmpleado == "Medico", ct))
            throw new ForbiddenException("Solo el médico responsable puede consultar esta receta.");
    }

    private async Task<RecetaClinicaDetalleDto> ObtenerCoreAsync(int idReceta, CancellationToken ct)
    {
        var cabecera = await context.RecetasClinicas.AsNoTracking()
            .Where(r => r.IdReceta == idReceta)
            .Join(context.Tratamientos.AsNoTracking(), r => r.IdTratamiento,
                t => t.IdTratamiento, (r, t) => new { r, t })
            .Join(context.Diagnosticos.AsNoTracking(), x => x.r.IdDiagnostico,
                d => d.IdDiagnostico, (x, d) => new { x.r, x.t, d })
            .SingleOrDefaultAsync(ct)
            ?? throw new NotFoundException("Receta no encontrada.");
        var lineas = await context.RecetaLineas.AsNoTracking()
            .Where(l => l.IdReceta == idReceta)
            .OrderBy(l => l.Orden)
            .Join(context.Medicamentos.AsNoTracking(), l => l.IdMedicamento,
                m => m.IdMedicamento, (l, m) => new RecetaLineaDetalleDto(
                    l.IdRecetaLinea, l.Orden, l.IdMedicamento, m.Nombre,
                    l.DuracionDias, l.CantidadPrescritaUnidades, l.UnidadInventario,
                    l.DestinoMedicamento))
            .ToListAsync(ct);
        return new(cabecera.r.IdReceta, cabecera.t.IdConsulta,
            cabecera.t.IdTratamiento, cabecera.t.Descripcion,
            cabecera.t.Indicaciones, cabecera.t.FechaInicio, cabecera.t.FechaFin,
            cabecera.d.IdDiagnostico, cabecera.d.Descripcion,
            cabecera.r.NumeroVersion, cabecera.r.Estado,
            cabecera.r.IdUsuarioPrescriptor,
            DateTime.SpecifyKind(cabecera.r.FechaPrescripcionUtc, DateTimeKind.Utc), lineas);
    }
}
