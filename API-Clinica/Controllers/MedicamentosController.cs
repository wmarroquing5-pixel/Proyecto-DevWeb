using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/medicamentos")]
public sealed class MedicamentosController(IMedicamentoService service) : ControllerBase
{
    [HttpGet("catalogo"), PermisoRequerido("Medicamentos", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<CatalogoMedicamentoResponse>>> ListarCatalogo(
        [FromQuery] string? nombre, [FromQuery] int? categoriaId, [FromQuery] int? marcaId,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarCatalogoAsync(nombre, categoriaId, marcaId, page, pageSize, ct));

    [HttpGet("catalogo/{id:int}"), PermisoRequerido("Medicamentos", Operacion.Consultar)]
    public async Task<ActionResult<CatalogoMedicamentoResponse>> ObtenerCatalogo(int id, CancellationToken ct) =>
        Ok(await service.ObtenerCatalogoAsync(id, ct));

    [HttpGet, PermisoRequerido("Medicamentos", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<MedicamentoResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Medicamentos", Operacion.Consultar)]
    public async Task<ActionResult<MedicamentoResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Medicamentos", Operacion.Crear)]
    public async Task<ActionResult<MedicamentoResponse>> Crear(
        GuardarMedicamentoRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdMedicamento }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Medicamentos", Operacion.Modificar)]
    public async Task<ActionResult<MedicamentoResponse>> Actualizar(
        int id, GuardarMedicamentoRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Medicamentos", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
