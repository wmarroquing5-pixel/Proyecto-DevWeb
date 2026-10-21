import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CatalogosService } from './catalogos.service';

describe('CatalogosService', () => {
  let service: CatalogosService;
  let http: HttpTestingController;

  const sucursal = { idSucursal: 1, nombre: 'Central', direccion: null, activa: true };
  const especialidad = { idEspecialidad: 2, nombre: 'Cardiología', activa: true };
  const turno = {
    idTurno: 3, nombre: 'Diurno', codigo: 'D', horaEntrada: '08:00:00',
    horaSalida: '16:00:00', jornada: 'Diurna', activo: true,
  };
  const servicio = {
    idServicio: 4, codigo: 'SRV-4', nombre: 'Consulta', descripcion: null,
    precioBase: 150, tipoServicio: 'Consulta', activo: true,
  };
  const clinica = {
    idClinica: 5, nombreClinica: 'Clínica Central', especialidad: null,
    activa: true, idSucursal: 1,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CatalogosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('recorre las páginas de un selector sin presentar la primera como completa', () => {
    let result: unknown;
    service.getSucursales().subscribe(items => result = items);
    http.expectOne(`${environment.apiUrl}/sucursales?page=1&pageSize=100`).flush({
      items: [sucursal], page: 1, pageSize: 100, totalCount: 101, totalPages: 2,
    });
    http.expectOne(`${environment.apiUrl}/sucursales?page=2&pageSize=100`).flush({
      items: [{ ...sucursal, idSucursal: 101 }],
      page: 2, pageSize: 100, totalCount: 101, totalPages: 2,
    });
    expect((result as unknown[]).length).toBe(2);
  });

  it('rechaza un selector que excede el límite seguro', () => {
    let error: unknown;
    service.getEspecialidades().subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/especialidades?page=1&pageSize=100`).flush({
      items: [], page: 1, pageSize: 100, totalCount: 501, totalPages: 6,
    });
    expect(error).toEqual(jasmine.any(Error));
    expect(http.match(() => true)).toEqual([]);
  });

  it('administra sucursales con el contrato REST real', () => {
    service.listarSucursales(2, 10).subscribe(response => expect(response.items).toEqual([sucursal]));
    http.expectOne(`${environment.apiUrl}/sucursales?page=2&pageSize=10`).flush({
      items: [sucursal], page: 2, pageSize: 10, totalCount: 11, totalPages: 2,
    });
    service.obtenerSucursal(1).subscribe(value => expect(value).toEqual(sucursal));
    http.expectOne(`${environment.apiUrl}/sucursales/1`).flush(sucursal);

    const request = { nombre: 'Central', direccion: 'Zona 1', activa: true };
    service.crearSucursal(request).subscribe();
    const post = http.expectOne(`${environment.apiUrl}/sucursales`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(request);
    post.flush(sucursal);

    service.actualizarSucursal(1, { ...request, activa: false }).subscribe();
    const put = http.expectOne(`${environment.apiUrl}/sucursales/1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body.activa).toBeFalse();
    put.flush({ ...sucursal, activa: false });

    service.desactivarSucursal(1).subscribe();
    const remove = http.expectOne(`${environment.apiUrl}/sucursales/1`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('administra especialidades y conserva el indicador de reactivación', () => {
    service.listarEspecialidades().subscribe();
    http.expectOne(`${environment.apiUrl}/especialidades?page=1&pageSize=20`).flush({
      items: [especialidad], page: 1, pageSize: 20, totalCount: 1, totalPages: 1,
    });
    service.obtenerEspecialidad(2).subscribe();
    http.expectOne(`${environment.apiUrl}/especialidades/2`).flush(especialidad);
    service.crearEspecialidad({ nombre: 'Cardiología' }).subscribe();
    http.expectOne(`${environment.apiUrl}/especialidades`).flush(especialidad);
    service.actualizarEspecialidad(2, { nombre: 'Cardiología', activa: true }).subscribe();
    const put = http.expectOne(`${environment.apiUrl}/especialidades/2`);
    expect(put.request.body.activa).toBeTrue();
    put.flush(especialidad);
    service.desactivarEspecialidad(2).subscribe();
    http.expectOne(`${environment.apiUrl}/especialidades/2`).flush(null);
  });

  it('administra turnos sin enviar un estado no soportado', () => {
    const request = {
      nombre: 'Diurno', codigo: 'D', horaEntrada: '08:00:00',
      horaSalida: '16:00:00', jornada: 'Diurna' as const,
    };
    service.listarTurnos().subscribe();
    http.expectOne(`${environment.apiUrl}/turnos?page=1&pageSize=20`).flush({
      items: [turno], page: 1, pageSize: 20, totalCount: 1, totalPages: 1,
    });
    service.obtenerTurno(3).subscribe();
    http.expectOne(`${environment.apiUrl}/turnos/3`).flush(turno);
    service.crearTurno(request).subscribe();
    const post = http.expectOne(`${environment.apiUrl}/turnos`);
    expect(post.request.body).toEqual(request);
    expect(post.request.body.activo).toBeUndefined();
    post.flush(turno);
    service.actualizarTurno(3, request).subscribe();
    http.expectOne(`${environment.apiUrl}/turnos/3`).flush(turno);
    service.desactivarTurno(3).subscribe();
    http.expectOne(`${environment.apiUrl}/turnos/3`).flush(null);
  });

  it('administra servicios respetando tipos y precio del contrato', () => {
    const request = {
      codigo: 'SRV-4', nombre: 'Consulta', descripcion: null,
      precioBase: 150, tipoServicio: 'Consulta' as const,
    };
    service.listarServicios().subscribe();
    http.expectOne(`${environment.apiUrl}/servicios?page=1&pageSize=20`).flush({
      items: [servicio], page: 1, pageSize: 20, totalCount: 1, totalPages: 1,
    });
    service.obtenerServicio(4).subscribe();
    http.expectOne(`${environment.apiUrl}/servicios/4`).flush(servicio);
    service.crearServicio(request).subscribe();
    const post = http.expectOne(`${environment.apiUrl}/servicios`);
    expect(post.request.body).toEqual(request);
    expect(post.request.body.activo).toBeUndefined();
    post.flush(servicio);
    service.actualizarServicio(4, request).subscribe();
    http.expectOne(`${environment.apiUrl}/servicios/4`).flush(servicio);
    service.desactivarServicio(4).subscribe();
    http.expectOne(`${environment.apiUrl}/servicios/4`).flush(null);
  });

  it('administra clínicas sin permitir que el cliente escriba el estado', () => {
    const request = { nombreClinica: 'Clínica Central', especialidad: null, idSucursal: 1 };
    service.getClinicas().subscribe();
    http.expectOne(`${environment.apiUrl}/clinicas?page=1&pageSize=100`).flush({
      items: [clinica], page: 1, pageSize: 100, totalCount: 1, totalPages: 1,
    });
    service.listarClinicas().subscribe();
    http.expectOne(`${environment.apiUrl}/clinicas?page=1&pageSize=20`).flush({
      items: [clinica], page: 1, pageSize: 20, totalCount: 1, totalPages: 1,
    });
    service.obtenerClinica(5).subscribe();
    http.expectOne(`${environment.apiUrl}/clinicas/5`).flush(clinica);
    service.crearClinica(request).subscribe();
    const post = http.expectOne(`${environment.apiUrl}/clinicas`);
    expect(post.request.body).toEqual(request);
    expect(post.request.body.activa).toBeUndefined();
    post.flush(clinica);
    service.actualizarClinica(5, request).subscribe();
    http.expectOne(`${environment.apiUrl}/clinicas/5`).flush(clinica);
    service.desactivarClinica(5).subscribe();
    http.expectOne(`${environment.apiUrl}/clinicas/5`).flush(null);
  });

  it('rechaza registros y páginas que no cumplen el DTO real', () => {
    let itemError: unknown;
    service.obtenerSucursal(1).subscribe({ error: error => itemError = error });
    http.expectOne(`${environment.apiUrl}/sucursales/1`).flush({
      idSucursal: 1, nombre: 'Central', activa: 'sí',
    });
    expect(itemError).toEqual(jasmine.any(Error));

    let pageError: unknown;
    service.listarServicios().subscribe({ error: error => pageError = error });
    http.expectOne(`${environment.apiUrl}/servicios?page=1&pageSize=20`).flush({
      items: [{ ...servicio, tipoServicio: 'Inventado' }],
      page: 1, pageSize: 20, totalCount: 1, totalPages: 1,
    });
    expect(pageError).toEqual(jasmine.any(Error));
  });

  for (const status of [400, 401, 403, 404, 409]) {
    it(`conserva el error HTTP ${status} sin reintentar la escritura`, () => {
      let error: HttpErrorResponse | undefined;
      service.crearClinica({ nombreClinica: 'Central', idSucursal: 1 }).subscribe({
        error: value => error = value,
      });
      const request = http.expectOne(`${environment.apiUrl}/clinicas`);
      request.flush({ title: 'Error controlado', status }, { status, statusText: 'Error' });
      expect(error?.status).toBe(status);
      http.expectNone(`${environment.apiUrl}/clinicas`);
    });
  }
});
