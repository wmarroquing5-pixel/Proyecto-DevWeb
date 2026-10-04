/**
 * Modelos del módulo Citas.
 *
 * NOTA DE DISEÑO: el script SQL base no incluye tabla de citas, por lo que se
 * agregó la tabla `Cita` siguiendo las mismas convenciones del resto del sistema
 * (IDENTITY PK, NVARCHAR, BIT Activo/estado con CHECK, FKs nombradas):
 *
 *   CREATE TABLE Cita (
 *       IdCita INT IDENTITY(1,1) PRIMARY KEY,
 *       IdPaciente INT NOT NULL REFERENCES Paciente(IdPaciente),
 *       IdMedico INT NOT NULL REFERENCES Empleado(IdEmpleado),      -- TipoEmpleado='Medico'
 *       IdSucursal INT NOT NULL REFERENCES Sucursal(IdSucursal),
 *       FechaCita DATETIME2 NOT NULL,
 *       DuracionMin INT NOT NULL CONSTRAINT CHK_Cita_Duracion CHECK (DuracionMin > 0),
 *       Motivo NVARCHAR(500) NULL,
 *       Estado NVARCHAR(20) NOT NULL CONSTRAINT CHK_Cita_Estado
 *           CHECK (Estado IN ('Programada','Confirmada','Atendida','Cancelada')),
 *       CONSTRAINT UQ_Cita_Medico_Horario UNIQUE (IdMedico, FechaCita)
 *   );
 *   -- Auditoría de cambios de estado en tiempo real
 *   CREATE TABLE CitaHistorial (
 *       IdCitaHistorial INT IDENTITY(1,1) PRIMARY KEY,
 *       IdCita INT NOT NULL REFERENCES Cita(IdCita),
 *       EstadoAnterior NVARCHAR(20) NULL,
 *       EstadoNuevo NVARCHAR(20) NOT NULL,
 *       IdUsuario INT NULL REFERENCES Usuario(IdUsuario),
 *       Fecha DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
 *       Observaciones NVARCHAR(500) NULL
 *   );
 */

/** Lista cerrada de estados (replica CHK_Cita_Estado) */
export type EstadoCita = 'Programada' | 'Confirmada' | 'Atendida' | 'Cancelada';

export const ESTADOS_CITA: EstadoCita[] = ['Programada', 'Confirmada', 'Atendida', 'Cancelada'];

export const ESTADO_CITA_LABEL: Record<EstadoCita, string> = {
  Programada: 'Programada',
  Confirmada: 'Confirmada',
  Atendida: 'Atendida',
  Cancelada: 'Cancelada',
};

/** Clases bootstrap para badges/tarjetas por estado */
export const ESTADO_CITA_CLASE: Record<EstadoCita, string> = {
  Programada: 'text-bg-warning',
  Confirmada: 'text-bg-primary',
  Atendida: 'text-bg-success',
  Cancelada: 'text-bg-danger',
};

/** Franjas horarias disponibles para agendar (recurso del médico) */
export const HORAS_DISPONIBLES: string[] = [
  '08:00', '09:00', '10:00', '11:00', '12:00',
  '14:00', '15:00', '16:00', '17:00', '18:00',
];

/** Tabla Cita (+ campos JOIN para la grilla) */
export interface Cita {
  idCita: number;
  idPaciente: number;
  pacienteNombre: string;        // JOIN Paciente (Nombres + Apellidos)
  idMedico: number;
  medicoNombre: string;          // JOIN Empleado (Nombres + Apellidos)
  especialidad: string | null;   // JOIN Especialidad del médico
  idSucursal: number;
  sucursalNombre: string;        // JOIN Sucursal
  fechaCita: string;             // DATETIME2 ISO ('YYYY-MM-DDTHH:mm:ss')
  duracionMin: number;           // CHK_Cita_Duracion > 0
  motivo: string | null;
  estado: EstadoCita;            // CHK_Cita_Estado
}

/** Formulario de programación (payload POST /api/Citas) */
export interface CitaFormData {
  idPaciente: number | null;
  idMedico: number | null;
  idSucursal: number | null;
  fecha: string;                 // 'YYYY-MM-DD' (input date)
  hora: string;                  // 'HH:mm' (select HORAS_DISPONIBLES)
  duracionMin: number;
  motivo: string;
}

/** Registro de cambio de estado (para el feed en tiempo real) */
export interface CitaEvento {
  idCita: number;
  pacienteNombre: string;
  medicoNombre: string;
  estadoAnterior: EstadoCita | null;
  estadoNuevo: EstadoCita;
  accion: 'CREADA' | 'CONFIRMADA' | 'ATENDIDA' | 'CANCELADA' | 'REPROGRAMADA';
  fechaHora: string;             // ISO
  usuario: string;               // Username que ejecutó el cambio
}

/** Conexión SignalR del CitasHub (inciso de actualización en tiempo real) */
export type { EstadoConexion } from './habitacion.model';

/** Payload PATCH /api/Citas/{id}/Estado */
export interface CambioEstadoCita {
  estado: EstadoCita;
  observaciones?: string;
}

/** KPIs del día (GET /api/Citas/Resumen) */
export interface ResumenCitas {
  totalHoy: number;
  programadas: number;
  confirmadas: number;
  atendidas: number;
  canceladas: number;
  ocupacionPct: number;          // % de franjas usadas hoy vs. capacidad
}

/** Agenda de un día: franja -> cita o libre */
export interface FranjaAgenda {
  hora: string;                  // 'HH:mm'
  disponible: boolean;
  cita: Cita | null;
}
