using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/turnos")]
public sealed class TurnosController(ITurnoService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Turnos", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<TurnoResponseDto>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Turnos", Operacion.Consultar)]
    public async Task<ActionResult<TurnoResponseDto>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Turnos", Operacion.Crear)]
    public async Task<ActionResult<TurnoResponseDto>> Crear(
        TurnoCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdTurno }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Turnos", Operacion.Modificar)]
    public async Task<ActionResult<TurnoResponseDto>> Actualizar(
        int id, TurnoUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Turnos", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
