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
  estadoConsulta?: string | null;
  motivoConsulta?: string | null;
  nombrePaciente?: string | null;
  nombreMedico?: string | null;
  nombreSucursal?: string | null;
  nombreClinica?: string | null;
}

export interface ConsultaDetalleDto extends ConsultaListadoDto {
  motivoConsulta: string | null;
  sintomas: string | null;
  observaciones: string | null;
  pesoLb: number | null;
  presionDiastolica: number | null;
  presionSistolica: number | null;
  alturaCm: number | null;
  temperaturaC?: number | null;
  frecuenciaCardiaca?: number | null;
}

export interface RegistrarEvaluacionConsultaRequest {
  sintomas: string | null;
  observaciones: string | null;
  pesoLb: number | null;
  alturaCm: number | null;
  presionSistolica: number | null;
  presionDiastolica: number | null;
  temperaturaC: number | null;
  frecuenciaCardiaca: number | null;
}

export interface ConsultaCreateDto {
  idPaciente: number;
  idMedico: number | null;
  idSucursal: number;
  idClinica: number | null;
  fechaConsulta: string;
  motivoConsulta?: string | null;
}

export interface ConsultaUpdateDto extends ConsultaCreateDto {
  motivoConsulta: string | null;
  sintomas: string | null;
  observaciones: string | null;
  pesoLb: number | null;
  presionDiastolica: number | null;
  presionSistolica: number | null;
  alturaCm: number | null;
  temperaturaC?: number | null;
  frecuenciaCardiaca?: number | null;
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

export interface CrearDiagnosticoConExamenRequest extends CrearDiagnosticoRequest {
  idExamen: number;
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

export interface RecetaLineaCrearRequest {
  idMedicamento: number;
  cantidadPrescritaUnidades: number;
}

export interface CrearRecetaClinicaRequest {
  idConsulta: number;
  idDiagnostico: number;
  claveOperacion: string;
  descripcionTratamiento: string;
  indicacionesGenerales: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  lineas: RecetaLineaCrearRequest[];
}

export interface RecetaLineaDetalleDto extends RecetaLineaCrearRequest {
  idRecetaLinea: number;
  orden: number;
  nombreMedicamento: string;
  presentacion: string;
}

export interface RecetaClinicaDetalleDto {
  idReceta: number;
  idConsulta: number;
  idTratamiento: number;
  descripcionTratamiento: string;
  indicacionesGenerales: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  idDiagnostico: number;
  descripcionDiagnostico: string;
  numeroVersion: number;
  estado: string;
  idUsuarioPrescriptor: number;
  fechaPrescripcionUtc: string;
  lineas: RecetaLineaDetalleDto[];
}

export interface RecetaClinicaResumenDto {
  idReceta: number;
  idConsulta: number;
  idTratamiento: number;
  descripcionTratamiento: string;
  fechaInicio: string;
  fechaFin: string | null;
  idDiagnostico: number;
  descripcionDiagnostico: string;
  numeroVersion: number;
  estado: string;
  fechaPrescripcionUtc: string;
  cantidadLineas: number;
}

export interface ConsumoClinicoCreateDto {
  cantidad: number;
}

export interface ConsumoClinicoResponseDto {
  idMovimiento: number;
  idTratamiento: number;
  idLote: number;
  cantidad: number;
  idSucursal: number;
  fechaMovimiento: string;
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

export interface ExamResultFileDto {
  archivoId: string;
  nombreOriginal: string;
  tipoContenido: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp';
  tamanoBytes: number;
  fechaCargaUtc: string;
  idUsuarioCarga: number;
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
