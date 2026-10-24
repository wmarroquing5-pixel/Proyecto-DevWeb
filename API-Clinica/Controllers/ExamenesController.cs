using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/examenes")]
public sealed class ExamenesController(IExamenService service, IExamResultService results) : ControllerBase
{
    [HttpGet, PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<PagedResponse<ExamenResponseDto>>> Listar(
        [FromQuery] ExamenFiltroDto filtro, CancellationToken ct) =>
        Ok(await service.ListarAsync(filtro, User, ct));

    [HttpGet("{id:int}"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<ExamenResponseDto>> Obtener(int id, CancellationToken ct) =>
        Ok(await service.ObtenerAsync(id, User, ct));

    [HttpPost, PermisoRequerido("Historial", Operacion.Crear)]
    public async Task<ActionResult<ExamenResponseDto>> Crear(
        ExamenCreateDto request, CancellationToken ct)
    {
        var response = await service.CrearAsync(request, User, ct);
        return CreatedAtAction(nameof(Obtener), new { id = response.IdExamen }, response);
    }

    [HttpPut("{id:int}"), PermisoRequerido("Historial", Operacion.Modificar)]
    public async Task<ActionResult<ExamenResponseDto>> Actualizar(
        int id, ExamenUpdateDto request, CancellationToken ct) =>
        Ok(await service.ActualizarAsync(id, request, User, ct));

    [HttpGet("{id:int}/archivos"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<ActionResult<IReadOnlyList<ExamResultFileDto>>> ListarArchivos(
        int id, CancellationToken ct) => Ok(await results.ListAsync(id, User, ct));

    [HttpPost("{id:int}/archivos"), PermisoRequerido("Historial", Operacion.Modificar)]
    [RequestSizeLimit(22 * 1024 * 1024)]
    [RequestFormLimits(MultipartBodyLengthLimit = 22 * 1024 * 1024)]
    public async Task<ActionResult<IReadOnlyList<ExamResultFileDto>>> AdjuntarArchivos(
        int id, [FromForm] List<IFormFile>? archivos, CancellationToken ct) =>
        StatusCode(StatusCodes.Status201Created,
            await results.UploadAsync(id, archivos, User, ct));

    [HttpGet("{id:int}/archivos/{archivoId}"), PermisoRequerido("Historial", Operacion.Consultar)]
    public async Task<IActionResult> DescargarArchivo(int id, string archivoId, CancellationToken ct)
    {
        var file = await results.DownloadAsync(id, archivoId, User, ct);
        Response.Headers.CacheControl = "private, no-store";
        Response.Headers.XContentTypeOptions = "nosniff";
        Response.Headers.ContentSecurityPolicy = "sandbox";
        return File(file.Content, file.Metadata.TipoContenido, file.Metadata.NombreOriginal);
    }

    [HttpDelete("{id:int}/archivos/{archivoId}"), PermisoRequerido("Historial", Operacion.Eliminar)]
    public async Task<IActionResult> EliminarArchivo(int id, string archivoId, CancellationToken ct)
    {
        await results.DeleteAsync(id, archivoId, User, ct);
        return NoContent();
    }
}
