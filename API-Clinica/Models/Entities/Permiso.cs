namespace API_Clinica.Models.Entities;

public class Permiso
{
    public int IdPermiso { get; set; }

    public int IdRol { get; set; }

    public string Modulo { get; set; } = null!;

    public bool PuedeConsultar { get; set; }

    public bool PuedeCrear { get; set; }

    public bool PuedeModificar { get; set; }

    public bool PuedeEliminar { get; set; }
}
