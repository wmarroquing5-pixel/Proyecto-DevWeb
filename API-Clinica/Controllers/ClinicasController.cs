using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/clinicas")]
public sealed class ClinicasController(IClinicaService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Clinicas", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<ClinicaResponseDto>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Clinicas", Operacion.Consultar)]
    public async Task<ActionResult<ClinicaResponseDto>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Clinicas", Operacion.Crear)]
    public async Task<ActionResult<ClinicaResponseDto>> Crear(
        ClinicaCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdClinica }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Clinicas", Operacion.Modificar)]
    public async Task<ActionResult<ClinicaResponseDto>> Actualizar(
        int id, ClinicaUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Clinicas", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
