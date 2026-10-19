import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { VentasService } from './venta.service';

describe('VentasService: integración de inventario', () => {
  let service: VentasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(VentasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('crea la venta con una única operación y deja el descuento de lotes a la API', () => {
    const body = { idSucursal: 2, items: [{ idMedicamento: 3, cantidad: 2 }] };
    service.crearVenta(body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/ventas`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush({
      idVenta: 10, idUsuario: 7, idSucursal: 2,
      fechaVenta: '2026-10-19T20:00:00Z', total: 25,
      detalles: [{
        idVentaDetalle: 1, idLote: 7, idMedicamento: 3,
        cantidad: 2, precioUnitario: 12.5, subtotal: 25,
      }],
    });
    expect(http.match(req => req.url.includes('/lotes-medicamento')).length).toBe(0);
  });

  it('no reintenta ni envía un descuento alterno cuando la venta entra en conflicto', () => {
    let error: HttpErrorResponse | undefined;
    service.crearVenta({ idSucursal: 2, items: [{ idMedicamento: 3, cantidad: 2 }] })
      .subscribe({ error: value => error = value });
    http.expectOne(`${environment.apiUrl}/ventas`).flush(
      { detail: 'Stock insuficiente.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(error?.status).toBe(409);
    http.expectNone(`${environment.apiUrl}/ventas`);
    expect(http.match(req => req.url.includes('/lotes-medicamento')).length).toBe(0);
  });
});
