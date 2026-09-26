using API_Clinica.Exceptions;

namespace API_Clinica.Services;

internal static class FarmaciaValidation
{
    public static string RequiredText(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > maxLength)
            throw Invalid(field, $"Debe contener entre 1 y {maxLength} caracteres.");
        return text;
    }

    public static string? OptionalText(string? value, string field, int maxLength)
    {
        var text = value?.Trim();
        if (text?.Length > maxLength)
            throw Invalid(field, $"Máximo {maxLength} caracteres.");
        return string.IsNullOrEmpty(text) ? null : text;
    }

    public static decimal Price(decimal value)
    {
        if (value <= 0 || value >= 10_000_000_000_000_000m ||
            decimal.Round(value, 2) != value)
            throw Invalid("PrecioVenta", "Debe ser mayor que cero y tener como máximo dos decimales dentro de decimal(18,2).");
        return value;
    }

    public static void Dates(DateOnly ingreso, DateOnly vencimiento)
    {
        if (ingreso == default || ingreso > DateOnly.FromDateTime(DateTime.UtcNow))
            throw Invalid("FechaIngreso", "Debe ser una fecha válida que no esté en el futuro.");
        if (vencimiento == default || vencimiento <= ingreso)
            throw Invalid("FechaVencimiento", "Debe ser posterior a FechaIngreso.");
    }

    public static AppValidationException Invalid(string field, string message) =>
        new("Datos no válidos.", new Dictionary<string, string[]> { [field] = [message] });
}
