using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/facturas")]
public sealed class FacturasController(IFacturaServiciosService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Facturas", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<FacturaConsultaResumenResponse>>> Listar(
        [FromQuery] FacturaConsultaFiltroDto filtro, CancellationToken cancellationToken) =>
        Ok(await service.ListarAsync(filtro, cancellationToken));

    [HttpGet("{id:int}"), PermisoRequerido("Facturas", Operacion.Consultar)]
    public async Task<ActionResult<FacturaConsultaResponse>> Obtener(
        int id, CancellationToken cancellationToken) =>
        Ok(await service.ObtenerAsync(id, cancellationToken));

    [HttpPost, PermisoRequerido("Facturas", Operacion.Crear)]
    [ProducesResponseType(typeof(FacturaServiciosResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<FacturaServiciosResponse>> Crear(
        [FromBody] CrearFacturaServiciosRequest request, CancellationToken cancellationToken)
    {
        var response = await service.CrearAsync(request, User, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }
}
