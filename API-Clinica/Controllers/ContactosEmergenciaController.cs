using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/contactos-emergencia")]
public sealed class ContactosEmergenciaController(IContactoEmergenciaService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("ContactosEmergencia", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<ContactoEmergenciaResponseDto>>> Listar(
        [FromQuery] int? idPaciente = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await service.ListarAsync(idPaciente, page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("ContactosEmergencia", Operacion.Consultar)]
    public async Task<ActionResult<ContactoEmergenciaResponseDto>> Obtener(
        int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("ContactosEmergencia", Operacion.Crear)]
    public async Task<ActionResult<ContactoEmergenciaResponseDto>> Crear(
        ContactoEmergenciaCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdContacto }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("ContactosEmergencia", Operacion.Modificar)]
    public async Task<ActionResult<ContactoEmergenciaResponseDto>> Actualizar(
        int id, ContactoEmergenciaUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("ContactosEmergencia", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
