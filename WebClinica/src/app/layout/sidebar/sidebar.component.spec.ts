import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { MenuItem } from '../../core/models/menu-item.model';
import { EstadoPermisos } from '../../core/models/permiso.model';
import { AuthService } from '../../core/services/auth.service';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';
import { EstadoMenu, MenuService } from '../../core/services/menu.service';
import { PermisosService } from '../../core/services/permisos.service';
import { SidebarComponent } from './sidebar.component';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  let component: SidebarComponent;
  let element: HTMLElement;
  const menuItems = signal<MenuItem[]>([]);
  const menuState = signal<EstadoMenu>('cargado');
  const received = signal(0);
  const permissionState = signal<EstadoPermisos>('cargados');
  const authorizationValid = signal(true);
  const authenticated = signal(true);
  const logout = jasmine.createSpy('logout');
  const retry = jasmine.createSpy('revalidarAhora').and.returnValue(of(true));

  beforeEach(async () => {
    menuItems.set([]);
    menuState.set('cargado');
    received.set(0);
    permissionState.set('cargados');
    authorizationValid.set(true);
    authenticated.set(true);
    logout.calls.reset();
    retry.calls.reset();
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideRouter([]),
        { provide: MenuService, useValue: {
          menu: menuItems,
          estado: menuState,
          elementosRecibidos: received,
        } },
        { provide: PermisosService, useValue: {
          estado: permissionState,
          autorizacionVigente: authorizationValid,
        } },
        { provide: AuthService, useValue: {
          isAuthenticated: authenticated,
          currentUser: () => ({ idUsuario: 7, username: 'admin' }),
          logout,
        } },
        { provide: AutorizacionActualizacionService, useValue: { revalidarAhora: retry } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SidebarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('identifica la navegación principal de forma accesible', () => {
    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Navegación principal');
    expect(element.querySelector('.mobile-menu-toggle')?.getAttribute('aria-controls'))
      .toBe('main-navigation');
  });

  it('distingue la carga de permisos de un menú vacío', () => {
    permissionState.set('cargando');
    fixture.detectChanges();
    expect(element.querySelector('.menu-status')?.textContent).toContain('Validando permisos');

    permissionState.set('cargados');
    fixture.detectChanges();
    expect(element.querySelector('.menu-status')?.textContent)
      .toContain('Tu cuenta no tiene módulos disponibles');
  });

  it('distingue un error recuperable y ejecuta la revalidación', () => {
    menuState.set('error');
    fixture.detectChanges();
    const button = element.querySelector<HTMLButtonElement>('.retry-btn');
    expect(element.querySelector('.menu-status')?.textContent).toContain('No fue posible cargar el menú');
    button?.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('renderiza una sola vez cada opción entregada por el servicio', () => {
    menuItems.set([
      { label: 'Dashboard', route: '/dashboard', icon: 'fa-home' },
      { label: 'Pacientes', route: '/pacientes' },
    ]);
    received.set(2);
    fixture.detectChanges();
    expect(element.querySelectorAll('a.menu-link').length).toBe(2);
    expect(element.querySelectorAll('[href="/pacientes"]').length).toBe(1);
    expect(element.querySelector('.bi-grid-1x2-fill')).not.toBeNull();
  });

  it('abre y cierra el menú móvil al navegar', () => {
    menuItems.set([{ label: 'Pacientes', route: '/pacientes' }]);
    received.set(1);
    component.toggleMobile();
    fixture.detectChanges();
    expect(element.querySelector('.sidebar')?.classList).toContain('mobile-open');
    element.querySelector<HTMLAnchorElement>('a.menu-link')?.click();
    fixture.detectChanges();
    expect(element.querySelector('.sidebar')?.classList).not.toContain('mobile-open');
  });

  it('cierra la navegación móvil y finaliza la sesión', () => {
    component.toggleMobile();
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.logout-btn')?.click();
    expect(component.mobileOpen()).toBeFalse();
    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('informa una sesión finalizada sin crear enlaces', () => {
    authenticated.set(false);
    fixture.detectChanges();
    expect(element.querySelector('.menu-status')?.textContent).toContain('La sesión finalizó');
    expect(element.querySelector('a.menu-link')).toBeNull();
  });
});
