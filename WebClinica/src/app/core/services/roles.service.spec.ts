import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { MODULOS_PERMISO_CANONICOS } from '../models/permiso.model';
import { GuardarPermisoRolRequest, GuardarRolRequest } from '../models/rol.model';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  let service: RolesService;
  let http: HttpTestingController;

  const rol = { idRol: 2, nombre: 'Doctor', activo: true };
  const permiso = {
    idPermiso: 5, idRol: 2, modulo: 'Pacientes',
    puedeConsultar: true, puedeCrear: false, puedeModificar: false, puedeEliminar: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
    ] });
    service = TestBed.inject(RolesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function page<T>(items: T[], number = 1, pageSize = 10, totalCount = items.length) {
    return { items, page: number, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize) };
  }

  it('lista roles con la paginación solicitada', () => {
    let result: unknown;
    service.listarRoles(2, 10).subscribe(value => result = value);
    const request = http.expectOne(req => req.url === `${environment.apiUrl}/roles`
      && req.params.get('page') === '2' && req.params.get('pageSize') === '10');
    request.flush(page([rol], 2, 10, 11));
    expect(result).toEqual(page([rol], 2, 10, 11));
  });

  it('conserva un rol heredado con nombre vacío sin rechazar el catálogo completo', () => {
    const rolSinNombre = { idRol: 7, nombre: '', activo: false };
    let result: unknown;
    service.listarRoles(1, 20).subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/roles?page=1&pageSize=20`)
      .flush(page([rol, rolSinNombre], 1, 20));
    expect(result).toEqual(page([rol, rolSinNombre], 1, 20));
  });

  it('acepta una página administrativa vacía', () => {
    let result: unknown;
    service.listarPermisos(1, 10).subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/permisos?page=1&pageSize=10`)
      .flush(page([], 1, 10));
    expect(result).toEqual(page([], 1, 10));
  });

  it('rechaza específicamente un nombre de rol nulo', () => {
    let error: unknown;
    service.listarRoles(1, 20).subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/roles?page=1&pageSize=20`)
      .flush(page([{ idRol: 7, nombre: null, activo: false }], 1, 20));
    expect(error).toEqual(jasmine.any(Error));
  });

  it('recorre todas las páginas de roles dentro del límite seguro', () => {
    let result: readonly unknown[] = [];
    service.listarTodosRoles().subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/roles?page=1&pageSize=100`)
      .flush(page([rol], 1, 100, 101));
    const second = { idRol: 3, nombre: 'Enfermería', activo: true };
    http.expectOne(`${environment.apiUrl}/roles?page=2&pageSize=100`)
      .flush(page([second], 2, 100, 101));
    expect(result).toEqual([rol, second]);
  });

  it('rechaza catálogos de roles mayores al límite seguro', () => {
    let error: unknown;
    service.listarTodosRoles().subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/roles?page=1&pageSize=100`)
      .flush(page([rol], 1, 100, 501));
    expect(error).toEqual(jasmine.any(Error));
  });

  it('rechaza una respuesta paginada mal formada', () => {
    let error: unknown;
    service.listarRoles(1, 10).subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/roles?page=1&pageSize=10`)
      .flush({ items: 'invalid', page: 1, pageSize: 10 });
    expect(error).toEqual(jasmine.any(Error));
  });

  it('obtiene el detalle de un rol', () => {
    let result: unknown;
    service.obtenerRol(2).subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/roles/2`).flush(rol);
    expect(result).toEqual(rol);
  });

  it('crea un rol con el DTO real', () => {
    const body: GuardarRolRequest = { nombre: 'Doctor', activo: true };
    service.crearRol(body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/roles`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(rol);
  });

  it('actualiza un rol con PUT', () => {
    const body: GuardarRolRequest = { nombre: 'Doctor', activo: false };
    service.actualizarRol(2, body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/roles/2`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ ...rol, activo: false });
  });

  it('elimina un rol con DELETE', () => {
    service.eliminarRol(2).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/roles/2`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  it('lista permisos con el máximo de página admitido por la API', () => {
    let result: unknown;
    service.listarPermisos().subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/permisos?page=1&pageSize=100`)
      .flush(page([permiso], 1, 100));
    expect(result).toEqual(page([permiso], 1, 100));
  });

  it('envía los filtros de permisos admitidos por la API', () => {
    service.listarPermisos(2, 10, { idRol: 2, modulo: 'Pacientes' }).subscribe();
    const request = http.expectOne(req => req.url === `${environment.apiUrl}/permisos`
      && req.params.get('page') === '2'
      && req.params.get('pageSize') === '10'
      && req.params.get('idRol') === '2'
      && req.params.get('modulo') === 'Pacientes');
    expect(request.request.method).toBe('GET');
    request.flush(page([permiso], 2, 10, 11));
  });

  it('obtiene el catálogo de módulos autorizado por la API', () => {
    let result: readonly string[] = [];
    service.listarModulosPermiso().subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/permisos/modulos`)
      .flush(MODULOS_PERMISO_CANONICOS);
    expect(result).toEqual(MODULOS_PERMISO_CANONICOS);
    expect(result.length).toBe(22);
  });

  it('rechaza módulos vacíos o duplicados sin normalizar el contrato', () => {
    let error: unknown;
    service.listarModulosPermiso().subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/permisos/modulos`)
      .flush(['Permisos', ' permisos ']);
    expect(error).toEqual(jasmine.any(Error));
  });

  it('rechaza un módulo que la API ya no reconoce como política independiente', () => {
    let error: unknown;
    service.listarModulosPermiso().subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/permisos/modulos`).flush(['Inventario']);
    expect(error).toEqual(jasmine.any(Error));
  });

  it('recorre todas las páginas para consultar permisos sin inventar un filtro', () => {
    let result: readonly unknown[] = [];
    service.listarTodosPermisos().subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/permisos?page=1&pageSize=100`)
      .flush(page([permiso], 1, 100, 101));
    const second = { ...permiso, idPermiso: 6, idRol: 3, modulo: 'Usuarios' };
    http.expectOne(`${environment.apiUrl}/permisos?page=2&pageSize=100`)
      .flush(page([second], 2, 100, 101));
    expect(result).toEqual([permiso, second]);
  });

  it('filtra en memoria los permisos del rol después de paginar el contrato global', () => {
    let result: readonly unknown[] = [];
    service.listarPermisosDeRol(2).subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/permisos?page=1&pageSize=100`).flush(page([
      permiso,
      { ...permiso, idPermiso: 7, idRol: 3 },
    ], 1, 100, 2));
    expect(result).toEqual([permiso]);
  });

  it('obtiene el detalle de un permiso', () => {
    let result: unknown;
    service.obtenerPermiso(5).subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/permisos/5`).flush(permiso);
    expect(result).toEqual(permiso);
  });

  it('crea un permiso individual', () => {
    const body: GuardarPermisoRolRequest = {
      idRol: 2, modulo: 'Pacientes', puedeConsultar: true,
      puedeCrear: false, puedeModificar: false, puedeEliminar: false,
    };
    service.crearPermiso(body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/permisos`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(permiso);
  });

  it('actualiza un permiso individual', () => {
    const body: GuardarPermisoRolRequest = {
      idRol: 2, modulo: 'Pacientes', puedeConsultar: true,
      puedeCrear: true, puedeModificar: false, puedeEliminar: false,
    };
    service.actualizarPermiso(5, body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/permisos/5`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ ...permiso, puedeCrear: true });
  });

  it('elimina un permiso individual', () => {
    service.eliminarPermiso(5).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/permisos/5`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);
  });

  for (const status of [400, 401, 403, 404, 409, 500]) {
    it(`conserva el error HTTP ${status} para el tratamiento centralizado`, () => {
      let error: HttpErrorResponse | undefined;
      service.eliminarRol(2).subscribe({ error: value => error = value });
      http.expectOne(`${environment.apiUrl}/roles/2`).flush(
        { title: 'Error', status },
        { status, statusText: 'Error' },
      );
      expect(error?.status).toBe(status);
    });
  }

  it('rechaza elementos de permisos mal formados', () => {
    let error: unknown;
    service.listarPermisos().subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/permisos?page=1&pageSize=100`)
      .flush(page([{ idPermiso: 1, idRol: 2, modulo: 'Pacientes' }], 1, 100));
    expect(error).toEqual(jasmine.any(Error));
  });
});
