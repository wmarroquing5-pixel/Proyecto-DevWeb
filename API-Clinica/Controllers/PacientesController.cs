using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/pacientes")]
public sealed class PacientesController(IPacienteService service) : ControllerBase
{
    [HttpGet, PermisoRequerido("Pacientes", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<PacienteListadoResponse>>> Listar(
        [FromQuery] string? nombre = null, [FromQuery] bool? activo = null,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        Ok(await service.ListarAsync(nombre, activo, page, pageSize, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Pacientes", Operacion.Consultar)]
    public async Task<ActionResult<PacienteResponse>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, ct));

    [HttpPost, PermisoRequerido("Pacientes", Operacion.Crear)]
    public async Task<ActionResult<PacienteResponse>> Crear(
        GuardarPacienteRequest request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdPaciente }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Pacientes", Operacion.Modificar)]
    public async Task<ActionResult<PacienteResponse>> Actualizar(
        int id, GuardarPacienteRequest request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, ct));

    [HttpDelete("{id:int}"), PermisoRequerido("Pacientes", Operacion.Eliminar)]
    public async Task<IActionResult> Eliminar(int id, CancellationToken ct)
    {
        await service.DesactivarAsync(id, ct);
        return NoContent();
    }
}
