using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/habitaciones")]
public sealed class HabitacionesController(IHabitacionService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Habitaciones", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<HabitacionResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Habitaciones", Operacion.Consultar)]
    public async Task<ActionResult<HabitacionResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Habitaciones", Operacion.Crear)]
    public async Task<ActionResult<HabitacionResponse>> Crear(
        CrearHabitacionRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdHabitacion }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Habitaciones", Operacion.Modificar)]
    public async Task<ActionResult<HabitacionResponse>> Actualizar(
        int id, ActualizarHabitacionRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Habitaciones", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
