import { HttpErrorResponse } from '@angular/common/http';
import { CrearFacturaRequest, FacturaCreada } from '../../core/models/factura.model';
import { CrearVentaRequest, VentaResponse } from '../../core/models/venta.model';
import { idInventarioValido } from '../inventario/inventario-ui';
import { forkJoin, of, tap } from 'rxjs';
import { InventarioService } from '../../core/services/inventario.service';

export const cantidadFinancieraValida = idInventarioValido;
export const precioReferenciaValido = (value: number): boolean =>
  Number.isFinite(value) && value > 0 && value < 1e16 && /^\d+(\.\d{1,2})?$/.test(String(value));

export function respuestaFinancieraIncierta(error: unknown): boolean {
  return !(error instanceof HttpErrorResponse) || error.status === 0 || error.status === 408 || error.status >= 500;
}

export const mensajeResultadoIncierto =
  'Resultado incierto: la operación puede haberse registrado. No vuelva a confirmar; compruebe el listado y detalle antes de intentar una nueva operación.';

export function verificarMedicamentosFinancieros(
  items: readonly { idMedicamento: number; cantidad: number }[], inventario: InventarioService,
) {
  if (items.length === 0) return of([]);
  return forkJoin(items.map(i => inventario.obtenerCatalogo(i.idMedicamento))).pipe(tap(medicamentos => {
    if (medicamentos.some((m, i) => !m || m.idMedicamento !== items[i].idMedicamento ||
      !Number.isSafeInteger(m.existenciaTotal) || m.existenciaTotal < items[i].cantidad || !precioReferenciaValido(m.precioVenta))) {
      throw new Error('El medicamento o stock de referencia cambió. Recargue el catálogo antes de confirmar.');
    }
  }));
}

interface LineaConfirmada {
  id: number;
  idMedicamento: number | null;
  idServicio: number | null;
  idLote: number | null;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
}

function centavos(value: number): bigint | null {
  if (!Number.isFinite(value) || value < 0 || value >= 1e16) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) return null;
  const result = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0'));
  // No declarar coherente un importe cuya representación JSON number pierde centavos.
  return result <= BigInt(Number.MAX_SAFE_INTEGER) ? result : null;
}

function detallesCoherentes(
  detalles: LineaConfirmada[], total: number, esperados: Map<string, number>,
): boolean {
  if (!Array.isArray(detalles) || detalles.length === 0) return false;
  const cantidades = new Map<string, number>(), ids = new Set<number>();
  let suma = 0n;
  for (const item of detalles) {
    if (!idInventarioValido(item.id) || ids.has(item.id) || !cantidadFinancieraValida(item.cantidad)) return false;
    ids.add(item.id);
    const servicio = item.idServicio !== null;
    if (servicio ? (!idInventarioValido(item.idServicio!) || item.idMedicamento !== null || item.idLote !== null)
      : (!idInventarioValido(item.idMedicamento!) || !idInventarioValido(item.idLote!))) return false;
    const key = `${servicio ? 's' : 'm'}:${servicio ? item.idServicio : item.idMedicamento}`;
    const precio = centavos(item.precioUnitario), subtotal = centavos(item.subtotal);
    if (precio === null || precio <= 0n || subtotal === null || subtotal !== precio * BigInt(item.cantidad)) return false;
    suma += subtotal;
    cantidades.set(key, (cantidades.get(key) ?? 0) + item.cantidad);
  }
  return centavos(total) === suma && cantidades.size === esperados.size &&
    [...esperados].every(([key, cantidad]) => cantidades.get(key) === cantidad);
}

export function ventaConfirmada(res: VentaResponse, request: CrearVentaRequest, idUsuario: number): boolean {
  return !!res && idInventarioValido(res.idVenta) && idInventarioValido(res.idUsuario) && res.idUsuario === idUsuario && res.idSucursal === request.idSucursal &&
    typeof res.fechaVenta === 'string' && Number.isFinite(Date.parse(res.fechaVenta)) && Array.isArray(res.detalles) && res.detalles.every(d => !!d && typeof d === 'object') &&
    detallesCoherentes(res.detalles.map(d => ({ ...d, id: d.idVentaDetalle, idServicio: null })), res.total,
      new Map(request.items.map(i => [`m:${i.idMedicamento}`, i.cantidad])));
}

export function facturaConfirmada(res: FacturaCreada, request: CrearFacturaRequest, idUsuario: number): boolean {
  return !!res && idInventarioValido(res.idFactura) && idInventarioValido(res.idUsuario) && res.idUsuario === idUsuario && res.idSucursal === request.idSucursal &&
    res.idPaciente === request.idPaciente && typeof res.fechaFactura === 'string' && Number.isFinite(Date.parse(res.fechaFactura)) &&
    Array.isArray(res.detalles) && res.detalles.every(d => !!d && typeof d === 'object') && detallesCoherentes(res.detalles.map(d => ({ ...d, id: d.idDetalle })), res.total,
      new Map([...request.servicios.map(i => [`s:${i.idServicio}`, i.cantidad] as const),
        ...request.medicamentos.map(i => [`m:${i.idMedicamento}`, i.cantidad] as const)]));
}
