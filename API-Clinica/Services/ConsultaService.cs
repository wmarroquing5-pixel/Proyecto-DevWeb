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
    private static readonly Expression<Func<Consulta, ConsultaDetalleDto>> Detalle = c =>
        new ConsultaDetalleDto(c.IdConsulta, c.IdPaciente, c.IdMedico,
            c.IdSucursal, c.IdClinica, c.FechaConsulta, c.MotivoConsulta,
            c.Sintomas, c.Observaciones, c.PesoLb, c.PresionDiastolica,
            c.PresionSistolica, c.AlturaCm)
        {
            EstadoConsulta = c.EstadoConsulta,
            TemperaturaC = c.TemperaturaC,
            FrecuenciaCardiaca = c.FrecuenciaCardiaca
        };

    public async Task<PagedResponse<ConsultaListadoDto>> ListarAsync(
        ConsultaFiltroDto filtro, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var idMedicoAutorizado = await ObtenerMedicoParaLecturaAsync(
            principal, cancellationToken);
        var pagination = parameterValidator.ValidatePagination(filtro.Page, filtro.PageSize);
        ValidarFiltroId(filtro.IdPaciente, nameof(filtro.IdPaciente));
        ValidarFiltroId(filtro.IdMedico, nameof(filtro.IdMedico));
        ValidarFiltroId(filtro.IdSucursal, nameof(filtro.IdSucursal));
        ValidarFiltroId(filtro.IdClinica, nameof(filtro.IdClinica));
        if (filtro.Desde.HasValue && filtro.Hasta.HasValue && filtro.Desde > filtro.Hasta)
            throw Invalid(nameof(filtro.Hasta), "Debe ser posterior o igual a Desde.");

        var permisos = await accesoActual.ObtenerPermisosAsync(principal, cancellationToken);
        bool PuedeConsultar(string modulo) => permisos.Any(p =>
            p.PuedeConsultar && string.Equals(p.Modulo, modulo, StringComparison.OrdinalIgnoreCase));
        var puedeVerPacientes = PuedeConsultar("Pacientes");
        var puedeVerMedicos = PuedeConsultar("Empleados");
        var puedeVerSucursales = PuedeConsultar("Sucursales");
        var puedeVerClinicas = PuedeConsultar("Clinicas");

        var query = context.Consultas.AsNoTracking();
        if (idMedicoAutorizado.HasValue)
            query = query.Where(c => c.IdMedico == idMedicoAutorizado.Value);
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
        var pagina = query.OrderBy(c => c.IdConsulta)
            .Skip(pagination.Skip).Take(pagination.PageSize);
        var items = await ProyectarListado(context, pagina, puedeVerPacientes,
            puedeVerMedicos, puedeVerSucursales, puedeVerClinicas)
            .ToListAsync(cancellationToken);
        return new(items, filtro.Page, filtro.PageSize, total);
    }

    internal static IQueryable<ConsultaListadoDto> ProyectarListado(
        ClinicaDbContext context, IQueryable<Consulta> pagina,
        bool puedeVerPacientes, bool puedeVerMedicos,
        bool puedeVerSucursales, bool puedeVerClinicas) =>
        (
            from consulta in pagina
            join paciente in context.Pacientes.AsNoTracking()
                on consulta.IdPaciente equals paciente.IdPaciente into pacientes
            from paciente in pacientes.DefaultIfEmpty()
            join medico in context.Empleados.AsNoTracking()
                on consulta.IdMedico equals medico.IdEmpleado into medicos
            from medico in medicos.DefaultIfEmpty()
            join sucursal in context.Sucursales.AsNoTracking()
                on consulta.IdSucursal equals sucursal.IdSucursal into sucursales
            from sucursal in sucursales.DefaultIfEmpty()
            join clinica in context.Clinicas.AsNoTracking()
                on consulta.IdClinica equals (int?)clinica.IdClinica into clinicas
            from clinica in clinicas.DefaultIfEmpty()
            select new ConsultaListadoDto(consulta.IdConsulta, consulta.IdPaciente,
                consulta.IdMedico, consulta.IdSucursal, consulta.IdClinica,
                consulta.FechaConsulta)
            {
                EstadoConsulta = consulta.EstadoConsulta,
                MotivoConsulta = consulta.MotivoConsulta,
                NombrePaciente = puedeVerPacientes && paciente != null
                    ? paciente.Nombres + " " + paciente.Apellidos : null,
                NombreMedico = puedeVerMedicos && medico != null
                    ? medico.Nombres + " " + medico.Apellidos : null,
                NombreSucursal = puedeVerSucursales && sucursal != null
                    ? sucursal.Nombre : null,
                NombreClinica = puedeVerClinicas && clinica != null
                    ? clinica.NombreClinica : null
            });

    public async Task<ConsultaDetalleDto> ObtenerAsync(
        int id, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var idMedicoAutorizado = await ObtenerMedicoParaLecturaAsync(
            principal, cancellationToken);
        var query = context.Consultas.AsNoTracking();
        if (idMedicoAutorizado.HasValue)
            query = query.Where(c => c.IdMedico == idMedicoAutorizado.Value);

        return await query
            .Where(c => c.IdConsulta == id)
            .Select(Detalle).SingleOrDefaultAsync(cancellationToken)
            ?? throw new NotFoundException("Consulta no encontrada.");
    }

    public async Task<ConsultaDetalleDto> CrearAsync(
        ConsultaCreateDto request, ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        ValidarSinEvaluacion(request);
        var usuario = await ObtenerUsuarioAsync(principal, cancellationToken);
        var idMedico = await ResolverMedicoAsync(usuario, request.IdMedico, null,
            cancellationToken);
        var consulta = new Consulta { EstadoConsulta = "Abierta" };
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
        ValidarSinEvaluacion(request);

        if ((consulta.IdPaciente != request.IdPaciente || consulta.IdMedico != idMedico ||
            consulta.IdSucursal != request.IdSucursal || consulta.IdClinica != request.IdClinica) &&
            await TieneRegistrosClinicosAsync(id, cancellationToken))
            throw new ConflictException(
                "Una consulta con registros clínicos no puede cambiar sus asociaciones.");

        await AplicarDatosAsync(consulta, request, idMedico, cancellationToken);
        await GuardarAsync(cancellationToken);
        return ToDetalle(consulta);
    }

    public async Task<ConsultaDetalleDto> RegistrarEvaluacionAsync(
        int id, RegistrarEvaluacionConsultaRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken)
    {
        var usuario = await ObtenerUsuarioAsync(principal, cancellationToken);
        var medicoAutorizado = await ObtenerMedicoParaLecturaAsync(principal, cancellationToken);
        var query = context.Consultas.AsQueryable();
        if (medicoAutorizado.HasValue)
            query = query.Where(c => c.IdMedico == medicoAutorizado.Value);
        var consulta = await query.SingleOrDefaultAsync(
            c => c.IdConsulta == id, cancellationToken)
            ?? throw new NotFoundException("Consulta no encontrada.");
        await ResolverMedicoAsync(usuario, consulta.IdMedico, consulta.IdMedico,
            cancellationToken);
        if (!string.Equals(consulta.EstadoConsulta, "Abierta", StringComparison.Ordinal) ||
            TieneEvaluacion(consulta))
            throw new ConflictException("La consulta no admite otra evaluación clínica.");

        var sintomas = TextoOpcional(request.Sintomas, nameof(request.Sintomas));
        var observaciones = TextoOpcional(request.Observaciones, nameof(request.Observaciones));
        var peso = Finito(request.PesoLb, nameof(request.PesoLb));
        var sistolica = Finito(request.PresionSistolica, nameof(request.PresionSistolica));
        var diastolica = Finito(request.PresionDiastolica, nameof(request.PresionDiastolica));
        var temperatura = TemperaturaValida(request.TemperaturaC);
        var frecuencia = FrecuenciaCardiacaValida(request.FrecuenciaCardiaca);
        if (sintomas is null && observaciones is null && peso is null &&
            request.AlturaCm is null && sistolica is null && diastolica is null &&
            temperatura is null && frecuencia is null)
            throw Invalid("Evaluacion", "Debe registrar al menos un dato clínico.");

        consulta.Sintomas = sintomas;
        consulta.Observaciones = observaciones;
        consulta.PesoLb = peso;
        consulta.AlturaCm = request.AlturaCm;
        consulta.PresionSistolica = sistolica;
        consulta.PresionDiastolica = diastolica;
        consulta.TemperaturaC = temperatura;
        consulta.FrecuenciaCardiaca = frecuencia;
        consulta.EstadoConsulta = "En seguimiento";
        // Los tokens EF agregan el estado, la atribución y los ocho valores originales
        // al WHERE del único UPDATE. Cero filas afectadas produce conflicto, sin escritura parcial.
        await GuardarAsync(cancellationToken);
        return ToDetalle(consulta);
    }

    private static bool TieneEvaluacion(Consulta consulta) =>
        !string.IsNullOrWhiteSpace(consulta.Sintomas) ||
        !string.IsNullOrWhiteSpace(consulta.Observaciones) ||
        consulta.PesoLb.HasValue || consulta.AlturaCm.HasValue ||
        consulta.PresionSistolica.HasValue || consulta.PresionDiastolica.HasValue ||
        consulta.TemperaturaC.HasValue || consulta.FrecuenciaCardiaca.HasValue;

    private static void ValidarSinEvaluacion(ConsultaDatosRequest request)
    {
        if (!string.IsNullOrWhiteSpace(request.Sintomas) ||
            !string.IsNullOrWhiteSpace(request.Observaciones) ||
            request.PesoLb.HasValue || request.AlturaCm.HasValue ||
            request.PresionSistolica.HasValue || request.PresionDiastolica.HasValue ||
            request.TemperaturaC.HasValue || request.FrecuenciaCardiaca.HasValue)
            throw Invalid("Evaluacion",
                "Los datos clínicos se registran únicamente mediante POST /api/consultas/{id}/evaluacion.");
    }

    private async Task<Usuario> ObtenerUsuarioAsync(
        ClaimsPrincipal principal, CancellationToken cancellationToken) =>
        await accesoActual.ObtenerUsuarioActivoAsync(principal, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");

    private async Task<int?> ObtenerMedicoParaLecturaAsync(
        ClaimsPrincipal principal, CancellationToken cancellationToken)
    {
        var usuario = await ObtenerUsuarioAsync(principal, cancellationToken);
        var nombreRol = await context.Roles.AsNoTracking()
            .Where(rol => rol.IdRol == usuario.IdRol && rol.Activo)
            .Select(rol => rol.Nombre)
            .SingleOrDefaultAsync(cancellationToken)
            ?? throw new ForbiddenException("El rol actual no se encuentra activo.");

        if (!string.Equals(nombreRol, "MEDICO", StringComparison.Ordinal))
            return null;

        if (!usuario.IdEmpleado.HasValue)
            throw new ForbiddenException(
                "El usuario médico no tiene un empleado vinculado.");

        var medicoActivo = await context.Empleados.AsNoTracking()
            .AnyAsync(
                empleado => empleado.IdEmpleado == usuario.IdEmpleado.Value &&
                    empleado.Activo && empleado.TipoEmpleado == "Medico",
                cancellationToken);
        if (!medicoActivo)
            throw new ForbiddenException(
                "El empleado médico vinculado no se encuentra activo.");

        return usuario.IdEmpleado.Value;
    }

    private async Task<int> ResolverMedicoAsync(
        Usuario usuario, int? solicitado, int? medicoActual,
        CancellationToken cancellationToken)
    {
        if (usuario.IdEmpleado is int vinculado)
        {
            var empleadoVinculado = await context.Empleados.AsNoTracking()
                .Where(e => e.IdEmpleado == vinculado)
                .Select(e => new { e.Activo, e.TipoEmpleado })
                .SingleOrDefaultAsync(cancellationToken);
            if (empleadoVinculado?.TipoEmpleado == "Medico")
            {
                if (!empleadoVinculado.Activo)
                    throw Invalid("IdMedico", "El médico indicado está inactivo.");
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
        await ValidarMedicoActivoAsync(solicitado.Value, cancellationToken);
        return solicitado.Value;
    }

    private async Task ValidarMedicoActivoAsync(int idMedico, CancellationToken cancellationToken)
    {
        var medico = await context.Empleados.AsNoTracking()
            .Where(e => e.IdEmpleado == idMedico)
            .Select(e => new { e.Activo, e.TipoEmpleado })
            .SingleOrDefaultAsync(cancellationToken);
        if (medico is null)
            throw Invalid("IdMedico", "El médico indicado no existe.");
        if (!medico.Activo)
            throw Invalid("IdMedico", "El médico indicado está inactivo.");
        if (medico.TipoEmpleado != "Medico")
            throw Invalid("IdMedico", "El empleado indicado no es de tipo Medico.");
    }

    private async Task AplicarDatosAsync(
        Consulta consulta, ConsultaDatosRequest request, int idMedico,
        CancellationToken cancellationToken)
    {
        var pacienteActivo = request.IdPaciente <= 0 ? null :
            await context.Pacientes.AsNoTracking()
                .Where(p => p.IdPaciente == request.IdPaciente)
                .Select(p => (bool?)p.Activo)
                .SingleOrDefaultAsync(cancellationToken);
        if (pacienteActivo is null)
            throw Invalid(nameof(request.IdPaciente), "El paciente indicado no existe.");
        if (!pacienteActivo.Value)
            throw Invalid(nameof(request.IdPaciente), "El paciente indicado está inactivo.");

        var sucursalActiva = request.IdSucursal <= 0 ? null :
            await context.Sucursales.AsNoTracking()
                .Where(s => s.IdSucursal == request.IdSucursal)
                .Select(s => (bool?)s.Activa)
                .SingleOrDefaultAsync(cancellationToken);
        if (sucursalActiva is null)
            throw Invalid(nameof(request.IdSucursal), "La sucursal indicada no existe.");
        if (!sucursalActiva.Value)
            throw Invalid(nameof(request.IdSucursal), "La sucursal indicada está inactiva.");

        if (request.IdClinica is int idClinica)
        {
            if (idClinica <= 0)
                throw Invalid(nameof(request.IdClinica), "La clínica indicada no existe.");
            var clinica = await context.Clinicas.AsNoTracking()
                .Where(c => c.IdClinica == idClinica)
                .Select(c => new { c.IdSucursal, c.Activa })
                .SingleOrDefaultAsync(cancellationToken);
            if (clinica is null)
                throw Invalid(nameof(request.IdClinica), "La clínica indicada no existe.");
            if (!clinica.Activa)
                throw Invalid(nameof(request.IdClinica), "La clínica indicada está inactiva.");
            if (clinica.IdSucursal != request.IdSucursal)
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
    }

    private async Task<bool> TieneRegistrosClinicosAsync(int id, CancellationToken ct) =>
        await context.Diagnosticos.AsNoTracking().AnyAsync(d => d.IdConsulta == id, ct) ||
        await context.Examenes.AsNoTracking().AnyAsync(e => e.IdConsulta == id, ct) ||
        await context.Tratamientos.AsNoTracking().AnyAsync(t => t.IdConsulta == id, ct) ||
        await context.HistorialesMedicos.AsNoTracking().AnyAsync(h => h.IdConsulta == id, ct);

    private async Task GuardarAsync(CancellationToken cancellationToken)
    {
        try { await context.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException)
        {
            throw new ConflictException("La consulta cambió durante la operación. Recargue sus datos.");
        }
        catch (DbUpdateException ex) when (ex.InnerException is SqlException sql &&
            sql.Number is 1205 or 1222)
        {
            throw new ConflictException("La consulta está siendo modificada. Intente nuevamente.");
        }
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

    private static decimal? TemperaturaValida(decimal? valor)
    {
        if (valor is < -999.9m or > 999.9m)
            throw Invalid(nameof(ConsultaDatosRequest.TemperaturaC),
                "Debe caber en decimal(4,1).");
        if (valor.HasValue && decimal.Round(valor.Value, 1) != valor.Value)
            throw Invalid(nameof(ConsultaDatosRequest.TemperaturaC),
                "Se admite como máximo un decimal, sin redondeo.");
        return valor;
    }

    private static short? FrecuenciaCardiacaValida(short? valor)
    {
        if (valor is < 0)
            throw Invalid(nameof(ConsultaDatosRequest.FrecuenciaCardiaca),
                "No puede ser negativa.");
        return valor;
    }

    private static AppValidationException Invalid(string campo, string mensaje) =>
        new("Datos de la consulta no válidos.",
            new Dictionary<string, string[]> { [campo] = [mensaje] });

    private static ConsultaDetalleDto ToDetalle(Consulta c) =>
        new(c.IdConsulta, c.IdPaciente, c.IdMedico, c.IdSucursal,
            c.IdClinica, c.FechaConsulta, c.MotivoConsulta, c.Sintomas,
            c.Observaciones, c.PesoLb, c.PresionDiastolica,
            c.PresionSistolica, c.AlturaCm)
        {
            EstadoConsulta = c.EstadoConsulta,
            TemperaturaC = c.TemperaturaC,
            FrecuenciaCardiaca = c.FrecuenciaCardiaca
        };
}
