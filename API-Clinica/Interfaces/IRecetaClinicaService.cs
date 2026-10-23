using System.Security.Claims;
using API_Clinica.DTOs;
using API_Clinica.Services;

namespace API_Clinica.Interfaces;

public sealed record RecetaCreacionResultado(RecetaClinicaDetalleDto Receta, bool EsReintento);

public interface IRecetaClinicaService
{
    Task<RecetaCreacionResultado> CrearAsync(
        CrearRecetaClinicaRequest request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
    Task<RecetaClinicaDetalleDto> ObtenerAsync(
        int idReceta, ClaimsPrincipal principal, CancellationToken cancellationToken);
    Task<PagedResponse<RecetaClinicaResumenDto>> ListarPorConsultaAsync(
        int idConsulta, int page, int pageSize, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}

// El contexto debe provenir de lecturas/autorización del backend; nunca del HTTP.
public interface IRecetaClinicaPreparador
{
    // Huella del cuerpo del cliente, calculable antes de volver a evaluar una
    // política que pudo cambiar después del primer COMMIT.
    ReadOnlyMemory<byte> CalcularHashSolicitud(CrearRecetaClinicaRequest request);

    RecetaClinicaPreparada Preparar(
        CrearRecetaClinicaRequest request, ClaimsPrincipal principal,
        RecetaClinicaContextoConfiable contexto);
}
