using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IMarcaService
{
    Task<PagedResponse<MarcaResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<MarcaResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<MarcaResponse> CrearAsync(GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken);
    Task<MarcaResponse> ActualizarAsync(int id, GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
