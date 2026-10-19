export interface UsuarioResponse {
  idUsuario: number;
  idRol: number;
  username: string;
  idEmpleado?: number | null;
  activo: boolean;
}

export interface CrearUsuarioRequest {
  username: string;
  password: string;
  idRol: number;
  idEmpleado?: number | null;
}

export interface ActualizarUsuarioRequest {
  username: string;
  idRol: number;
  idEmpleado?: number | null;
  activo: boolean;
}

export type { PagedResponse } from './paged-response.model';
