import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { resolverIconoMenu } from '../models/menu-item.model';
import { MODULOS_PERMISO } from '../models/permiso.model';
import { AuthService } from './auth.service';
import { MenuService } from './menu.service';
import { PermisosService } from './permisos.service';

describe('MenuService: actualización dinámica', () => {
  let authenticated: WritableSignal<boolean>;
  let authorized: WritableSignal<boolean>;
  let userId: WritableSignal<number>;
  let token: string;
  let authorizationByModule: (module: string) => boolean;
  let service: MenuService;
  let http: HttpTestingController;

  const dashboard = { label: 'Inicio', route: '/dashboard' };
  const users = { label: 'Usuarios', route: '/admin/usuarios', roles: ['Admin'] };
  const catalog = [
    { label: 'Dashboard', route: '/dashboard', icon: 'fa-home', hidden: false, roles: ['Admin'], children: null },
    { label: 'Pacientes', route: '/pacientes', icon: 'fa-user-injured', hidden: false, roles: ['Admin'], children: null },
    { label: 'Consultas', route: '/consultas', icon: 'fa-stethoscope', hidden: false, roles: ['Admin'], children: null },
    { label: 'Medicamentos', route: '/medicamentos', icon: 'fa-pills', hidden: false, roles: ['Admin'], children: null },
    { label: 'Lotes', route: '/inventario/lotes', icon: 'fa-boxes-stacked', hidden: false, roles: null, children: null },
    { label: 'Habitaciones', route: '/habitaciones', icon: 'fa-bed', hidden: false, roles: null, children: null },
    { label: 'Ventas', route: '/ventas', icon: 'fa-cash-register', hidden: false, roles: null, children: null },
    { label: 'Recetas de farmacia', route: '/farmacia/recetas', icon: 'bi bi-prescription2', hidden: false, roles: null, children: null },
    { label: 'Facturación', route: '/facturas', icon: 'fa-file-invoice-dollar', hidden: false, roles: null, children: null },
    { label: 'Catálogos organizativos', route: null, icon: 'bi bi-building', hidden: false, roles: null, children: [
      { label: 'Sucursales', route: '/admin/sucursales', icon: 'bi bi-building', hidden: false, roles: null, children: null },
      { label: 'Clínicas', route: '/admin/clinicas', icon: 'bi bi-hospital', hidden: false, roles: null, children: null },
      { label: 'Especialidades', route: '/admin/especialidades', icon: 'bi bi-person-lines-fill', hidden: false, roles: null, children: null },
      { label: 'Turnos', route: '/admin/turnos', icon: 'bi bi-clock', hidden: false, roles: null, children: null },
      { label: 'Servicios', route: '/admin/servicios', icon: 'bi bi-clipboard2-pulse', hidden: false, roles: null, children: null },
    ] },
    { label: 'Catálogos farmacéuticos', route: null, icon: 'bi bi-box-seam', hidden: false, roles: null, children: [
      { label: 'Categorías', route: '/admin/categorias', icon: 'bi bi-tags', hidden: false, roles: null, children: null },
      { label: 'Marcas', route: '/admin/marcas', icon: 'bi bi-bookmark-star', hidden: false, roles: null, children: null },
    ] },
    { label: 'Administración', route: null, icon: 'fa-cogs', hidden: false, roles: ['Admin'], children: [
      { label: 'Usuarios', route: '/admin/usuarios', icon: 'fa-users-cog', hidden: false, roles: ['Admin'], children: null },
      { label: 'Roles', route: '/admin/roles', icon: 'fa-user-tag', hidden: false, roles: ['Admin'], children: null },
      { label: 'Empleados', route: '/admin/empleados', icon: 'fa-id-badge', hidden: false, roles: ['Admin'], children: null },
      { label: 'Permisos', route: '/admin/permisos', icon: 'fa-shield-halved', hidden: false, roles: ['Admin'], children: null },
    ] },
  ];

  function configure(restoredSession = false): void {
    authenticated = signal(restoredSession);
    authorized = signal(true);
    userId = signal(7);
    token = 'menu-token';
    authorizationByModule = () => authorized();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(), provideHttpClientTesting(),
      { provide: AuthService, useValue: {
        isAuthenticated: () => authenticated(),
        currentUser: () => ({ idUsuario: userId() }),
        get token(): string { return token; },
      } },
      { provide: PermisosService, useValue: {
        autorizacionVigente: () => authenticated(),
        puedeConsultar: (module: string) => authorizationByModule(module),
      } },
    ] });
    service = TestBed.inject(MenuService);
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http?.verify());

  function load(items: unknown[]): void {
    service.loadMenu().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/menu`).flush(items);
  }

  it('conserva los ítems autorizados aunque /auth/me no entregue nombres de rol', () => {
    configure();
    authenticated.set(true);
    load([{ label: 'Administración', roles: ['Admin'], children: [users,
      { label: 'Oculto', hidden: true }] }]);

    expect(service.menu().map(item => item.label)).toEqual(['Administración']);
    expect(service.menu()[0].children?.map(item => item.label)).toEqual(['Usuarios']);
  });

  it('incorpora una opción recién concedida después de recargar el menú oficial', () => {
    configure(); authenticated.set(true); authorized.set(false);
    load([dashboard]);
    expect(service.menu().map(item => item.label)).toEqual(['Inicio']);

    authorized.set(true);
    load([dashboard, users]);
    expect(service.menu().map(item => item.label)).toEqual(['Inicio', 'Usuarios']);
  });

  it('retira una opción tan pronto se confirma que dejó de estar autorizada', () => {
    configure(); authenticated.set(true);
    load([dashboard, users]);
    expect(service.menu().map(item => item.label)).toContain('Usuarios');

    authorized.set(false);
    expect(service.menu().map(item => item.label)).toEqual(['Inicio']);
  });

  it('carga el menú correcto después de completar un login', () => {
    configure();
    expect(service.menu()).toEqual([]);
    authenticated.set(true);
    load([dashboard, users]);
    expect(service.menu().length).toBe(2);
  });

  it('recupera automáticamente el menú de una sesión restaurada', () => {
    configure(true);
    http.expectOne(`${environment.apiUrl}/menu`).flush([dashboard]);
    expect(service.menu().map(item => ({ label: item.label, route: item.route })))
      .toEqual([dashboard]);
  });

  it('limpia el menú después del logout', () => {
    configure(); authenticated.set(true); load([dashboard, users]);
    authenticated.set(false);
    TestBed.flushEffects();
    expect(service.menu()).toEqual([]);
    expect(service.ultimaActualizacion()).toBeNull();
  });

  it('reemplaza el estado y no crea entradas duplicadas durante una actualización', () => {
    configure(); authenticated.set(true); load([dashboard]);
    load([dashboard, dashboard, users]);
    expect(service.menu().map(item => item.label)).toEqual(['Inicio', 'Usuarios']);
  });

  it('comparte una única solicitud de menú entre actualizaciones concurrentes', () => {
    configure(); authenticated.set(true);
    service.loadMenu().subscribe();
    service.loadMenu().subscribe();
    const requests = http.match(`${environment.apiUrl}/menu`);
    expect(requests.length).toBe(1);
    requests[0].flush([dashboard]);
  });

  it('ignora la respuesta tardía de otro usuario', () => {
    configure(); authenticated.set(true);
    service.loadMenu().subscribe();
    const oldRequest = http.expectOne(`${environment.apiUrl}/menu`);
    userId.set(8); token = 'new-token';
    service.loadMenu().subscribe();
    const newRequest = http.expectOne(`${environment.apiUrl}/menu`);
    newRequest.flush([dashboard]);
    oldRequest.flush([users]);

    expect(service.menu().map(item => ({ label: item.label, route: item.route })))
      .toEqual([dashboard]);
  });

  it('descarta una ruta pendiente que ya no pertenece al catálogo backend', () => {
    configure(); authenticated.set(true);
    load([{ label: 'Citas', route: '/citas' }]);
    expect(service.menu()).toEqual([]);
  });

  it('acepta el catálogo API-MENU-01 completo con opcionales null', () => {
    configure(); authenticated.set(true);
    load(catalog);

    const routes = service.menu().flatMap(item => item.children?.length
      ? item.children.map(child => child.route)
      : [item.route]);
    expect(routes).toEqual([
      '/dashboard', '/pacientes', '/consultas', '/medicamentos',
      '/inventario/lotes', '/habitaciones', '/ventas', '/farmacia/recetas',
      '/facturas',
      '/admin/sucursales', '/admin/clinicas', '/admin/especialidades',
      '/admin/turnos', '/admin/servicios', '/admin/categorias', '/admin/marcas',
      '/admin/usuarios', '/admin/roles', '/admin/empleados', '/admin/permisos',
    ]);
    expect(service.estado()).toBe('cargado');
  });

  [
    ['/inventario/lotes', MODULOS_PERMISO.LOTES_MEDICAMENTO],
    ['/habitaciones', MODULOS_PERMISO.HABITACIONES],
    ['/ventas', MODULOS_PERMISO.VENTAS],
    ['/farmacia/recetas', MODULOS_PERMISO.VENTAS],
    ['/facturas', MODULOS_PERMISO.FACTURAS],
    ['/admin/sucursales', MODULOS_PERMISO.SUCURSALES],
    ['/admin/clinicas', MODULOS_PERMISO.CLINICAS],
    ['/admin/especialidades', MODULOS_PERMISO.ESPECIALIDADES],
    ['/admin/turnos', MODULOS_PERMISO.TURNOS],
    ['/admin/servicios', MODULOS_PERMISO.SERVICIOS],
    ['/admin/categorias', MODULOS_PERMISO.CATEGORIAS],
    ['/admin/marcas', MODULOS_PERMISO.MARCAS],
    ['/admin/permisos', MODULOS_PERMISO.PERMISOS],
  ].forEach(([route, module]) => {
    it(`conserva ${route} únicamente con ${module}/Consultar`, () => {
      configure(); authenticated.set(true);
      authorizationByModule = current => current === module;
      load([{ label: module, route, children: null }]);
      expect(service.menu().map(item => item.route)).toEqual([route]);

      authorizationByModule = () => false;
      load([{ label: module, route, children: null }]);
      expect(service.menu()).toEqual([]);
    });
  });

  it('filtra los grupos de catálogos por permisos independientes', () => {
    configure(); authenticated.set(true);
    authorizationByModule = module =>
      module === MODULOS_PERMISO.SUCURSALES || module === MODULOS_PERMISO.MARCAS;
    load(catalog.filter(item => item.label.startsWith('Catálogos')));

    expect(service.menu().map(item => item.label)).toEqual([
      'Catálogos organizativos', 'Catálogos farmacéuticos',
    ]);
    expect(service.menu()[0].children?.map(item => item.route)).toEqual(['/admin/sucursales']);
    expect(service.menu()[1].children?.map(item => item.route)).toEqual(['/admin/marcas']);
  });

  it('oculta los grupos de catálogos cuando no queda ningún hijo consultable', () => {
    configure(); authenticated.set(true);
    authorizationByModule = () => false;
    load(catalog.filter(item => item.label.startsWith('Catálogos')));

    expect(service.menu()).toEqual([]);
  });

  it('conserva /consultas únicamente con el permiso real Consultas/Consultar', () => {
    configure(); authenticated.set(true);
    authorizationByModule = module => module === MODULOS_PERMISO.CONSULTAS;
    load([{ label: 'Consultas', route: '/consultas' }]);
    expect(service.menu().map(item => item.route)).toEqual(['/consultas']);

    authorizationByModule = module => module === MODULOS_PERMISO.HISTORIAL;
    load([{ label: 'Consultas', route: '/consultas' }]);
    expect(service.menu()).toEqual([]);
  });

  it('retira una ruta pendiente cuando el permiso no está vigente', () => {
    configure(); authenticated.set(true); authorized.set(false);
    load([{ label: 'Roles', route: '/admin/roles' }]);
    expect(service.menu()).toEqual([]);
  });

  it('descarta una ruta desconocida recibida desde la API', () => {
    configure(); authenticated.set(true);
    load([{ label: 'Desconocida', route: '/sin-contrato' }]);
    expect(service.menu()).toEqual([]);
  });

  it('elimina duplicados dentro de un submenú reconocido', () => {
    configure(); authenticated.set(true);
    load([{ label: 'Administración', children: [
      { label: 'Roles', route: '/admin/roles' },
      { label: 'Roles', route: '/admin/roles' },
    ] }]);
    expect(service.menu()[0].children?.map(item => item.route)).toEqual(['/admin/roles']);
  });

  it('distingue la carga inicial de un menú vacío confirmado', () => {
    configure(); authenticated.set(true);
    service.loadMenu().subscribe();
    expect(service.estado()).toBe('cargando');
    http.expectOne(`${environment.apiUrl}/menu`).flush([]);
    expect(service.estado()).toBe('cargado');
    expect(service.elementosRecibidos()).toBe(0);
  });

  it('conserva el menú recibido mientras los permisos aún no lo autorizan', () => {
    configure(); authenticated.set(true); authorized.set(false);
    load([users]);
    expect(service.elementosRecibidos()).toBe(1);
    expect(service.menu()).toEqual([]);

    authorized.set(true);
    expect(service.menu().map(item => item.route)).toEqual(['/admin/usuarios']);
  });

  it('no inventa opciones para un usuario sin permisos', () => {
    configure(); authenticated.set(true); authorizationByModule = () => false;
    load([]);
    expect(service.menu()).toEqual([]);
    expect(service.estado()).toBe('cargado');
  });

  it('registra un error de red y permite recuperarse con una nueva solicitud', () => {
    configure(); authenticated.set(true);
    service.loadMenu().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/menu`)
      .flush({}, { status: 0, statusText: 'Network error' });
    expect(service.estado()).toBe('error');
    expect(service.error()).not.toBeNull();

    load([dashboard]);
    expect(service.estado()).toBe('cargado');
    expect(service.error()).toBeNull();
    expect(service.menu().map(item => item.route)).toEqual(['/dashboard']);
  });

  for (const status of [401, 403]) {
    it(`mantiene denegación por defecto ante HTTP ${status}`, () => {
      configure(); authenticated.set(true);
      service.loadMenu().subscribe({ error: () => undefined });
      http.expectOne(`${environment.apiUrl}/menu`)
        .flush({}, { status, statusText: 'Authorization error' });
      expect(service.estado()).toBe('error');
      expect(service.menu()).toEqual([]);
    });
  }

  it('rechaza una respuesta mal formada sin conservar datos parciales', () => {
    configure(); authenticated.set(true);
    service.loadMenu().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/menu`).flush({ items: [dashboard] });
    expect(service.estado()).toBe('error');
    expect(service.elementosRecibidos()).toBe(0);
  });

  it('normaliza espacios y barra final de una ruta conocida', () => {
    configure(); authenticated.set(true);
    load([{ label: 'Roles', route: ' /admin/roles/ ' }]);
    expect(service.menu().map(item => item.route)).toEqual(['/admin/roles']);
  });

  it('conserva el alias de inventario emitido por el backend con su permiso específico', () => {
    configure(); authenticated.set(true);
    authorizationByModule = module => module === MODULOS_PERMISO.MEDICAMENTOS;
    load([{ label: 'Medicamentos', route: '/medicamentos' }]);
    expect(service.menu().map(item => item.route)).toEqual(['/medicamentos']);
  });

  it('mantiene el elemento con icono desconocido y usa un icono visual seguro', () => {
    configure(); authenticated.set(true);
    load([{ label: 'Pacientes', route: '/pacientes', icon: 'fa-no-registrado', children: null }]);
    expect(service.menu().map(item => item.route)).toEqual(['/pacientes']);
    expect(resolverIconoMenu(service.menu()[0].icon)).toBe('bi bi-grid');
  });

  it('traduce los iconos del catálogo nuevo sin afectar la autorización', () => {
    expect(resolverIconoMenu('fa-boxes-stacked')).toBe('bi bi-box-seam-fill');
    expect(resolverIconoMenu('fa-bed')).toBe('bi bi-hospital');
    expect(resolverIconoMenu('fa-cash-register')).toBe('bi bi-receipt-cutoff');
  });
});
