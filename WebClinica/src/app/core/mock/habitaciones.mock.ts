import { delay, Observable, of, throwError } from 'rxjs';
import {
  AsignacionHabitacion,
  EgresoRegistro,
  EstadoHabitacion,
  Habitacion,
  HabitacionFormData,
  HabitacionEvent,
  PacienteCatalogo,
  ResumenHabitaciones,
} from '../models/habitacion.model';

/**
 * Datos de prueba del módulo Habitaciones.
 * Espejo de las tablas SQL: Sucursal, Habitacion (CHK_Habitacion_Estado),
 * AsignacionHabitacion (FechaIngreso/FechaEgreso) y Paciente.
 * Se elimina cuando environment.useMockApi = false.
 */
let SEQ_HABITACION = 100;
let SEQ_ASIGNACION = 500;

const HOY = new Date();
const fechaHora = (d: Date) => d.toISOString();
const diasAtras = (n: number, h = 8) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  d.setHours(h, 30, 0, 0);
  return d;
};

const SUCURSALES: Record<number, string> = {
  1: 'Sucursal Central',
  2: 'Sucursal Zona 10',
  3: 'Sucursal Mixco',
};

const PACIENTES: PacienteCatalogo[] = [
  { idPaciente: 1, nombres: 'María Elena', apellidos: 'Rodríguez López', dpi: '1234567890101', habitacionActual: null },
  { idPaciente: 2, nombres: 'Juan Carlos', apellidos: 'Monterroso Paz', dpi: '0011223344556', habitacionActual: null },
  { idPaciente: 3, nombres: 'Ana Lucía', apellidos: 'Fernández Sáenz', dpi: '9876543210987', habitacionActual: null },
  { idPaciente: 4, nombres: 'Pedro Antonio', apellidos: 'González Ixmatá', dpi: '5554443332221', habitacionActual: null },
  { idPaciente: 5, nombres: 'Sofía Isabel', apellidos: 'Martínez Chen', dpi: '7778889990001', habitacionActual: null },
  { idPaciente: 6, nombres: 'Luis Alberto', apellidos: 'Cordero Villanueva', dpi: '1928374650123', habitacionActual: null },
];

let HABITACIONES: Habitacion[] = [
  mk(1, 1, '101', 'Individual', 'Ocupada', true, 1, diasAtras(3)),
  mk(2, 1, '102', 'Individual', 'Libre', true, null, null),
  mk(3, 1, '103', 'Doble', 'Ocupada', true, 3, diasAtras(1)),
  mk(4, 1, '201', 'Suite', 'En limpieza', true, null, null),
  mk(5, 1, '202', 'Individual', 'Libre', true, null, null),
  mk(6, 2, '104', 'Doble', 'Ocupada', true, 2, diasAtras(6)),
  mk(7, 2, '105', 'Individual', 'En limpieza', true, null, null),
  mk(8, 2, '106', 'UTI', 'Libre', true, null, null),
  mk(9, 3, '301', 'UTI', 'Ocupada', true, 5, diasAtras(2)),
  mk(10, 3, '302', 'Individual', 'Libre', true, null, null),
  mk(11, 3, '303', 'Maternidad', 'Libre', true, null, null),
  mk(12, 3, '304', 'Maternidad', 'Ocupada', true, 4, diasAtras(0, 6)),
];

/** Historial completo de asignaciones (con egresos cerrados). */
let ASIGNACIONES: AsignacionHabitacion[] = [
  mkAsig(1, 1, 1, diasAtras(3), null, 'Postoperatorio de apendicectomía.'),
  mkAsig(2, 3, 3, diasAtras(1), null, 'Observación por neumonía.'),
  mkAsig(3, 6, 2, diasAtras(6), null, 'Tratamiento antibiótico endovenoso.'),
  mkAsig(4, 9, 5, diasAtras(2), null, 'Estable, en monitoreo UTI.'),
  mkAsig(5, 12, 4, diasAtras(0, 6), null, 'Parto programado, madre y recién nacido estables.'),
  // Egresos históricos (inciso v: control de fechas ingreso/egreso)
  mkAsig(101, 4, 6, diasAtras(12), diasAtras(9), 'Alta médica, pasó a limpieza y luego quedó libre.'),
  mkAsig(102, 7, 1, diasAtras(20), diasAtras(15), 'Egreso con facturación pendiente resuelta.'),
];

