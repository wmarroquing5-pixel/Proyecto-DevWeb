import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { MenuItem } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';
import { EstadoMenu, MenuService } from '../../core/services/menu.service';
import { EstadoPermisos } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
  let fixture: ComponentFixture<DashboardComponent>;
  let element: HTMLElement;
  const menuItems = signal<MenuItem[]>([]);
  const menuState = signal<EstadoMenu>('cargado');
  const permissionState = signal<EstadoPermisos>('cargados');
  const authorizationValid = signal(true);
  const currentUser = signal({ idUsuario: 7, idRol: 1, username: 'admin', fullName: 'Administración Clínica' });

  beforeEach(async () => {
    menuItems.set([]);
    menuState.set('cargado');
    permissionState.set('cargados');
    authorizationValid.set(true);
    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        provideRouter([]),
        { provide: MenuService, useValue: { menu: menuItems, estado: menuState } },
        { provide: PermisosService, useValue: {
          estado: permissionState,
          autorizacionVigente: authorizationValid,
        } },
        { provide: AuthService, useValue: { currentUser } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('muestra el encabezado y el usuario de la sesión autenticada', () => {
    expect(element.querySelector('h1')?.textContent).toContain('Dashboard');
    expect(element.textContent).toContain('Administración Clínica');
  });

  it('crea accesos rápidos únicamente desde la navegación autorizada', () => {
    menuItems.set([
      { label: 'Dashboard', route: '/dashboard' },
      { label: 'Pacientes', route: '/pacientes', icon: 'fa-user-injured' },
      { label: 'Administración', children: [{ label: 'Roles', route: '/admin/roles' }] },
    ]);
    fixture.detectChanges();
    const links = Array.from(element.querySelectorAll<HTMLAnchorElement>('.quick-card'));
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/pacientes', '/admin/roles']);
    expect(element.textContent).toContain('2 opciones');
  });

  it('no presenta rutas pendientes como funcionalidades terminadas', () => {
    menuItems.set([
      { label: 'Citas', route: '/citas' },
      { label: 'Reporte', route: '/reportes/citas' },
      { label: 'Consultas', route: '/consultas' },
    ]);
    fixture.detectChanges();
    const hrefs = Array.from(element.querySelectorAll<HTMLAnchorElement>('.quick-card'))
      .map(link => link.getAttribute('href'));
    expect(hrefs).toEqual(['/consultas']);
  });

  it('reacciona cuando el menú se completa después de renderizar', () => {
    expect(element.textContent).toContain('Sin módulos adicionales');
    menuItems.set([{ label: 'Medicamentos', route: '/medicamentos' }]);
    fixture.detectChanges();
    expect(element.querySelector('.quick-card')?.getAttribute('href')).toBe('/medicamentos');
    expect(element.textContent).toContain('1 opción');
  });

  it('distingue el estado de carga', () => {
    menuState.set('cargando');
    fixture.detectChanges();
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Cargando navegación');
    expect(element.querySelector('.quick-card')).toBeNull();
  });

  it('distingue el error de autorización', () => {
    permissionState.set('error');
    authorizationValid.set(false);
    fixture.detectChanges();
    expect(element.querySelector('[role="alert"]')?.textContent)
      .toContain('No fue posible cargar la navegación');
  });

  it('no solicita ni muestra métricas clínicas inexistentes', () => {
    expect(element.querySelectorAll('[data-clinical-metric]').length).toBe(0);
    expect(element.textContent).not.toContain('Pacientes registrados');
  });
});
