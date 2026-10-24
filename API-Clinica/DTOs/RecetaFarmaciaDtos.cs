namespace API_Clinica.DTOs;

public sealed record RecetaFarmaciaLineaDto(
    int IdMedicamento, string NombreMedicamento, string? Presentacion,
    int CantidadPrescritaUnidades);

public sealed record RecetaFarmaciaDto(
    int IdReceta, int IdConsulta, string NombrePaciente,
    string? NombreMedicoPrescriptor, DateTime FechaPrescripcionUtc,
    string Estado, IReadOnlyList<RecetaFarmaciaLineaDto> Medicamentos);
