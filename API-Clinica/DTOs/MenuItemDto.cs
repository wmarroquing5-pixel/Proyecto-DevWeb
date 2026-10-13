namespace API_Clinica.DTOs;

/// <summary>
/// Item de menú. Se define como record para permitir la sintaxis 'with'
/// en el filtrado recursivo de hijos.
/// </summary>
public sealed record MenuItemDto
{
    public string Label { get; init; } = string.Empty;
    public string? Route { get; init; }
    public string? Icon { get; init; }
    public bool Hidden { get; init; }
    public string[]? Roles { get; init; }
    public List<MenuItemDto>? Children { get; init; }
}