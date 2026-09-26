using Microsoft.AspNetCore.Authorization;

namespace API_Clinica.Common;

public sealed class PermisoRequeridoAttribute : AuthorizeAttribute
{
    public const string Prefix = "Permiso:";
    public PermisoRequeridoAttribute(string modulo, Operacion operacion)
    {
        Policy = $"{Prefix}{modulo}:{operacion}";
    }
}
