using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/servicios")]
public sealed class ServiciosController(IServicioService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Servicios", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<ServicioResponseDto>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Servicios", Operacion.Consultar)]
    public async Task<ActionResult<ServicioResponseDto>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Servicios", Operacion.Crear)]
    public async Task<ActionResult<ServicioResponseDto>> Crear(
        ServicioCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdServicio }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Servicios", Operacion.Modificar)]
    public async Task<ActionResult<ServicioResponseDto>> Actualizar(
        int id, ServicioUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Servicios", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
