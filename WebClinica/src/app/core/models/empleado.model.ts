export interface Empleado {
  idEmpleado: number;
  idSucursal: number;
  idEspecialidad?: number | null;
  nombres: string;
  apellidos: string;
  dpi: string;
  tipoEmpleado: string;
  activo: boolean;
  fechaIngreso?: string | null;
  tipoSangre?: string | null;
  idTurno?: number | null;
  direccion?: string | null;
  telefono?: string | null;
  correoElectronico?: string | null;
}

export interface CrearEmpleadoRequest {
  idSucursal: number;
  idEspecialidad?: number | null;
  nombres: string;
  apellidos: string;
  dpi: string;
  tipoEmpleado: string;
  fechaIngreso?: string | null;
  tipoSangre?: string | null;
  idTurno?: number | null;
  direccion?: string | null;
  telefono?: string | null;
  correoElectronico?: string | null;
}

export interface ActualizarEmpleadoRequest {
  idSucursal: number;
  idEspecialidad?: number | null;
  nombres: string;
  apellidos: string;
  dpi: string;
  tipoEmpleado: string;
  fechaIngreso?: string | null;
  tipoSangre?: string | null;
  idTurno?: number | null;
  direccion?: string | null;
  telefono?: string | null;
  correoElectronico?: string | null;
  activo: boolean;
}

export interface EmpleadoListadoResponse {
  idEmpleado: number;
  nombres: string;
  apellidos: string;
  dpi: string;
  tipoEmpleado: string;
  activo: boolean;
  telefono?: string | null;
  correoElectronico?: string | null;
}

export interface EmpleadoDetalleResponse extends Empleado {}

export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

// 👇 INTERFACES DE CATÁLOGOS (Sucursales, Especialidades, Turnos)
export interface CatalogoSucursalSimple {
  idSucursal: number;
  nombre: string;
  activa?: boolean;  // 👈 AGREGAR ESTA LÍNEA
}

export interface CatalogoEspecialidadSimple {
  idEspecialidad: number;
  nombre: string;
  activa?: boolean;  // 👈 Opcional, por consistencia
}

export interface CatalogoTurnoSimple {
  idTurno: number;
  nombre: string;
  horaInicio?: string;
  horaFin?: string;
  activo?: boolean;  // 👈 Opcional, por consistencia
}