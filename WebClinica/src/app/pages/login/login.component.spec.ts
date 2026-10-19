import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { AUTH_EXPIRES_AT_KEY } from '../../core/services/auth-session.service';

import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let savedToken: string | null;
  let savedUser: string | null;
  let savedExpiration: string | null;

  beforeEach(async () => {
    savedToken = localStorage.getItem('auth_token');
    savedUser = localStorage.getItem('auth_user');
    savedExpiration = localStorage.getItem(AUTH_EXPIRES_AT_KEY);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem(AUTH_EXPIRES_AT_KEY);
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([])
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    for (const [key, value] of [
      ['auth_token', savedToken],
      ['auth_user', savedUser],
      [AUTH_EXPIRES_AT_KEY, savedExpiration],
    ]) {
      if (value === null) localStorage.removeItem(key!);
      else localStorage.setItem(key!, value!);
    }
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('completa login, usuario y menú con los contratos reales sin escribir en la API', () => {
    const http = TestBed.inject(HttpTestingController);
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.usuario = 'test-user';
    component.password = 'test-only';
    component.iniciarSesion();
    const login = http.expectOne(`${environment.apiUrl}/auth/login`);
    expect(login.request.body).toEqual({ username: 'test-user', password: 'test-only' });
    login.flush({ accessToken: 'test-access-token', tokenType: 'Bearer', expiresAtUtc: '2099-01-01T00:00:00Z' });
    http.expectOne(`${environment.apiUrl}/auth/me`)
      .flush({ idUsuario: 7, idRol: 1, username: 'test-user', idEmpleado: null });
    http.expectOne(`${environment.apiUrl}/auth/permisos`).flush([
      { idPermiso: 1, modulo: 'Pacientes', puedeConsultar: true,
        puedeCrear: false, puedeModificar: false, puedeEliminar: false },
    ]);
    http.expectOne(`${environment.apiUrl}/menu`)
      .flush([{ label: 'Pacientes', route: '/pacientes', roles: ['Admin'] }]);
    expect(TestBed.inject(AuthService).isAuthenticated()).toBeTrue();
    expect(TestBed.inject(MenuService).menu().length).toBe(1);
    expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(component.cargando).toBeFalse();
  });

  it('rechaza credenciales inválidas sin navegar al dashboard', () => {
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    component.usuario = 'test-user';
    component.password = 'test-only';
    component.iniciarSesion();
    TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/auth/login`)
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(component.error).toBe('Usuario o contraseña incorrectos.');
    expect(component.cargando).toBeFalse();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('muestra el primer error seguro de validación devuelto como ProblemDetails', () => {
    component.usuario = 'test-user';
    component.password = 'test-only';
    component.iniciarSesion();
    TestBed.inject(HttpTestingController).expectOne(`${environment.apiUrl}/auth/login`)
      .flush({
        status: 400,
        title: 'Error de validación',
        errors: { password: ['La contraseña no cumple el formato requerido.'] },
        traceId: 'not-for-ui',
      }, { status: 400, statusText: 'Bad Request' });
    expect(component.error).toBe('La contraseña no cumple el formato requerido.');
    expect(component.error).not.toContain('not-for-ui');
  });
});
