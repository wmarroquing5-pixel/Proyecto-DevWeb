import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { MenuService } from './menu.service';

describe('MenuService: permisos resueltos por la API', () => {
  it('conserva los ítems autorizados aunque /auth/me no entregue roles', () => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: { isAuthenticated: () => false } },
    ] });
    const service = TestBed.inject(MenuService);
    const http = TestBed.inject(HttpTestingController);
    service.loadMenu().subscribe();
    http.expectOne(`${environment.apiUrl}/menu`).flush([
      { label: 'Administración', roles: ['Admin'], children: [
        { label: 'Usuarios', route: '/admin/usuarios', roles: ['Admin'] },
        { label: 'Oculto', hidden: true },
      ] },
      { label: 'Oculto', hidden: true },
    ]);
    expect(service.menu().map(item => item.label)).toEqual(['Administración']);
    expect(service.menu()[0].children?.map(item => item.label)).toEqual(['Usuarios']);
    http.verify();
  });
});
