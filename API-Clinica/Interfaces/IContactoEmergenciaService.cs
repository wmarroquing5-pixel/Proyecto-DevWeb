using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface IContactoEmergenciaService
{
    Task<PagedResponse<ContactoEmergenciaResponseDto>> ListarAsync(
        int? idPaciente, int page, int pageSize, CancellationToken cancellationToken);
    Task<ContactoEmergenciaResponseDto> ObtenerAsync(int id, CancellationToken cancellationToken);
    Task<ContactoEmergenciaResponseDto> CrearAsync(
        ContactoEmergenciaCreateDto request, CancellationToken cancellationToken);
    Task<ContactoEmergenciaResponseDto> ActualizarAsync(
        int id, ContactoEmergenciaUpdateDto request, CancellationToken cancellationToken);
    Task DesactivarAsync(int id, CancellationToken cancellationToken);
}
