import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CrearVentaRequest,
  VentaResponse,
  VentaConsultaFiltroDto,
  VentaConsultaResumenResponse,
  VentaConsultaResponse,
  CatalogoMedicamentoResponse,
  PagedResponse
} from '../models/venta.model';

@Injectable({ providedIn: 'root' })
export class VentasService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  // ==================== VENTAS ====================

  listarVentas(filtro: VentaConsultaFiltroDto): Observable<PagedResponse<VentaConsultaResumenResponse>> {
    let params = new HttpParams()
      .set('page', (filtro.page ?? 1).toString())
      .set('pageSize', (filtro.pageSize ?? 20).toString());

    if (filtro.idVenta) params = params.set('idVenta', filtro.idVenta.toString());
    if (filtro.fechaDesde) params = params.set('fechaDesde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fechaHasta', filtro.fechaHasta);
    if (filtro.idSucursal) params = params.set('idSucursal', filtro.idSucursal.toString());
    if (filtro.idUsuario) params = params.set('idUsuario', filtro.idUsuario.toString());

    return this.http.get<PagedResponse<VentaConsultaResumenResponse>>(
      `${this.apiUrl}/ventas`, { params });
  }

  obtenerVenta(id: number): Observable<VentaConsultaResponse> {
    return this.http.get<VentaConsultaResponse>(`${this.apiUrl}/ventas/${id}`);
  }

  crearVenta(request: CrearVentaRequest): Observable<VentaResponse> {
    return this.http.post<VentaResponse>(`${this.apiUrl}/ventas`, request);
  }

  // ==================== CATÁLOGO DE MEDICAMENTOS ====================

  buscarMedicamentos(nombre?: string, page = 1, pageSize = 20): Observable<PagedResponse<CatalogoMedicamentoResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    if (nombre) params = params.set('nombre', nombre);
    return this.http.get<PagedResponse<CatalogoMedicamentoResponse>>(
      `${this.apiUrl}/medicamentos/catalogo`, { params });
  }
}