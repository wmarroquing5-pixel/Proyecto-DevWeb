using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/usuarios")]
public sealed class UsuariosController(IAdministracionService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Usuarios", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<UsuarioResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarUsuariosAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Usuarios", Operacion.Consultar)]
    public async Task<ActionResult<UsuarioResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerUsuarioAsync(id, ct));

    [HttpPost, PermisoRequerido("Usuarios", Operacion.Crear)]
    public async Task<ActionResult<UsuarioResponse>> Crear(CrearUsuarioRequest request, CancellationToken ct)
    {
        var response = await service.CrearUsuarioAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdUsuario }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Usuarios", Operacion.Modificar)]
    public async Task<ActionResult<UsuarioResponse>> Actualizar(int id, ActualizarUsuarioRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarUsuarioAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Usuarios", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        if (!int.TryParse(User.FindFirst("IdUsuario")?.Value, out var actorId)) return Forbid();
        await service.EliminarUsuarioAsync(id, actorId, ct);
        return NoContent();
    }
}
