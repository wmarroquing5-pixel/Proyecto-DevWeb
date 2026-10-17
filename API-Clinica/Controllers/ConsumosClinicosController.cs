using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/tratamientos/{id:int}/consumos")]
public sealed class ConsumosClinicosController(IConsumoClinicoService service) : ControllerBase
{
    [HttpPost, PermisoRequerido("ConsumoClinico", Operacion.Crear)]
    public async Task<ActionResult<ConsumoClinicoResponseDto>> Crear(
        int id, ConsumoClinicoCreateDto request, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created,
            await service.RegistrarAsync(id, request, User, ct));
}
