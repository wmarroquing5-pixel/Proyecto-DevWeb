import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  RegistrarVentaResult,
  ResumenVentas,
  Venta,
} from '../models/venta.model';
import {
  LoteDisponible,
  mockCatalogoSucursales,
  mockListarDisponibles,
  mockListarVentas,
  mockObtenerVenta,
  mockRegistrarVenta,
  mockResumenVentas,
} from '../mock/ventas.mock';

/**
 * Servicio del módulo Ventas de Farmacia.
 * Alterna entre mock y API .NET real según environment.useMockApi.
 * Contrato REST documentado en venta.model.ts (VentasController).
 */
@Injectable({ providedIn: 'root' })
export class VentaService {

  private http = inject(HttpClient);
  private auth = inject(AuthService);

  /** Catálogo FEFO de lotes vendibles (activo + stock > 0 + no vencido) */
  listarDisponibles(filtro?: string): Observable<LoteDisponible[]> {
    if (environment.useMockApi) return mockListarDisponibles(filtro);
    return this.http.get<LoteDisponible[]>(`${environment.apiUrl}/Farmacia/disponibles`, {
      params: filtro ? { filtro } : {},
    });
  }

  /** i/ii. Historial de ventas con detalle */
  listarVentas(filtro?: string): Observable<Venta[]> {
    if (environment.useMockApi) return mockListarVentas(filtro);
    return this.http.get<Venta[]>(`${environment.apiUrl}/Ventas`, {
      params: filtro ? { filtro } : {},
    });
  }

  obtenerVenta(id: number): Observable<Venta> {
    if (environment.useMockApi) return mockObtenerVenta(id);
    return this.http.get<Venta>(`${environment.apiUrl}/Ventas/${id}`);
  }

  sucursales(): Observable<Array<{ idSucursal: number; nombre: string }>> {
    if (environment.useMockApi) return mockCatalogoSucursales();
    return this.http.get<Array<{ idSucursal: number; nombre: string }>>(
      `${environment.apiUrl}/Catalogos/sucursales`);
  }

  /**
   * i/ii/iii/iv. Completa la venta.
   * El frontend valida cantidad > 0, precio > 0 y disponibilidad por lote;
   * el backend (.NET) re-valida todo dentro de una transacción SQL y descuenta
   * LoteMedicamento.CantidadDisponible automáticamente.
   */
  registrarVenta(detalles: Array<{ idLote: number; cantidad: number; precioUnitario: number }>,
                 idSucursal: number): Observable<RegistrarVentaResult> {

    const user = this.auth.currentUser();
    if (!user) throw new Error('No hay usuario autenticado que respalde la venta');
    if (!detalles.length) throw new Error('Agrega al menos un producto a la venta');
    if (detalles.some(d => d.cantidad <= 0)) {
      throw new Error('La cantidad de cada línea debe ser mayor a cero');
    }
    if (detalles.some(d => d.precioUnitario <= 0)) {
      throw new Error('El precio unitario de cada línea debe ser mayor a cero');
    }

    if (environment.useMockApi) {
      return mockRegistrarVenta({
        vendedor: { idUsuario: user.id, usuarioNombre: `${user.fullName} (${user.username})` },
        idSucursal,
        detalles,
      });
    }
    return this.http.post<RegistrarVentaResult>(`${environment.apiUrl}/Ventas`, {
      idUsuario: user.id,
      idSucursal,
      detalles,
    });
  }

  resumen(): Observable<ResumenVentas> {
    if (environment.useMockApi) return mockResumenVentas();
    return this.http.get<ResumenVentas>(`${environment.apiUrl}/Ventas/Resumen`);
  }

  /** Traducción de errores de negocio del backend/mock a mensajes amigables */
  mensajeError(err: unknown): string {
    const code = err instanceof Error ? err.message : String(err);
    switch (code) {
      case 'INSUFFICIENT_STOCK':
        return 'Stock insuficiente: algún lote no alcanza para la cantidad solicitada. Revisa las existencias y vuelve a intentar.';
      case 'EXPIRED_LOTE':
        return 'No se puede vender: uno de los lotes seleccionados está vencido.';
      case 'MEDICAMENTO_INACTIVO':
        return 'Uno de los medicamentos está inactivo en el catálogo.';
      case 'LOTE_NOT_FOUND':
        return 'El lote ya no existe (pudo haber sido eliminado). Actualiza el catálogo.';
      case 'EMPTY_CART':
        return 'La venta no tiene líneas de detalle.';
      case 'INVALID_VALUES':
        return 'Cantidad y precio unitario deben ser mayores a cero en todas las líneas.';
      default:
        return 'No se pudo registrar la venta. Verifica la conexión con el servidor.';
    }
  }
}
