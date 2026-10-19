// 👇 Sucursales (coincide con SucursalResponse del backend)
export interface Sucursal {
  idSucursal: number;
  nombre: string;
  direccion?: string | null;
  telefono?: string | null;
  activa: boolean;
}

// 👇 Especialidades (coincide con EspecialidadResponse del backend)
export interface Especialidad {
  idEspecialidad: number;
  nombre: string;
  descripcion?: string | null;
  activa: boolean;
}

// 👇 Turnos (coincide con TurnoResponse del backend)
export interface Turno {
  idTurno: number;
  nombre: string;
  codigo: string;
  horaEntrada: string;
  horaSalida: string;
  jornada: string;
  activo: boolean;
}

// 👇 Respuesta paginada genérica (coincide con PagedResponse<T> del backend)
export interface PagedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}