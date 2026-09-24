using API_Clinica.Data;
using API_Clinica.DTOs;
using API_Clinica.Exceptions;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace API_Clinica.Services;

public sealed class AuthService(
    ClinicaDbContext context,
    IPasswordHasher<Usuario> passwordHasher,
    IJwtTokenService tokenService) : IAuthService
{
    private const string InvalidCredentialsMessage = "Credenciales inválidas.";

    public async Task<LoginResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        var usuario = await context.Usuarios.AsNoTracking()
            .SingleOrDefaultAsync(u => u.Username == request.Username, cancellationToken);

        if (usuario is null || !usuario.Activo)
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        var rolActivo = await context.Roles.AsNoTracking()
            .AnyAsync(r => r.IdRol == usuario.IdRol && r.Activo, cancellationToken);

        if (!rolActivo)
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        if (usuario.IdEmpleado is int idEmpleado &&
            !await context.Empleados.AsNoTracking()
                .AnyAsync(e => e.IdEmpleado == idEmpleado, cancellationToken))
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        var passwordResult = passwordHasher.VerifyHashedPassword(
            usuario, usuario.PasswordHash, request.Password);

        if (passwordResult == PasswordVerificationResult.Failed)
        {
            throw new UnauthorizedException(InvalidCredentialsMessage);
        }

        return tokenService.CreateToken(usuario);
    }
}
