import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let previousToken: string | null;

  beforeEach(() => {
    previousToken = localStorage.getItem('auth_token');
    localStorage.setItem('auth_token', 'interceptor-test-token');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
    ] });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    if (previousToken === null) localStorage.removeItem('auth_token');
    else localStorage.setItem('auth_token', previousToken);
  });

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

  it('permite solicitudes sin sesión', () => {
    localStorage.removeItem('auth_token');
    client.get(`${environment.apiUrl}/auth/me`).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/auth/me`);
    expect(request.request.headers.has('Authorization')).toBeFalse();
    request.flush({});
  });
});
