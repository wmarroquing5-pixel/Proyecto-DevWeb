namespace API_Clinica.DTOs;

public sealed record ExamResultFileDto(
    string ArchivoId,
    string NombreOriginal,
    string TipoContenido,
    long TamanoBytes,
    DateTimeOffset FechaCargaUtc,
    int IdUsuarioCarga);
