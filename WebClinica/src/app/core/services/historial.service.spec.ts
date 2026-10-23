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

  it('separa el registro general del registro atómico con examen', () => {
    const general = { idConsulta: 17, idMedico: null, descripcion: 'Control' };
    service.crearDiagnostico(general).subscribe();
    const standard = http.expectOne(`${environment.apiUrl}/diagnosticos`);
    expect(standard.request.method).toBe('POST');
    expect(standard.request.body).toEqual(general);
    expect(standard.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    standard.flush({ ...general, idDiagnostico: 31, idMedico: 7 });

    const linked = { ...general, idExamen: 8 };
    service.crearDiagnosticoConExamen(linked).subscribe();
    const association = http.expectOne(`${environment.apiUrl}/diagnosticos/con-examen`);
    expect(association.request.method).toBe('POST');
    expect(association.request.body).toEqual(linked);
    expect(association.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    association.flush({ ...general, idDiagnostico: 32, idMedico: 7 });
  });

  it('adjunta varios archivos con FormData y deja el Content-Type al navegador', () => {
    const files = [new File(['%PDF-1.4'], 'uno.pdf', { type: 'application/pdf' }),
      new File(['PNG'], 'dos.png', { type: 'image/png' })];
    service.adjuntarArchivosExamen(8, files).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/examenes/8/archivos`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body instanceof FormData).toBeTrue();
    expect((request.request.body as FormData).getAll('archivos')).toEqual(files);
    expect(request.request.headers.has('Content-Type')).toBeFalse();
    expect(request.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    expect(request.request.reportProgress).toBeTrue();
    request.flush([], { status: 201, statusText: 'Created' });
  });

  it('consulta, descarga y elimina solo archivos del examen indicado', () => {
    service.listarArchivosExamen(8).subscribe();
    const list = http.expectOne(`${environment.apiUrl}/examenes/8/archivos`);
    expect(list.request.method).toBe('GET');
    list.flush([]);
    service.descargarArchivoExamen(8, 'abc').subscribe();
    const download = http.expectOne(`${environment.apiUrl}/examenes/8/archivos/abc`);
    expect(download.request.method).toBe('GET');
    expect(download.request.responseType).toBe('blob');
    download.flush(new Blob(['test'], { type: 'application/pdf' }));
    service.eliminarArchivoExamen(8, 'abc').subscribe();
    const deletion = http.expectOne(`${environment.apiUrl}/examenes/8/archivos/abc`);
    expect(deletion.request.method).toBe('DELETE');
    expect(deletion.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    deletion.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('registra la evaluación única por POST con solo los ocho campos clínicos y Bearer', () => {
    const body = { sintomas: 'Dolor', observaciones: null, pesoLb: 150.5, alturaCm: 170,
      presionSistolica: 120, presionDiastolica: 80, temperaturaC: 36.7, frecuenciaCardiaca: 72 };
    let result: unknown;
    service.registrarEvaluacion(17, body).subscribe(response => result = response);
    const request = http.expectOne(`${environment.apiUrl}/consultas/17/evaluacion`);
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    expect(request.request.body).toEqual(body);
    expect(Object.keys(request.request.body).sort()).toEqual(Object.keys(body).sort());
    const response = { idConsulta: 17, idPaciente: 11, estadoConsulta: 'En seguimiento' };
    request.flush(response, { status: 201, statusText: 'Created' });
    expect(result).toEqual(response);
  });

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

  it('crea la prescripción con lote/cantidad por POST tratamientos sin emitir consumo ni modificar stock', () => {
    const body = { idConsulta: 17, descripcion: 'Prescripción', fechaInicio: '2026-10-21',
      fechaFin: null, indicaciones: null, idLote: 7, cantidad: 2 };
    service.crearTratamiento(body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/tratamientos`);
    expect(request.request.method).toBe('POST'); expect(request.request.body).toEqual(body);
    expect(request.request.headers.get('Authorization')).toBe('Bearer consultas-token');
    request.flush({ ...body, idTratamiento: 9, idPaciente: 11, idMedico: 7 });
    http.expectNone(req => req.url.includes('/consumos') || req.url.includes('/lotes-medicamento'));
  });

  it('permite crear un tratamiento sin lote ni cantidad sin invocar inventario', () => {
    const body = { idConsulta: 17, descripcion: 'Reposo', fechaInicio: '2026-10-21',
      fechaFin: null, indicaciones: null, idLote: null, cantidad: null };
    service.crearTratamiento(body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/tratamientos`);
    expect(request.request.body).toEqual(body);
    request.flush({ ...body, idTratamiento: 10, idPaciente: 11, idMedico: 7 });
    http.expectNone(req => req.url.includes('/consumos') || req.url.includes('/lotes-medicamento'));
  });

  it('relee un tratamiento por su ID aunque no esté en la primera página de historial', () => {
    service.obtenerTratamiento(101).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/tratamientos/101`);
    expect(request.request.method).toBe('GET');
    request.flush({ idTratamiento: 101, idLote: 7, cantidad: 2 });
  });

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
