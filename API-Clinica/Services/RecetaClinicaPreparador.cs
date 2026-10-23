using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;

namespace API_Clinica.Services;

// Todos estos datos deben cargarse y autorizarse en el backend en la futura
// operación. Nunca deserializar este contexto desde una solicitud HTTP.
public sealed record RecetaClinicaContextoConfiable(
    Consulta? Consulta, Diagnostico? Diagnostico,
    Usuario? Usuario, Empleado? Medico, bool TienePermisoPrescribir,
    IReadOnlyDictionary<int, Medicamento> Medicamentos,
    PoliticaPrescripcionAprobada? Politica);

// Sin política aprobada no hay estado ni equivalencia por defecto.
public sealed record PoliticaPrescripcionAprobada(
    IReadOnlySet<string> EstadosConsultaPermitidos,
    string EstadoInicialReceta,
    bool? PermiteMismoMedicamentoEnVariasLineas,
    IReadOnlyDictionary<int, EquivalenciaFarmaceuticaAprobada> Equivalencias);

public sealed record EquivalenciaFarmaceuticaAprobada(
    string UnidadInventario, string UnidadDosis, decimal ContenidoPorUnidad,
    string UnidadContenido, string Fuente, string Version,
    int IdUsuarioValidador, DateTime FechaValidacionUtc);

public sealed record RecetaLineaPreparada(
    short Orden, int IdMedicamento, int CantidadPrescritaUnidades);

public sealed record RecetaClinicaPreparada(
    int IdConsulta, int IdDiagnostico, string DescripcionTratamiento,
    string? IndicacionesGenerales, DateOnly FechaInicio, DateOnly? FechaFin,
    int IdUsuarioPrescriptor, string EstadoInicialReceta,
    Guid ClaveOperacion, IReadOnlyList<RecetaLineaPreparada> Lineas,
    ReadOnlyMemory<byte> HashSolicitud);

// No accede a EF, inventario, venta, consumo ni tablas nuevas. Su resultado
// es una preparación, nunca prueba de persistencia o autorización HTTP.
public sealed class RecetaClinicaPreparador : IRecetaClinicaPreparador
{
    public ReadOnlyMemory<byte> CalcularHashSolicitud(CrearRecetaClinicaRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (request.Lineas is null)
            throw Invalid(nameof(request.Lineas), "La lista de medicamentos es obligatoria.");
        if (request.Lineas.Any(linea => linea is null))
            throw Invalid(nameof(request.Lineas), "Una línea de receta es inválida.");

        // No incluye estado, actor, fecha ni equivalencia cargados del servidor.
        // La clave de operación se compara por separado. Un reintento del mismo
        // cuerpo mantiene la huella aunque cambie la política farmacéutica.
        var cuerpo = JsonSerializer.Serialize(new
        {
            Version = 3,
            request.IdConsulta,
            request.IdDiagnostico,
            DescripcionTratamiento = Normalize(request.DescripcionTratamiento),
            IndicacionesGenerales = Optional(request.IndicacionesGenerales,
                nameof(request.IndicacionesGenerales), 300),
            request.FechaInicio,
            request.FechaFin,
            Lineas = request.Lineas.Select((linea, index) => new
            {
                Orden = index + 1,
                linea.IdMedicamento,
                linea.CantidadPrescritaUnidades
            })
        });
        return SHA256.HashData(Encoding.UTF8.GetBytes(cuerpo));
    }

    public RecetaClinicaPreparada Preparar(
        CrearRecetaClinicaRequest request, ClaimsPrincipal principal,
        RecetaClinicaContextoConfiable contexto)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(principal);
        ArgumentNullException.ThrowIfNull(contexto);

        var usuario = contexto.Usuario;
        if (principal.Identity?.IsAuthenticated != true ||
            !contexto.TienePermisoPrescribir || usuario is null || !usuario.Activo ||
            !int.TryParse(principal.FindFirst("IdUsuario")?.Value, out var idUsuario) ||
            !int.TryParse(principal.FindFirst("IdRol")?.Value, out var idRol) ||
            idUsuario != usuario.IdUsuario || idRol != usuario.IdRol ||
            !string.Equals(principal.FindFirst("Username")?.Value,
                usuario.Username, StringComparison.Ordinal))
            throw new ForbiddenException("El usuario no está autorizado para prescribir.");

        if (request.IdConsulta <= 0)
            throw Invalid(nameof(request.IdConsulta), "La consulta debe ser válida.");
        if (request.IdDiagnostico <= 0)
            throw Invalid(nameof(request.IdDiagnostico), "El diagnóstico debe ser válido.");
        if (request.ClaveOperacion == Guid.Empty)
            throw Invalid(nameof(request.ClaveOperacion), "La clave de operación es obligatoria.");

