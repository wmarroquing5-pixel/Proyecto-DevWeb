using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/lotes-medicamento")]
public sealed class LotesMedicamentoController(ILoteMedicamentoService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("LotesMedicamento", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<LoteMedicamentoResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("LotesMedicamento", Operacion.Consultar)]
    public async Task<ActionResult<LoteMedicamentoResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("LotesMedicamento", Operacion.Crear)]
    public async Task<ActionResult<LoteMedicamentoResponse>> Crear(
        GuardarLoteMedicamentoRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdLote }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("LotesMedicamento", Operacion.Modificar)]
    public async Task<ActionResult<LoteMedicamentoResponse>> Actualizar(
        int id, GuardarLoteMedicamentoRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("LotesMedicamento", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.EliminarAsync(id, ct);
        return NoContent();
    }
}
