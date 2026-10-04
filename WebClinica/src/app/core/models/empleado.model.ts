/**
 * Modelos del módulo Empleados (Recursos Humanos y Seguridad).
 * Espejo 1:1 de las tablas del script SQL de la clínica:
 *   Empleado, Rol, Sucursal, Especialidad (+ Usuario para la asignación de roles).
 */

/**
 * Constraint CHK_Empleado_Tipo del script SQL: lista cerrada de tipos.
 * 'Medico' -> doctores, 'Enfermera' -> personal de enfermería,
 * 'Administrativo' -> personal administrativo (recepción, farmacia, TI…).
 */
export type TipoEmpleado = 'Medico' | 'Enfermera' | 'Administrativo';

export const TIPOS_EMPLEADO: TipoEmpleado[] = ['Medico', 'Enfermera', 'Administrativo'];

/** Etiquetas legibles para la UI (el valor guardado en BD es el del CHECK) */
export const TIPO_EMPLEADO_LABEL: Record<TipoEmpleado, string> = {
  Medico: 'Doctor(a)',
  Enfermera: 'Enfermero(a)',
  Administrativo: 'Administrativo',
};

/** Tabla Empleado (+ columnas derivadas de JOIN para la grilla) */
export interface Empleado {
  idEmpleado: number;
  idSucursal: number;                 // FK NOT NULL -> Sucursal
  sucursalNombre: string;             // JOIN Sucursal
  idEspecialidad: number | null;      // FK NULL -> Especialidad (obligatoria para Médicos)
  especialidadNombre: string | null;  // JOIN Especialidad
  nombres: string;                    // NVARCHAR(100) NOT NULL
  apellidos: string;                  // NVARCHAR(100) NOT NULL
  dpi: string;                        // NVARCHAR(20) NOT NULL UNIQUE
  tipoEmpleado: TipoEmpleado;         // CHECK (TipoEmpleado IN ('Medico','Enfermera','Administrativo'))
  telefono: string | null;            // Campo sugerido (ampliación de la tabla base)
  correo: string | null;              // Campo sugerido (ampliación de la tabla base)
  fechaIngreso: string;               // Campo sugerido: antigüedad del colaborador
  activo: boolean;                    // BIT NOT NULL DEFAULT 1 (baja lógica)
  /** Roles del sistema asignados al empleado (Usuario.IdRol -> Rol, vía Usuario.IdEmpleado) */
  roles: string[];
  /** Consultas atendidas (Consulta.IdMedico) — solo médicos; trazabilidad en la ficha */
  numConsultas: number;
}

/** Formulario de registro / edición (sin campos autogenerados ni derivados) */
export interface EmpleadoFormData {
  idSucursal: number | '';
  idEspecialidad: number | '';
  nombres: string;
  apellidos: string;
  dpi: string;
  tipoEmpleado: TipoEmpleado | '';
  telefono: string;
  correo: string;
  fechaIngreso: string;
  activo: boolean;
  /** ids de Rol seleccionados (multi-selección dentro del sistema) */
  rolesIds: number[];
}

/* ------------------------------------------------------------------ */
/* CATÁLOGOS Y SEGURIDAD                                               */
/* ------------------------------------------------------------------ */

/** Tabla Rol (Nombre UNIQUE + Activo) */
export interface Rol {
  idRol: number;
  nombre: string;
  descripcion: string;    // Descripción funcional del rol (campo de apoyo para la UI)
  activo: boolean;
}

/** Tabla Especialidad (Nombre UNIQUE + Activa) */
export interface CatalogoEspecialidad {
  idEspecialidad: number;
  nombre: string;
  activa: boolean;
}

/** Tabla Sucursal (versión reducida para combos) */
export interface CatalogoSucursalSimple {
  idSucursal: number;
  nombre: string;
  activa: boolean;
}

/** Resumen de RR.HH. para los KPIs de la vista */
export interface ResumenEmpleados {
  total: number;
  medicos: number;
  enfermeras: number;
  administrativos: number;
  inactivos: number;
}

/** Ficha del empleado: datos generales + especialidad/roles + actividad reciente */
export interface FichaEmpleado {
  empleado: Empleado;
  /** Consultas atendidas (tabla Consulta WHERE IdMedico = IdEmpleado) */
  consultasRecientes: {
    idConsulta: number;
    idPaciente: number;
    pacienteNombre: string;
    sucursalNombre: string;
    fechaConsulta: string;
    motivoConsulta: string | null;
  }[];
}
