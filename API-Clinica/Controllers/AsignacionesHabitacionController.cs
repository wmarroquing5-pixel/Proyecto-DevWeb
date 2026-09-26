using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/asignaciones-habitacion")]
public sealed class AsignacionesHabitacionController(
    IAsignacionHabitacionService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("AsignacionesHabitacion", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<AsignacionHabitacionResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("AsignacionesHabitacion", Operacion.Consultar)]
    public async Task<ActionResult<AsignacionHabitacionResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("AsignacionesHabitacion", Operacion.Crear)]
    public async Task<ActionResult<AsignacionHabitacionResponse>> Crear(
        CrearAsignacionHabitacionRequest request, CancellationToken ct)
    {
        var response = await service.AsignarAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdAsignacion }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("AsignacionesHabitacion", Operacion.Modificar)]
    public async Task<ActionResult<AsignacionHabitacionResponse>> Actualizar(
        int id, ActualizarAsignacionHabitacionRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpPost("{id:int}/egreso"), PermisoRequerido("AsignacionesHabitacion", Operacion.Modificar)]
    public async Task<ActionResult<AsignacionHabitacionResponse>> Egreso(int id, CancellationToken ct) =>
        Ok(await service.RegistrarEgresoAsync(id, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("AsignacionesHabitacion", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.EliminarAsync(id, ct);
        return NoContent();
    }
}
