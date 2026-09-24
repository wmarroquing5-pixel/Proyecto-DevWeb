using System.Globalization;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using API_Clinica.Common;
using API_Clinica.DTOs;
using API_Clinica.Interfaces;
using API_Clinica.Models.Entities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace API_Clinica.Services;

public sealed class JwtTokenService(IOptions<JwtOptions> jwtOptions) : IJwtTokenService
{
    public LoginResponse CreateToken(Usuario usuario)
    {
        var options = jwtOptions.Value;
        var now = DateTime.UtcNow;
        var expires = now.AddMinutes(options.ExpirationMinutes);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, usuario.IdUsuario.ToString(CultureInfo.InvariantCulture)),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("IdUsuario", usuario.IdUsuario.ToString(CultureInfo.InvariantCulture)),
            new("IdRol", usuario.IdRol.ToString(CultureInfo.InvariantCulture)),
            new("Username", usuario.Username)
        };

        if (usuario.IdEmpleado is int idEmpleado)
        {
            claims.Add(new Claim("IdEmpleado", idEmpleado.ToString(CultureInfo.InvariantCulture)));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: options.Issuer,
            audience: options.Audience,
            claims: claims,
            notBefore: now,
            expires: expires,
            signingCredentials: credentials);

        return new LoginResponse(
            new JwtSecurityTokenHandler().WriteToken(token),
            "Bearer",
            new DateTimeOffset(expires, TimeSpan.Zero));
    }
}
