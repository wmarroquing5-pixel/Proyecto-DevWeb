namespace API_Clinica.DTOs;

public sealed record PermisoActualResponse(
    int IdPermiso, string Modulo, bool PuedeConsultar, bool PuedeCrear,
    bool PuedeModificar, bool PuedeEliminar);
