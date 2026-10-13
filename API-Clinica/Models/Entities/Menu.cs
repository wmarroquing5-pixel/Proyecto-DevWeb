// Entities/Menu.cs
public sealed class Menu
{
    public int IdMenu { get; set; }
    public int? IdMenuPadre { get; set; }
    public string Nombre { get; set; } = string.Empty;
    public string? Ruta { get; set; }
    public string? Icono { get; set; }
    public int Orden { get; set; }
    public bool Activo { get; set; } = true;
    public bool EsOculto { get; set; }
}

// Entities/RolMenu.cs (tabla intermedia rol ↔ menú)
public sealed class RolMenu
{
    public int IdRol { get; set; }
    public int IdMenu { get; set; }
    public Menu Menu { get; set; } = null!;
}