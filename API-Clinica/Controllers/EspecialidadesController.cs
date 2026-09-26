using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/especialidades")]
public sealed class EspecialidadesController(IEspecialidadService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Especialidades", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<EspecialidadResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Especialidades", Operacion.Consultar)]
    public async Task<ActionResult<EspecialidadResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Especialidades", Operacion.Crear)]
    public async Task<ActionResult<EspecialidadResponse>> Crear(GuardarEspecialidadRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdEspecialidad }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Especialidades", Operacion.Modificar)]
    public async Task<ActionResult<EspecialidadResponse>> Actualizar(
        int id, GuardarEspecialidadRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Especialidades", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
