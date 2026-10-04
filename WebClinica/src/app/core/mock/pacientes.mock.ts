import { delay, Observable, of } from 'rxjs';
import {
  AsignacionHabitacion,
  CatalogoMedico,
  CatalogoSucursal,
  Consulta,
  Diagnostico,
  Evolucion,
  Examen,
  FichaHistorial,
  HistorialPaciente,
  Paciente,
  PacienteResumen,
  Tratamiento,
} from '../models/paciente.model';

/**
 * Datos de prueba del módulo Pacientes (mismo orden de columnas que el SQL).
 * Se elimina cuando environment.useMockApi = false.
 */
let SEQ_PACIENTE = 100;
let SEQ_CONSULTA = 100;
let SEQ_DIAGNOSTICO = 100;
let SEQ_TRATAMIENTO = 100;
let SEQ_EXAMEN = 100;
let SEQ_EVOLUCION = 100;

const HOY = new Date();
const fecha = (d: Date) => d.toISOString().slice(0, 10);
const fechaHora = (d: Date) => d.toISOString();
const diasAtras = (n: number) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  return d;
};

let PACIENTES: Paciente[] = [
  {
    idPaciente: 1, nombres: 'María Fernanda', apellidos: 'López Rivera', dpi: '1234567890101',
    fechaNacimiento: '1990-04-12', sexo: 'Femenino', telefono: '5551234567',
    correo: 'maria.lopez@example.com', fechaRegistro: fechaHora(diasAtras(200)), activo: true,
  },
  {
    idPaciente: 2, nombres: 'Carlos Alberto', apellidos: 'Gudiel Pérez', dpi: '0987654321098',
    fechaNacimiento: '1975-11-30', sexo: 'Masculino', telefono: '5557654321',
    correo: 'carlos.gudiel@example.com', fechaRegistro: fechaHora(diasAtras(150)), activo: true,
  },
  {
    idPaciente: 3, nombres: 'Ana Lucía', apellidos: 'Ramírez Soto', dpi: '1122334455667',
    fechaNacimiento: '2001-07-05', sexo: 'Femenino', telefono: '5559871234',
    correo: 'ana.ramirez@example.com', fechaRegistro: fechaHora(diasAtras(90)), activo: true,
  },
  {
    idPaciente: 4, nombres: 'José Manuel', apellidos: 'Cifuentes Rocha', dpi: '4455667788990',
    fechaNacimiento: '1968-02-18', sexo: 'Masculino', telefono: '5554455667',
    correo: null, fechaRegistro: fechaHora(diasAtras(60)), activo: true,
  },
  {
    idPaciente: 5, nombres: 'Sofía Elizabeth', apellidos: 'Monroy Castillo', dpi: null,
    fechaNacimiento: '2015-09-22', sexo: 'Femenino', telefono: '5552233445',
    correo: 'familia.monroy@example.com', fechaRegistro: fechaHora(diasAtras(20)), activo: false,
  },
];

const CONSULTAS: Consulta[] = [
  {
    idConsulta: 1, idPaciente: 1, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    especialidad: 'Cardiología', idSucursal: 1, sucursalNombre: 'Sucursal Central',
    fechaConsulta: fechaHora(diasAtras(45)), motivoConsulta: 'Dolor torácico leve al hacer esfuerzo',
    sintomas: 'Presión en el pecho, fatiga, disnea grado I', observaciones: 'Se solicita electrocardiograma',
  },
  {
    idConsulta: 2, idPaciente: 1, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    especialidad: 'Cardiología', idSucursal: 1, sucursalNombre: 'Sucursal Central',
    fechaConsulta: fechaHora(diasAtras(20)), motivoConsulta: 'Control de presión arterial',
    sintomas: 'Cefalea ocasional', observaciones: 'Buen avance, mantener tratamiento',
  },
  {
    idConsulta: 3, idPaciente: 2, idMedico: 2, medicoNombre: 'Dra. Petra Sofía Ramos',
    especialidad: 'Medicina General', idSucursal: 2, sucursalNombre: 'Sucursal Zona 10',
    fechaConsulta: fechaHora(diasAtras(12)), motivoConsulta: 'Revisión general anual',
    sintomas: 'Ninguno relevante', observaciones: 'Paciente estable',
  },
  {
    idConsulta: 4, idPaciente: 3, idMedico: 3, medicoNombre: 'Dr. Luis Fernando Aguilar',
    especialidad: 'Neurología', idSucursal: 1, sucursalNombre: 'Sucursal Central',
    fechaConsulta: fechaHora(diasAtras(5)), motivoConsulta: 'Migrenas frecuentes',
    sintomas: 'Cefalea pulsátil unilateral, fotofobia', observaciones: 'Se inicia estudio por imágenes',
  },
];

