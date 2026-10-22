// Coincide con PacienteListadoResponse del backend
export interface PacienteListadoResponse {
  idPaciente: number;
  nombres: string;
  apellidos: string;
  activo: boolean;
}

// Coincide con PacienteResponse del backend
export interface PacienteResponse {
  idPaciente: number;
  nombres: string;
  apellidos: string;
  dpi?: string | null;
  fechaNacimiento: string; // DateOnly en C# → string en JSON (YYYY-MM-DD)
  genero?: string | null;
  telefono?: string | null;
  correo?: string | null;
  fechaRegistro: string;
  activo: boolean;
  tipoSangre?: string | null;
  nit?: string | null;
  nombreFacturacion?: string | null;
  direccion?: string | null;
  urlFoto?: string | null;
}

// Coincide con GuardarPacienteRequest del backend
export interface GuardarPacienteRequest {
  nombres: string;
  apellidos: string;
  dpi?: string | null;
  fechaNacimiento: string;
  genero?: string | null;
  telefono?: string | null;
  correo?: string | null;
  tipoSangre?: string | null;
  nit?: string | null;
  nombreFacturacion?: string | null;
  direccion?: string | null;
  /** Compatibilidad del DTO legado; la UI no debe enviarlo. La foto usa /pacientes/{id}/foto. */
  urlFoto?: string | null;
}

export interface FotoPacienteResponse {
  url: string;
}

// Respuesta paginada genérica
export type { PagedResponse } from './paged-response.model';
