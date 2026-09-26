using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/roles")]
public sealed class RolesController(IAdministracionService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Roles", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<RolResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarRolesAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Roles", Operacion.Consultar)]
    public async Task<ActionResult<RolResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerRolAsync(id, ct));

    [HttpPost, PermisoRequerido("Roles", Operacion.Crear)]
    public async Task<ActionResult<RolResponse>> Crear(GuardarRolRequest request, CancellationToken ct)
    {
        var response = await service.CrearRolAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdRol }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Roles", Operacion.Modificar)]
    public async Task<ActionResult<RolResponse>> Actualizar(int id, GuardarRolRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarRolAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Roles", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.EliminarRolAsync(id, ct);
        return NoContent();
    }
}
