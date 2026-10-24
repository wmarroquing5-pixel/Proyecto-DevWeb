export interface PublicEndpoints {
  apiUrl: string;
  hubUrl: string;
}

function absoluteHttpsEndpoint(value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim());
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || url.search ||
      url.hash || url.pathname !== path || host === 'localhost' ||
      host.endsWith('.localhost') || host === '127.0.0.1' || host === '[::1]') return '';
    return url.href;
  } catch {
    return '';
  }
}

export function resolveProductionEndpoints(value: unknown): PublicEndpoints {
  const configured = value && typeof value === 'object'
    ? value as Record<string, unknown> : {};
  const apiUrl = absoluteHttpsEndpoint(configured['apiUrl'], '/api');
  const hubUrl = absoluteHttpsEndpoint(configured['hubUrl'], '/hubs/habitaciones');
  if (!apiUrl || !hubUrl || new URL(apiUrl).origin !== new URL(hubUrl).origin)
    return { apiUrl: '', hubUrl: '' };
  return { apiUrl, hubUrl };
}

export function productionEndpointsReady(value: PublicEndpoints): boolean {
  const resolved = resolveProductionEndpoints(value);
  return !!resolved.apiUrl && !!resolved.hubUrl;
}
