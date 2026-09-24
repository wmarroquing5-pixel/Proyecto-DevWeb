using System.ComponentModel.DataAnnotations;

namespace API_Clinica.DTOs;

public sealed class LoginRequest
{
    [Required]
    [MaxLength(50)]
    public string Username { get; init; } = string.Empty;

    [Required]
    public string Password { get; init; } = string.Empty;
}
