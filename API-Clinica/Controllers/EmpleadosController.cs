using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/empleados")]
public sealed class EmpleadosController(IEmpleadoService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Empleados", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<EmpleadoListadoResponse>>> Listar(
        [FromQuery] string? nombre = null, [FromQuery] string? tipoEmpleado = null,
        [FromQuery] int? idSucursal = null, [FromQuery] bool? activo = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await service.ListarAsync(nombre, tipoEmpleado, idSucursal, activo,
            page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Empleados", Operacion.Consultar)]
    public async Task<ActionResult<EmpleadoDetalleResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Empleados", Operacion.Crear)]
    public async Task<ActionResult<EmpleadoDetalleResponse>> Crear(
        CrearEmpleadoRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdEmpleado }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Empleados", Operacion.Modificar)]
    public async Task<ActionResult<EmpleadoDetalleResponse>> Actualizar(
        int id, ActualizarEmpleadoRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Empleados", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
