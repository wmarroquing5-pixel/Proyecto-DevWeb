/**
 * Modelos del módulo Pacientes.
 * Espejo 1:1 de las tablas del script SQL de la clínica:
 * Paciente, Consulta, Diagnostico, Tratamiento, Evolucion, Examen, AsignacionHabitacion.
 */

export type SexoPaciente = 'Masculino' | 'Femenino' | 'Otro';

/** Tabla Paciente */
export interface Paciente {
  idPaciente: number;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: string;      // DATE -> 'YYYY-MM-DD'
  sexo: SexoPaciente | null;
  telefono: string | null;
  correo: string | null;
  fechaRegistro: string;        // DATETIME2 (DEFAULT SYSUTCDATETIME())
  activo: boolean;
}

/** Formulario de registro / edición (sin campos autogenerados) */
export interface PacienteFormData {
  nombres: string;
  apellidos: string;
  dpi: string;
  fechaNacimiento: string;
  sexo: SexoPaciente | '';
  telefono: string;
  correo: string;
  activo: boolean;
}

export const SEXOS_OPCIONES: SexoPaciente[] = ['Masculino', 'Femenino', 'Otro'];

/* ------------------------------------------------------------------ */
/* HISTORIAL CLÍNICO                                                   */
/* ------------------------------------------------------------------ */

/** Tabla Consulta (IdMedico -> Empleado con TipoEmpleado = 'Medico') */
export interface Consulta {
  idConsulta: number;
  idPaciente: number;
  idMedico: number;
  medicoNombre: string;         // JOIN Empleado (Nombres + Apellidos)
  especialidad: string | null;  // JOIN Especialidad
  idSucursal: number;
  sucursalNombre: string;       // JOIN Sucursal
  fechaConsulta: string;
  motivoConsulta: string | null;
  sintomas: string | null;
  observaciones: string | null;
}

/** Tabla Diagnostico */
export interface Diagnostico {
  idDiagnostico: number;
  idConsulta: number;
  idMedico: number;
  medicoNombre: string;
  descripcion: string;
  fechaRegistro: string;
}

/** Tabla Tratamiento */
export interface Tratamiento {
  idTratamiento: number;
  idConsulta: number;
  idMedico: number;
  medicoNombre: string;
  descripcion: string;
  indicaciones: string | null;
  fechaInicio: string;
  fechaFin: string | null;
}

/** Tabla Evolucion */
export interface Evolucion {
  idEvolucion: number;
  idPaciente: number;
  idConsulta: number | null;
  idMedico: number;
  medicoNombre: string;
  fechaEvolucion: string;
  descripcion: string;
}

/** Tabla Examen */
export interface Examen {
  idExamen: number;
  idPaciente: number;
  idConsulta: number | null;
  idMedico: number;
  medicoNombre: string;
  nombreExamen: string;
  fechaExamen: string;
  resultado: string | null;
}

/** Tabla AsignacionHabitacion */
export interface AsignacionHabitacion {
  idAsignacion: number;
  idHabitacion: number;
  numeroHabitacion: string;     // JOIN Habitacion
  idSucursal: number;
  sucursalNombre: string;       // JOIN Sucursal
  idPaciente: number;
  fechaIngreso: string;
  fechaEgreso: string | null;
  observaciones: string | null;
}

/** Payload POST /api/Pacientes/{id}/Consultas */
export interface ConsultaNueva {
  idMedico: number;
  idSucursal: number;
  fechaConsulta: string;
  motivoConsulta: string;
  sintomas: string;
  observaciones: string;
}

/** Payload POST /api/Pacientes/{id}/Diagnosticos */
export interface DiagnosticoNuevo {
  idConsulta: number;
  idMedico: number;
  descripcion: string;
}

/** Payload POST /api/Pacientes/{id}/Tratamientos */
export interface TratamientoNuevo {
  idConsulta: number;
  idMedico: number;
  descripcion: string;
  indicaciones: string;
  fechaInicio: string;
  fechaFin: string;
}

/** Historial completo devuelto por GET /api/Pacientes/{id}/Historial */
export interface HistorialPaciente {
  paciente: Paciente;
  consultas: Consulta[];
  diagnosticos: Diagnostico[];
  tratamientos: Tratamiento[];
  evoluciones: Evolucion[];
  examenes: Examen[];
  habitaciones: AsignacionHabitacion[];
}

/** Catálogos necesarios para registrar una consulta (tablas Empleado/Sucursal/Especialidad) */
export interface CatalogoMedico {
  idEmpleado: number;
  nombre: string;
  especialidad: string | null;
}

export interface CatalogoSucursal {
  idSucursal: number;
  nombre: string;
}

/* ------------------------------------------------------------------ */
/* HISTORIAL CLÍNICO — Módulo independiente (consultas, exámenes,      */
/* diagnósticos, evoluciones). Espejo de las tablas 6 del script SQL.   */
/* ------------------------------------------------------------------ */

/** Datos generales del paciente para la ficha del historial clínico. */
export interface PacienteResumen {
  idPaciente: number;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  fechaNacimiento: string;
  edadAnios: number;
  sexo: string | null;
  telefono: string | null;
  correo: string | null;
  activo: boolean;
}

/** Ficha completa: GET /api/HistorialClinico/{idPaciente} */
export interface FichaHistorial {
  paciente: PacienteResumen;
  consultas: Consulta[];
  diagnosticos: Diagnostico[];
  tratamientos: Tratamiento[];
  examenes: Examen[];
  evoluciones: Evolucion[];
  habitaciones: AsignacionHabitacion[];
}

/** Filtros de la vista global "Historial clínico" (inciso i-iv). */
export interface HistorialFiltro {
  pacienteId: number | '';
  medicoId: number | '';
  desde: string; // 'YYYY-MM-DD'
  hasta: string;
  texto: string;
}

/** Payload POST /api/HistorialClinico/Examenes (tabla Examen). */
export interface ExamenNuevo {
  idPaciente: number;
  idConsulta: number | null;
  idMedico: number;
  nombreExamen: string;
  fechaExamen: string; // ISO datetime
  resultado: string;
}

/** Payload POST /api/HistorialClinico/Evoluciones (tabla Evolucion). */
export interface EvolucionNueva {
  idPaciente: number;
  idConsulta: number | null;
  idMedico: number;
  fechaEvolucion: string; // ISO datetime
  descripcion: string;
}

/** Payload PUT genérico para editar registros clínicos ya asignados. */
export interface ActualizacionClinica {
  [campo: string]: string | number | null;
}
