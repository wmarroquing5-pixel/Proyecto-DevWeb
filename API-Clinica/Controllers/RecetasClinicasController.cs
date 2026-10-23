using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api")]
public sealed class RecetasClinicasController(IRecetaClinicaService service) : ControllerBase
{
    [HttpPost("consultas/{idConsulta:int}/recetas"), PermisoRequerido("Historial", Operacion.Crear)]
    public async Task<ActionResult<RecetaClinicaDetalleDto>> Crear(
        int idConsulta, CrearRecetaClinicaRequest request, CancellationToken ct)
    {
        if (request.IdConsulta != idConsulta)
            throw new AppValidationException("La consulta de la ruta y del cuerpo no coincide.",
                new Dictionary<string, string[]> { ["IdConsulta"] = ["Debe coincidir con la ruta."] });
        var resultado = await service.CrearAsync(request, User, ct);
        if (resultado.EsReintento)
            return Ok(resultado.Receta);
        return CreatedAtAction(nameof(Obtener),
            new { idReceta = resultado.Receta.IdReceta }, resultado.Receta);
    }

    [HttpGet("consultas/{idConsulta:int}/recetas"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<RecetaClinicaResumenDto>>> Listar(
        int idConsulta, [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await service.ListarPorConsultaAsync(idConsulta, page, pageSize, User, ct));

    [HttpGet("recetas/{idReceta:int}"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<RecetaClinicaDetalleDto>> Obtener(
        int idReceta, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(idReceta, User, ct));
}