const DIAGNOSTICOS: Diagnostico[] = [
  {
    idDiagnostico: 1, idConsulta: 1, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    descripcion: 'Hipertensión arterial esencial (CIE-10 I10)', fechaRegistro: fechaHora(diasAtras(45)),
  },
  {
    idDiagnostico: 2, idConsulta: 2, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    descripcion: 'Hipertensión arterial controlada', fechaRegistro: fechaHora(diasAtras(20)),
  },
  {
    idDiagnostico: 3, idConsulta: 4, idMedico: 3, medicoNombre: 'Dr. Luis Fernando Aguilar',
    descripcion: 'Migrena con aura (CIE-10 G43.1)', fechaRegistro: fechaHora(diasAtras(5)),
  },
];

const TRATAMIENTOS: Tratamiento[] = [
  {
    idTratamiento: 1, idConsulta: 1, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    descripcion: 'Losartán 50 mg cada 24 horas', indicaciones: 'Reducir sodio, caminar 30 min diarios',
    fechaInicio: fecha(diasAtras(45)), fechaFin: fecha(diasAtras(-45)),
  },
  {
    idTratamiento: 2, idConsulta: 2, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    descripcion: 'Continuar Losartán 50 mg + control en 3 meses', indicaciones: 'Medir tensión en casa',
    fechaInicio: fecha(diasAtras(20)), fechaFin: null,
  },
  {
    idTratamiento: 3, idConsulta: 4, idMedico: 3, medicoNombre: 'Dr. Luis Fernando Aguilar',
    descripcion: 'Sumatriptán 50 mg ante crisis', indicaciones: 'No exceder 200 mg/día, registro de desencadenantes',
    fechaInicio: fecha(diasAtras(5)), fechaFin: null,
  },
];

const EVOLUCIONES: Evolucion[] = [
  {
    idEvolucion: 1, idPaciente: 1, idConsulta: 2, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    fechaEvolucion: fechaHora(diasAtras(20)),
    descripcion: 'TA 130/85 mmHg. Sin dolor torácico. Tolera bien el medicamento.',
  },
  {
    idEvolucion: 2, idPaciente: 3, idConsulta: 4, idMedico: 3, medicoNombre: 'Dr. Luis Fernando Aguilar',
    fechaEvolucion: fechaHora(diasAtras(3)),
    descripcion: 'Reduce frecuencia de crisis a 1 por semana con medicación de rescate.',
  },
];

const EXAMENES: Examen[] = [
  {
    idExamen: 1, idPaciente: 1, idConsulta: 1, idMedico: 1, medicoNombre: 'Dr. Juan Carlos Méndez',
    nombreExamen: 'Electrocardiograma', fechaExamen: fechaHora(diasAtras(44)),
    resultado: 'Ritmo sinusal, no signos de isquemia aguda',
  },
  {
    idExamen: 2, idPaciente: 2, idConsulta: 3, idMedico: 2, medicoNombre: 'Dra. Petra Sofía Ramos',
    nombreExamen: 'Perfil lipídico', fechaExamen: fechaHora(diasAtras(11)),
    resultado: 'Colesterol total 210 mg/dL (límite)',
  },
];

const HABITACIONES: AsignacionHabitacion[] = [
  {
    idAsignacion: 1, idHabitacion: 3, numeroHabitacion: '204-B', idSucursal: 1,
    sucursalNombre: 'Sucursal Central', idPaciente: 4,
    fechaIngreso: fechaHora(diasAtras(8)), fechaEgreso: fechaHora(diasAtras(1)),
    observaciones: 'Observación por gastritis erosiva',
  },
  {
    idAsignacion: 2, idHabitacion: 1, numeroHabitacion: '101-A', idSucursal: 1,
    sucursalNombre: 'Sucursal Central', idPaciente: 2,
    fechaIngreso: fechaHora(diasAtras(2)), fechaEgreso: null,
    observaciones: 'Hospitalización 48 h por estudio cardiovascular',
  },
];

