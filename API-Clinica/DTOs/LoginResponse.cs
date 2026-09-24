namespace API_Clinica.DTOs;

public sealed record LoginResponse(string AccessToken, string TokenType, DateTimeOffset ExpiresAtUtc);
