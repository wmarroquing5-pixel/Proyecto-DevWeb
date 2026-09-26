using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface ISucursalService
{
    Task<PagedResponse<SucursalResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<SucursalResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<SucursalResponse> CrearAsync(GuardarSucursalRequest request, CancellationToken cancellationToken);
    Task<SucursalResponse> ActualizarAsync(int id, GuardarSucursalRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
