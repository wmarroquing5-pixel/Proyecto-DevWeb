import { delay, Observable, of, throwError } from 'rxjs';
import {
  Categoria,
  DIAS_PROXIMO_VENCIMIENTO,
  EstadoLote,
  LoteMedicamento,
  Marca,
  Medicamento,
  MedicamentoConLotes,
  MovimientoInventario,
  ResumenInventario,
  STOCK_MINIMO_ALERTA,
} from '../models/inventario.model';

/**
 * Datos de prueba del módulo Inventario de Medicamentos.
 * Mismo orden de columnas que el script SQL (Categoria, Marca, Medicamento,
 * LoteMedicamento) + tabla sugerida MovimientoInventario.
 * Se elimina cuando environment.useMockApi = false.
 */
let SEQ_MEDICAMENTO = 100;
let SEQ_LOTE = 100;
let SEQ_MOVIMIENTO = 100;

const HOY = new Date();
const fecha = (d: Date) => d.toISOString().slice(0, 10);
const fechaHora = (d: Date) => d.toISOString();
const diasAtras = (n: number) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  return d;
};
const diasDespues = (n: number) => diasAtras(-n);

const CATEGORIAS: Categoria[] = [
  { idCategoria: 1, nombre: 'Analgésicos', activa: true },
  { idCategoria: 2, nombre: 'Antibióticos', activa: true },
  { idCategoria: 3, nombre: 'Antihipertensivos', activa: true },
  { idCategoria: 4, nombre: 'Antiinflamatorios', activa: true },
  { idCategoria: 5, nombre: 'Antidiabéticos', activa: true },
];

const MARCAS: Marca[] = [
  { idMarca: 1, nombre: 'Farmacéutica Nacional', activa: true },
  { idMarca: 2, nombre: 'MediSur', activa: true },
  { idMarca: 3, nombre: 'Genéricos GT', activa: true },
  { idMarca: 4, nombre: 'PharmaPlus', activa: true },
];

let MEDICAMENTOS: Medicamento[] = [
  {
    idMedicamento: 1, idCategoria: 1, categoriaNombre: 'Analgésicos',
    idMarca: 1, marcaNombre: 'Farmacéutica Nacional', codigo: 'MED-001',
    nombre: 'Acetaminofén 500 mg', descripcion: 'Tabletas, caja x 20',
    precioVenta: 12.50, imagenUrl: null, activo: true,
  },
  {
    idMedicamento: 2, idCategoria: 2, categoriaNombre: 'Antibióticos',
    idMarca: 2, marcaNombre: 'MediSur', codigo: 'MED-002',
    nombre: 'Amoxicilina 500 mg', descripcion: 'Cápsulas, caja x 12',
    precioVenta: 35.00, imagenUrl: null, activo: true,
  },
  {
    idMedicamento: 3, idCategoria: 3, categoriaNombre: 'Antihipertensivos',
    idMarca: 3, marcaNombre: 'Genéricos GT', codigo: 'MED-003',
    nombre: 'Losartán 50 mg', descripcion: 'Tabletas, caja x 30',
    precioVenta: 48.90, imagenUrl: null, activo: true,
  },
  {
    idMedicamento: 4, idCategoria: 1, categoriaNombre: 'Analgésicos',
    idMarca: 4, marcaNombre: 'PharmaPlus', codigo: 'MED-004',
    nombre: 'Ibuprofeno 400 mg', descripcion: 'Tabletas recubiertas, caja x 20',
    precioVenta: 18.75, imagenUrl: null, activo: true,
  },
  {
    idMedicamento: 5, idCategoria: 5, categoriaNombre: 'Antidiabéticos',
    idMarca: 2, marcaNombre: 'MediSur', codigo: 'MED-005',
    nombre: 'Metformina 850 mg', descripcion: 'Tabletas, caja x 30',
    precioVenta: 29.40, imagenUrl: null, activo: true,
  },
  {
    idMedicamento: 6, idCategoria: 4, categoriaNombre: 'Antiinflamatorios',
    idMarca: 1, marcaNombre: 'Farmacéutica Nacional', codigo: 'MED-006',
    nombre: 'Diclofenaco gel 1%', descripcion: 'Tubo 60 g, uso tópico',
    precioVenta: 22.00, imagenUrl: null, activo: false,
  },
];

