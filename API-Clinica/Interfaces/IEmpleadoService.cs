using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IEmpleadoService
{
    Task<PagedResponse<EmpleadoListadoResponse>> ListarAsync(
        string? nombre, string? tipoEmpleado, int? idSucursal, bool? activo,
        int page, int pageSize, CancellationToken cancellationToken);
    Task<EmpleadoDetalleResponse> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<EmpleadoDetalleResponse> CrearAsync(CrearEmpleadoRequest request, CancellationToken cancellationToken);
    Task<EmpleadoDetalleResponse> ActualizarAsync(
        int id, ActualizarEmpleadoRequest request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
