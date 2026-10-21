import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { FacturaService } from './factura.service';

describe('FacturaService', () => {
  let service: FacturaService;
  let http: HttpTestingController;
  const resumen = {
    idFactura: 9, idUsuario: 2, idSucursal: 3, idPaciente: 4,
    fechaFactura: '2026-10-20T10:00:00Z', tipoFactura: 'Estancia Medica',
    nit: 'CF', nombreFacturacion: 'Paciente', total: 125,
  };
  const detalle = {
    ...resumen,
    detalles: [{
      idDetalle: 11, idServicio: 5, idLote: null, idMedicamento: null,
      cantidad: 1, precioUnitario: 125, subtotal: 125,
    }],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(FacturaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('envía todos los filtros soportados y valida la página', () => {
    let result: unknown;
    service.listar({
      idFactura: 9, idPaciente: 4, idSucursal: 3, idUsuario: 2,
      fechaDesde: '2026-10-01', fechaHasta: '2026-10-20', page: 2, pageSize: 10,
    }).subscribe(value => result = value);
    const request = http.expectOne(req => req.url === `${environment.apiUrl}/facturas`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('idPaciente')).toBe('4');
    expect(request.request.params.get('page')).toBe('2');
    request.flush({ items: [resumen], page: 2, pageSize: 10, totalCount: 11, totalPages: 2 });
    expect(result).toBeTruthy();
  });

  it('rechaza una respuesta paginada malformada', () => {
    let error: unknown;
    service.listar().subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/facturas?page=1&pageSize=20`).flush({ items: [{}] });
    expect(error).toEqual(jasmine.any(Error));
  });

  it('consulta el detalle por el identificador real', () => {
    let result: unknown;
    service.obtener(9).subscribe(value => result = value);
    http.expectOne(`${environment.apiUrl}/facturas/9`).flush(detalle);
    expect(result).toEqual(detalle);
  });

  it('crea una factura mixta sin enviar precios, total, lotes ni usuario', () => {
    const body = {
      idSucursal: 3, idPaciente: 4, nit: 'CF', nombreFacturacion: 'Paciente',
      servicios: [{ idServicio: 5, cantidad: 1 }],
      medicamentos: [{ idMedicamento: 7, cantidad: 2 }],
    };
    service.crear(body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/facturas`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    expect(JSON.stringify(request.request.body)).not.toContain('precio');
    expect(JSON.stringify(request.request.body)).not.toContain('total');
    request.flush(detalle);
  });

  it('propaga un conflicto sin reintentar el POST', () => {
    let error: HttpErrorResponse | undefined;
    service.crear({
      idSucursal: 3, idPaciente: 4, servicios: [{ idServicio: 5, cantidad: 1 }], medicamentos: [],
    }).subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/facturas`).flush(
      { detail: 'El inventario cambió.' }, { status: 409, statusText: 'Conflict' },
    );
    expect(error?.status).toBe(409);
    http.expectNone(`${environment.apiUrl}/facturas`);
  });
});
