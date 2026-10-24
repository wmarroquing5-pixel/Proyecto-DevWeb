using System.Security.Claims;
using API_Clinica.DTOs;

namespace API_Clinica.Interfaces;

public interface ITratamientoService
{
    Task<PagedResponse<TratamientoResponseDto>> ListarAsync(
        TratamientoFiltroDto filtro, ClaimsPrincipal principal, CancellationToken cancellationToken);
    Task<TratamientoResponseDto> ObtenerAsync(int id, ClaimsPrincipal principal, CancellationToken cancellationToken);
    Task<TratamientoResponseDto> CrearAsync(
        TratamientoCreateDto request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
    Task<TratamientoResponseDto> ActualizarAsync(
        int id, TratamientoUpdateDto request, ClaimsPrincipal principal,
        CancellationToken cancellationToken);
}
