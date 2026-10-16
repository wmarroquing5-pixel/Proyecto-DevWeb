using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/diagnosticos")]
public sealed class DiagnosticosController(IDiagnosticoService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<DiagnosticoResponse>>> Listar(
        [FromQuery] DiagnosticoFiltroDto filtro, CancellationToken cancellationToken) =>
        Ok(await service.ListarAsync(filtro, cancellationToken));

    [HttpGet("{id:int}"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<DiagnosticoResponse>> Obtener(
        int id, CancellationToken cancellationToken) =>
        Ok(await service.ObtenerAsync(id, cancellationToken));

    [HttpPost, PermisoRequerido("Historial", Operacion.Crear)]
    [ProducesResponseType(typeof(DiagnosticoResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<DiagnosticoResponse>> Crear(
        [FromBody] CrearDiagnosticoRequest request, CancellationToken cancellationToken)
    {
        var response = await service.CrearAsync(request, User, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Historial", Operacion.Modificar)]
    public async Task<ActionResult<DiagnosticoResponse>> Actualizar(
        int id, [FromBody] ActualizarDiagnosticoRequest request,
        CancellationToken cancellationToken) =>
        Ok(await service.ActualizarAsync(id, request, User, cancellationToken));
}
