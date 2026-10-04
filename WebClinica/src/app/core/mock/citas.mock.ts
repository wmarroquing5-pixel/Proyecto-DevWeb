import { delay, Observable, of, throwError } from 'rxjs';
import {
  Cita,
  CitaEvento,
  CitaFormData,
  EstadoCita,
  FranjaAgenda,
  HORAS_DISPONIBLES,
  ResumenCitas,
} from '../models/cita.model';

/**
 * Datos de prueba del módulo Citas.
 * Espejo de las tablas SQL: Cita + CitaHistorial (ver cita.model.ts).
 * Se elimina cuando environment.useMockApi = false.
 */
let SEQ_CITA = 100;

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const HOY = new Date();
const AYER = new Date(HOY); AYER.setDate(HOY.getDate() - 1);
const MANANA = new Date(HOY); MANANA.setDate(HOY.getDate() + 1);
const DOS_DIAS = new Date(HOY); DOS_DIAS.setDate(HOY.getDate() + 2);

/** 'YYYY-MM-DD' + 'HH:mm' -> ISO DATETIME2 */
const iso = (fecha: string, hora: string) => `${fecha}T${hora}:00`;

/** Médicos disponibles (subconjunto activo de Empleado con TipoEmpleado='Medico') */
export const MOCK_MEDICOS_AGENDA = [
  { idEmpleado: 1, nombre: 'Dr. Juan Carlos Méndez Aguilar', especialidad: 'Cardiología', idSucursal: 1 },
  { idEmpleado: 2, nombre: 'Dra. Petra Sofía Ramos Gironz', especialidad: 'Medicina General', idSucursal: 2 },
  { idEmpleado: 3, nombre: 'Dr. Luis Fernando Aguilar Solís', especialidad: 'Neurología', idSucursal: 1 },
];

/** Pacientes registrados (espejo de pacientes.mock.ts) */
export const MOCK_PACIENTES_AGENDA = [
  { idPaciente: 1, nombre: 'María Fernanda López Rivera' },
  { idPaciente: 2, nombre: 'Carlos Alberto Gudiel Pérez' },
  { idPaciente: 3, nombre: 'Ana Lucía Ramírez Soto' },
  { idPaciente: 4, nombre: 'José Manuel Cifuentes Rocha' },
  { idPaciente: 5, nombre: 'Sofía Elizabeth Monroy Castillo' },
];

const SUCURSALES_NOMBRE: Record<number, string> = {
  1: 'Sucursal Central',
  2: 'Sucursal Zona 10',
  3: 'Sucursal Mixco',
};

const medicoDe = (id: number) => MOCK_MEDICOS_AGENDA.find(m => m.idEmpleado === id)!;
const pacienteDe = (id: number) => MOCK_PACIENTES_AGENDA.find(p => p.idPaciente === id)!;

function crearCita(
  id: number, idPaciente: number, idMedico: number,
  fechaBase: Date, hora: string, estado: EstadoCita, motivo: string, duracionMin = 30,
): Cita {
  const med = medicoDe(idMedico);
  const pac = pacienteDe(idPaciente);
  return {
    idCita: id,
    idPaciente, pacienteNombre: pac.nombre,
    idMedico, medicoNombre: med.nombre, especialidad: med.especialidad,
    idSucursal: med.idSucursal, sucursalNombre: SUCURSALES_NOMBRE[med.idSucursal],
    fechaCita: iso(ymd(fechaBase), hora),
    duracionMin, motivo, estado,
  };
}

let CITAS: Cita[] = [
  // Ayer (histórico)
  crearCita(1, 1, 1, AYER, '08:00', 'Atendida', 'Control de presión arterial'),
  crearCita(2, 2, 2, AYER, '10:00', 'Cancelada', 'Consulta general — paciente no asistió'),
  // Hoy
  crearCita(3, 1, 1, HOY, '09:00', 'Confirmada', 'Resultados de electrocardiograma'),
  crearCita(4, 3, 3, HOY, '11:00', 'Programada', 'Migrañas recurrentes', 45),
  crearCita(5, 4, 2, HOY, '14:00', 'Programada', 'Chequeo anual'),
  crearCita(6, 5, 1, HOY, '15:00', 'Confirmada', 'Arritmia'),
  crearCita(7, 2, 3, HOY, '16:00', 'Atendida', 'Seguimiento neurológico'),
  // Futuro
  crearCita(8, 3, 2, MANANA, '08:00', 'Programada', 'Renovación de receta'),
  crearCita(9, 1, 1, DOS_DIAS, '10:00', 'Programada', 'Ecocardiograma de control', 60),
];

