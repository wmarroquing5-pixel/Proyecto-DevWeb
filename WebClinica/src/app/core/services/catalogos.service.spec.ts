import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { CatalogosService } from './catalogos.service';

describe('CatalogosService: paginación acotada', () => {
  let service: CatalogosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
    ] });
    service = TestBed.inject(CatalogosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('recorre las páginas de un catálogo pequeño sin presentar la primera como completa', () => {
    const values: unknown[] = [];
    service.getSucursales().subscribe(items => values.push(...items));
    http.expectOne(`${environment.apiUrl}/sucursales?page=1&pageSize=100`).flush({
      items: [{ idSucursal: 1, nombre: 'Central', activa: true }],
      page: 1, pageSize: 100, totalCount: 101, totalPages: 2,
    });
    http.expectOne(`${environment.apiUrl}/sucursales?page=2&pageSize=100`).flush({
      items: [{ idSucursal: 101, nombre: 'Norte', activa: true }],
      page: 2, pageSize: 100, totalCount: 101, totalPages: 2,
    });
    expect(values.length).toBe(2);
  });

  it('rechaza un catálogo que excede el límite seguro en vez de devolver datos parciales', () => {
    let error: unknown;
    service.getEspecialidades().subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/especialidades?page=1&pageSize=100`).flush({
      items: [], page: 1, pageSize: 100, totalCount: 501, totalPages: 6,
    });
    expect(error).toEqual(jasmine.any(Error));
    expect(http.match(() => true)).toEqual([]);
  });

  it('consulta turnos con el contrato paginado real', () => {
    let result: unknown;
    service.getTurnos().subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/turnos?page=1&pageSize=100`).flush({
      items: [{
        idTurno: 3, nombre: 'Diurno', codigo: 'D', horaEntrada: '08:00',
        horaSalida: '16:00', jornada: 'Diurna', activo: true,
      }],
      page: 1, pageSize: 100, totalCount: 1, totalPages: 1,
    });
    expect((result as unknown[]).length).toBe(1);
  });
});
