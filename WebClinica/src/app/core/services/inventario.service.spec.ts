import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import {
  ActualizarLoteMedicamentoRequest,
  CatalogoMedicamentoResponse,
  EntradaInventarioResponse,
  LoteMedicamentoResponse,
  RegistrarEntradaInventarioRequest,
} from '../models/inventario.model';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { AuthSessionService } from './auth-session.service';
import { InventarioService } from './inventario.service';

describe('InventarioService', () => {
  let service: InventarioService;
  let http: HttpTestingController;

  const lote: LoteMedicamentoResponse = {
    idLote: 7,
    idMedicamento: 3,
    numeroLote: 'LT-007',
    fechaIngreso: '2026-10-01',
    fechaVencimiento: '2027-10-01',
    cantidadDisponible: 25,
  };
  const catalogo: CatalogoMedicamentoResponse = {
    idMedicamento: 3,
    codigo: 'MED-3',
    nombre: 'Paracetamol',
    precioVenta: 12.5,
    marca: 'Marca',
    categoria: 'Analgésico',
    descripcion: null,
    imagenURL: null,
    existenciaTotal: 25,
  };
  const entrada: EntradaInventarioResponse = {
    idMovimiento: 41,
    idLote: 7,
    idMedicamento: 3,
    idSucursal: 2,
    cantidad: 5,
    cantidadDisponible: 30,
    fechaMovimiento: '2026-10-19T18:00:00Z',
    observaciones: 'Compra OC-10',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: {
        token: 'inventario-token',
        invalidateForToken: jasmine.createSpy('invalidateForToken'),
      } },
    ] });
    service = TestBed.inject(InventarioService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('consulta existencias de medicamentos con filtros, paginación y Bearer', () => {
    service.listarCatalogo({ nombre: 'para', categoriaId: 4, marcaId: 6, page: 2, pageSize: 10 })
      .subscribe(response => expect(response.items).toEqual([catalogo]));

    const request = http.expectOne(req => req.url === `${environment.apiUrl}/medicamentos/catalogo`);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual([
      'categoriaId', 'marcaId', 'nombre', 'page', 'pageSize',
    ]);
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.headers.get('Authorization')).toBe('Bearer inventario-token');
    request.flush({ items: [catalogo], page: 2, pageSize: 10, totalCount: 11, totalPages: 2 });
  });

  it('consulta lotes mediante el contrato paginado real', () => {
    service.listarLotes(3, 20).subscribe(response => expect(response.items).toEqual([lote]));
    const request = http.expectOne(`${environment.apiUrl}/lotes-medicamento?page=3&pageSize=20`);
    expect(request.request.method).toBe('GET');
    request.flush({ items: [lote], page: 3, pageSize: 20, totalCount: 41, totalPages: 3 });
  });

  it('registra una entrada con POST y el DTO exacto', () => {
    const body: RegistrarEntradaInventarioRequest = {
      idSucursal: 2,
      cantidad: 5,
      observaciones: 'Compra OC-10',
    };
    service.registrarEntrada(7, body).subscribe(response => expect(response).toEqual(entrada));
    const request = http.expectOne(`${environment.apiUrl}/lotes-medicamento/7/entradas`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(entrada);
  });

  it('conserva cantidadEsperada, sucursal y justificación al ajustar un lote', () => {
    const body: ActualizarLoteMedicamentoRequest = {
      idMedicamento: 3,
      numeroLote: 'LT-007',
      fechaIngreso: '2026-10-01',
      fechaVencimiento: '2027-10-01',
      cantidadDisponible: 24,
      cantidadEsperada: 25,
      idSucursal: 2,
      observaciones: 'Conteo físico',
    };
    service.actualizarLote(7, body).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/lotes-medicamento/7`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.body).toEqual(body);
    request.flush({ ...lote, cantidadDisponible: 24 });
  });

  it('rechaza una página inesperada en lugar de fabricar existencias', () => {
    let received: unknown;
    service.listarLotes().subscribe({ error: error => received = error });
    http.expectOne(`${environment.apiUrl}/lotes-medicamento?page=1&pageSize=20`)
      .flush({ items: [{ idLote: 7 }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 });
    expect(received).toEqual(jasmine.any(Error));
  });

  it('rechaza una confirmación de entrada incompleta', () => {
    let received: unknown;
    service.registrarEntrada(7, { idSucursal: 2, cantidad: 5 }).subscribe({
      error: error => received = error,
    });
    http.expectOne(`${environment.apiUrl}/lotes-medicamento/7/entradas`)
      .flush({ idMovimiento: 41, idLote: 7 });
    expect(received).toEqual(jasmine.any(Error));
  });

  for (const status of [400, 403, 404, 409]) {
    it(`conserva el error HTTP ${status} de una entrada para ApiErrorService`, () => {
      let received: HttpErrorResponse | undefined;
      service.registrarEntrada(7, { idSucursal: 2, cantidad: 5 }).subscribe({
        error: error => received = error,
      });
      http.expectOne(`${environment.apiUrl}/lotes-medicamento/7/entradas`).flush(
        { title: 'Error controlado', status },
        { status, statusText: 'Error' },
      );
      expect(received?.status).toBe(status);
    });
  }

  it('no reintenta automáticamente una escritura que responde con conflicto', () => {
    let requests = 0;
    service.registrarEntrada(7, { idSucursal: 2, cantidad: 5 }).subscribe({ error: () => undefined });
    const request = http.expectOne(`${environment.apiUrl}/lotes-medicamento/7/entradas`);
    requests++;
    request.flush({ detail: 'El inventario cambió.' }, { status: 409, statusText: 'Conflict' });
    http.expectNone(`${environment.apiUrl}/lotes-medicamento/7/entradas`);
    expect(requests).toBe(1);
  });

  it('administra categorías con baja lógica y reactivación mediante PUT', () => {
    const category = { idCategoria: 8, nombre: 'Analgésicos', activa: true };
    service.listarCategorias(2, 10).subscribe(response => expect(response.items).toEqual([category]));
    http.expectOne(`${environment.apiUrl}/categorias?page=2&pageSize=10`).flush({
      items: [category], page: 2, pageSize: 10, totalCount: 11, totalPages: 2,
    });

    service.crearCategoria({ nombre: 'Analgésicos' }).subscribe(value => expect(value).toEqual(category));
    const post = http.expectOne(`${environment.apiUrl}/categorias`);
    expect(post.request.method).toBe('POST');
    post.flush(category);

    service.actualizarCategoria(8, { nombre: 'Analgésicos', activa: true }).subscribe();
    const put = http.expectOne(`${environment.apiUrl}/categorias/8`);
    expect(put.request.body.activa).toBeTrue();
    put.flush(category);

    service.desactivarCategoria(8).subscribe();
    const remove = http.expectOne(`${environment.apiUrl}/categorias/8`);
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
  });

  it('administra marcas sin duplicar el cliente HTTP existente', () => {
    const brand = { idMarca: 4, nombre: 'Marca Uno', activa: true };
    service.listarMarcas().subscribe(response => expect(response.items).toEqual([brand]));
    http.expectOne(`${environment.apiUrl}/marcas?page=1&pageSize=100`).flush({
      items: [brand], page: 1, pageSize: 100, totalCount: 1, totalPages: 1,
    });
    service.crearMarca({ nombre: 'Marca Uno' }).subscribe();
    http.expectOne(`${environment.apiUrl}/marcas`).flush(brand);
    service.actualizarMarca(4, { nombre: 'Marca Uno', activa: false }).subscribe();
    http.expectOne(`${environment.apiUrl}/marcas/4`).flush({ ...brand, activa: false });
    service.desactivarMarca(4).subscribe();
    http.expectOne(`${environment.apiUrl}/marcas/4`).flush(null);
  });

  it('rechaza catálogos farmacéuticos malformados y conserva conflictos 409', () => {
    let malformed: unknown;
    service.listarCategorias().subscribe({ error: error => malformed = error });
    http.expectOne(`${environment.apiUrl}/categorias?page=1&pageSize=100`).flush({
      items: [{ idCategoria: 8, nombre: 'Analgésicos', activa: 'sí' }],
      page: 1, pageSize: 100, totalCount: 1, totalPages: 1,
    });
    expect(malformed).toEqual(jasmine.any(Error));

    let conflict: HttpErrorResponse | undefined;
    service.desactivarMarca(4).subscribe({ error: error => conflict = error });
    http.expectOne(`${environment.apiUrl}/marcas/4`).flush(
      { title: 'Conflicto', detail: 'La marca tiene medicamentos activos.' },
      { status: 409, statusText: 'Conflict' },
    );
    expect(conflict?.status).toBe(409);
  });
});
