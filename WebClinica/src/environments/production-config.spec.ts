import { environment as development } from './environment';
import { environment as production } from './environment.production';
import { productionEndpointsReady, resolveProductionEndpoints } from './production-config';

describe('configuración de entornos', () => {
  it('conserva el destino local únicamente en desarrollo', () => {
    expect(development.production).toBeFalse();
    expect(development.apiUrl).toBe('http://localhost:5293/api');
    expect(development.hubUrl).toBe('http://localhost:5293/hubs/habitaciones');
  });

  it('cierra producción por defecto hasta recibir URLs autorizadas', () => {
    expect(production.production).toBeTrue();
    expect(productionEndpointsReady(production)).toBeFalse();
    expect(production.apiUrl).toBe('');
    expect(production.hubUrl).toBe('');
  });

  it('admite solo API y hub HTTPS del mismo origen con las rutas reales', () => {
    const endpoints = resolveProductionEndpoints({
      apiUrl: 'https://api.prueba.example.test/api',
      hubUrl: 'https://api.prueba.example.test/hubs/habitaciones',
    });
    expect(productionEndpointsReady(endpoints)).toBeTrue();
  });

  for (const config of [
    { apiUrl: 'http://api.prueba.example.test/api', hubUrl: 'https://api.prueba.example.test/hubs/habitaciones' },
    { apiUrl: 'https://localhost/api', hubUrl: 'https://localhost/hubs/habitaciones' },
    { apiUrl: 'https://api.prueba.example.test/api', hubUrl: 'https://otro.example.test/hubs/habitaciones' },
    { apiUrl: 'https://api.prueba.example.test/api?token=123', hubUrl: 'https://api.prueba.example.test/hubs/habitaciones' },
    { apiUrl: 'https://api.prueba.example.test/incorrecto', hubUrl: 'https://api.prueba.example.test/hubs/habitaciones' },
  ]) {
    it('rechaza un destino inseguro o incoherente', () => {
      expect(productionEndpointsReady(resolveProductionEndpoints(config))).toBeFalse();
    });
  }
});
