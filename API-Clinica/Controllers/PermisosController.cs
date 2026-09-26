using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/permisos")]
public sealed class PermisosController(IAdministracionService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Permisos", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<PermisoResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarPermisosAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Permisos", Operacion.Consultar)]
    public async Task<ActionResult<PermisoResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerPermisoAsync(id, ct));

    [HttpPost, PermisoRequerido("Permisos", Operacion.Crear)]
    public async Task<ActionResult<PermisoResponse>> Crear(GuardarPermisoRequest request, CancellationToken ct)
    {
        var response = await service.CrearPermisoAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdPermiso }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Permisos", Operacion.Modificar)]
    public async Task<ActionResult<PermisoResponse>> Actualizar(int id, GuardarPermisoRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarPermisoAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Permisos", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.EliminarPermisoAsync(id, ct);
        return NoContent();
    }
}
