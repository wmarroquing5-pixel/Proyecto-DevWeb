using API_Clinica.DTOs;
using API_Clinica.Models.Entities;

namespace API_Clinica.Interfaces;

public interface IJwtTokenService
{
    LoginResponse CreateToken(Usuario usuario);
}
