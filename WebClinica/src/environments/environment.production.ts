import { resolveProductionEndpoints } from './production-config';

// El archivo público runtime-config.js debe recibir las URL HTTPS autorizadas
// en el destino. Sin ellas, main.ts impide iniciar la aplicación.
const endpoints = resolveProductionEndpoints(
  (globalThis as typeof globalThis & { WEBCLINICA_PUBLIC_CONFIG?: unknown }).WEBCLINICA_PUBLIC_CONFIG);

export const environment = {
  production: true,
  ...endpoints,
  authorizationRefreshIntervalMs: 60_000,
  authorizationMaxStaleMs: 180_000,
  authorizationRetryBaseMs: 15_000,
  authorizationRetryMaxMs: 120_000,
  useMockApi: false,
};
