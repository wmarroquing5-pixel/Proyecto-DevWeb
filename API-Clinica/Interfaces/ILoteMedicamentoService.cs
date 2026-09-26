using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface ILoteMedicamentoService
{
    Task<PagedResponse<LoteMedicamentoResponse>> ListarAsync(int page, int pageSize, CancellationToken cancellationToken);
    Task<LoteMedicamentoResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<LoteMedicamentoResponse> CrearAsync(GuardarLoteMedicamentoRequest request, CancellationToken cancellationToken);
    Task<LoteMedicamentoResponse> ActualizarAsync(int id, GuardarLoteMedicamentoRequest request, CancellationToken cancellationToken);
    Task EliminarAsync(int id, CancellationToken cancellationToken);
}
