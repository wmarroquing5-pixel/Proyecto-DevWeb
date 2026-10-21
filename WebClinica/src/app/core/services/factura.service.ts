import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CrearFacturaRequest,
  FacturaCreada,
  FacturaConsultaFiltro,
  FacturaDetalle,
  FacturaDetalleItem,
  FacturaResumen,
  PagedResponse,
} from '../models/factura.model';

@Injectable({ providedIn: 'root' })
export class FacturaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/facturas`;

  listar(filtro: FacturaConsultaFiltro = {}): Observable<PagedResponse<FacturaResumen>> {
    let params = new HttpParams()
      .set('page', filtro.page ?? 1)
      .set('pageSize', filtro.pageSize ?? 20);
    if (filtro.idFactura) params = params.set('idFactura', filtro.idFactura);
    if (filtro.fechaDesde) params = params.set('fechaDesde', filtro.fechaDesde);
    if (filtro.fechaHasta) params = params.set('fechaHasta', filtro.fechaHasta);
    if (filtro.idSucursal) params = params.set('idSucursal', filtro.idSucursal);
    if (filtro.idPaciente) params = params.set('idPaciente', filtro.idPaciente);
    if (filtro.idUsuario) params = params.set('idUsuario', filtro.idUsuario);

    return this.http.get<unknown>(this.apiUrl, { params }).pipe(
      map(response => this.validarPagina(response)),
    );
  }

  obtener(id: number): Observable<FacturaDetalle> {
    return this.http.get<unknown>(`${this.apiUrl}/${id}`).pipe(
      map(response => this.validarDetalle(response, false)),
    );
  }

  crear(request: CrearFacturaRequest): Observable<FacturaCreada> {
    return this.http.post<unknown>(this.apiUrl, request).pipe(
      map(response => this.validarDetalle(response, true) as FacturaCreada),
    );
  }

  private validarPagina(value: unknown): PagedResponse<FacturaResumen> {
    if (!this.esRegistro(value)
      || !Array.isArray(value['items'])
      || !value['items'].every(item => this.esFacturaResumen(item))
      || !this.esEnteroPositivo(value['page'])
      || !this.esEnteroPositivo(value['pageSize'])
      || !this.esEnteroNoNegativo(value['totalCount'])
      || !this.esEnteroNoNegativo(value['totalPages'])) {
      throw new Error('La API devolvió una página de facturas inválida.');
    }
    return value as unknown as PagedResponse<FacturaResumen>;
  }

  private validarDetalle(value: unknown, pacienteObligatorio: boolean): FacturaDetalle {
    if (!this.esFacturaResumen(value)) {
      throw new Error('La API devolvió una factura inválida.');
    }
    const source = value as unknown as Record<string, unknown>;
    if (!Array.isArray(source['detalles'])
      || !source['detalles'].every(item => this.esDetalle(item))
      || (pacienteObligatorio && !this.esEnteroPositivo(source['idPaciente']))) {
      throw new Error('La API devolvió una factura inválida.');
    }
    return value as unknown as FacturaDetalle;
  }

  private esFacturaResumen = (value: unknown): value is FacturaResumen =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idFactura'])
    && this.esEnteroPositivo(value['idUsuario'])
    && this.esEnteroPositivo(value['idSucursal'])
    && (value['idPaciente'] === null || this.esEnteroPositivo(value['idPaciente']))
    && typeof value['fechaFactura'] === 'string'
    && typeof value['tipoFactura'] === 'string'
    && (value['nit'] === null || typeof value['nit'] === 'string')
    && (value['nombreFacturacion'] === null || typeof value['nombreFacturacion'] === 'string')
    && typeof value['total'] === 'number' && value['total'] >= 0;

  private esDetalle = (value: unknown): value is FacturaDetalleItem =>
    this.esRegistro(value)
    && this.esEnteroPositivo(value['idDetalle'])
    && (value['idServicio'] === null || this.esEnteroPositivo(value['idServicio']))
    && (value['idLote'] === null || this.esEnteroPositivo(value['idLote']))
    && (value['idMedicamento'] === null || this.esEnteroPositivo(value['idMedicamento']))
    && this.esEnteroPositivo(value['cantidad'])
    && typeof value['precioUnitario'] === 'number' && value['precioUnitario'] > 0
    && typeof value['subtotal'] === 'number' && value['subtotal'] > 0;

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
