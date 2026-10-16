using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/consultas")]
public sealed class ConsultasController(IConsultaService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Consultas", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<ConsultaListadoDto>>> Listar(
        [FromQuery] ConsultaFiltroDto filtro, CancellationToken ct) =>
        Ok(await service.ListarAsync(filtro, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Consultas", Operacion.Consultar)]
    public async Task<ActionResult<ConsultaDetalleDto>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Consultas", Operacion.Crear)]
    public async Task<ActionResult<ConsultaDetalleDto>> Crear(
        ConsultaCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, User, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdConsulta }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Consultas", Operacion.Modificar)]
    public async Task<ActionResult<ConsultaDetalleDto>> Actualizar(
        int id, ConsultaUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, User, ct));
}
