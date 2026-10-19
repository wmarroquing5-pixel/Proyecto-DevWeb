import { PagedResponse } from './paged-response.model';

export interface RolResponse {
  idRol: number;
  nombre: string;
  activo: boolean;
}

export interface GuardarRolRequest {
  nombre: string;
  activo: boolean;
}

export interface PermisoRolResponse {
  idPermiso: number;
  idRol: number;
  modulo: string;
  puedeConsultar: boolean;
  puedeCrear: boolean;
  puedeModificar: boolean;
  puedeEliminar: boolean;
}

export interface GuardarPermisoRolRequest {
  idRol: number;
  modulo: string;
  puedeConsultar: boolean;
  puedeCrear: boolean;
  puedeModificar: boolean;
  puedeEliminar: boolean;
}

export type { PagedResponse };
