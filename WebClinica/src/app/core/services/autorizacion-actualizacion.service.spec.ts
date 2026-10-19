import { HttpErrorResponse } from '@angular/common/http';
import { Component, signal, WritableSignal } from '@angular/core';
import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { firstValueFrom, Observable, of, Subject, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MODULOS_PERMISO, OPERACIONES_PERMISO, PermisoActual } from '../models/permiso.model';
import { ApiErrorService } from './api-error.service';
import { AuthSessionService } from './auth-session.service';
import { AutorizacionActualizacionService } from './autorizacion-actualizacion.service';
import { MenuService } from './menu.service';
import { PermisosService } from './permisos.service';

@Component({ standalone: true, template: '' })
class RefreshPage {}

describe('AutorizacionActualizacionService', () => {
  let authenticated: WritableSignal<boolean>;
  let currentUser: WritableSignal<{ idUsuario: number } | null>;
  let token: string | null;
  let allowed: boolean;
  let stale: boolean;
  let permissionsResult: Observable<readonly PermisoActual[]>;
  let menuResult: Observable<unknown[]>;
  let reloadPermissions: jasmine.Spy;
  let reloadMenu: jasmine.Spy;
  let service: AutorizacionActualizacionService;

  beforeEach(() => {
    authenticated = signal(true);
    currentUser = signal({ idUsuario: 7 });
    token = 'active-token';
    allowed = true;
    stale = true;
    permissionsResult = of([]);
    menuResult = of([]);
    reloadPermissions = jasmine.createSpy('revalidarPermisos')
      .and.callFake(() => permissionsResult);
    reloadMenu = jasmine.createSpy('loadMenu').and.callFake(() => menuResult);
    TestBed.configureTestingModule({ providers: [
      provideRouter([
        { path: 'protegida', component: RefreshPage, data: { permisos: [
          { modulo: MODULOS_PERMISO.USUARIOS, operacion: OPERACIONES_PERMISO.CONSULTAR },
        ] } },
        { path: 'dashboard', component: RefreshPage },
        { path: 'acceso-denegado', component: RefreshPage },
        { path: 'login', component: RefreshPage },
      ]),
      { provide: AuthSessionService, useValue: {
        isAuthenticated: () => authenticated(),
        currentUser: () => currentUser(),
        get token(): string | null { return token; },
      } },
      { provide: PermisosService, useValue: {
        revalidarPermisos: reloadPermissions,
        estaDesactualizado: () => stale,
        invalidarSiCaducada: jasmine.createSpy('invalidarSiCaducada').and.returnValue(false),
        tiempoHastaCaducidad: () => null,
        tieneTodos: () => allowed,
      } },
      { provide: MenuService, useValue: {
        loadMenu: reloadMenu,
        estaDesactualizado: () => stale,
      } },
    ] });
    service = TestBed.inject(AutorizacionActualizacionService);
    TestBed.flushEffects();
  });

  it('revalida permisos y menú al recuperar el foco', () => {
    window.dispatchEvent(new Event('focus'));
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    expect(reloadMenu).toHaveBeenCalledTimes(1);
  });

  it('revalida al volver a estar visible', () => {
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    expect(reloadMenu).toHaveBeenCalledTimes(1);
  });

  it('no duplica dos disparadores mientras existe una actualización pendiente', () => {
    const pending = new Subject<readonly PermisoActual[]>();
    permissionsResult = pending.asObservable();
    window.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    pending.next([]); pending.complete();
    expect(reloadMenu).toHaveBeenCalledTimes(1);
  });

  it('revalida de forma controlada después de un 403', () => {
    TestBed.inject(ApiErrorService).notifyForbidden(new HttpErrorResponse({ status: 403 }));
    TestBed.flushEffects();
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    expect(reloadMenu).toHaveBeenCalledTimes(1);
  });

  it('agrupa varios 403 mientras la misma actualización está pendiente', () => {
    const pending = new Subject<readonly PermisoActual[]>();
    permissionsResult = pending.asObservable();
    const errors = TestBed.inject(ApiErrorService);
    errors.notifyForbidden(new HttpErrorResponse({ status: 403 }));
    TestBed.flushEffects();
    errors.notifyForbidden(new HttpErrorResponse({ status: 403 }));
    TestBed.flushEffects();
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    pending.next([]); pending.complete();
  });

  it('no consulta endpoints cuando los datos aún están vigentes', async () => {
    stale = false;
    expect(await firstValueFrom(service.revalidarSiDesactualizado())).toBeTrue();
    expect(reloadPermissions).not.toHaveBeenCalled();
    expect(reloadMenu).not.toHaveBeenCalled();
  });

  it('revalida al navegar cuando los datos están desactualizados', async () => {
    expect(await firstValueFrom(service.revalidarSiDesactualizado())).toBeTrue();
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    expect(reloadMenu).toHaveBeenCalledTimes(1);
  });

  it('no inicia sondeo después del logout', fakeAsync(() => {
    authenticated.set(false); currentUser.set(null); token = null;
    TestBed.flushEffects();
    tick(environment.authorizationRefreshIntervalMs * 2);
    expect(reloadPermissions).not.toHaveBeenCalled();
    expect(service.estado()).toBe('inactiva');
  }));

  it('suspende el sondeo mientras la pestaña está oculta', fakeAsync(() => {
    const visibility = spyOnProperty(document, 'visibilityState', 'get').and.returnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    tick(environment.authorizationRefreshIntervalMs * 2);
    expect(reloadPermissions).not.toHaveBeenCalled();
    visibility.and.returnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    authenticated.set(false); currentUser.set(null); token = null;
    TestBed.flushEffects();
  }));

  it('aplica espera gradual después de un error de red', fakeAsync(() => {
    permissionsResult = throwError(() => new Error('network'));
    service.revalidarAhora().subscribe();
    expect(service.estado()).toBe('error');
    tick(environment.authorizationRetryBaseMs - 1);
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    tick(1);
    expect(reloadPermissions).toHaveBeenCalledTimes(2);
    authenticated.set(false); currentUser.set(null); token = null;
    TestBed.flushEffects();
  }));

  it('descarta el flujo anterior y revalida para el usuario nuevo', () => {
    const pending = new Subject<readonly PermisoActual[]>();
    permissionsResult = pending.asObservable();
    service.revalidarAhora().subscribe();
    currentUser.set({ idUsuario: 8 }); token = 'new-token';
    TestBed.flushEffects();
    pending.next([]); pending.complete();
    expect(reloadPermissions).toHaveBeenCalledTimes(2);
    expect(reloadMenu).toHaveBeenCalledTimes(1);
    expect(currentUser()?.idUsuario).toBe(8);
  });

  it('conserva la sesión cuando una revalidación falla', () => {
    permissionsResult = throwError(() => new Error('unavailable'));
    service.revalidarAhora().subscribe();
    expect(authenticated()).toBeTrue();
    expect(token).toBe('active-token');
  });

  it('redirige una ruta abierta cuando se confirma la revocación', async () => {
    const harness = await RouterTestingHarness.create('/protegida');
    allowed = false;
    await firstValueFrom(service.revalidarAhora());
    await Promise.resolve();
    expect(TestBed.inject(Router).url).toBe('/acceso-denegado');
    expect(authenticated()).toBeTrue();
    expect(harness).toBeTruthy();
  });

  it('no crea un bucle cuando ya está en acceso denegado', async () => {
    await RouterTestingHarness.create('/acceso-denegado');
    allowed = false;
    await firstValueFrom(service.revalidarAhora());
    await Promise.resolve();
    expect(TestBed.inject(Router).url).toBe('/acceso-denegado');
  });

  it('una concesión actualiza la interfaz sin cambiar la sesión', async () => {
    allowed = true;
    await firstValueFrom(service.revalidarAhora());
    expect(authenticated()).toBeTrue();
    expect(currentUser()?.idUsuario).toBe(7);
    expect(reloadPermissions).toHaveBeenCalledTimes(1);
    expect(reloadMenu).toHaveBeenCalledTimes(1);
  });
});