let EVENTOS: CitaEvento[] = [];

const DEMORA = 350;

/* ------------------------------------------------------------------ */
/* Validaciones de negocio (espejo de CONSTRAINTs SQL)                 */
/* ------------------------------------------------------------------ */

const claveHorario = (idMedico: number, fechaCita: string) => `${idMedico}|${fechaCita.slice(0, 16)}`;

/** UQ_Cita_Medico_Horario: un médico no puede tener dos citas en la misma franja */
function chocaConCitaActiva(idMedico: number, fechaCita: string, exceptoId?: number): boolean {
  const k = claveHorario(idMedico, fechaCita);
  return CITAS.some(c =>
    c.idCita !== exceptoId &&
    c.estado !== 'Cancelada' &&
    claveHorario(c.idMedico, c.fechaCita) === k,
  );
}

/** No se puede agendar en el pasado */
function esPasado(fechaCita: string): boolean {
  return new Date(fechaCita).getTime() < Date.now() - 60_000;
}

/* ------------------------------------------------------------------ */
/* "Endpoints" simulados                                               */
/* ------------------------------------------------------------------ */

/** GET /api/Citas?fecha=&estado=&idMedico=&filtro= */
export function mockListarCitas(fecha?: string, estado?: string): Observable<Cita[]> {
  let lista = [...CITAS];
  if (fecha) lista = lista.filter(c => c.fechaCita.slice(0, 10) === fecha);
  if (estado) lista = lista.filter(c => c.estado === estado);
  lista.sort((a, b) => a.fechaCita.localeCompare(b.fechaCita));
  return of(lista).pipe(delay(DEMORA));
}

/** GET /api/Citas/Resumen?fecha= */
export function mockResumenCitas(fecha: string): Observable<ResumenCitas> {
  const delDia = CITAS.filter(c => c.fechaCita.slice(0, 10) === fecha);
  const activas = delDia.filter(c => c.estado !== 'Cancelada');
  const capacidad = MOCK_MEDICOS_AGENDA.length * HORAS_DISPONIBLES.length;
  return of({
    totalHoy: delDia.length,
    programadas: delDia.filter(c => c.estado === 'Programada').length,
    confirmadas: delDia.filter(c => c.estado === 'Confirmada').length,
    atendidas: delDia.filter(c => c.estado === 'Atendida').length,
    canceladas: delDia.filter(c => c.estado === 'Cancelada').length,
    ocupacionPct: Math.round((activas.length / capacidad) * 100),
  }).pipe(delay(120));
}

/** POST /api/Citas — valida FKs, CHECK DuracionMin > 0 y UNIQUE médico-horario */
export function mockCrearCita(data: CitaFormData): Observable<Cita> {
  if (!data.idPaciente || !data.idMedico || !data.idSucursal) {
    return throwError(() => ({ error: { message: 'Paciente, médico y sucursal son obligatorios.' } }));
  }
  if (!data.fecha || !data.hora) {
    return throwError(() => ({ error: { message: 'Debe indicar fecha y hora de la cita.' } }));
  }
  if (!(data.duracionMin > 0)) {
    return throwError(() => ({ error: { message: 'La duración debe ser mayor a cero (CHK_Cita_Duracion).' } }));
  }
  const fechaCita = iso(data.fecha, data.hora);
  if (esPasado(fechaCita)) {
    return throwError(() => ({ error: { message: 'No se pueden agendar citas en fechas pasadas.' } }));
  }
  if (chocaConCitaActiva(data.idMedico, fechaCita)) {
    return throwError(() => ({
      error: { message: `El médico ya tiene una cita asignada a las ${data.hora} de ese día.` },
    }));
  }
  const med = medicoDe(data.idMedico);
  const pac = pacienteDe(data.idPaciente);
  const cita: Cita = {
    idCita: ++SEQ_CITA,
    idPaciente: data.idPaciente, pacienteNombre: pac.nombre,
    idMedico: data.idMedico, medicoNombre: med.nombre, especialidad: med.especialidad,
    idSucursal: data.idSucursal, sucursalNombre: SUCURSALES_NOMBRE[data.idSucursal],
    fechaCita, duracionMin: data.duracionMin,
    motivo: data.motivo || null, estado: 'Programada',
  };
  CITAS.push(cita);
  emitir({
    idCita: cita.idCita, pacienteNombre: cita.pacienteNombre, medicoNombre: cita.medicoNombre,
    estadoAnterior: null, estadoNuevo: 'Programada', accion: 'CREADA',
    fechaHora: new Date().toISOString(), usuario: 'demo',
  });
  return of(cita).pipe(delay(DEMORA));
}