function mk(
  id: number,
  idSucursal: number,
  numero: string,
  tipo: string,
  estado: EstadoHabitacion,
  activa: boolean,
  idPaciente: number | null,
  ingreso: Date | null,
): Habitacion {
  const p = idPaciente ? PACIENTES.find(x => x.idPaciente === idPaciente) ?? null : null;
  return {
    idHabitacion: id,
    idSucursal,
    sucursalNombre: SUCURSALES[idSucursal],
    numeroHabitacion: numero,
    tipoHabitacion: tipo,
    estado,
    activa,
    idAsignacionActiva: null,
    idPaciente,
    pacienteNombre: p ? `${p.nombres} ${p.apellidos}` : null,
    fechaIngreso: ingreso ? fechaHora(ingreso) : null,
  };
}

function mkAsig(
  id: number,
  idHabitacion: number,
  idPaciente: number,
  ingreso: Date,
  egreso: Date | null,
  obs: string,
): AsignacionHabitacion {
  const hab = HABITACIONES.find(h => h.idHabitacion === idHabitacion)!;
  const p = PACIENTES.find(x => x.idPaciente === idPaciente)!;
  const fin = egreso ?? HOY;
  return {
    idAsignacion: id,
    idHabitacion,
    habitacionNumero: hab.numeroHabitacion,
    sucursalNombre: hab.sucursalNombre,
    idPaciente,
    pacienteNombre: `${p.nombres} ${p.apellidos}`,
    fechaIngreso: fechaHora(ingreso),
    fechaEgreso: egreso ? fechaHora(egreso) : null,
    observaciones: obs,
    diasEstancia: Math.max(
      1,
      Math.round((fin.getTime() - ingreso.getTime()) / 86_400_000),
    ),
  };
}

/** Recalcula los campos agregados de ocupación tras cualquier cambio. */
function sincronizarAgregados(): void {
  for (const h of HABITACIONES) {
    const act = ASIGNACIONES.find(a => a.idHabitacion === h.idHabitacion && !a.fechaEgreso);
    h.idAsignacionActiva = act?.idAsignacion ?? null;
    h.idPaciente = act?.idPaciente ?? null;
    h.pacienteNombre = act ? act.pacienteNombre : null;
    h.fechaIngreso = act ? act.fechaIngreso : null;
    // Regla de integridad: Ocupada <=> tiene asignación abierta.
    if (h.estado === 'Ocupada' && !act) h.estado = 'Libre';
  }
}

const clonar = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const conRetardo = <T>(v: T, ms = 250): Observable<T> => of(clonar(v)).pipe(delay(ms));

// ===================== "ENDPOINTS" SIMULADOS =====================

export function mockListarHabitaciones(
  estado: string,
  idSucursal: number,
): Observable<Habitacion[]> {
  sincronizarAgregados();
  const r = HABITACIONES.filter(
    h =>
      (!estado || h.estado === estado) &&
      (!idSucursal || h.idSucursal === idSucursal),
  );
  return conRetardo(r);
}

export function mockResumenHabitaciones(): Observable<ResumenHabitaciones> {
  sincronizarAgregados();
  const activas = HABITACIONES.filter(h => h.activa);
  const libres = activas.filter(h => h.estado === 'Libre').length;
  const ocupadas = activas.filter(h => h.estado === 'Ocupada').length;
  const limpieza = activas.filter(h => h.estado === 'En limpieza').length;
  return conRetardo({
    total: activas.length,
    libres,
    ocupadas,
    enLimpieza: limpieza,
    ocupacionPct: activas.length ? Math.round((ocupadas / activas.length) * 100) : 0,
  });
}

export function mockCrearHabitacion(data: HabitacionFormData): Observable<Habitacion> {
  const dup = HABITACIONES.find(
    h => h.idSucursal === data.idSucursal && h.numeroHabitacion === data.numeroHabitacion,
  );
  if (dup) {
    return throwError(() => ({
      error: { message: `Ya existe la habitación "${data.numeroHabitacion}" en ${dup.sucursalNombre}.` },
    }));
  }
  const hab: Habitacion = {
    idHabitacion: ++SEQ_HABITACION,
    idSucursal: data.idSucursal!,
    sucursalNombre: SUCURSALES[data.idSucursal!] ?? '—',
    numeroHabitacion: data.numeroHabitacion,
    tipoHabitacion: data.tipoHabitacion || null,
    estado: data.estado,
    activa: true,
    idAsignacionActiva: null,
    idPaciente: null,
    pacienteNombre: null,
    fechaIngreso: null,
  };
  HABITACIONES = [...HABITACIONES, hab];
  return conRetardo(hab);
}

