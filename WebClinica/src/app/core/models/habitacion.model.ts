/**
 * Modelos del módulo Habitaciones.
 * Espejo 1:1 del diseño SQL:
 *
 *  Habitacion(IdHabitacion, IdSucursal FK, NumeroHabitacion, TipoHabitacion,
 *             Estado CHECK IN ('Libre','Ocupada','En limpieza'), Activa)
 *  AsignacionHabitacion(IdAsignacion, IdHabitacion FK, IdPaciente FK,
 *                       FechaIngreso, FechaEgreso NULL, Observaciones)
 */

/** Lista cerrada de estados (CHK_Habitacion_Estado en la tabla Habitacion). */
export type EstadoHabitacion = 'Libre' | 'Ocupada' | 'En limpieza';

export const ESTADOS_HABITACION: EstadoHabitacion[] = ['Libre', 'Ocupada', 'En limpieza'];

export const ESTADO_HABITACION_LABEL: Record<EstadoHabitacion, string> = {
  Libre: 'Libre',
  Ocupada: 'Ocupada',
  'En limpieza': 'En limpieza',
};

/** Colores/íconos por estado para el tablero visual. */
export const ESTADO_HABITACION_UI: Record<EstadoHabitacion, { icono: string; css: string }> = {
  Libre: { icono: 'bi bi-door-open', css: 'estado-libre' },
  Ocupada: { icono: 'bi bi-person-walking', css: 'estado-ocupada' },
  'En limpieza': { icono: 'bi bi-bucket', css: 'estado-limpieza' },
};

/** Tabla Habitacion (+ datos agregados de la asignación activa). */
export interface Habitacion {
  idHabitacion: number;          // Habitacion.IdHabitacion
  idSucursal: number;            // FK -> Sucursal
  sucursalNombre: string;        // JOIN Sucursal.Nombre
  numeroHabitacion: string;      // Habitacion.NumeroHabitacion
  tipoHabitacion: string | null; // Habitacion.TipoHabitacion
  estado: EstadoHabitacion;      // Habitacion.Estado (CHECK cerrado)
  activa: boolean;               // Habitacion.Activa (baja lógica)
  // --- Agregados de AsignacionHabitacion con FechaEgreso NULL ---
  idAsignacionActiva: number | null;
  idPaciente: number | null;
  pacienteNombre: string | null; // Paciente.Nombres + Apellidos
  fechaIngreso: string | null;   // DATETIME2
}

/** Tabla AsignacionHabitacion (control de fechas ingreso/egreso). */
export interface AsignacionHabitacion {
  idAsignacion: number;
  idHabitacion: number;
  habitacionNumero: string;
  sucursalNombre: string;
  idPaciente: number;
  pacienteNombre: string;
  fechaIngreso: string;
  fechaEgreso: string | null;
  observaciones: string | null;
  diasEstancia: number; // calculado (hasta egreso o hoy)
}

/** Formulario de registro/edición de habitación (inciso i). */
export interface HabitacionFormData {
  idSucursal: number | null;
  numeroHabitacion: string;
  tipoHabitacion: string;
  estado: EstadoHabitacion;
}

/** Payload POST /api/Habitaciones/{id}/AsignarPaciente (incisos iii-iv-v). */
export interface AsignacionNueva {
  idPaciente: number;
  fechaIngreso: string; // ISO datetime
  observaciones: string;
}

/** Payload PUT /api/Asignaciones/{id}/Egreso (inciso v). */
export interface EgresoRegistro {
  fechaEgreso: string; // ISO datetime
  destinoEstado: EstadoHabitacion; // normalmente 'En limpieza'
  observaciones: string;
}

/** Catálogo de pacientes habilitados para asignar. */
export interface PacienteCatalogo {
  idPaciente: number;
  nombres: string;
  apellidos: string;
  dpi: string | null;
  /** Habitación ocupada actualmente (si aplica), para advertir al usuario. */
  habitacionActual: string | null;
}

/** KPIs del semáforo de habitaciones. */
export interface ResumenHabitaciones {
  total: number;
  libres: number;
  ocupadas: number;
  enLimpieza: number;
  ocupacionPct: number;
}

/** Evento en tiempo real recibido por SignalR (Hub HabitacionesHub). */
export interface HabitacionEvent {
  tipoEvento: 'estado' | 'asignacion' | 'egreso' | 'alta' | 'edicion' | 'baja';
  idHabitacion: number;
  habitacionNumero: string;
  sucursalNombre: string;
  estadoAnterior: EstadoHabitacion | null;
  estadoNuevo: EstadoHabitacion;
  pacienteNombre: string | null;
  mensaje: string;
  fechaHora: string;
  usuarioOrigen: string;
}

/** Estado de la conexión en tiempo real (para el indicador del tablero). */
export type EstadoConexion = 'desconectado' | 'conectando' | 'conectado' | 'error';

export const ESTADO_CONEXION_LABEL: Record<EstadoConexion, string> = {
  desconectado: 'Sin conexión',
  conectando: 'Conectando…',
  conectado: 'Tiempo real activo',
  error: 'Reintentando…',
};
