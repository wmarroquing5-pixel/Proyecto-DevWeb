using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/ventas")]
public sealed class VentasController(IVentaService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Ventas", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<VentaConsultaResumenResponse>>> Listar(
        [FromQuery] VentaConsultaFiltroDto filtro, CancellationToken cancellationToken) =>
        Ok(await service.ListarAsync(filtro, cancellationToken));

    [HttpGet("{id:int}"), PermisoRequerido("Ventas", Operacion.Consultar)]
    public async Task<ActionResult<VentaConsultaResponse>> Obtener(
        int id, CancellationToken cancellationToken) =>
        Ok(await service.ObtenerAsync(id, cancellationToken));

    [HttpPost, PermisoRequerido("Ventas", Operacion.Crear)]
    [ProducesResponseType(typeof(VentaResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<VentaResponse>> Crear(
        [FromBody] CrearVentaRequest request, CancellationToken cancellationToken)
    {
        var response = await service.CrearAsync(request, User, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }
}
