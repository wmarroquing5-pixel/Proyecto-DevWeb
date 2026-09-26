using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface ICategoriaService
{
    Task<PagedResponse<CategoriaResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<CategoriaResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<CategoriaResponse> CrearAsync(GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken);
    Task<CategoriaResponse> ActualizarAsync(int id, GuardarCatalogoFarmaciaRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
