import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CatalogoMedicamentoResponse,
  MedicamentoResponse,
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
    );
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
    );
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

  // ==================== LOTES ====================

  listarLotes(page = 1, pageSize = 20): Observable<PagedResponse<LoteMedicamentoResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<PagedResponse<LoteMedicamentoResponse>>(
      `${this.apiUrl}/lotes-medicamento`, { params }
    );
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
    );
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
    );
  }

  crearCategoria(request: GuardarCatalogoFarmaciaRequest): Observable<CategoriaResponse> {
    return this.http.post<CategoriaResponse>(`${this.apiUrl}/categorias`, request);
  }

  actualizarCategoria(id: number, request: GuardarCatalogoFarmaciaRequest): Observable<CategoriaResponse> {
    return this.http.put<CategoriaResponse>(`${this.apiUrl}/categorias/${id}`, request);
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
    );
  }

  crearMarca(request: GuardarCatalogoFarmaciaRequest): Observable<MarcaResponse> {
    return this.http.post<MarcaResponse>(`${this.apiUrl}/marcas`, request);
  }

  actualizarMarca(id: number, request: GuardarCatalogoFarmaciaRequest): Observable<MarcaResponse> {
    return this.http.put<MarcaResponse>(`${this.apiUrl}/marcas/${id}`, request);
  }

  desactivarMarca(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/marcas/${id}`);
  }
}