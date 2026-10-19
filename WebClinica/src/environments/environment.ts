export const environment = {
  production: false,
  apiUrl: 'http://localhost:5293/api',
  /** URL del Hub SignalR expuesto por la API .NET. */
  hubUrl: 'http://localhost:5293/hubs/habitaciones',
  /** Revalidación eventual de permisos mientras la sesión y la pestaña están activas. */
  authorizationRefreshIntervalMs: 60_000,
  /** Tras este límite sin una respuesta válida, las autorizaciones en caché dejan de ser efectivas. */
  authorizationMaxStaleMs: 180_000,
  authorizationRetryBaseMs: 15_000,
  authorizationRetryMaxMs: 120_000,
  /** Reservado para código pendiente; los servicios activos consumen la API real. */
  useMockApi: false,
};
