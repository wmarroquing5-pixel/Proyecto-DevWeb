using API_Clinica.Common;
using Microsoft.AspNetCore.SignalR;

namespace API_Clinica.Hubs;

[PermisoRequerido("Habitaciones", Operacion.Consultar)]
public sealed class HabitacionHub : Hub;
