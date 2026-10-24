using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/tratamientos")]
public sealed class TratamientosController(ITratamientoService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<TratamientoResponseDto>>> Listar(
        [FromQuery] TratamientoFiltroDto filtro, CancellationToken ct) =>
        Ok(await service.ListarAsync(filtro, User, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<TratamientoResponseDto>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, User, ct));

    [HttpPost, PermisoRequerido("Historial", Operacion.Crear)]
    public async Task<ActionResult<TratamientoResponseDto>> Crear(
        TratamientoCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, User, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdTratamiento }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Historial", Operacion.Modificar)]
    public async Task<ActionResult<TratamientoResponseDto>> Actualizar(
        int id, TratamientoUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, User, ct));
}
