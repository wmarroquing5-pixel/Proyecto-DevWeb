import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MODULOS_PERMISO, OPERACIONES_PERMISO, PermisoActual } from '../models/permiso.model';
import { AuthService } from '../services/auth.service';
import { PermisosService } from '../services/permisos.service';
import { permisoGuard } from './permiso.guard';
import { AutorizacionActualizacionService } from '../services/autorizacion-actualizacion.service';

@Component({ standalone: true, template: '' })
class GuardPage {}

describe('permisoGuard', () => {
  let authenticated: boolean;
  let allowed: boolean;
  let loadResult: Observable<readonly PermisoActual[]>;
  let loadPermissions: jasmine.Spy;
  let revalidateAuthorization: jasmine.Spy;

  beforeEach(() => {
    authenticated = true;
    allowed = true;
    loadResult = of([]);
    loadPermissions = jasmine.createSpy('cargarPermisos').and.callFake(() => loadResult);
    revalidateAuthorization = jasmine.createSpy('revalidarSiDesactualizado')
      .and.callFake(() => loadResult);
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { validateSession: () => authenticated } },
      { provide: AutorizacionActualizacionService, useValue: {
        revalidarSiDesactualizado: revalidateAuthorization,
      } },
      {
        provide: PermisosService,
        useValue: {
          cargarPermisos: loadPermissions,
          tieneTodos: () => allowed,
        },
      },
      provideRouter([
        { path: 'login', component: GuardPage },
        { path: 'acceso-denegado', component: GuardPage },
        {
          path: 'protegida', component: GuardPage, canActivate: [permisoGuard],
          data: { permisos: [{ modulo: MODULOS_PERMISO.USUARIOS,
            operacion: OPERACIONES_PERMISO.CONSULTAR }] },
        },
        { path: 'sin-metadatos', component: GuardPage, canActivate: [permisoGuard] },
      ]),
    ] });
  });

  it('permite navegación directa a una ruta autorizada', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protegida');
    expect(TestBed.inject(Router).url).toBe('/protegida');
    expect(loadPermissions).not.toHaveBeenCalled();
    expect(revalidateAuthorization).toHaveBeenCalledTimes(1);
  });

  it('redirige una ruta denegada sin cerrar la sesión', async () => {
    allowed = false;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protegida');
    expect(TestBed.inject(Router).url).toBe('/acceso-denegado');
  });

  it('redirige al login cuando no hay autenticación', async () => {
    authenticated = false;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protegida');
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(loadPermissions).not.toHaveBeenCalled();
  });

  it('trata una sesión expirada como no autenticada', async () => {
    authenticated = false;
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protegida');
    expect(TestBed.inject(Router).url).toBe('/login');
  });

  it('espera a que finalice una carga pendiente', async () => {
    const pending = new Subject<readonly PermisoActual[]>();
    loadResult = pending.asObservable();
    const harness = await RouterTestingHarness.create();
    const navigation = harness.navigateByUrl('/protegida');
    await Promise.resolve();
    expect(TestBed.inject(Router).url).not.toBe('/protegida');
    pending.next([]); pending.complete();
    await navigation;
    expect(TestBed.inject(Router).url).toBe('/protegida');
  });

  it('deniega si falla la carga de permisos', async () => {
    loadResult = throwError(() => new Error('permissions unavailable'));
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/protegida');
    expect(TestBed.inject(Router).url).toBe('/acceso-denegado');
  });

  it('deniega rutas sin metadatos en vez de conceder acceso por defecto', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/sin-metadatos');
    expect(TestBed.inject(Router).url).toBe('/acceso-denegado');
  });

  it('no aplica el guard a la pantalla de acceso denegado ni genera bucles', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/acceso-denegado');
    expect(TestBed.inject(Router).url).toBe('/acceso-denegado');
    expect(loadPermissions).not.toHaveBeenCalled();
  });
});
