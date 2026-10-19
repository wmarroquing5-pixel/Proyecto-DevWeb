import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { ApiErrorService } from '../services/api-error.service';
import {
  AUTH_EXPIRES_AT_KEY,
  AUTH_TOKEN_KEY,
  AUTH_USER_KEY,
  AuthSessionService,
} from '../services/auth-session.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let session: AuthSessionService;
  let router: Router;
  let savedStorage: Record<string, string | null>;

  beforeEach(() => {
    savedStorage = {
      [AUTH_TOKEN_KEY]: localStorage.getItem(AUTH_TOKEN_KEY),
      [AUTH_USER_KEY]: localStorage.getItem(AUTH_USER_KEY),
      [AUTH_EXPIRES_AT_KEY]: localStorage.getItem(AUTH_EXPIRES_AT_KEY),
    };
    storeSession('interceptor-test-token');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(AuthSessionService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    clearStoredSession();
    for (const [key, value] of Object.entries(savedStorage)) {
      if (value !== null) localStorage.setItem(key, value);
    }
  });

  function storeSession(token: string): void {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(AUTH_EXPIRES_AT_KEY, new Date(Date.now() + 60_000).toISOString());
    localStorage.setItem(AUTH_USER_KEY, JSON.stringify({
      idUsuario: 7, idRol: 1, username: 'test-user',
    }));
  }

  function clearStoredSession(): void {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(AUTH_USER_KEY);
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
  }

  it('envía el JWT únicamente a la API configurada', () => {
    const urls = [`${environment.apiUrl}/pacientes`, 'https://external.invalid/photo',
      `${environment.apiUrl}.external.invalid/photo`, `${environment.apiUrl}-other/photo`];
    urls.forEach((url, index) => {
      client.get(url).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization'))
        .toBe(index === 0 ? 'Bearer interceptor-test-token' : null);
      request.flush({});
    });
  });

  it('permite solicitudes sin sesión y no añade Bearer al login', () => {
    session.logout();
    client.get(`${environment.apiUrl}/auth/me`).subscribe();
    let request = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});

    storeSession('stored-outside-state');
    client.post(`${environment.apiUrl}/auth/login`, {}).subscribe();
    request = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });

  it('invalida la sesión ante un 401 protegido y propaga el error original', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    let receivedError: HttpErrorResponse | undefined;
    client.get(`${environment.apiUrl}/pacientes`).subscribe({ error: error => receivedError = error });
    http.expectOne(`${environment.apiUrl}/pacientes`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(receivedError?.status).toBe(401);
    expect(session.isAuthenticated()).toBeFalse();
    expect(localStorage.getItem(AUTH_TOKEN_KEY)).toBeNull();
    expect(navigate).toHaveBeenCalledOnceWith(['/login']);
  });

  it('no cierra la sesión por credenciales incorrectas en /auth/login', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    let receivedStatus: number | undefined;
    client.post(`${environment.apiUrl}/auth/login`, {}).subscribe({
      error: (error: HttpErrorResponse) => receivedStatus = error.status,
    });
    http.expectOne(`${environment.apiUrl}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(receivedStatus).toBe(401);
    expect(session.isAuthenticated()).toBeTrue();
    expect(session.token).toBe('interceptor-test-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('conserva la sesión en un 403 y publica un mensaje seguro', () => {
    const initialRevision = TestBed.inject(ApiErrorService).authorizationRefreshRevision();
    let receivedStatus: number | undefined;
    client.delete(`${environment.apiUrl}/pacientes/7`).subscribe({
      error: (error: HttpErrorResponse) => receivedStatus = error.status,
    });
    http.expectOne(`${environment.apiUrl}/pacientes/7`)
      .flush({ title: 'Acceso prohibido', traceId: 'internal-trace' },
        { status: 403, statusText: 'Forbidden' });

    expect(receivedStatus).toBe(403);
    expect(session.isAuthenticated()).toBeTrue();
    expect(TestBed.inject(ApiErrorService).authorizationMessage())
      .toBe('No tienes autorización para realizar esta operación.');
    expect(TestBed.inject(ApiErrorService).authorizationRefreshRevision()).toBe(initialRevision + 1);
  });

  it('no solicita otra revalidación si el propio endpoint de permisos responde 403', () => {
    const errors = TestBed.inject(ApiErrorService);
    const initialRevision = errors.authorizationRefreshRevision();
    client.get(`${environment.apiUrl}/auth/permisos`).subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/auth/permisos`)
      .flush({}, { status: 403, statusText: 'Forbidden' });

    expect(session.isAuthenticated()).toBeTrue();
    expect(errors.authorizationMessage()).toBe('No tienes autorización para realizar esta operación.');
    expect(errors.authorizationRefreshRevision()).toBe(initialRevision);
  });

  it('realiza una sola redirección ante respuestas 401 concurrentes', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    client.get(`${environment.apiUrl}/pacientes`).subscribe({ error: () => undefined });
    client.get(`${environment.apiUrl}/empleados`).subscribe({ error: () => undefined });
    const first = http.expectOne(`${environment.apiUrl}/pacientes`);
    const second = http.expectOne(`${environment.apiUrl}/empleados`);

    first.flush({}, { status: 401, statusText: 'Unauthorized' });
    second.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(session.isAuthenticated()).toBeFalse();
  });

  it('ignora un 401 tardío cuando la solicitud usó el token de una sesión anterior', () => {
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    client.get(`${environment.apiUrl}/pacientes`).subscribe({ error: () => undefined });
    const oldRequest = http.expectOne(`${environment.apiUrl}/pacientes`);
    session.establishSession({
      accessToken: 'new-session-token', tokenType: 'Bearer',
      expiresAtUtc: new Date(Date.now() + 120_000).toISOString(),
    });
    session.setCurrentUser({ idUsuario: 8, idRol: 2, username: 'new-user' });

    oldRequest.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(session.isAuthenticated()).toBeTrue();
    expect(session.token).toBe('new-session-token');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('no altera la sesión por un 401 de un servicio externo', () => {
    client.get('https://external.invalid/protected').subscribe({ error: () => undefined });
    http.expectOne('https://external.invalid/protected')
      .flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(session.isAuthenticated()).toBeTrue();
    expect(session.token).toBe('interceptor-test-token');
  });

  it('no redirige por un 401 si la solicitud no llevaba un token de sesión', () => {
    session.logout();
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    client.get(`${environment.apiUrl}/auth/me`).subscribe({ error: () => undefined });
    const request = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({}, { status: 401, statusText: 'Unauthorized' });

    expect(navigate).not.toHaveBeenCalled();
    expect(session.isAuthenticated()).toBeFalse();
  });
});
