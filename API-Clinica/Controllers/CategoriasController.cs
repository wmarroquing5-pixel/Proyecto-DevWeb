using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/categorias")]
public sealed class CategoriasController(ICategoriaService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Categorias", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<CategoriaResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Categorias", Operacion.Consultar)]
    public async Task<ActionResult<CategoriaResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Categorias", Operacion.Crear)]
    public async Task<ActionResult<CategoriaResponse>> Crear(
        GuardarCatalogoFarmaciaRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdCategoria }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Categorias", Operacion.Modificar)]
    public async Task<ActionResult<CategoriaResponse>> Actualizar(
        int id, GuardarCatalogoFarmaciaRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Categorias", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
