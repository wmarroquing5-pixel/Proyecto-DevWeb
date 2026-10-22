import { PagedResponse } from './paged-response.model';

export interface ContactoEmergenciaRequest {
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string;
  correoElectronico?: string | null;
  parentesco?: string | null;
  idPaciente: number;
}

export interface ContactoEmergenciaResponse extends ContactoEmergenciaRequest {
  idContacto: number;
  activo: boolean;
}

export type ContactosEmergenciaPagina = PagedResponse<ContactoEmergenciaResponse>;
