using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/examenes")]
public sealed class ExamenesController(IExamenService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<ExamenResponseDto>>> Listar(
        [FromQuery] ExamenFiltroDto filtro, CancellationToken ct) =>
        Ok(await service.ListarAsync(filtro, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<ExamenResponseDto>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Historial", Operacion.Crear)]
    public async Task<ActionResult<ExamenResponseDto>> Crear(
        ExamenCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, User, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdExamen }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Historial", Operacion.Modificar)]
    public async Task<ActionResult<ExamenResponseDto>> Actualizar(
        int id, ExamenUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, User, ct));
}
