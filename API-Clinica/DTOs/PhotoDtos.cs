namespace API_Clinica.DTOs;

public sealed record PhotoResponse(string Url);

public sealed record PhotoContent(byte[] Content, string ContentType);

public sealed record ProcessedPhoto(byte[] Content, string ContentType);
