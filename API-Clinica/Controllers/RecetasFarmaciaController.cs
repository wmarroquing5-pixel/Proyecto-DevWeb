using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/farmacia/recetas")]
public sealed class RecetasFarmaciaController(IRecetaFarmaciaService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Ventas", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<RecetaFarmaciaDto>>> Listar(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        [FromQuery] int? idConsulta = null, CancellationToken ct = default) =>
        Ok(await service.ListarAsync(page, pageSize, idConsulta, User, ct));

    [HttpGet("{idReceta:int}"), PermisoRequerido("Ventas", Operacion.Consultar)]
    public async Task<ActionResult<RecetaFarmaciaDto>> Obtener(
        int idReceta, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(idReceta, User, ct));
}
