using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/ventas")]
public sealed class VentasController(IVentaService service) : ControllerBase
{
    [HttpPost, PermisoRequerido("Ventas", Operacion.Crear)]
    [ProducesResponseType(typeof(VentaResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<VentaResponse>> Crear(
        [FromBody] CrearVentaRequest request, CancellationToken cancellationToken)
    {
        var response = await service.CrearAsync(request, User, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }
}
