using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/sucursales")]
public sealed class SucursalesController(ISucursalService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Sucursales", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<SucursalResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Sucursales", Operacion.Consultar)]
    public async Task<ActionResult<SucursalResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Sucursales", Operacion.Crear)]
    public async Task<ActionResult<SucursalResponse>> Crear(GuardarSucursalRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdSucursal }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Sucursales", Operacion.Modificar)]
    public async Task<ActionResult<SucursalResponse>> Actualizar(
        int id, GuardarSucursalRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Sucursales", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
