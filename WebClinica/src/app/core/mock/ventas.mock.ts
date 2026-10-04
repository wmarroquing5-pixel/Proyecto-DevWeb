import { delay, map, Observable, of, throwError } from 'rxjs';
import {
  LoteMedicamento,
  MedicamentoConLotes,
} from '../models/inventario.model';
import {
  RegistrarVentaResult,
  ResumenVentas,
  Venta,
  VentaDetalle,
} from '../models/venta.model';
import {
  estaVencido,
  getLotesRef,
  getMovimientosRef,
  mockListarLotes,
  mockListarMedicamentos,
  registrarMovimiento,
  snapshotInventarioSync,
} from './inventario.mock';

/**
 * Datos y "endpoints" simulados del módulo Ventas de Farmacia.
 * Comparte el estado en memoria de inventario.mock (LOTES), por lo que
 * registrar una venta DESCUENTA automáticamente la existencia del lote,
 * exactamente como hará la transacción del backend .NET.
 * Se elimina cuando environment.useMockApi = false.
 */
let SEQ_VENTA = 1050;
let SEQ_DETALLE = 5000;

const fechaHora = (d: Date) => d.toISOString();
const diasAtras = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

interface VendedorInfo {
  idUsuario: number;
  usuarioNombre: string;
}

const SUCURSALES = [
  { idSucursal: 1, nombre: 'Sucursal Central' },
  { idSucursal: 2, nombre: 'Sucursal Zona 10' },
  { idSucursal: 3, nombre: 'Sucursal Mixco' },
];

/** Historial precargado (ventas ya reflejadas en los movimientos de inventario) */
let VENTAS: Venta[] = [
  {
    idVenta: 1023, idUsuario: 2, usuarioNombre: 'Cajero: Mario López',
    idSucursal: 1, sucursalNombre: 'Sucursal Central',
    fechaVenta: fechaHora(diasAtras(30)), total: 250.00,
    detalle: [{
      idVentaDetalle: 1, idVenta: 1023, idLote: 1, numeroLote: 'ACF-2401',
      idMedicamento: 1, medicamentoCodigo: 'MED-001', medicamentoNombre: 'Acetaminofén 500 mg',
      cantidad: 20, precioUnitario: 12.50, subtotal: 250.00, stockAnterior: 170, stockNuevo: 150,
    }],
  },
  {
    idVenta: 1041, idUsuario: 2, usuarioNombre: 'Cajero: Mario López',
    idSucursal: 1, sucursalNombre: 'Sucursal Central',
    fechaVenta: fechaHora(diasAtras(2)), total: 1467.00,
    detalle: [{
      idVentaDetalle: 2, idVenta: 1041, idLote: 4, numeroLote: 'LOS-2501',
      idMedicamento: 3, medicamentoCodigo: 'MED-003', medicamentoNombre: 'Losartán 50 mg',
      cantidad: 30, precioUnitario: 48.90, subtotal: 1467.00, stockAnterior: 30, stockNuevo: 0,
    }],
  },
  {
    idVenta: 1048, idUsuario: 4, usuarioNombre: 'Cajera: Sofía Chen',
    idSucursal: 2, sucursalNombre: 'Sucursal Zona 10',
    fechaVenta: fechaHora(diasAtras(1)), total: 117.50,
    detalle: [
      {
        idVentaDetalle: 3, idVenta: 1048, idLote: 7, numeroLote: 'IBU-2501',
        idMedicamento: 4, medicamentoCodigo: 'MED-004', medicamentoNombre: 'Ibuprofeno 400 mg',
        cantidad: 4, precioUnitario: 18.75, subtotal: 75.00, stockAnterior: 210, stockNuevo: 206,
      },
      {
        idVentaDetalle: 4, idVenta: 1048, idLote: 2, numeroLote: 'ACF-2402',
        idMedicamento: 1, medicamentoCodigo: 'MED-001', medicamentoNombre: 'Acetaminofén 500 mg',
        cantidad: 3, precioUnitario: 12.50, subtotal: 37.50, stockAnterior: 43, stockNuevo: 40,
      },
    ],
  },
];

/* ------------------------------------------------------------------ */
/* "Endpoints" simulados                                                 */
/* ------------------------------------------------------------------ */

const DEMORA = 450;

/** Fila del catálogo FEFO de lotes disponibles para la venta */
export interface LoteDisponible extends LoteMedicamento {
  precioVenta: number;
  categoriaNombre: string;
}

/** iv. Catálogo de productos disponibles: Medicamento Activo + lote con stock > 0
 *  + lote no vencido, ordenado FEFO (el que vence primero se ofrece primero). */