let LOTES: LoteMedicamento[] = [
  // Acetaminofén: lote saludable + lote próximo a vencer
  { idLote: 1, idMedicamento: 1, medicamentoNombre: 'Acetaminofén 500 mg', medicamentoCodigo: 'MED-001',
    numeroLote: 'ACF-2401', fechaIngreso: fecha(diasAtras(90)), fechaVencimiento: fecha(diasDespues(400)), cantidadDisponible: 120 },
  { idLote: 2, idMedicamento: 1, medicamentoNombre: 'Acetaminofén 500 mg', medicamentoCodigo: 'MED-001',
    numeroLote: 'ACF-2402', fechaIngreso: fecha(diasAtras(300)), fechaVencimiento: fecha(diasDespues(35)), cantidadDisponible: 40 },
  // Amoxicilina: lote con stock bajo
  { idLote: 3, idMedicamento: 2, medicamentoNombre: 'Amoxicilina 500 mg', medicamentoCodigo: 'MED-002',
    numeroLote: 'AMX-2501', fechaIngreso: fecha(diasAtras(45)), fechaVencimiento: fecha(diasDespues(300)), cantidadDisponible: 15 },
  // Losartán: lote agotado (CantidadDisponible = 0 permitido por CHK >= 0)
  { idLote: 4, idMedicamento: 3, medicamentoNombre: 'Losartán 50 mg', medicamentoCodigo: 'MED-003',
    numeroLote: 'LOS-2501', fechaIngreso: fecha(diasAtras(120)), fechaVencimiento: fecha(diasDespues(240)), cantidadDisponible: 0 },
  { idLote: 5, idMedicamento: 3, medicamentoNombre: 'Losartán 50 mg', medicamentoCodigo: 'MED-003',
    numeroLote: 'LOS-2502', fechaIngreso: fecha(diasAtras(10)), fechaVencimiento: fecha(diasDespues(500)), cantidadDisponible: 80 },
  // Ibuprofeno: lote VENCIDO (no cuenta para stock disponible)
  { idLote: 6, idMedicamento: 4, medicamentoNombre: 'Ibuprofeno 400 mg', medicamentoCodigo: 'MED-004',
    numeroLote: 'IBU-2301', fechaIngreso: fecha(diasAtras(400)), fechaVencimiento: fecha(diasAtras(15)), cantidadDisponible: 25 },
  { idLote: 7, idMedicamento: 4, medicamentoNombre: 'Ibuprofeno 400 mg', medicamentoCodigo: 'MED-004',
    numeroLote: 'IBU-2501', fechaIngreso: fecha(diasAtras(20)), fechaVencimiento: fecha(diasDespues(365)), cantidadDisponible: 200 },
  // Metformina
  { idLote: 8, idMedicamento: 5, medicamentoNombre: 'Metformina 850 mg', medicamentoCodigo: 'MED-005',
    numeroLote: 'MET-2501', fechaIngreso: fecha(diasAtras(60)), fechaVencimiento: fecha(diasDespues(180)), cantidadDisponible: 12 },
];