const MEDICOS: CatalogoMedico[] = [
  { idEmpleado: 1, nombre: 'Dr. Juan Carlos Méndez', especialidad: 'Cardiología' },
  { idEmpleado: 2, nombre: 'Dra. Petra Sofía Ramos', especialidad: 'Medicina General' },
  { idEmpleado: 3, nombre: 'Dr. Luis Fernando Aguilar', especialidad: 'Neurología' },
];

const SUCURSALES: CatalogoSucursal[] = [
  { idSucursal: 1, nombre: 'Sucursal Central' },
  { idSucursal: 2, nombre: 'Sucursal Zona 10' },
  { idSucursal: 3, nombre: 'Sucursal Mixco' },
];

/* ------------------------------------------------------------------ */
/* "Endpoints" simulados                                                 */
/* ------------------------------------------------------------------ */

const DEMORA = 400;

export function mockListarPacientes(filtro?: string): Observable<Paciente[]> {
  const q = (filtro ?? '').trim().toLowerCase();
  const lista = !q
    ? [...PACIENTES]
    : PACIENTES.filter(p =>
        `${p.nombres} ${p.apellidos} ${p.dpi ?? ''} ${p.telefono ?? ''}`.toLowerCase().includes(q));
  return of(lista).pipe(delay(DEMORA));
}

export function mockObtenerPaciente(id: number): Observable<Paciente> {
  const p = PACIENTES.find(x => x.idPaciente === id);
  if (!p) throw new Error(`Paciente ${id} no encontrado`);
  return of({ ...p }).pipe(delay(DEMORA));
}

export function mockCrearPaciente(data: Omit<Paciente, 'idPaciente' | 'fechaRegistro'>): Observable<Paciente> {
  const nuevo: Paciente = {
    ...data,
    idPaciente: ++SEQ_PACIENTE,
    fechaRegistro: new Date().toISOString(),
  };
  PACIENTES = [nuevo, ...PACIENTES];
  return of(nuevo).pipe(delay(DEMORA));
}

export function mockActualizarPaciente(id: number, data: Partial<Paciente>): Observable<Paciente> {
  const idx = PACIENTES.findIndex(p => p.idPaciente === id);
  if (idx < 0) throw new Error(`Paciente ${id} no encontrado`);
  PACIENTES[idx] = { ...PACIENTES[idx], ...data, idPaciente: id };
  return of(PACIENTES[idx]).pipe(delay(DEMORA));
}

/** Baja lógica: la tabla Paciente usa Activo BIT (no se borra físicamente) */
export function mockEliminarPaciente(id: number): Observable<{ ok: boolean }> {
  const idx = PACIENTES.findIndex(p => p.idPaciente === id);
  if (idx >= 0) PACIENTES[idx] = { ...PACIENTES[idx], activo: false };
  return of({ ok: true }).pipe(delay(DEMORA));
}

export function mockObtenerHistorial(id: number): Observable<HistorialPaciente> {
  const paciente = PACIENTES.find(p => p.idPaciente === id);
  if (!paciente) throw new Error(`Paciente ${id} no encontrado`);

  const consultas = CONSULTAS.filter(c => c.idPaciente === id)
    .sort((a, b) => b.fechaConsulta.localeCompare(a.fechaConsulta));
  const idsConsultas = consultas.map(c => c.idConsulta);

  return of({
    paciente: { ...paciente },
    consultas,
    diagnosticos: DIAGNOSTICOS.filter(d => idsConsultas.includes(d.idConsulta)),
    tratamientos: TRATAMIENTOS.filter(t => idsConsultas.includes(t.idConsulta)),
    evoluciones: EVOLUCIONES.filter(e => e.idPaciente === id),
    examenes: EXAMENES.filter(e => e.idPaciente === id),
    habitaciones: HABITACIONES.filter(h => h.idPaciente === id),
  }).pipe(delay(DEMORA));
}

export function mockRegistrarConsulta(idPaciente: number, data: {
  idMedico: number; idSucursal: number; fechaConsulta: string;
  motivoConsulta: string; sintomas: string; observaciones: string;
}): Observable<Consulta> {
  const med = MEDICOS.find(m => m.idEmpleado === data.idMedico);
  const suc = SUCURSALES.find(s => s.idSucursal === data.idSucursal);
  const nueva: Consulta = {
    idConsulta: ++SEQ_CONSULTA,
    idPaciente,
    idMedico: data.idMedico,
    medicoNombre: med?.nombre ?? 'Médico',
    especialidad: med?.especialidad ?? null,
    idSucursal: data.idSucursal,
    sucursalNombre: suc?.nombre ?? 'Sucursal',
    fechaConsulta: data.fechaConsulta,
    motivoConsulta: data.motivoConsulta,
    sintomas: data.sintomas,
    observaciones: data.observaciones,
  };
  CONSULTAS.unshift(nueva);
  return of(nueva).pipe(delay(DEMORA));
}

