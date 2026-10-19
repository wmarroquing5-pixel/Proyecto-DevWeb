export const MODULOS_PERMISO = {
  PACIENTES: 'Pacientes',
  EMPLEADOS: 'Empleados',
  USUARIOS: 'Usuarios',
  ROLES: 'Roles',
  PERMISOS: 'Permisos',
  HABITACIONES: 'Habitaciones',
  ASIGNACIONES_HABITACION: 'AsignacionesHabitacion',
  CONSULTAS: 'Consultas',
  HISTORIAL: 'Historial',
  CONSUMO_CLINICO: 'ConsumoClinico',
  MEDICAMENTOS: 'Medicamentos',
  LOTES_MEDICAMENTO: 'LotesMedicamento',
  CATEGORIAS: 'Categorias',
  MARCAS: 'Marcas',
  VENTAS: 'Ventas',
  SUCURSALES: 'Sucursales',
  ESPECIALIDADES: 'Especialidades',
  TURNOS: 'Turnos',
  CITAS: 'Citas',
  REPORTES: 'Reportes',
} as const;

export const OPERACIONES_PERMISO = {
  CONSULTAR: 'Consultar',
  CREAR: 'Crear',
  MODIFICAR: 'Modificar',
  ELIMINAR: 'Eliminar',
} as const;

export type OperacionPermiso = typeof OPERACIONES_PERMISO[keyof typeof OPERACIONES_PERMISO];
export type EstadoPermisos = 'no-cargados' | 'cargando' | 'cargados' | 'error';

export interface PermisoActual {
  idPermiso: number;
  modulo: string;
  puedeConsultar: boolean;
  puedeCrear: boolean;
  puedeModificar: boolean;
  puedeEliminar: boolean;
}

export interface PermisoRequerido {
  modulo: string;
  operacion: OperacionPermiso;
}
