using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IMedicamentoService
{
    Task<PagedResponse<MedicamentoResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<MedicamentoResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<MedicamentoResponse> CrearAsync(GuardarMedicamentoRequest request, CancellationToken cancellationToken);
    Task<MedicamentoResponse> ActualizarAsync(int id, GuardarMedicamentoRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