export function mockActualizarHabitacion(
  id: number,
  data: HabitacionFormData,
): Observable<Habitacion> {
  const hab = HABITACIONES.find(h => h.idHabitacion === id);
  if (!hab) return throwError(() => ({ error: { message: 'Habitación no encontrada.' } }));
  Object.assign(hab, {
    idSucursal: data.idSucursal ?? hab.idSucursal,
    sucursalNombre: SUCURSALES[data.idSucursal ?? hab.idSucursal] ?? hab.sucursalNombre,
    numeroHabitacion: data.numeroHabitacion,
    tipoHabitacion: data.tipoHabitacion || null,
  });
  // No se permite poner "Ocupada" manualmente sin paciente asignado.
  if (data.estado !== 'Ocupada') hab.estado = data.estado;
  sincronizarAgregados();
  return conRetardo(hab);
}

export function mockCambiarEstado(
  id: number,
  nuevoEstado: EstadoHabitacion,
): Observable<Habitacion> {
  const hab = HABITACIONES.find(h => h.idHabitacion === id);
  if (!hab) return throwError(() => ({ error: { message: 'Habitación no encontrada.' } }));
  if (hab.estado === 'Ocupada' && nuevoEstado !== 'Ocupada') {
    return throwError(() => ({
      error: { message: 'No es posible cambiar el estado de una habitación ocupada. Registre primero el egreso del paciente.' },
    }));
  }
  if (nuevoEstado === 'Ocupada') {
    return throwError(() => ({
      error: { message: 'El estado "Ocupada" solo se establece asignando un paciente.' },
    }));
  }
  hab.estado = nuevoEstado;
  return conRetardo(hab);
}

export function mockEliminarHabitacion(id: number): Observable<boolean> {
  const hab = HABITACIONES.find(h => h.idHabitacion === id);
  if (!hab) return throwError(() => ({ error: { message: 'Habitación no encontrada.' } }));
  if (hab.estado === 'Ocupada') {
    return throwError(() => ({
      error: { message: 'No se puede desactivar una habitación con paciente asignado.' },
    }));
  }
  hab.activa = false;
  return conRetardo(true);
}

export function mockListarPacientesCatalogo(): Observable<PacienteCatalogo[]> {
  sincronizarAgregados();
  const r = PACIENTES.map(p => {
    const hab = HABITACIONES.find(h => h.idPaciente === p.idPaciente && h.activa);
    return { ...p, habitacionActual: hab ? `${hab.numeroHabitacion} (${hab.sucursalNombre})` : null };
  });
  return conRetardo(r);
}

export function mockAsignarPaciente(
  idHabitacion: number,
  data: { idPaciente: number; fechaIngreso: string; observaciones: string },
): Observable<{ habitacion: Habitacion; asignacion: AsignacionHabitacion }> {
  const hab = HABITACIONES.find(h => h.idHabitacion === idHabitacion);
  if (!hab || !hab.activa) {
    return throwError(() => ({ error: { message: 'La habitación no existe o está dada de baja.' } }));
  }
  if (hab.estado === 'Ocupada') {
    return throwError(() => ({ error: { message: `La habitación ${hab.numeroHabitacion} ya está ocupada.` } }));
  }
  const p = PACIENTES.find(x => x.idPaciente === data.idPaciente);
  if (!p) return throwError(() => ({ error: { message: 'Paciente no encontrado.' } }));
  const otra = HABITACIONES.find(h => h.idPaciente === data.idPaciente && h.estado === 'Ocupada');
  if (otra) {
    return throwError(() => ({
      error: { message: `${p.nombres} ${p.apellidos} ya está en la habitación ${otra.numeroHabitacion}. Registre su egreso primero.` },
    }));
  }
  hab.estado = 'Ocupada';
  const asig = mkAsig(
    ++SEQ_ASIGNACION,
    hab.idHabitacion,
    data.idPaciente,
    new Date(data.fechaIngreso),
    null,
    data.observaciones,
  );
  ASIGNACIONES = [asig, ...ASIGNACIONES];
  sincronizarAgregados();
  return conRetardo({ habitacion: hab, asignacion: asig });
}