export function mockRegistrarDiagnostico(idPaciente: number, data: {
  idConsulta: number; idMedico: number; descripcion: string;
}): Observable<Diagnostico> {
  const med = MEDICOS.find(m => m.idEmpleado === data.idMedico);
  const nuevo: Diagnostico = {
    idDiagnostico: ++SEQ_DIAGNOSTICO,
    idConsulta: data.idConsulta,
    idMedico: data.idMedico,
    medicoNombre: med?.nombre ?? 'Médico',
    descripcion: data.descripcion,
    fechaRegistro: new Date().toISOString(),
  };
  DIAGNOSTICOS.push(nuevo);
  return of(nuevo).pipe(delay(DEMORA));
}

export function mockRegistrarTratamiento(idPaciente: number, data: {
  idConsulta: number; idMedico: number; descripcion: string;
  indicaciones: string; fechaInicio: string; fechaFin: string;
}): Observable<Tratamiento> {
  const med = MEDICOS.find(m => m.idEmpleado === data.idMedico);
  const nuevo: Tratamiento = {
    idTratamiento: ++SEQ_TRATAMIENTO,
    idConsulta: data.idConsulta,
    idMedico: data.idMedico,
    medicoNombre: med?.nombre ?? 'Médico',
    descripcion: data.descripcion,
    indicaciones: data.indicaciones,
    fechaInicio: data.fechaInicio,
    fechaFin: data.fechaFin || null,
  };
  TRATAMIENTOS.push(nuevo);
  return of(nuevo).pipe(delay(DEMORA));
}

export function mockCatalogoMedicos(): Observable<CatalogoMedico[]> {
  return of(MEDICOS.filter(() => true)).pipe(delay(200));
}

export function mockCatalogoSucursales(): Observable<CatalogoSucursal[]> {
  return of(SUCURSALES.filter(() => true)).pipe(delay(200));
}

/* ================================================================== */
/* MÓDULO HISTORIAL CLÍNICO (endpoints simulados)                       */
/* Contrato: HistorialClinicoController (.NET)                          */
/* ================================================================== */

/** Tabla Paciente -> PacienteResumen (calcula edad a partir de FechaNacimiento). */
function toResumen(p: Paciente): PacienteResumen {
  const nacimiento = new Date(p.fechaNacimiento);
  let edad = new Date().getFullYear() - nacimiento.getFullYear();
  const hoy = new Date();
  if (hoy.getMonth() < nacimiento.getMonth() ||
      (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate())) {
    edad--;
  }
  return {
    idPaciente: p.idPaciente,
    nombres: p.nombres,
    apellidos: p.apellidos,
    dpi: p.dpi,
    fechaNacimiento: p.fechaNacimiento,
    edadAnios: Math.max(edad, 0),
    sexo: p.sexo,
    telefono: p.telefono,
    correo: p.correo,
    activo: p.activo,
  };
}

/** Ficha del historial clínico: GET /api/HistorialClinico/{idPaciente} */
export function mockObtenerFichaHistorial(idPaciente: number): Observable<FichaHistorial> {
  const paciente = PACIENTES.find(p => p.idPaciente === idPaciente);
  if (!paciente) throw new Error(`Paciente ${idPaciente} no encontrado`);

  const consultas = CONSULTAS.filter(c => c.idPaciente === idPaciente)
    .sort((a, b) => b.fechaConsulta.localeCompare(a.fechaConsulta));
  const idsConsultas = consultas.map(c => c.idConsulta);

  return of({
    paciente: toResumen(paciente),
    consultas,
    // Diagnósticos/tratamientos vinculados a las consultas del paciente (FK IdConsulta)
    diagnosticos: DIAGNOSTICOS.filter(d => idsConsultas.includes(d.idConsulta))
      .sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro)),
    tratamientos: TRATAMIENTOS.filter(t => idsConsultas.includes(t.idConsulta))
      .sort((a, b) => b.fechaInicio.localeCompare(a.fechaInicio)),
    examenes: EXAMENES.filter(e => e.idPaciente === idPaciente)
      .sort((a, b) => b.fechaExamen.localeCompare(a.fechaExamen)),
    evoluciones: EVOLUCIONES.filter(e => e.idPaciente === idPaciente)
      .sort((a, b) => b.fechaEvolucion.localeCompare(a.fechaEvolucion)),
    habitaciones: HABITACIONES.filter(h => h.idPaciente === idPaciente),
  }).pipe(delay(DEMORA));
}

