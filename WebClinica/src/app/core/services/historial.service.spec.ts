import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthSessionService } from './auth-session.service';
import { HistorialService } from './historial.service';

describe('HistorialService: listado global de consultas', () => {
  let service: HistorialService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: {
        token: 'consultas-token',
        invalidateForToken: jasmine.createSpy('invalidateForToken'),
      } },
    ] });
    service = TestBed.inject(HistorialService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('usa GET /api/consultas, paginación real y Bearer del interceptor', () => {
    service.listarConsultas({
      idPaciente: null, idMedico: null, idSucursal: null, idClinica: null,
      desde: null, hasta: null, page: 2, pageSize: 50,
    }).subscribe();

    const request = http.expectOne(req => req.url === `${environment.apiUrl}/consultas`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('50');
    expect(request.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    request.flush({ items: [], page: 2, pageSize: 50, totalCount: 0, totalPages: 0 });
  });

  it('envía únicamente los filtros confirmados por ConsultaFiltroDto', () => {
    service.listarConsultas({
      idPaciente: 1, idMedico: 2, idSucursal: 3, idClinica: 4,
      desde: '2026-10-01T00:00:00', hasta: '2026-10-19T23:59:59.999',
      page: 1, pageSize: 20,
    }).subscribe();

    const request = http.expectOne(req => req.url === `${environment.apiUrl}/consultas`);
    expect(request.request.params.keys().sort()).toEqual([
      'desde', 'hasta', 'idClinica', 'idMedico', 'idPaciente', 'idSucursal', 'page', 'pageSize',
    ]);
    expect(request.request.params.get('idPaciente')).toBe('1');
    expect(request.request.params.get('idMedico')).toBe('2');
    expect(request.request.params.get('idSucursal')).toBe('3');
    expect(request.request.params.get('idClinica')).toBe('4');
    expect(request.request.params.get('desde')).toBe('2026-10-01T00:00:00');
    expect(request.request.params.get('hasta')).toBe('2026-10-19T23:59:59.999');
    request.flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
  });

  it('mantiene el contrato camelCase del listado y su respuesta paginada', () => {
    const response = {
      items: [{
        idConsulta: 9, idPaciente: 4, idMedico: 7, idSucursal: 2,
        idClinica: null, fechaConsulta: '2026-10-19T14:30:00',
      }],
      page: 1, pageSize: 20, totalCount: 21, totalPages: 2,
    };
    let result: unknown;
    service.listarConsultas({
      idPaciente: null, idMedico: null, idSucursal: null, idClinica: null,
      desde: null, hasta: null, page: 1, pageSize: 20,
    }).subscribe(value => result = value);
    http.expectOne(req => req.url === `${environment.apiUrl}/consultas`).flush(response);
    expect(result).toEqual(response);
  });

  it('acepta una página vacía sin fabricar registros', () => {
    let total = -1;
    service.listarConsultas({
      idPaciente: 999, idMedico: null, idSucursal: null, idClinica: null,
      desde: null, hasta: null, page: 1, pageSize: 20,
    }).subscribe(response => total = response.totalCount);
    http.expectOne(req => req.url === `${environment.apiUrl}/consultas`)
      .flush({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 });
    expect(total).toBe(0);
  });

  for (const status of [400, 401, 403, 500]) {
    it(`conserva el error HTTP ${status} para el tratamiento centralizado`, () => {
      let received: HttpErrorResponse | undefined;
      service.listarConsultas({
        idPaciente: null, idMedico: null, idSucursal: null, idClinica: null,
        desde: null, hasta: null, page: 1, pageSize: 20,
      }).subscribe({ error: error => received = error });
      http.expectOne(req => req.url === `${environment.apiUrl}/consultas`).flush(
        { title: 'Error controlado', status },
        { status, statusText: 'Error' },
      );
      expect(received?.status).toBe(status);
    });
  }

  it('registra consumo clínico únicamente en el tratamiento indicado', () => {
    const response = {
      idMovimiento: 51,
      idTratamiento: 9,
      idLote: 7,
      cantidad: 2,
      idSucursal: 3,
      fechaMovimiento: '2026-10-19T19:00:00Z',
    };
    let result: unknown;
    service.registrarConsumoClinico(9, { cantidad: 2 }).subscribe(value => result = value);
    const request = http.expectOne(`${environment.apiUrl}/tratamientos/9/consumos`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ cantidad: 2 });
    expect(request.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    request.flush(response);
    expect(result).toEqual(response);
  });

  for (const status of [400, 403, 404, 409]) {
    it(`conserva el error HTTP ${status} del consumo clínico sin reintentar`, () => {
      let received: HttpErrorResponse | undefined;
      service.registrarConsumoClinico(9, { cantidad: 2 }).subscribe({
        error: error => received = error,
      });
      http.expectOne(`${environment.apiUrl}/tratamientos/9/consumos`).flush(
        { title: 'Error controlado', status },
        { status, statusText: 'Error' },
      );
      expect(received?.status).toBe(status);
      http.expectNone(`${environment.apiUrl}/tratamientos/9/consumos`);
    });
  }
});
