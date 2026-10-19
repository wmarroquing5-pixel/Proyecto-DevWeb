import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { MODULOS_PERMISO, PermisoActual } from '../models/permiso.model';
import { User } from '../models/user.model';
import { AuthSessionService } from './auth-session.service';
import { PermisosService } from './permisos.service';

describe('PermisosService', () => {
  let service: PermisosService;
  let http: HttpTestingController;
  let token: string | null;
  let authenticated: WritableSignal<boolean>;
  let currentUser: WritableSignal<User | null>;

  const permiso: PermisoActual = {
    idPermiso: 1,
    modulo: MODULOS_PERMISO.USUARIOS,
    puedeConsultar: true,
    puedeCrear: true,
    puedeModificar: true,
    puedeEliminar: true,
  };

  beforeEach(() => {
    token = null;
    authenticated = signal(false);
    currentUser = signal<User | null>(null);
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      {
        provide: AuthSessionService,
        useValue: {
          isAuthenticated: authenticated.asReadonly(),
          currentUser: currentUser.asReadonly(),
          get token(): string | null { return token; },
        },
      },
    ] });
    service = TestBed.inject(PermisosService);
    http = TestBed.inject(HttpTestingController);
    TestBed.flushEffects();
  });

  afterEach(() => http.verify());

  function activate(userId = 7, sessionToken = 'permission-token'): void {
    token = sessionToken;
    currentUser.set({ idUsuario: userId, idRol: 1, username: `user-${userId}` });
    authenticated.set(true);
  }

  function load(response: readonly PermisoActual[] = [permiso]): void {
    service.cargarPermisos().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush(response);
  }

  it('carga y normaliza la respuesta real de /auth/permisos', () => {
    activate();
    load([{ ...permiso, modulo: '  Usuarios  ' }]);
    expect(service.estado()).toBe('cargados');
    expect(service.permisos().length).toBe(1);
    expect(service.permisos()[0].modulo).toBe('Usuarios');
  });

  it('evalúa el permiso Consultar', () => {
    activate(); load();
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeTrue();
  });

  it('evalúa el permiso Crear', () => {
    activate(); load();
    expect(service.puedeCrear(MODULOS_PERMISO.USUARIOS)).toBeTrue();
  });

  it('evalúa el permiso Modificar', () => {
    activate(); load();
    expect(service.puedeModificar(MODULOS_PERMISO.USUARIOS)).toBeTrue();
  });

  it('evalúa el permiso Eliminar', () => {
    activate(); load();
    expect(service.puedeEliminar(MODULOS_PERMISO.USUARIOS)).toBeTrue();
  });

  it('deniega todas las operaciones que la API devuelve en false', () => {
    activate();
    load([{ ...permiso, puedeConsultar: false, puedeCrear: false,
      puedeModificar: false, puedeEliminar: false }]);
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
    expect(service.puedeCrear(MODULOS_PERMISO.USUARIOS)).toBeFalse();
    expect(service.puedeModificar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
    expect(service.puedeEliminar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
  });

  it('trata una respuesta vacía como permisos cargados pero denegados', () => {
    activate(); load([]);
    expect(service.estado()).toBe('cargados');
    expect(service.permisos()).toEqual([]);
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
  });

  it('deniega por defecto mientras la carga está pendiente', () => {
    activate();
    service.cargarPermisos().subscribe();
    expect(service.estado()).toBe('cargando');
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([permiso]);
  });

  it('limpia los permisos y conserva el estado de error si falla HTTP', () => {
    activate();
    service.cargarPermisos().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/auth/permisos`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    expect(service.estado()).toBe('error');
    expect(service.permisos()).toEqual([]);
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
  });

  it('limpia permisos al cerrar sesión', () => {
    activate(); load();
    authenticated.set(false); currentUser.set(null); token = null;
    TestBed.flushEffects();
    expect(service.estado()).toBe('no-cargados');
    expect(service.permisos()).toEqual([]);
  });

  it('elimina los permisos efectivos cuando expira el JWT', () => {
    activate(); load();
    token = null; authenticated.set(false);
    TestBed.flushEffects();
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
    expect(service.permisos()).toEqual([]);
  });

  it('ignora una respuesta tardía de la sesión anterior', () => {
    activate(7, 'old-token');
    service.cargarPermisos().subscribe({ error: () => undefined });
    const oldRequest = http.expectOne(`${environment.apiUrl}/auth/permisos`);

    token = 'new-token';
    currentUser.set({ idUsuario: 8, idRol: 2, username: 'new-user' });
    TestBed.flushEffects();
    const newRequest = http.expectOne(`${environment.apiUrl}/auth/permisos`);
    oldRequest.flush([permiso]);
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();

    newRequest.flush([{ ...permiso, idPermiso: 2, puedeCrear: false }]);
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeTrue();
    expect(service.puedeCrear(MODULOS_PERMISO.USUARIOS)).toBeFalse();
  });

  it('comparte una única solicitud entre cargas concurrentes', () => {
    activate();
    let firstResult = 0;
    let secondResult = 0;
    service.cargarPermisos().subscribe(items => firstResult = items.length);
    service.cargarPermisos().subscribe(items => secondResult = items.length);
    const requests = http.match(`${environment.apiUrl}/auth/permisos`);
    expect(requests.length).toBe(1);
    requests[0].flush([permiso]);
    expect(firstResult).toBe(1);
    expect(secondResult).toBe(1);
  });

  it('no hereda permisos al iniciar una sesión posterior', () => {
    activate(7, 'first-token'); load();
    authenticated.set(false); currentUser.set(null); token = null;
    TestBed.flushEffects();
    activate(8, 'second-token');
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
    TestBed.flushEffects();
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([]);
  });

  it('aplica un permiso concedido durante una sesión activa', () => {
    activate();
    load([{ ...permiso, puedeCrear: false }]);
    service.revalidarPermisos().subscribe();
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([permiso]);

    expect(service.puedeCrear(MODULOS_PERMISO.USUARIOS)).toBeTrue();
  });

  it('retira inmediatamente un permiso revocado confirmado por la API', () => {
    activate(); load();
    service.revalidarPermisos().subscribe();
    http.expectOne(`${environment.apiUrl}/auth/permisos`)
      .flush([{ ...permiso, puedeModificar: false }]);

    expect(service.puedeModificar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
  });

  it('acepta una revalidación sin cambios sin duplicar permisos', () => {
    activate(); load();
    service.revalidarPermisos().subscribe();
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([permiso]);

    expect(service.permisos()).toEqual([permiso]);
    expect(service.estado()).toBe('cargados');
  });

  it('interpreta una respuesta vacía durante la revalidación como revocación confirmada', () => {
    activate(); load();
    service.revalidarPermisos().subscribe();
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([]);

    expect(service.permisos()).toEqual([]);
    expect(service.autorizacionVigente()).toBeTrue();
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
  });

  it('rechaza datos mal formados y no concede permisos nuevos', () => {
    activate();
    service.cargarPermisos().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([{ modulo: 'Usuarios' }]);

    expect(service.estado()).toBe('error');
    expect(service.autorizacionVigente()).toBeFalse();
    expect(service.permisos()).toEqual([]);
  });

  it('mantiene temporalmente el último estado verificable ante un error de red', () => {
    activate(); load();
    service.revalidarPermisos().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/auth/permisos`)
      .error(new ProgressEvent('network error'));

    expect(service.estado()).toBe('error');
    expect(service.autorizacionVigente()).toBeTrue();
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeTrue();
  });

  it('no reemplaza una caché válida con una respuesta de revalidación mal formada', () => {
    activate(); load();
    service.revalidarPermisos().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([permiso, { invalido: true }]);

    expect(service.estado()).toBe('error');
    expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeTrue();
    expect(service.permisos()).toEqual([permiso]);
  });

  it('deniega la caché cuando supera su vigencia máxima sin validación', () => {
    jasmine.clock().install();
    try {
      jasmine.clock().mockDate(new Date('2026-10-19T12:00:00Z'));
      activate(); load();
      jasmine.clock().mockDate(new Date('2026-10-19T12:03:01Z'));

      expect(service.invalidarSiCaducada(180_000)).toBeTrue();
      expect(service.autorizacionVigente()).toBeFalse();
      expect(service.puedeConsultar(MODULOS_PERMISO.USUARIOS)).toBeFalse();
      expect(service.estado()).toBe('error');
    } finally {
      jasmine.clock().uninstall();
    }
  });

  it('comparte una única solicitud entre revalidaciones concurrentes', () => {
    activate(); load();
    service.revalidarPermisos().subscribe();
    service.revalidarPermisos().subscribe();
    const requests = http.match(`${environment.apiUrl}/auth/permisos`);
    expect(requests.length).toBe(1);
    requests[0].flush([permiso]);
  });

  it('ignora la respuesta de una actualización que termina después del logout', () => {
    activate(); load();
    service.revalidarPermisos().subscribe();
    const request = http.expectOne(`${environment.apiUrl}/auth/permisos`);
    authenticated.set(false); currentUser.set(null); token = null;
    TestBed.flushEffects();
    request.flush([permiso]);

    expect(service.autorizacionVigente()).toBeFalse();
    expect(service.permisos()).toEqual([]);
  });
});
