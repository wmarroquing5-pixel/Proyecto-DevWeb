import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import {
  AUTH_EXPIRES_AT_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
} from './auth-session.service';
import { AuthService } from './auth.service';

describe('AuthService: ciclo de vida de la sesión JWT', () => {
  let http: HttpTestingController | undefined;
  let auth: AuthService;
  let router: Router;
  let savedStorage: Record<string, string | null>;

  const user = { idUsuario: 7, idRol: 1, username: 'test-user', idEmpleado: null };

  beforeEach(() => {
    savedStorage = {
      [AUTH_TOKEN_KEY]: localStorage.getItem(AUTH_TOKEN_KEY),
      [AUTH_USER_KEY]: localStorage.getItem(AUTH_USER_KEY),
      [AUTH_EXPIRES_AT_KEY]: localStorage.getItem(AUTH_EXPIRES_AT_KEY),
    };
    clearStoredSession();
  });

  afterEach(() => {
    http?.verify();
    clearStoredSession();
    for (const [key, value] of Object.entries(savedStorage)) {
      if (value !== null) localStorage.setItem(key, value);
    }
  });

  function configure(): void {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      provideRouter([]),
    ] });
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  function clearStoredSession(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
  }

  function storeSession(token: string, expiresAt: string, storedUser: unknown = user): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_EXPIRES_AT_KEY, expiresAt);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(storedUser));
  }

  it('guarda la expiración futura del login y activa la sesión al cargar /auth/me', () => {
    configure();
    const expiresAtUtc = new Date(Date.now() + 60_000).toISOString();

    auth.login('test-user', 'test-only').subscribe();
    http!.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'future-token', tokenType: 'Bearer', expiresAtUtc,
    });
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBe('future-token');
    expect(localStorage.getItem(AUTH_EXPIRES_AT_KEY)).toBe(expiresAtUtc);
    expect(auth.isAuthenticated()).toBeFalse();

    auth.loadCurrentUser().subscribe();
    http!.expectOne(`${environment.apiUrl}/auth/me`).flush(user);
    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.currentUser()?.id).toBe(7);
  });

  it('restaura una sesión almacenada completa y vigente', () => {
    storeSession('stored-token', new Date(Date.now() + 60_000).toISOString());
    configure();

    expect(auth.validateSession()).toBeTrue();
    expect(auth.isAuthenticated()).toBeTrue();
    expect(auth.token).toBe('stored-token');
  });

  it('rechaza una sesión expirada y limpia todos sus datos', () => {
    storeSession('expired-token', new Date(Date.now() - 1_000).toISOString());
    configure();

    expect(auth.validateSession()).toBeFalse();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_EXPIRES_AT_KEY)).toBeNull();
  });

  it('rechaza y limpia datos de usuario corruptos', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'incomplete-token');
    localStorage.setItem(AUTH_EXPIRES_AT_KEY, new Date(Date.now() + 60_000).toISOString());
    localStorage.setItem(AUTH_USER_KEY, '{invalid-json');
    configure();

    expect(auth.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_EXPIRES_AT_KEY)).toBeNull();
  });

  it('rechaza una sesión almacenada incompleta', () => {
    localStorage.setItem(AUTH_TOKEN_KEY, 'incomplete-token');
    localStorage.setItem(AUTH_EXPIRES_AT_KEY, new Date(Date.now() + 60_000).toISOString());
    configure();

    expect(auth.validateSession()).toBeFalse();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_EXPIRES_AT_KEY)).toBeNull();
  });

  it('acepta una sesión antigua solo si el JWT contiene una expiración futura comprobable', () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 60 }))
      .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    localStorage.setItem(AUTH_TOKEN_KEY, `header.${payload}.signature`);
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    configure();

    expect(auth.validateSession()).toBeTrue();
    expect(localStorage.getItem(AUTH_EXPIRES_AT_KEY)).not.toBeNull();
  });

  it('actualiza isAuthenticated de forma reactiva al completar y cerrar la sesión', () => {
    configure();
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    auth.login('test-user', 'test-only').subscribe();
    http!.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'reactive-token', tokenType: 'Bearer',
      expiresAtUtc: new Date(Date.now() + 60_000).toISOString(),
    });
    auth.loadCurrentUser().subscribe();
    http!.expectOne(`${environment.apiUrl}/auth/me`).flush(user);
    expect(auth.isAuthenticated()).toBeTrue();

    auth.logout();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(navigate).toHaveBeenCalledOnceWith(['/login']);
  });

  it('invalida y redirige cuando una sesión activa alcanza su expiración', fakeAsync(() => {
    configure();
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    auth.login('test-user', 'test-only').subscribe();
    http!.expectOne(`${environment.apiUrl}/auth/login`).flush({
      accessToken: 'short-token', tokenType: 'Bearer',
      expiresAtUtc: new Date(Date.now() + 1_000).toISOString(),
    });
    auth.loadCurrentUser().subscribe();
    http!.expectOne(`${environment.apiUrl}/auth/me`).flush(user);
    expect(auth.isAuthenticated()).toBeTrue();

    tick(1_001);
    flushMicrotasks();
    expect(auth.isAuthenticated()).toBeFalse();
    expect(auth.token).toBeNull();
    expect(navigate).toHaveBeenCalledOnceWith(['/login']);
  }));

  it('revalida la expiración al recuperar el foco después de quedar en segundo plano', () => {
    jasmine.clock().install();
    try {
      const initialTime = new Date('2026-10-19T12:00:00Z');
      jasmine.clock().mockDate(initialTime);
      storeSession('background-token', new Date(initialTime.getTime() + 1_000).toISOString());
      configure();
      const navigate = spyOn(router, 'navigate').and.resolveTo(true);
      expect(auth.isAuthenticated()).toBeTrue();

      jasmine.clock().mockDate(new Date(initialTime.getTime() + 2_000));
      window.dispatchEvent(new Event('focus'));

      expect(auth.isAuthenticated()).toBeFalse();
      expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
      expect(navigate).toHaveBeenCalledOnceWith(['/login']);
    } finally {
      jasmine.clock().uninstall();
    }
  });
});
