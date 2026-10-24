import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CatalogoMedicamentoResponse,
  MedicamentoResponse,
  FotoMedicamentoResponse,
  GuardarMedicamentoRequest,
  CatalogoFiltroDto,
  LoteMedicamentoResponse,
  GuardarLoteMedicamentoRequest,
  ActualizarLoteMedicamentoRequest,
  RegistrarEntradaInventarioRequest,
  EntradaInventarioResponse,
  CategoriaResponse,
  MarcaResponse,
  GuardarCatalogoFarmaciaRequest,
  PagedResponse
} from '../models/inventario.model';

@Injectable({ providedIn: 'root' })
export class InventarioService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  // ==================== MEDICAMENTOS ====================

  listarCatalogo(filtro: CatalogoFiltroDto): Observable<PagedResponse<CatalogoMedicamentoResponse>> {
    let params = new HttpParams()
      .set('page', (filtro.page ?? 1).toString())
      .set('pageSize', (filtro.pageSize ?? 20).toString());

    if (filtro.nombre) params = params.set('nombre', filtro.nombre);
    if (filtro.categoriaId) params = params.set('categoriaId', filtro.categoriaId.toString());
    if (filtro.marcaId) params = params.set('marcaId', filtro.marcaId.toString());

    return this.http.get<PagedResponse<CatalogoMedicamentoResponse>>(
      `${this.apiUrl}/medicamentos/catalogo`, { params }
    ).pipe(map(response => this.validarPagina(response, this.esCatalogoMedicamento)));
  }

  obtenerCatalogo(id: number): Observable<CatalogoMedicamentoResponse> {
    return this.http.get<CatalogoMedicamentoResponse>(`${this.apiUrl}/medicamentos/catalogo/${id}`);
  }

  listarMedicamentos(page = 1, pageSize = 20): Observable<PagedResponse<MedicamentoResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<PagedResponse<MedicamentoResponse>>(
      `${this.apiUrl}/medicamentos`, { params }
    ).pipe(map(response => this.validarPagina(response, this.esMedicamento)));
  }

  obtenerMedicamento(id: number): Observable<MedicamentoResponse> {
    return this.http.get<MedicamentoResponse>(`${this.apiUrl}/medicamentos/${id}`);
  }

  crearMedicamento(request: GuardarMedicamentoRequest): Observable<MedicamentoResponse> {
    return this.http.post<MedicamentoResponse>(`${this.apiUrl}/medicamentos`, request);
  }

  actualizarMedicamento(id: number, request: GuardarMedicamentoRequest): Observable<MedicamentoResponse> {
    return this.http.put<MedicamentoResponse>(`${this.apiUrl}/medicamentos/${id}`, request);
  }

  desactivarMedicamento(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/medicamentos/${id}`);
  }

  guardarFotoMedicamento(id: number, foto: File): Observable<FotoMedicamentoResponse> {
    const form = new FormData();
    form.append('foto', foto, foto.name);
    return this.http.post<FotoMedicamentoResponse>(`${this.apiUrl}/medicamentos/${id}/foto`, form);
  }

  obtenerFotoMedicamento(id: number): Observable<Blob> {
    return this.http.get(`${this.apiUrl}/medicamentos/${id}/foto`, { responseType: 'blob' });
  }

  eliminarFotoMedicamento(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/medicamentos/${id}/foto`);
  }

  // ==================== LOTES ====================

  listarLotes(page = 1, pageSize = 20): Observable<PagedResponse<LoteMedicamentoResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<PagedResponse<LoteMedicamentoResponse>>(
      `${this.apiUrl}/lotes-medicamento`, { params }
    ).pipe(map(response => this.validarPagina(response, this.esLote)));
  }

  obtenerLote(id: number): Observable<LoteMedicamentoResponse> {
    return this.http.get<LoteMedicamentoResponse>(`${this.apiUrl}/lotes-medicamento/${id}`);
  }

  crearLote(request: GuardarLoteMedicamentoRequest): Observable<LoteMedicamentoResponse> {
    return this.http.post<LoteMedicamentoResponse>(`${this.apiUrl}/lotes-medicamento`, request);
  }

  actualizarLote(id: number, request: ActualizarLoteMedicamentoRequest): Observable<LoteMedicamentoResponse> {
    return this.http.put<LoteMedicamentoResponse>(`${this.apiUrl}/lotes-medicamento/${id}`, request);
  }

  registrarEntrada(idLote: number, request: RegistrarEntradaInventarioRequest): Observable<EntradaInventarioResponse> {
    return this.http.post<EntradaInventarioResponse>(
      `${this.apiUrl}/lotes-medicamento/${idLote}/entradas`, request
    ).pipe(map(response => {
      if (!this.esEntrada(response)) throw new Error('La API devolvió una entrada de inventario inválida.');
      return response;
    }));
  }

  eliminarLote(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/lotes-medicamento/${id}`);
  }

  // ==================== CATEGORÍAS ====================

  listarCategorias(page = 1, pageSize = 100): Observable<PagedResponse<CategoriaResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<PagedResponse<CategoriaResponse>>(
      `${this.apiUrl}/categorias`, { params }
    ).pipe(map(response => this.validarPagina(response, this.esCategoria)));
  }

  crearCategoria(request: GuardarCatalogoFarmaciaRequest): Observable<CategoriaResponse> {
    return this.http.post<unknown>(`${this.apiUrl}/categorias`, request)
      .pipe(map(response => this.validarItem(response, this.esCategoria, 'categoría')));
  }

  actualizarCategoria(id: number, request: GuardarCatalogoFarmaciaRequest): Observable<CategoriaResponse> {
    return this.http.put<unknown>(`${this.apiUrl}/categorias/${id}`, request)
      .pipe(map(response => this.validarItem(response, this.esCategoria, 'categoría')));
  }

  desactivarCategoria(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/categorias/${id}`);
  }

  // ==================== MARCAS ====================

  listarMarcas(page = 1, pageSize = 100): Observable<PagedResponse<MarcaResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<PagedResponse<MarcaResponse>>(
      `${this.apiUrl}/marcas`, { params }
    ).pipe(map(response => this.validarPagina(response, this.esMarca)));
  }

  crearMarca(request: GuardarCatalogoFarmaciaRequest): Observable<MarcaResponse> {
    return this.http.post<unknown>(`${this.apiUrl}/marcas`, request)
      .pipe(map(response => this.validarItem(response, this.esMarca, 'marca')));
  }

  actualizarMarca(id: number, request: GuardarCatalogoFarmaciaRequest): Observable<MarcaResponse> {
    return this.http.put<unknown>(`${this.apiUrl}/marcas/${id}`, request)
      .pipe(map(response => this.validarItem(response, this.esMarca, 'marca')));
  }

  desactivarMarca(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/marcas/${id}`);
  }

  private validarPagina<T>(
    response: PagedResponse<T>,
    validarItem: (value: unknown) => value is T,
  ): PagedResponse<T> {
    if (!this.esRegistro(response)
      || !Array.isArray(response.items)
      || !response.items.every(validarItem)
      || !this.esEnteroPositivo(response.page)
      || !this.esEnteroPositivo(response.pageSize)
      || !this.esEnteroNoNegativo(response.totalCount)
      || !this.esEnteroNoNegativo(response.totalPages)) {
      throw new Error('La API devolvió una página de inventario inválida.');
    }
    return response;
  }

  private readonly esCatalogoMedicamento = (value: unknown): value is CatalogoMedicamentoResponse =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idMedicamento'])
    && typeof value['codigo'] === 'string'
    && typeof value['nombre'] === 'string'
    && typeof value['precioVenta'] === 'number'
    && typeof value['marca'] === 'string'
    && typeof value['categoria'] === 'string'
    && this.esEnteroNoNegativo(value['existenciaTotal']);

  private readonly esMedicamento = (value: unknown): value is MedicamentoResponse =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idMedicamento'])
    && this.esEnteroPositivo(value['idCategoria'])
    && this.esEnteroPositivo(value['idMarca'])
    && typeof value['codigo'] === 'string'
    && typeof value['nombre'] === 'string'
    && typeof value['precioVenta'] === 'number'
    && typeof value['activo'] === 'boolean';

  private readonly esLote = (value: unknown): value is LoteMedicamentoResponse =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idLote'])
    && this.esEnteroPositivo(value['idMedicamento'])
    && typeof value['numeroLote'] === 'string'
    && typeof value['fechaIngreso'] === 'string'
    && typeof value['fechaVencimiento'] === 'string'
    && this.esEnteroNoNegativo(value['cantidadDisponible']);

  private readonly esCategoria = (value: unknown): value is CategoriaResponse =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idCategoria'])
    && typeof value['nombre'] === 'string'
    && typeof value['activa'] === 'boolean';

  private readonly esMarca = (value: unknown): value is MarcaResponse =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idMarca'])
    && typeof value['nombre'] === 'string'
    && typeof value['activa'] === 'boolean';

  private readonly esEntrada = (value: unknown): value is EntradaInventarioResponse =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idMovimiento'])
    && this.esEnteroPositivo(value['idLote'])
    && this.esEnteroPositivo(value['idMedicamento'])
    && this.esEnteroPositivo(value['idSucursal'])
    && this.esEnteroPositivo(value['cantidad'])
    && this.esEnteroNoNegativo(value['cantidadDisponible'])
    && typeof value['fechaMovimiento'] === 'string'
    && (value['observaciones'] === null || typeof value['observaciones'] === 'string');

  private validarItem<T>(
    value: unknown,
    validator: (candidate: unknown) => candidate is T,
    resource: string,
  ): T {
    if (!validator(value)) throw new Error(`La API devolvió una ${resource} inválida.`);
    return value;
  }

  private esRegistro(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private esEnteroPositivo(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  private esEnteroNoNegativo(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
}
