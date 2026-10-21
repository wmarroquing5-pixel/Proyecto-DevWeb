export interface Sucursal {
  idSucursal: number;
  nombre: string;
  direccion: string | null;
  activa: boolean;
}

export interface GuardarSucursalRequest {
  nombre: string;
  direccion?: string | null;
  activa?: boolean | null;
}

export interface Especialidad {
  idEspecialidad: number;
  nombre: string;
  activa: boolean;
}

export interface GuardarEspecialidadRequest {
  nombre: string;
  activa?: boolean | null;
}

export const JORNADAS_TURNO = ['Diurna', 'Nocturna'] as const;
export type JornadaTurno = typeof JORNADAS_TURNO[number];

export interface Turno {
  idTurno: number;
  nombre: string;
  codigo: string;
  horaEntrada: string;
  horaSalida: string;
  jornada: JornadaTurno;
  activo: boolean;
}

export interface GuardarTurnoRequest {
  nombre: string;
  codigo: string;
  horaEntrada: string | null;
  horaSalida: string | null;
  jornada: JornadaTurno;
}

export const TIPOS_SERVICIO = [
  'Consulta',
  'Examen',
  'Habitacion',
  'Procedimiento',
  'Otro',
] as const;
export type TipoServicio = typeof TIPOS_SERVICIO[number];

export interface Servicio {
  idServicio: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  precioBase: number;
  tipoServicio: TipoServicio;
  activo: boolean;
}

export interface GuardarServicioRequest {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioBase: number;
  tipoServicio: TipoServicio;
}

export interface Clinica {
  idClinica: number;
  nombreClinica: string;
  especialidad: string | null;
  activa: boolean;
  idSucursal: number;
}

export interface GuardarClinicaRequest {
  nombreClinica: string;
  especialidad?: string | null;
  idSucursal: number;
}

export type { PagedResponse } from './paged-response.model';
