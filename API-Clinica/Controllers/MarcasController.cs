using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/marcas")]
public sealed class MarcasController(IMarcaService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Marcas", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<MarcaResponse>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Marcas", Operacion.Consultar)]
    public async Task<ActionResult<MarcaResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Marcas", Operacion.Crear)]
    public async Task<ActionResult<MarcaResponse>> Crear(
        GuardarCatalogoFarmaciaRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdMarca }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Marcas", Operacion.Modificar)]
    public async Task<ActionResult<MarcaResponse>> Actualizar(
        int id, GuardarCatalogoFarmaciaRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Marcas", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
