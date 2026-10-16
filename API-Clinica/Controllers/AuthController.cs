using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace API_Clinica.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService, IAccesoActualService accesoActual) : ControllerBase
{
    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<LoginResponse>> Login(
        [FromBody] LoginRequest request,
        CancellationToken cancellationToken)
    {
        var response = await authService.LoginAsync(request, cancellationToken);
        return Ok(response);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        var usuario = await accesoActual.ObtenerUsuarioActivoAsync(User, cancellationToken)
            ?? throw new ForbiddenException("Acceso denegado.");

        return Ok(new
        {
            idUsuario = usuario.IdUsuario,
            idRol = usuario.IdRol,
            username = usuario.Username,
            idEmpleado = usuario.IdEmpleado
        });
    }

    [Authorize]
    [HttpGet("permisos")]
    public async Task<IActionResult> Permisos(CancellationToken cancellationToken) =>
        Ok(await accesoActual.ObtenerPermisosAsync(User, cancellationToken));
}
