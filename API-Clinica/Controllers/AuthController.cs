using API_Clinica.DTOs;
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
    public IActionResult Me()
    {
        if (!int.TryParse(User.FindFirst("IdUsuario")?.Value, out var idUsuario) ||
            !int.TryParse(User.FindFirst("IdRol")?.Value, out var idRol))
        {
            return Unauthorized();
        }

        int? idEmpleado = int.TryParse(User.FindFirst("IdEmpleado")?.Value, out var employeeId)
            ? employeeId : null;

        return Ok(new
        {
            idUsuario,
            idRol,
            username = User.FindFirst("Username")?.Value,
            idEmpleado
        });
    }

    [Authorize]
    [HttpGet("permisos")]
    public async Task<IActionResult> Permisos(CancellationToken cancellationToken) =>
        Ok(await accesoActual.ObtenerPermisosAsync(User, cancellationToken));
}
