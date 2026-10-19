// ==========================================
// HABITACIONES
// ==========================================
export interface HabitacionResponse {
  idHabitacion: number;
  idSucursal: number;
  numeroHabitacion: string;
  tipoHabitacion: string | null;
  estado: string; // 'Libre', 'Ocupada', 'En limpieza'
  activa: boolean;
}

export interface CrearHabitacionRequest {
  idSucursal: number;
  numeroHabitacion: string;
  tipoHabitacion?: string | null;
}

export interface ActualizarHabitacionRequest {
  idSucursal: number;
  numeroHabitacion: string;
  tipoHabitacion?: string | null;
  estado?: string | null;
  activa?: boolean | null;
}

// ==========================================
// ASIGNACIONES
// ==========================================
export interface AsignacionHabitacionResponse {
  idAsignacion: number;
  idHabitacion: number;
  idPaciente: number;
  fechaIngreso: string; // DateTime ISO
  fechaEgreso: string | null;
  observaciones: string | null;
}

export interface CrearAsignacionHabitacionRequest {
  idHabitacion: number;
  idPaciente: number;
  fechaIngreso?: string | null; // DateTimeOffset ISO
  observaciones?: string | null;
}

export interface ActualizarAsignacionHabitacionRequest {
  fechaIngreso?: string | null;
  observaciones?: string | null;
}

// ==========================================
// CATEGORÍAS
// ==========================================
export type { CategoriaResponse } from './inventario.model';

// ==========================================
// GENÉRICO
// ==========================================
export type { PagedResponse } from './paged-response.model';

// ==========================================
// CONSTANTES DE ESTADO
// ==========================================
export const ESTADOS_HABITACION = {
  LIBRE: 'Libre',
  OCUPADA: 'Ocupada',
  EN_LIMPIEZA: 'En limpieza'
} as const;

export type EstadoHabitacion = typeof ESTADOS_HABITACION[keyof typeof ESTADOS_HABITACION];