        var consulta = contexto.Consulta;
        if (consulta is null || consulta.IdConsulta != request.IdConsulta)
            throw new NotFoundException("Consulta no encontrada.");
        if (usuario.IdEmpleado != consulta.IdMedico ||
            contexto.Medico is not { Activo: true } medico ||
            medico.IdEmpleado != consulta.IdMedico ||
            !string.Equals(medico.TipoEmpleado, "Medico", StringComparison.Ordinal))
            throw new ForbiddenException("Solo el médico responsable activo puede prescribir.");
        if (contexto.Diagnostico is null ||
            contexto.Diagnostico.IdDiagnostico != request.IdDiagnostico ||
            contexto.Diagnostico.IdConsulta != consulta.IdConsulta)
            throw new NotFoundException("Diagnóstico no encontrado en esta consulta.");

        var descripcion = Required(request.DescripcionTratamiento,
            nameof(request.DescripcionTratamiento), 300);
        var indicacionesGenerales = Optional(request.IndicacionesGenerales,
            nameof(request.IndicacionesGenerales), 300);
        if (request.FechaInicio == default)
            throw Invalid(nameof(request.FechaInicio), "La fecha de inicio es obligatoria.");
        if (request.FechaFin is DateOnly fin && fin < request.FechaInicio)
            throw Invalid(nameof(request.FechaFin), "La fecha de fin no puede preceder al inicio.");

        var politica = contexto.Politica;
        if (politica is null || politica.EstadosConsultaPermitidos is null ||
            politica.EstadosConsultaPermitidos.Count == 0 ||
            consulta.EstadoConsulta is null ||
            !politica.EstadosConsultaPermitidos.Contains(consulta.EstadoConsulta) ||
            !string.Equals(politica.EstadoInicialReceta, "Vigente",
                StringComparison.Ordinal))
            throw new ConflictException("La política clínica de prescripción o el estado no están aprobados.");

        if (request.Lineas is null || request.Lineas.Count == 0)
            throw Invalid(nameof(request.Lineas), "La receta requiere al menos un medicamento.");
        if (request.Lineas.Count > short.MaxValue)
            throw Invalid(nameof(request.Lineas), "La receta excede el número de líneas admitido.");
        var preparadas = new List<RecetaLineaPreparada>(request.Lineas.Count);
        var vistos = new HashSet<int>();
        for (var i = 0; i < request.Lineas.Count; i++)
        {
            var linea = request.Lineas[i];
            if (linea is null)
                throw Invalid(nameof(request.Lineas), "Una línea de receta es inválida.");
            if (linea.IdMedicamento <= 0)
                throw Invalid(nameof(linea.IdMedicamento), "El medicamento debe ser válido.");
            if (!vistos.Add(linea.IdMedicamento))
            {
                if (politica.PermiteMismoMedicamentoEnVariasLineas is null)
                    throw new ConflictException("La política de líneas repetidas aún no está aprobada.");
                if (politica.PermiteMismoMedicamentoEnVariasLineas == false)
                    throw Invalid(nameof(request.Lineas), "El medicamento está repetido en la receta.");
            }
            if (linea.CantidadPrescritaUnidades <= 0)
                throw Invalid(nameof(linea.CantidadPrescritaUnidades), "La cantidad debe ser positiva.");

            if (contexto.Medicamentos is null ||
                !contexto.Medicamentos.TryGetValue(linea.IdMedicamento, out var medicamento) ||
                medicamento is null ||
                medicamento.IdMedicamento != linea.IdMedicamento)
                throw new NotFoundException("Medicamento no encontrado.");
            if (!medicamento.Activo)
                throw new ConflictException("El medicamento no está activo.");

            // La cantidad se captura directamente; la presentación no implica conversión.
            preparadas.Add(new RecetaLineaPreparada(
                checked((short)(i + 1)), linea.IdMedicamento,
                linea.CantidadPrescritaUnidades));
        }

        var lineas = Array.AsReadOnly(preparadas.ToArray());
        return new RecetaClinicaPreparada(
            request.IdConsulta, request.IdDiagnostico, descripcion,
            indicacionesGenerales, request.FechaInicio, request.FechaFin,
            usuario.IdUsuario, politica.EstadoInicialReceta,
            request.ClaveOperacion, lineas, CalcularHashSolicitud(request));
    }

    public static short CalcularDuracionDias(DateOnly inicio, DateOnly fin)
    {
        var dias = (long)fin.DayNumber - inicio.DayNumber + 1;
        if (inicio == default || dias is < 1 or > short.MaxValue)
            throw Invalid(nameof(fin), "La duración debe estar entre 1 y 32767 días.");
        return (short)dias;
    }

    private static string Required(string? value, string field, int max)
    {
        var normalized = Normalize(value);
        if (normalized.Length == 0 || normalized.Length > max)
            throw Invalid(field, $"Debe contener entre 1 y {max} caracteres.");
        return normalized;
    }

    private static string? Optional(string? value, string field, int max)
    {
        var normalized = Normalize(value);
        if (normalized.Length > max)
            throw Invalid(field, $"Máximo {max} caracteres.");
        return normalized.Length == 0 ? null : normalized;
    }

    private static string Normalize(string? value) =>
        string.Join(' ', (value ?? string.Empty).Split((char[]?)null,
            StringSplitOptions.RemoveEmptyEntries));

    private static AppValidationException Invalid(string field, string message) =>
        new("Datos de la receta no válidos.",
            new Dictionary<string, string[]> { [field] = [message] });
}
