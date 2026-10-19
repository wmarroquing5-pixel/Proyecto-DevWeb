using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using API_Clinica.Services;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/pacientes")]
public sealed class PacientesController(
    IPacienteService service,
    IPhotoService photoService) : ControllerBase
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

    [HttpPost("{id:int}/foto"), PermisoRequerido("Pacientes", Operacion.Modificar)]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(PhotoImageProcessor.MultipartBodyLimit)]
    [RequestFormLimits(MultipartBodyLengthLimit = PhotoImageProcessor.MultipartBodyLimit)]
    public async Task<ActionResult<PhotoResponse>> GuardarFoto(
        int id, [FromForm(Name = "foto")] IFormFile? foto, CancellationToken ct) =>
        Ok(await photoService.SavePatientPhotoAsync(id, foto, ct));

    [HttpGet("{id:int}/foto"), PermisoRequerido("Pacientes", Operacion.Consultar)]
    public async Task<IActionResult> ObtenerFoto(int id, CancellationToken ct)
    {
        var photo = await photoService.GetPatientPhotoAsync(id, ct);
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers.XContentTypeOptions = "nosniff";
        return File(photo.Content, photo.ContentType);
    }

    [HttpDelete("{id:int}/foto"), PermisoRequerido("Pacientes", Operacion.Modificar)]
    public async Task<IActionResult> EliminarFoto(int id, CancellationToken ct)
    {
        await photoService.DeletePatientPhotoAsync(id, ct);
        return NoContent();
    }
}