let MOVIMIENTOS: MovimientoInventario[] = [
  { idMovimiento: 1, idLote: 1, numeroLote: 'ACF-2401', idMedicamento: 1, medicamentoNombre: 'Acetaminofén 500 mg',
    tipo: 'Entrada', motivo: 'Compra', cantidad: 150, referencia: 'Proveedor Farmacéutica Nacional / OC-2024-118',
    idUsuario: 1, usuarioNombre: 'demo', fechaMovimiento: fechaHora(diasAtras(90)) },
  { idMovimiento: 2, idLote: 1, numeroLote: 'ACF-2401', idMedicamento: 1, medicamentoNombre: 'Acetaminofén 500 mg',
    tipo: 'Salida', motivo: 'Venta', cantidad: 20, referencia: 'Venta #1023',
    idUsuario: 2, usuarioNombre: 'cajero1', fechaMovimiento: fechaHora(diasAtras(30)) },
  { idMovimiento: 3, idLote: 3, numeroLote: 'AMX-2501', idMedicamento: 2, medicamentoNombre: 'Amoxicilina 500 mg',
    tipo: 'Salida', motivo: 'Uso clínico', cantidad: 10, referencia: 'Consulta #4 (paciente Ana Ramírez)',
    idUsuario: 1, usuarioNombre: 'demo', fechaMovimiento: fechaHora(diasAtras(4)) },
  { idMovimiento: 4, idLote: 4, numeroLote: 'LOS-2501', idMedicamento: 3, medicamentoNombre: 'Losartán 50 mg',
    tipo: 'Salida', motivo: 'Venta', cantidad: 30, referencia: 'Venta #1041',
    idUsuario: 2, usuarioNombre: 'cajero1', fechaMovimiento: fechaHora(diasAtras(2)) },
  { idMovimiento: 5, idLote: 5, numeroLote: 'LOS-2502', idMedicamento: 3, medicamentoNombre: 'Losartán 50 mg',
    tipo: 'Entrada', motivo: 'Compra', cantidad: 80, referencia: 'Laboratorio Genéricos GT / OC-2025-007',
    idUsuario: 1, usuarioNombre: 'demo', fechaMovimiento: fechaHora(diasAtras(10)) },
  { idMovimiento: 6, idLote: 7, numeroLote: 'IBU-2501', idMedicamento: 4, medicamentoNombre: 'Ibuprofeno 400 mg',
    tipo: 'Salida', motivo: 'Merma', cantidad: 10, referencia: 'Rotura de empaque en bodega',
    idUsuario: 1, usuarioNombre: 'demo', fechaMovimiento: fechaHora(diasAtras(1)) },
  { idMovimiento: 7, idLote: 8, numeroLote: 'MET-2501', idMedicamento: 5, medicamentoNombre: 'Metformina 850 mg',
    tipo: 'Salida', motivo: 'Uso clínico', cantidad: 8, referencia: 'Consulta #3 (paciente Carlos Gudiel)',
    idUsuario: 3, usuarioNombre: 'enfermeria1', fechaMovimiento: fechaHora(new Date()) },
];

/* ------------------------------------------------------------------ */
/* Utilidades de cálculo (mismas reglas que aplicará el backend)        */
/* ------------------------------------------------------------------ */

export function estaVencido(l: LoteMedicamento): boolean {
  return l.fechaVencimiento < fecha(HOY);
}

export function proximoVencer(l: LoteMedicamento): boolean {
  if (estaVencido(l)) return false;
  const diffDias = (new Date(l.fechaVencimiento).getTime() - HOY.getTime()) / 86400000;
  return diffDias <= DIAS_PROXIMO_VENCIMIENTO;
}

/** Snapshot SINCRÓNICO y profundo del catálogo (para transacciones simuladas
 *  como registrar una venta). Se clona para que la vista se congele al momento
 *  de la operación: si el stock cambia después, los números del ticket siguen
 *  siendo los reales del instante de la venta. */
export function snapshotInventarioSync(): MedicamentoConLotes[] {
  return MEDICAMENTOS.filter(m => m.activo).map(med => {
    const lotes = LOTES.filter(l => l.idMedicamento === med.idMedicamento)
      .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))
      .map(l => ({ ...l }));
    const stockTotal = lotes.filter(l => !estaVencido(l)).reduce((s, l) => s + l.cantidadDisponible, 0);
    return { ...med, lotes, stockTotal, stockMinimoAlerta: stockTotal <= STOCK_MINIMO_ALERTA };
  });
}

