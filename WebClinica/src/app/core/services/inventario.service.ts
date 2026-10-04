import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Categoria,
  LoteFormData,
  LoteMedicamento,
  Marca,
  Medicamento,
  MedicamentoConLotes,
  MedicamentoFormData,
  MovimientoFormData,
  MovimientoInventario,
  ResumenInventario,
} from '../models/inventario.model';
import {
  mockActualizarLote,
  mockActualizarMedicamento,
  mockCatalogoCategorias,
  mockCatalogoMarcas,
  mockCrearLote,
  mockCrearMedicamento,
  mockEliminarMedicamento,
  mockListarLotes,
  mockListarMedicamentos,
  mockListarMovimientos,
  mockRegistrarMovimiento,
  mockResumenInventario,
} from '../mock/inventario.mock';

/**
 * Servicio del módulo Inventario de Medicamentos.
 * Alterna entre mock y API .NET real según environment.useMockApi.
 * Contrato REST documentado en inventario.model.ts.
 */
@Injectable({ providedIn: 'root' })
export class InventarioService {

  private http = inject(HttpClient);

  /** Último filtro usado (se conserva al volver del detalle) */
  readonly filtro = signal<string>('');

  /* ------------------------- Catálogos ------------------------- */

  categorias(): Observable<Categoria[]> {
    if (environment.useMockApi) return mockCatalogoCategorias();
    return this.http.get<Categoria[]>(`${environment.apiUrl}/Catalogos/categorias`);
  }

  marcas(): Observable<Marca[]> {
    if (environment.useMockApi) return mockCatalogoMarcas();
    return this.http.get<Marca[]>(`${environment.apiUrl}/Catalogos/marcas`);
  }

  /* --------------------- i. Medicamentos ----------------------- */

  listarMedicamentos(filtro?: string): Observable<MedicamentoConLotes[]> {
    const q = filtro ?? this.filtro();
    if (environment.useMockApi) return mockListarMedicamentos(q);
    return this.http.get<MedicamentoConLotes[]>(`${environment.apiUrl}/Medicamentos`, {
      params: q ? { filtro: q } : {},
    });
  }

  crearMedicamento(data: MedicamentoFormData): Observable<Medicamento> {
    const payload = this.medToEntity(data);
    if (environment.useMockApi) return mockCrearMedicamento(payload);
    return this.http.post<Medicamento>(`${environment.apiUrl}/Medicamentos`, payload);
  }

  actualizarMedicamento(id: number, data: MedicamentoFormData): Observable<Medicamento> {
    const payload = this.medToEntity(data);
    if (environment.useMockApi) return mockActualizarMedicamento(id, payload);
    return this.http.put<Medicamento>(`${environment.apiUrl}/Medicamentos/${id}`, payload);
  }

  desactivarMedicamento(id: number): Observable<{ ok: boolean }> {
    if (environment.useMockApi) return mockEliminarMedicamento(id);
    return this.http.delete<{ ok: boolean }>(`${environment.apiUrl}/Medicamentos/${id}`);
  }

  /* ------------------------ ii. Lotes -------------------------- */

  listarLotes(idMedicamento?: number): Observable<LoteMedicamento[]> {
    if (environment.useMockApi) return mockListarLotes(idMedicamento);
    return this.http.get<LoteMedicamento[]>(`${environment.apiUrl}/Lotes`, {
      params: idMedicamento ? { idMedicamento } : {},
    });
  }

  crearLote(data: LoteFormData): Observable<LoteMedicamento> {
    if (!data.idMedicamento || !data.numeroLote.trim() || !data.fechaIngreso ||
        !data.fechaVencimiento || data.cantidadDisponible === null) {
      throw new Error('Faltan campos obligatorios del lote');
    }
    const payload = {
      idMedicamento: data.idMedicamento,
      numeroLote: data.numeroLote.trim(),
      fechaIngreso: data.fechaIngreso,
      fechaVencimiento: data.fechaVencimiento,
      cantidadDisponible: data.cantidadDisponible,
    };
    if (environment.useMockApi) return mockCrearLote(payload);
    return this.http.post<LoteMedicamento>(`${environment.apiUrl}/Lotes`, payload);
  }

  actualizarLote(id: number, data: Partial<LoteMedicamento>): Observable<LoteMedicamento> {
    if (environment.useMockApi) return mockActualizarLote(id, data);
    return this.http.put<LoteMedicamento>(`${environment.apiUrl}/Lotes/${id}`, data);
  }

  /* ------------- iii. Entradas / salidas (movimientos) ---------- */

  registrarMovimiento(data: MovimientoFormData): Observable<MovimientoInventario> {
    if (!data.idLote || !data.cantidad || data.cantidad <= 0) {
      throw new Error('Selecciona un lote e ingresa una cantidad mayor a cero');
    }
    const payload = {
      idLote: data.idLote,
      tipo: data.tipo,
      motivo: data.motivo,
      cantidad: data.cantidad,
      referencia: data.referencia.trim(),
    };
    if (environment.useMockApi) return mockRegistrarMovimiento(payload);
    return this.http.post<MovimientoInventario>(`${environment.apiUrl}/Movimientos`, payload);
  }

  listarMovimientos(filtro?: { idLote?: number; tipo?: string }): Observable<MovimientoInventario[]> {
    if (environment.useMockApi) return mockListarMovimientos(filtro);
    let params = new HttpParams();
    if (filtro?.idLote) params = params.set('idLote', filtro.idLote);
    if (filtro?.tipo) params = params.set('tipo', filtro.tipo);
    return this.http.get<MovimientoInventario[]>(`${environment.apiUrl}/Movimientos`, { params });
  }

  /* -------------------------- KPIs ------------------------------ */

  resumen(): Observable<ResumenInventario> {
    if (environment.useMockApi) return mockResumenInventario();
    return this.http.get<ResumenInventario>(`${environment.apiUrl}/Inventario/Resumen`);
  }

  /* ------------------------- Privados --------------------------- */

  /** Formulario -> entidad Medicamento (NULL donde la BD lo permite) */
  private medToEntity(d: MedicamentoFormData): Omit<Medicamento, 'idMedicamento' | 'categoriaNombre' | 'marcaNombre'> {
    return {
      idCategoria: d.idCategoria!,
      idMarca: d.idMarca!,
      codigo: d.codigo.trim(),
      nombre: d.nombre.trim(),
      descripcion: d.descripcion.trim() || null,
      precioVenta: d.precioVenta!,
      imagenUrl: d.imagenUrl.trim() || null,
      activo: d.activo,
    };
  }
}