/** PATCH /api/Citas/{id}/Estado — máquina de estados + auditoría */
export function mockCambiarEstado(id: number, estado: EstadoCita, observaciones?: string): Observable<Cita> {
  const cita = CITAS.find(c => c.idCita === id);
  if (!cita) return throwError(() => ({ error: { message: 'Cita no encontrada.' } }));

  const transiciones: Record<EstadoCita, EstadoCita[]> = {
    Programada: ['Confirmada', 'Atendida', 'Cancelada'],
    Confirmada: ['Atendida', 'Cancelada'],
    Atendida: [],
    Cancelada: ['Programada'], // reprogramar
  };
  if (!transiciones[cita.estado].includes(estado)) {
    return throwError(() => ({
      error: { message: `Transición inválida: ${cita.estado} → ${estado}.` },
    }));
  }

  const anterior = cita.estado;
  if (estado === 'Programada') {
    // Reprogramación: buscar primera franja libre hoy para simular cambio de horario
    const nueva = CITAS.find(c => c.idCita === id)!;
    nueva.fechaCita = iso(ymd(new Date()), '17:00');
    if (chocaConCitaActiva(nueva.idMedico, nueva.fechaCita, id)) {
      return throwError(() => ({ error: { message: 'No hay franja disponible para reprogramar.' } }));
    }
    emitir({
      idCita: id, pacienteNombre: cita.pacienteNombre, medicoNombre: cita.medicoNombre,
      estadoAnterior: anterior, estadoNuevo: 'Programada', accion: 'REPROGRAMADA',
      fechaHora: new Date().toISOString(), usuario: 'demo',
    });
    return of(nueva).pipe(delay(200));
  }

  cita.estado = estado;
  if (observaciones) cita.motivo = `${cita.motivo ?? ''}${cita.motivo ? ' · ' : ''}${observaciones}`;
  const acciones: Record<Exclude<EstadoCita, 'Programada'>, CitaEvento['accion']> = {
    Confirmada: 'CONFIRMADA', Atendida: 'ATENDIDA', Cancelada: 'CANCELADA',
  };
  emitir({
    idCita: id, pacienteNombre: cita.pacienteNombre, medicoNombre: cita.medicoNombre,
    estadoAnterior: anterior, estadoNuevo: estado, accion: acciones[estado],
    fechaHora: new Date().toISOString(), usuario: 'demo',
  });
  return of({ ...cita }).pipe(delay(200));
}

