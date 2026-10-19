export const environment = {
  production: false,
  apiUrl: 'http://localhost:5293/api',
  /** URL del Hub SignalR expuesto por la API .NET. */
  hubUrl: 'http://localhost:5293/hubs/habitaciones',
  /** Reservado para código pendiente; los servicios activos consumen la API real. */
  useMockApi: false,
};
