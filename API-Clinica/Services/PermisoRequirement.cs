using API_Clinica.Common;
using Microsoft.AspNetCore.Authorization;

namespace API_Clinica.Services;

public sealed record PermisoRequirement(string Modulo, Operacion Operacion) : IAuthorizationRequirement;