/** Estado visual del lote (regla de negocio derivada, no almacenada en BD) */
export function estadoLote(l: LoteMedicamento): EstadoLote {
  if (estaVencido(l)) return 'Vencido';
  if (l.cantidadDisponible === 0) return 'Agotado';
  if (proximoVencer(l)) return 'Próx. vencer';
  if (l.cantidadDisponible <= STOCK_MINIMO_ALERTA) return 'Stock bajo';
  return 'Disponible';
}

/** Stock "real" de un medicamento = suma de lotes NO vencidos */
function stockDe(med: Medicamento): number {
  return LOTES.filter(l => l.idMedicamento === med.idMedicamento && !estaVencido(l))
    .reduce((s, l) => s + l.cantidadDisponible, 0);
}

function conLotes(med: Medicamento): MedicamentoConLotes {
  const lotes = LOTES.filter(l => l.idMedicamento === med.idMedicamento)
    .sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento)); // FEFO
  const stockTotal = lotes.filter(l => !estaVencido(l)).reduce((s, l) => s + l.cantidadDisponible, 0);
  return { ...med, lotes, stockTotal, stockMinimoAlerta: med.activo && stockTotal <= STOCK_MINIMO_ALERTA };
}

/* ------------------------------------------------------------------ */
/* "Endpoints" simulados                                                 */
/* ------------------------------------------------------------------ */

const DEMORA = 400;

export function mockCatalogoCategorias(): Observable<Categoria[]> {
  return of(CATEGORIAS.filter(c => c.activa)).pipe(delay(200));
}

export function mockCatalogoMarcas(): Observable<Marca[]> {
  return of(MARCAS.filter(m => m.activa)).pipe(delay(200));
}

export function mockListarMedicamentos(filtro?: string, soloActivos = false): Observable<MedicamentoConLotes[]> {
  const q = (filtro ?? '').trim().toLowerCase();
  let lista = MEDICAMENTOS.filter(m => (soloActivos ? m.activo : true));
  if (q) {
    lista = lista.filter(m =>
      `${m.codigo} ${m.nombre} ${m.categoriaNombre} ${m.marcaNombre}`.toLowerCase().includes(q));
  }
  return of(lista.map(conLotes)).pipe(delay(DEMORA));
}

/** i. Registro de medicamentos — valida replicando restricciones SQL */
export function mockCrearMedicamento(data: Omit<Medicamento, 'idMedicamento' | 'categoriaNombre' | 'marcaNombre'>): Observable<Medicamento> {
  if (MEDICAMENTOS.some(m => m.codigo.toLowerCase() === data.codigo.toLowerCase())) {
    return throwError(() => new Error('DUPLICATE_CODE')); // UNIQUE Codigo
  }
  const cat = CATEGORIAS.find(c => c.idCategoria === data.idCategoria);
  const mar = MARCAS.find(m => m.idMarca === data.idMarca);
  const nuevo: Medicamento = {
    ...data,
    idMedicamento: ++SEQ_MEDICAMENTO,
    categoriaNombre: cat?.nombre ?? '',
    marcaNombre: mar?.nombre ?? '',
  };
  MEDICAMENTOS = [nuevo, ...MEDICAMENTOS];
  return of(nuevo).pipe(delay(DEMORA));
}

export function mockActualizarMedicamento(id: number, data: Partial<Medicamento>): Observable<Medicamento> {
  const idx = MEDICAMENTOS.findIndex(m => m.idMedicamento === id);
  if (idx < 0) return throwError(() => new Error('NOT_FOUND'));
  if (data.codigo && MEDICAMENTOS.some(m => m.idMedicamento !== id && m.codigo.toLowerCase() === data.codigo!.toLowerCase())) {
    return throwError(() => new Error('DUPLICATE_CODE'));
  }
  const cat = CATEGORIAS.find(c => c.idCategoria === (data.idCategoria ?? MEDICAMENTOS[idx].idCategoria));
  const mar = MARCAS.find(m => m.idMarca === (data.idMarca ?? MEDICAMENTOS[idx].idMarca));
  MEDICAMENTOS[idx] = {
    ...MEDICAMENTOS[idx], ...data, idMedicamento: id,
    categoriaNombre: cat?.nombre ?? MEDICAMENTOS[idx].categoriaNombre,
    marcaNombre: mar?.nombre ?? MEDICAMENTOS[idx].marcaNombre,
  };
  return of(MEDICAMENTOS[idx]).pipe(delay(DEMORA));
}

