// ==========================================
// CONSULTAS
// ==========================================
export interface ConsultaListadoDto {
  idConsulta: number;
  idPaciente: number;
  idMedico: number;
  idSucursal: number;
  idClinica: number | null;
  fechaConsulta: string; // ISO DateTime
}

export interface ConsultaDetalleDto extends ConsultaListadoDto {
  motivoConsulta: string | null;
  sintomas: string | null;
  observaciones: string | null;
  pesoLb: number | null;
  presionDiastolica: number | null;
  presionSistolica: number | null;
  alturaCm: number | null;
}

export interface ConsultaCreateDto {
  idPaciente: number;
  idMedico: number | null;
  idSucursal: number;
  idClinica: number | null;
  fechaConsulta: string;
  motivoConsulta: string | null;
  sintomas: string | null;
  observaciones: string | null;
  pesoLb: number | null;
  presionDiastolica: number | null;
  presionSistolica: number | null;
  alturaCm: number | null;
}

export interface ConsultaFiltroDto {
  idPaciente: number | null;
  idMedico: number | null;
  idSucursal: number | null;
  idClinica: number | null;
  desde: string | null;
  hasta: string | null;
  page: number;
  pageSize: number;
}

// ==========================================
// DIAGNÓSTICOS
// ==========================================
export interface DiagnosticoResponse {
  idDiagnostico: number;
  idConsulta: number;
  idMedico: number;
  descripcion: string;
  fechaRegistro: string;
}

export interface CrearDiagnosticoRequest {
  idConsulta: number;
  idMedico: number | null;
  descripcion: string;
}

export interface ActualizarDiagnosticoRequest {
  descripcion: string;
}

export interface DiagnosticoFiltroDto {
  idConsulta?: number | null;
  page: number;
  pageSize: number;
}

// ==========================================
// HISTORIAL MÉDICO / EVOLUCIONES
// ==========================================
export interface HistorialMedicoResponseDto {
  idHistorial?: number;
  idConsulta?: number | null;
  idDiagnostico?: number | null;
  idPaciente?: number | null;
  idMedico: number | null;
  fechaHistorial: string;
  descripcion: string;
}

export interface HistorialMedicoCreateDto {
  idPaciente: number;
  idConsulta: number;
  idDiagnostico: number | null;
  descripcion: string;
}

export interface HistorialMedicoFiltroDto {
  idConsulta?: number | null;
  idDiagnostico?: number | null;
  idPaciente?: number | null;
  page: number;
  pageSize: number;
}

// ==========================================
// TRATAMIENTOS
// ==========================================
export interface TratamientoResponseDto {
  idTratamiento: number;
  idConsulta: number;
  idPaciente: number;
  idMedico: number;
  descripcion: string;
  indicaciones: string | null;
  fechaInicio: string; // DateOnly "YYYY-MM-DD"
  fechaFin: string | null;
  idLote: number | null;
  cantidad: number | null;
}

export interface TratamientoCreateDto {
  idConsulta: number;
  descripcion: string;
  indicaciones: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  idLote: number | null;
  cantidad: number | null;
}

export interface TratamientoUpdateDto {
  descripcion: string;
  indicaciones: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  idLote: number | null;
  cantidad: number | null;
}

export interface TratamientoFiltroDto {
  idConsulta: number | null;
  page: number;
  pageSize: number;
}

// ==========================================
// EXÁMENES
// ==========================================
export interface ExamenResponseDto {
  idExamen: number;
  idConsulta: number | null;
  idDiagnostico: number | null;
  idTurno: number | null;
  nombreExamen: string;
  fechaExamen: string;
  fechaResultado: string | null;
  prioridad: string | null;
  idPaciente: number | null;
  idMedico: number | null;
}

export interface ExamenCreateDto {
  idConsulta: number | null;
  idDiagnostico: number | null;
  idTurno: number | null;
  nombreExamen: string;
  fechaExamen: string;
  fechaResultado: string | null;
  prioridad: string | null;
}

export interface ExamenUpdateDto {
  idTurno: number | null;
  nombreExamen: string;
  fechaExamen: string;
  fechaResultado: string | null;
  prioridad: string | null;
}

export interface ExamenFiltroDto {
  idConsulta?: number | null;
  idDiagnostico?: number | null;
  page: number;
  pageSize: number;
}

// ==========================================
// CONTACTO EMERGENCIA
// ==========================================
export interface ContactoEmergenciaResponseDto {
  idContacto: number;
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string;
  correoElectronico: string | null;
  parentesco: string | null;
  activo: boolean;
  idPaciente: number | null;
}

export interface ContactoEmergenciaCreateDto {
  nombres: string;
  apellidos: string;
  telefono: string;
  direccion: string;
  correoElectronico: string | null;
  parentesco: string | null;
  idPaciente: number | null;
}

export interface ContactoEmergenciaUpdateDto extends ContactoEmergenciaCreateDto {}

// ==========================================
// GENÉRICO
// ==========================================
export type { PagedResponse } from './paged-response.model';
