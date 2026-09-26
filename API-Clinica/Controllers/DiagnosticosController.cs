using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/diagnosticos")]
public sealed class DiagnosticosController(IDiagnosticoService service) : ControllerBase
{
    [HttpPost, PermisoRequerido("Historial", Operacion.Crear)]
    [ProducesResponseType(typeof(DiagnosticoResponse), StatusCodes.Status201Created)]
    public async Task<ActionResult<DiagnosticoResponse>> Crear(
        [FromBody] CrearDiagnosticoRequest request, CancellationToken cancellationToken)
    {
        var response = await service.CrearAsync(request, User, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, response);
    }
}