/** Baja lógica (Activo = 0), igual que el resto del sistema */
export function mockEliminarMedicamento(id: number): Observable<{ ok: boolean }> {
  const idx = MEDICAMENTOS.findIndex(m => m.idMedicamento === id);
  if (idx >= 0) MEDICAMENTOS[idx] = { ...MEDICAMENTOS[idx], activo: false };
  return of({ ok: true }).pipe(delay(DEMORA));
}

export function mockListarLotes(idMedicamento?: number): Observable<LoteMedicamento[]> {
  const lista = idMedicamento
    ? LOTES.filter(l => l.idMedicamento === idMedicamento)
    : [...LOTES];
  return of(lista.sort((a, b) => a.fechaVencimiento.localeCompare(b.fechaVencimiento))).pipe(delay(DEMORA));
}

/** ii. Registro de lotes: número de lote, medicamento, ingreso, vencimiento y cantidad */
export function mockCrearLote(data: Omit<LoteMedicamento, 'idLote' | 'medicamentoNombre' | 'medicamentoCodigo'>): Observable<LoteMedicamento> {
  const med = MEDICAMENTOS.find(m => m.idMedicamento === data.idMedicamento);
  if (!med) return throwError(() => new Error('MEDICAMENTO_NOT_FOUND'));
  if (LOTES.some(l => l.idMedicamento === data.idMedicamento && l.numeroLote.toLowerCase() === data.numeroLote.toLowerCase())) {
    return throwError(() => new Error('DUPLICATE_LOTE'));
  }
  const nuevo: LoteMedicamento = {
    ...data,
    idLote: ++SEQ_LOTE,
    medicamentoNombre: med.nombre,
    medicamentoCodigo: med.codigo,
  };
  LOTES = [...LOTES, nuevo];

  // Toda alta de lote genera automáticamente su movimiento de ENTRADA
  const mov = registrarMovimiento(nuevo, 'Entrada', 'Compra', nuevo.cantidadDisponible, 'Alta de lote en inventario');
  MOVIMIENTOS.unshift(mov);
  return of(nuevo).pipe(delay(DEMORA));
}

/** Corrección puntual de un lote (edición de datos de ingreso/vencimiento/cantidad) */
export function mockActualizarLote(id: number, data: Partial<LoteMedicamento>): Observable<LoteMedicamento> {
  const idx = LOTES.findIndex(l => l.idLote === id);
  if (idx < 0) return throwError(() => new Error('NOT_FOUND'));
  LOTES[idx] = { ...LOTES[idx], ...data, idLote: id };
  return of(LOTES[idx]).pipe(delay(DEMORA));
}

/** Registra un movimiento de inventario (exportado para que el módulo Ventas
 *  inserte sus salidas en la misma lista compartida MOVIMIENTOS). */
export function registrarMovimiento(
  lote: LoteMedicamento, tipo: 'Entrada' | 'Salida', motivo: MovimientoInventario['motivo'],
  cantidad: number, referencia: string, usuario?: { id: number; nombre: string },
): MovimientoInventario {
  return {
    idMovimiento: ++SEQ_MOVIMIENTO,
    idLote: lote.idLote,
    numeroLote: lote.numeroLote,
    idMedicamento: lote.idMedicamento,
    medicamentoNombre: lote.medicamentoNombre,
    tipo, motivo, cantidad,
    referencia: referencia || null,
    idUsuario: usuario?.id ?? 1,
    usuarioNombre: usuario?.nombre ?? 'demo',
    fechaMovimiento: new Date().toISOString(),
  };
}