export function mockListarDisponibles(filtro?: string): Observable<LoteDisponible[]> {
  return mockListarMedicamentos(undefined, true).pipe(
    map(meds => {
      const q = (filtro ?? '').trim().toLowerCase();
      const filas: LoteDisponible[] = [];
      for (const m of meds) {
        if (q && !`${m.codigo} ${m.nombre} ${m.categoriaNombre}`.toLowerCase().includes(q)) continue;
        for (const l of m.lotes) {
          if (l.cantidadDisponible <= 0 || estaVencido(l)) continue;
          filas.push({ ...l, precioVenta: m.precioVenta, categoriaNombre: m.categoriaNombre });
        }
      }
      return filas.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento));
    }),
    delay(250),
  );
}

export function mockCatalogoSucursales(): Observable<Array<{ idSucursal: number; nombre: string }>> {
  return of(SUCURSALES).pipe(delay(200));
}

/** i/ii. Historial de ventas con su detalle (JOIN Venta + VentaDetalle) */
export function mockListarVentas(filtro?: string): Observable<Venta[]> {
  const q = (filtro ?? '').trim().toLowerCase();
  let lista = [...VENTAS].sort((a, b) => b.fechaVenta.localeCompare(a.fechaVenta));
  if (q) {
    lista = lista.filter(v =>
      `${v.idVenta} ${v.usuarioNombre} ${v.sucursalNombre} ` +
      v.detalle.map(d => `${d.medicamentoCodigo} ${d.medicamentoNombre}`).join(' ')
        .toLowerCase().includes(q));
  }
  return of(lista).pipe(delay(DEMORA));
}

export function mockObtenerVenta(id: number): Observable<Venta> {
  const v = VENTAS.find(x => x.idVenta === id);
  return v ? of(v).pipe(delay(200)) : throwError(() => new Error('NOT_FOUND'));
}

/** iii/iv. Registrar venta: valida disponibilidad, descuenta stock por lote
 *  e inserta el movimiento de salida — todo contra el estado compartido
 *  de inventario.mock, igual que la transacción del backend real. */
export function mockRegistrarVenta(payload: {
  vendedor: VendedorInfo;
  idSucursal: number;
  detalles: Array<{ idLote: number; cantidad: number; precioUnitario: number }>;
}): Observable<RegistrarVentaResult> {
  if (!payload.detalles.length) return throwError(() => new Error('EMPTY_CART'));
  if (payload.detalles.some(d => d.cantidad <= 0 || d.precioUnitario <= 0)) {
    return throwError(() => new Error('INVALID_VALUES')); // CHKs > 0
  }

  // iv. Validar disponibilidad ANTES de completar la venta (lote a lote)
  const validacion = validarYDescontar(payload.detalles, payload.vendedor);
  if ('error' in validacion) {
    return throwError(() => new Error(validacion.error));
  }

  const idVenta = ++SEQ_VENTA;
  const suc = SUCURSALES.find(s => s.idSucursal === payload.idSucursal);
  const detalles: VentaDetalle[] = validacion.filas.map(f => ({
    ...f,
    idVentaDetalle: ++SEQ_DETALLE,
    idVenta,
  }));
  const total = detalles.reduce((s, d) => s + d.subtotal, 0);

  const venta: Venta = {
    idVenta,
    idUsuario: payload.vendedor.idUsuario,
    usuarioNombre: payload.vendedor.usuarioNombre,
    idSucursal: payload.idSucursal,
    sucursalNombre: suc?.nombre ?? '',
    fechaVenta: new Date().toISOString(),
    total,
    detalle: detalles,
  };
  VENTAS = [venta, ...VENTAS];
  return of({ venta, movimientosGenerados: detalles.length }).pipe(delay(DEMORA));
}

/** KPIs del punto de venta */
export function mockResumenVentas(): Observable<ResumenVentas> {
  const hoy = new Date().toISOString().slice(0, 10);
  const mes = hoy.slice(0, 7);
  const deHoy = VENTAS.filter(v => v.fechaVenta.slice(0, 10) === hoy);
  const deMes = VENTAS.filter(v => v.fechaVenta.slice(0, 7) === mes);
  const unidades = (vs: Venta[]) => vs.reduce((s, v) => s + v.detalle.reduce((a, d) => a + d.cantidad, 0), 0);
  const monto = (vs: Venta[]) => vs.reduce((s, v) => s + v.total, 0);

  const porProducto = new Map<string, { unidades: number; monto: number }>();
  for (const v of VENTAS) {
    for (const d of v.detalle) {
      const cur = porProducto.get(d.medicamentoNombre) ?? { unidades: 0, monto: 0 };
      cur.unidades += d.cantidad;
      cur.monto += d.subtotal;
      porProducto.set(d.medicamentoNombre, cur);
    }
  }
  const topProductos = [...porProducto.entries()]
    .map(([nombre, x]) => ({ nombre, ...x }))
    .sort((a, b) => b.unidades - a.unidades)
    .slice(0, 5);

  return of({
    ventasHoy: deHoy.length,
    montoHoy: monto(deHoy),
    unidadesVendidasHoy: unidades(deHoy),
    ticketPromedio: deHoy.length ? monto(deHoy) / deHoy.length : 0,
    ventasMes: deMes.length,
    montoMes: monto(deMes),
    topProductos,
  }).pipe(delay(DEMORA));
}