/** PUT /api/Citas/{id} — reprogramación de fecha/hora/motivo */
export function mockReprogramar(id: number, data: Pick<CitaFormData, 'fecha' | 'hora' | 'motivo'>): Observable<Cita> {
  const cita = CITAS.find(c => c.idCita === id);
  if (!cita) return throwError(() => ({ error: { message: 'Cita no encontrada.' } }));
  if (cita.estado === 'Atendida') {
    return throwError(() => ({ error: { message: 'Una cita atendida no puede modificarse.' } }));
  }
  const fechaCita = iso(data.fecha, data.hora);
  if (esPasado(fechaCita)) {
    return throwError(() => ({ error: { message: 'La nueva fecha no puede estar en el pasado.' } }));
  }
  if (chocaConCitaActiva(cita.idMedico, fechaCita, id)) {
    return throwError(() => ({ error: { message: 'Ese horario ya está ocupado para el médico.' } }));
  }
  const anterior = cita.fechaCita;
  cita.fechaCita = fechaCita;
  cita.motivo = data.motivo || cita.motivo;
  emitir({
    idCita: id, pacienteNombre: cita.pacienteNombre, medicoNombre: cita.medicoNombre,
    estadoAnterior: cita.estado, estadoNuevo: cita.estado, accion: 'REPROGRAMADA',
    fechaHora: new Date().toISOString(), usuario: 'demo',
  });
  console.debug(`[mock] Cita ${id} reprogramada: ${anterior} -> ${fechaCita}`);
  return of({ ...cita }).pipe(delay(200));
}

/** GET /api/Citas/Agenda?fecha=&idMedico= — disponibilidad por franjas */
export function mockAgenda(fecha: string, idMedico: number): Observable<FranjaAgenda[]> {
  const agenda = HORAS_DISPONIBLES.map(hora => {
    const cita = CITAS.find(c =>
      c.idMedico === idMedico &&
      c.estado !== 'Cancelada' &&
      c.fechaCita.slice(0, 10) === fecha &&
      c.fechaCita.slice(11, 16) === hora,
    ) ?? null;
    return { hora, disponible: !cita, cita };
  });
  return of(agenda).pipe(delay(200));
}

/** Catálogos auxiliares (en producción vienen de /api/Catalogos/*) */
export function mockCatalogoPacientes(): Observable<{ idPaciente: number; nombre: string }[]> {
  return of(MOCK_PACIENTES_AGENDA).pipe(delay(150));
}

export function mockCatalogoMedicos(): Observable<
  { idEmpleado: number; nombre: string; especialidad: string; idSucursal: number }[]
> {
  return of(MOCK_MEDICOS_AGENDA).pipe(delay(150));
}

/* ------------------------------------------------------------------ */
/* Simulador SignalR (mismo contrato que CitasHub en .NET)            */
/* ------------------------------------------------------------------ */

type Listener = (e: CitaEvento) => void;
const listeners = new Set<Listener>();

/** Suscripción a eventos "CitaActualizada" del hub */
export function onCitaEvento(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitir(e: CitaEvento) {
  EVENTOS.unshift(e);
  EVENTOS = EVENTOS.slice(0, 30);
  listeners.forEach(l => l(e));
}

/** Feed de los últimos cambios (GET /api/Citas/Historial) */
export function mockEventosCitas(): Observable<CitaEvento[]> {
  return of([...EVENTOS]).pipe(delay(100));
}

/**
 * Cambios "de otro usuario" generados por el servidor simulado cada cierto
 * tiempo — equivalente al broadcast `_hub.Clients.All.SendAsync("CitaActualizada", evt)`.
 */
export function iniciarSimuladorCitas(intervaloMs = 12_000): () => void {
  const timer = setInterval(() => {
    const candidatas = CITAS.filter(c =>
      c.fechaCita.slice(0, 10) === ymd(HOY) &&
      (c.estado === 'Programada' || c.estado === 'Confirmada'),
    );
    if (!candidatas.length) return;
    const cita = candidatas[Math.floor(Math.random() * candidatas.length)];
    const anterior = cita.estado;
    cita.estado = anterior === 'Programada' ? 'Confirmada' : 'Atendida';
    emitir({
      idCita: cita.idCita, pacienteNombre: cita.pacienteNombre, medicoNombre: cita.medicoNombre,
      estadoAnterior: anterior, estadoNuevo: cita.estado,
      accion: cita.estado === 'Confirmada' ? 'CONFIRMADA' : 'ATENDIDA',
      fechaHora: new Date().toISOString(),
      usuario: Math.random() > 0.5 ? 'recepcion1' : 'secretaria2',
    });
  }, intervaloMs);
  return () => clearInterval(timer);
}