export function mockRegistrarEgreso(
  idAsignacion: number,
  data: EgresoRegistro,
): Observable<{ habitacion: Habitacion; asignacion: AsignacionHabitacion }> {
  const asig = ASIGNACIONES.find(a => a.idAsignacion === idAsignacion);
  if (!asig) return throwError(() => ({ error: { message: 'Asignación no encontrada.' } }));
  if (asig.fechaEgreso) {
    return throwError(() => ({ error: { message: 'El egreso ya fue registrado.' } }));
  }
  const ingreso = new Date(asig.fechaIngreso);
  const egreso = new Date(data.fechaEgreso);
  if (egreso <= ingreso) {
    return throwError(() => ({
      error: { message: 'La fecha de egreso debe ser posterior a la fecha de ingreso.' },
    }));
  }
  asig.fechaEgreso = data.fechaEgreso;
  asig.diasEstancia = Math.max(1, Math.round((egreso.getTime() - ingreso.getTime()) / 86_400_000));
  if (data.observaciones) {
    asig.observaciones = `${asig.observaciones ?? ''}${asig.observaciones ? ' | ' : ''}${data.observaciones}`;
  }
  const hab = HABITACIONES.find(h => h.idHabitacion === asig.idHabitacion)!;
  hab.estado = data.destinoEstado; // normalmente 'En limpieza'
  sincronizarAgregados();
  return conRetardo({ habitacion: hab, asignacion: asig });
}

export function mockListarAsignaciones(
  filtro = '',
  incluirEgresadas = true,
): Observable<AsignacionHabitacion[]> {
  sincronizarAgregados();
  const q = filtro.trim().toLowerCase();
  const r = ASIGNACIONES.filter(a => {
    if (!incluirEgresadas && a.fechaEgreso) return false;
    if (!q) return true;
    return (
      a.pacienteNombre.toLowerCase().includes(q) ||
      a.habitacionNumero.toLowerCase().includes(q)
    );
  });
  return conRetardo(r);
}

// ============ EMISOR MOCK DEL HUB SignalR (simula al servidor) ============
// Cuando useMockApi=false, HabitacionRealtimeService se conecta al Hub real
// (/hubs/habitaciones) y estos eventos los emite el backend .NET.

type Listener = (e: HabitacionEvent) => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setInterval> | null = null;

function emitir(e: Partial<HabitacionEvent> & { idHabitacion: number }): void {
  const hab = HABITACIONES.find(h => h.idHabitacion === e.idHabitacion);
  const ev: HabitacionEvent = {
    tipoEvento: 'estado',
    habitacionNumero: hab?.numeroHabitacion ?? '—',
    sucursalNombre: hab?.sucursalNombre ?? '—',
    estadoAnterior: null,
    estadoNuevo: hab?.estado ?? 'Libre',
    pacienteNombre: hab?.pacienteNombre ?? null,
    mensaje: '',
    fechaHora: fechaHora(new Date()),
    usuarioOrigen: 'sistema',
    ...e,
  } as HabitacionEvent;
  listeners.forEach(l => l(ev));
}

/** Escenarios simulados de otros usuarios/posts (comunicación bidireccional). */
const ESCENARIOS: Array<() => void> = [
  () => {
    const h = HABITACIONES.find(x => x.idHabitacion === 4);
    if (h && h.estado === 'En limpieza') {
      h.estado = 'Libre';
      emitir({
        idHabitacion: 4, tipoEvento: 'estado', estadoAnterior: 'En limpieza',
        estadoNuevo: 'Libre', usuarioOrigen: 'limpieza1',
        mensaje: 'Limpieza terminal finalizada en Suite 201.',
      });
    }
  },
  () => {
    const h = HABITACIONES.find(x => x.idHabitacion === 7);
    if (h && h.estado === 'En limpieza') {
      h.estado = 'Libre';
      emitir({
        idHabitacion: 7, tipoEvento: 'estado', estadoAnterior: 'En limpieza',
        estadoNuevo: 'Libre', usuarioOrigen: 'limpieza2',
        mensaje: 'Habitación 104 (Zona 10) desinfectada y disponible.',
      });
    }
  },
  () => {
    const h = HABITACIONES.find(x => x.idHabitacion === 5 && x.estado === 'Libre');
    const p = PACIENTES.find(x => x.idPaciente === 6)!;
    if (h) {
      h.estado = 'Ocupada';
      const asig = mkAsig(++SEQ_ASIGNACION, 5, 6, new Date(), null, 'Ingreso por urgencias (simulado).');
      ASIGNACIONES = [asig, ...ASIGNACIONES];
      sincronizarAgregados();
      emitir({
        idHabitacion: 5, tipoEvento: 'asignacion', estadoAnterior: 'Libre',
        estadoNuevo: 'Ocupada', pacienteNombre: `${p.nombres} ${p.apellidos}`,
        usuarioOrigen: 'recepcion1',
        mensaje: `Recepción asignó a ${p.nombres} ${p.apellidos} a la habitación ${h.numeroHabitacion}.`,
      });
    }
  },
];

export const mockHabitacionesHub = {
  start(): void {
    if (timer) return;
    let i = 0;
    timer = setInterval(() => {
      ESCENARIOS[i % ESCENARIOS.length]();
      i++;
    }, 9000);
  },
  stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
  },
  on(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