/** Snapshot síncrono y clonado del estado compartido de inventario (mismo array
 *  LOTES). BUG CORREGIDO: se usaba `mockListarMedicamentos().subscribe()` que
 *  ahora aplica `delay()` interno, por lo que la variable quedaba vacía al
 *  leerla de forma síncrona → catálogo vacío y ventas que nunca completaban. */
function snapshotMedicamentos(): MedicamentoConLotes[] {
  return snapshotInventarioSync();
}

/** Descuenta stock directamente sobre el array LOTES del mock de inventario
 *  (misma referencia que verán las vistas de inventario/movimientos) e inserta
 *  el movimiento de salida correspondiente en la lista compartida MOVIMIENTOS. */
function descontarYMovilizar(detalles: Array<{ idLote: number; cantidad: number; precioUnitario: number }>,
                             vendedor: VendedorInfo): { filas: FilaDetalle[] } | { error: string } {
  // Mutación directa sobre los arrays compartidos LOTESS/MOVIMIENTOS del mock
  const movs = getMovimientosRef();
  const filas: FilaDetalle[] = [];
  for (const d of detalles) {
    const idx = getLotesRef().findIndex(l => l.idLote === d.idLote);
    if (idx < 0) return { error: 'LOTE_NOT_FOUND' };
    const lote = getLotesRef()[idx];
    if (estaVencido(lote)) return { error: 'EXPIRED_LOTE' };
    if (d.cantidad > lote.cantidadDisponible) return { error: 'INSUFFICIENT_STOCK' };
    const stockAnterior = lote.cantidadDisponible;
    // iii. Actualización automática de existencia (transacción simulada: o todo, o nada)
    getLotesRef()[idx] = { ...lote, cantidadDisponible: stockAnterior - d.cantidad };
    const actualizado = getLotesRef()[idx];
    movs.unshift(registrarMovimiento(
      actualizado, 'Salida', 'Venta', d.cantidad,
      `Venta #${SEQ_VENTA + 1} · ${d.cantidad} u @ ${d.precioUnitario.toFixed(2)}`,
      { id: vendedor.idUsuario, nombre: vendedor.usuarioNombre },
    ));
    filas.push({
      idLote: actualizado.idLote, numeroLote: actualizado.numeroLote,
      idMedicamento: actualizado.idMedicamento, medicamentoCodigo: actualizado.medicamentoCodigo,
      medicamentoNombre: actualizado.medicamentoNombre,
      cantidad: d.cantidad, precioUnitario: d.precioUnitario,
      subtotal: +(d.cantidad * d.precioUnitario).toFixed(2),
      stockAnterior, stockNuevo: actualizado.cantidadDisponible,
    });
  }
  return { filas };
}

/* ------------------------------------------------------------------ */
/* Núcleo transaccional simulado (lo que hará el SP del backend)        */
/* ------------------------------------------------------------------ */

type FilaDetalle = Omit<VentaDetalle, 'idVentaDetalle' | 'idVenta'>;

/** Valida disponibilidad y descuenta stock en memoria.
 *  Devuelve { error } si algo falla (venta atómica: o todo, o nada). */
function validarYDescontar(
  detalles: Array<{ idLote: number; cantidad: number; precioUnitario: number }>,
  vendedor: VendedorInfo,
): { filas: FilaDetalle[] } | { error: string } {
  // Snapshot actualizado de lotes (estado compartido con inventario)
  const medicamentos = snapshotMedicamentos();
  const todosLotes = medicamentos.flatMap(m => m.lotes);

  // Acumular demanda por lote (el mismo lote puede venir duplicado en el carrito)
  const demanda = new Map<number, number>();
  for (const d of detalles) {
    demanda.set(d.idLote, (demanda.get(d.idLote) ?? 0) + d.cantidad);
  }

  // iv. Validaciones previas
  for (const [idLote, cant] of demanda) {
    const lote = todosLotes.find(l => l.idLote === idLote);
    if (!lote) return { error: 'LOTE_NOT_FOUND' };
    if (estaVencido(lote)) return { error: 'EXPIRED_LOTE' };
    const med = medicamentos.find(m => m.idMedicamento === lote.idMedicamento);
    if (!med?.activo) return { error: 'MEDICAMENTO_INACTIVO' };
    if (cant > lote.cantidadDisponible) return { error: 'INSUFFICIENT_STOCK' };
  }

  // iii. Descontar existencias (mutación del estado compartido de inventario.mock)
  return descontarYMovilizar(detalles, vendedor);
}