/** Listado global filtrable de consultas (inciso i). */
export function mockListarConsultas(filtro?: string): Observable<Consulta[]> {
  const q = (filtro ?? '').trim().toLowerCase();
  const lista = !q
    ? [...CONSULTAS]
    : CONSULTAS.filter(c =>
        `${c.medicoNombre} ${c.sucursalNombre} ${c.motivoConsulta ?? ''} ${c.sintomas ?? ''}`
          .toLowerCase().includes(q));
  return of(lista.sort((a, b) => b.fechaConsulta.localeCompare(a.fechaConsulta))).pipe(delay(DEMORA));
}

/** Registro de examen (tabla Examen): POST /api/HistorialClinico/Examenes */
export function mockRegistrarExamen(data: {
  idPaciente: number; idConsulta: number | null; idMedico: number;
  nombreExamen: string; fechaExamen: string; resultado: string;
}): Observable<Examen> {
  const med = MEDICOS.find(m => m.idEmpleado === data.idMedico);
  const nuevo: Examen = {
    idExamen: ++SEQ_EXAMEN,
    idPaciente: data.idPaciente,
    idConsulta: data.idConsulta,
    idMedico: data.idMedico,
    medicoNombre: med?.nombre ?? 'Médico',
    nombreExamen: data.nombreExamen,
    fechaExamen: data.fechaExamen,
    resultado: data.resultado || null,
  };
  EXAMENES.unshift(nuevo);
  return of(nuevo).pipe(delay(DEMORA));
}

/** Registro de evolución (tabla Evolucion): POST /api/HistorialClinico/Evoluciones */
export function mockRegistrarEvolucion(data: {
  idPaciente: number; idConsulta: number | null; idMedico: number;
  fechaEvolucion: string; descripcion: string;
}): Observable<Evolucion> {
  const med = MEDICOS.find(m => m.idEmpleado === data.idMedico);
  const nueva: Evolucion = {
    idEvolucion: ++SEQ_EVOLUCION,
    idPaciente: data.idPaciente,
    idConsulta: data.idConsulta,
    idMedico: data.idMedico,
    medicoNombre: med?.nombre ?? 'Médico',
    fechaEvolucion: data.fechaEvolucion,
    descripcion: data.descripcion,
  };
  EVOLUCIONES.unshift(nueva);
  return of(nueva).pipe(delay(DEMORA));
}

/** Edición de registros clínicos ya asignados (PUT genérico sobre arrays en memoria). */
export function mockActualizarClinical(kind: 'diagnostico' | 'examen' | 'evolucion',
                                       id: number,
                                       cambios: Record<string, unknown>): Observable<unknown> {
  if (kind === 'diagnostico') {
    const idx = DIAGNOSTICOS.findIndex(d => d.idDiagnostico === id);
    if (idx < 0) throw new Error(`Diagnóstico ${id} no encontrado`);
    DIAGNOSTICOS[idx] = { ...DIAGNOSTICOS[idx], ...cambios } as Diagnostico;
    return of(DIAGNOSTICOS[idx]).pipe(delay(DEMORA));
  }
  if (kind === 'examen') {
    const idx = EXAMENES.findIndex(e => e.idExamen === id);
    if (idx < 0) throw new Error(`Examen ${id} no encontrado`);
    EXAMENES[idx] = { ...EXAMENES[idx], ...cambios } as Examen;
    return of(EXAMENES[idx]).pipe(delay(DEMORA));
  }
  const idx = EVOLUCIONES.findIndex(e => e.idEvolucion === id);
  if (idx < 0) throw new Error(`Evolución ${id} no encontrada`);
  EVOLUCIONES[idx] = { ...EVOLUCIONES[idx], ...cambios } as Evolucion;
  return of(EVOLUCIONES[idx]).pipe(delay(DEMORA));
}

/** Catálogo de pacientes para el buscador del historial clínico. */
export function mockCatalogoPacientesResumen(): Observable<PacienteResumen[]> {
  return of(PACIENTES.filter(p => p.activo).map(toResumen)).pipe(delay(200));
}
