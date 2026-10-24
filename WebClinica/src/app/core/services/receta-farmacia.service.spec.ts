import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { RecetaFarmaciaService } from './receta-farmacia.service';

describe('RecetaFarmaciaService', () => {
  let service: RecetaFarmaciaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RecetaFarmaciaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lista recetas con paginación y filtro de consulta, solo mediante GET', () => {
    service.listar(2, 10, 17).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/farmacia/recetas?page=2&pageSize=10&idConsulta=17`);
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], page: 2, pageSize: 10, totalCount: 0, totalPages: 0 });

    service.listar(1, 10, null).subscribe();
    const withoutFilter = http.expectOne(`${environment.apiUrl}/farmacia/recetas?page=1&pageSize=10`);
    expect(withoutFilter.request.method).toBe('GET');
    withoutFilter.flush({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
  });

  it('consulta el detalle con el identificador real de receta', () => {
    service.obtener(42).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/farmacia/recetas/42`);
    expect(request.request.method).toBe('GET');
    request.flush({ idReceta: 42, idConsulta: 17, nombrePaciente: 'Paciente sintético',
      nombreMedicoPrescriptor: 'Médico sintético', fechaPrescripcionUtc: '2026-10-23T10:00:00Z',
      estado: 'Vigente', medicamentos: [] });
  });
});
