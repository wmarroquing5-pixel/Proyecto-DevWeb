using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/historial-medico")]
public sealed class HistorialMedicoController(IHistorialMedicoService service) : ControllerBase
{
    [HttpPost, PermisoRequerido("Historial", Operacion.Crear)]
    public async Task<ActionResult<HistorialMedicoResponseDto>> Crear(
        HistorialMedicoCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, User, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdHistorial }, response);
    }

    [HttpGet, PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<HistorialMedicoResponseDto>>> Listar(
        [FromQuery] HistorialMedicoFiltroDto filtro, CancellationToken ct) =>
        Ok(await service.ListarAsync(filtro, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<HistorialMedicoResponseDto>> Obtener(
        int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));
}