/** Lista compartida de movimientos (para inserción atómica desde ventas.mock) */
export function getMovimientosRef(): MovimientoInventario[] {
  return MOVIMIENTOS;
}

/** Referencia viva al array compartido LOTES (mutación atómica desde ventas.mock) */
export function getLotesRef(): LoteMedicamento[] {
  return LOTES;
}

/** iii. Entradas y salidas por ventas o uso clínico.
 *  Replica en memoria lo que hará un procedimiento almacenado en SQL Server:
 *  validar stock, actualizar LoteMedicamento.CantidadDisponible e insertar el movimiento. */
export function mockRegistrarMovimiento(data: {
  idLote: number; tipo: 'Entrada' | 'Salida'; motivo: MovimientoInventario['motivo'];
  cantidad: number; referencia: string;
}): Observable<MovimientoInventario> {
  const idx = LOTES.findIndex(l => l.idLote === data.idLote);
  if (idx < 0) return throwError(() => new Error('LOTE_NOT_FOUND'));
  const lote = LOTES[idx];

  if (data.tipo === 'Salida') {
    if (estaVencido(lote)) return throwError(() => new Error('EXPIRED_LOTE'));
    if (data.cantidad > lote.cantidadDisponible) return throwError(() => new Error('INSUFFICIENT_STOCK'));
  }

  const nuevo = registrarMovimiento(lote, data.tipo, data.motivo, data.cantidad, data.referencia);
  MOVIMIENTOS.unshift(nuevo);
  LOTES[idx] = {
    ...lote,
    cantidadDisponible: data.tipo === 'Entrada'
      ? lote.cantidadDisponible + data.cantidad
      : lote.cantidadDisponible - data.cantidad,   // nunca negativo gracias a la validación (CHK >= 0)
  };
  return of(nuevo).pipe(delay(DEMORA));
}

export function mockListarMovimientos(filtro?: { idLote?: number; tipo?: string }): Observable<MovimientoInventario[]> {
  let lista = [...MOVIMIENTOS];
  if (filtro?.idLote) lista = lista.filter(m => m.idLote === filtro.idLote);
  if (filtro?.tipo) lista = lista.filter(m => m.tipo === filtro.tipo);
  return of(lista.sort((a, b) => b.fechaMovimiento.localeCompare(a.fechaMovimiento))).pipe(delay(DEMORA));
}

export function mockResumenInventario(): Observable<ResumenInventario> {
  const hoy = fecha(HOY);
  const activos = MEDICAMENTOS.filter(m => m.activo);
  const valor = LOTES.filter(l => l.fechaVencimiento >= hoy)
    .reduce((s, l) => {
      const med = MEDICAMENTOS.find(m => m.idMedicamento === l.idMedicamento);
      return s + (med ? l.cantidadDisponible * med.precioVenta : 0);
    }, 0);
  return of({
    totalMedicamentos: activos.length,
    totalLotes: LOTES.length,
    unidadesEnStock: LOTES.filter(l => l.fechaVencimiento >= hoy).reduce((s, l) => s + l.cantidadDisponible, 0),
    valorInventario: valor,
    lotesVencidos: LOTES.filter(l => l.fechaVencimiento < hoy).length,
    lotesProximoVencer: LOTES.filter(l => l.fechaVencimiento >= hoy && proximoVencer(l)).length,
    lotesAgotados: LOTES.filter(l => l.cantidadDisponible === 0 && l.fechaVencimiento >= hoy).length,
    movimientosHoy: MOVIMIENTOS.filter(m => m.fechaMovimiento.slice(0, 10) === hoy).length,
  }).pipe(delay(DEMORA));
}

/** Utilidad exportada para los componentes */
export const mockStockDe = stockDe;
