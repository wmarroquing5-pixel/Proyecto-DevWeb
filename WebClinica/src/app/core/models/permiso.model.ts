export const MODULOS_PERMISO = {
  ASIGNACIONES_HABITACION: 'AsignacionesHabitacion',
  CATEGORIAS: 'Categorias',
  CLINICAS: 'Clinicas',
  CONSULTAS: 'Consultas',
  CONSUMO_CLINICO: 'ConsumoClinico',
  CONTACTOS_EMERGENCIA: 'ContactosEmergencia',
  EMPLEADOS: 'Empleados',
  ESPECIALIDADES: 'Especialidades',
  FACTURAS: 'Facturas',
  HABITACIONES: 'Habitaciones',
  HISTORIAL: 'Historial',
  LOTES_MEDICAMENTO: 'LotesMedicamento',
  MARCAS: 'Marcas',
  MEDICAMENTOS: 'Medicamentos',
  PACIENTES: 'Pacientes',
  PERMISOS: 'Permisos',
  ROLES: 'Roles',
  SERVICIOS: 'Servicios',
  SUCURSALES: 'Sucursales',
  TURNOS: 'Turnos',
  USUARIOS: 'Usuarios',
  VENTAS: 'Ventas',
} as const;

export type ModuloPermiso = typeof MODULOS_PERMISO[keyof typeof MODULOS_PERMISO];

export const MODULOS_PERMISO_CANONICOS = Object.freeze(
  Object.values(MODULOS_PERMISO),
) as readonly ModuloPermiso[];

export const OPERACIONES_PERMISO = {
  CONSULTAR: 'Consultar',
  CREAR: 'Crear',
  MODIFICAR: 'Modificar',
  ELIMINAR: 'Eliminar',
} as const;

export type OperacionPermiso = typeof OPERACIONES_PERMISO[keyof typeof OPERACIONES_PERMISO];
export type EstadoPermisos = 'no-cargados' | 'cargando' | 'cargados' | 'error';

const CAME_COMPLETO: readonly OperacionPermiso[] = Object.freeze([
  OPERACIONES_PERMISO.CONSULTAR,
  OPERACIONES_PERMISO.CREAR,
  OPERACIONES_PERMISO.MODIFICAR,
  OPERACIONES_PERMISO.ELIMINAR,
]);

export const OPERACIONES_POR_MODULO: Readonly<Record<ModuloPermiso, readonly OperacionPermiso[]>> = {
  AsignacionesHabitacion: CAME_COMPLETO,
  Categorias: CAME_COMPLETO,
  Clinicas: CAME_COMPLETO,
  Consultas: [OPERACIONES_PERMISO.CONSULTAR, OPERACIONES_PERMISO.CREAR, OPERACIONES_PERMISO.MODIFICAR],
  ConsumoClinico: [OPERACIONES_PERMISO.CREAR],
  ContactosEmergencia: CAME_COMPLETO,
  Empleados: CAME_COMPLETO,
  Especialidades: CAME_COMPLETO,
  Facturas: [OPERACIONES_PERMISO.CONSULTAR, OPERACIONES_PERMISO.CREAR],
  Habitaciones: CAME_COMPLETO,
  Historial: [OPERACIONES_PERMISO.CONSULTAR, OPERACIONES_PERMISO.CREAR, OPERACIONES_PERMISO.MODIFICAR],
  LotesMedicamento: CAME_COMPLETO,
  Marcas: CAME_COMPLETO,
  Medicamentos: CAME_COMPLETO,
  Pacientes: CAME_COMPLETO,
  Permisos: CAME_COMPLETO,
  Roles: CAME_COMPLETO,
  Servicios: CAME_COMPLETO,
  Sucursales: CAME_COMPLETO,
  Turnos: CAME_COMPLETO,
  Usuarios: CAME_COMPLETO,
  Ventas: [OPERACIONES_PERMISO.CONSULTAR, OPERACIONES_PERMISO.CREAR],
};

const ETIQUETAS_MODULO: Readonly<Record<ModuloPermiso, string>> = {
  AsignacionesHabitacion: 'Asignaciones de habitación',
  Categorias: 'Categorías',
  Clinicas: 'Clínicas',
  Consultas: 'Consultas',
  ConsumoClinico: 'Consumo clínico',
  ContactosEmergencia: 'Contactos de emergencia',
  Empleados: 'Empleados',
  Especialidades: 'Especialidades',
  Facturas: 'Facturas',
  Habitaciones: 'Habitaciones',
  Historial: 'Historial médico',
  LotesMedicamento: 'Lotes de medicamento',
  Marcas: 'Marcas',
  Medicamentos: 'Medicamentos',
  Pacientes: 'Pacientes',
  Permisos: 'Permisos',
  Roles: 'Roles',
  Servicios: 'Servicios',
  Sucursales: 'Sucursales',
  Turnos: 'Turnos',
  Usuarios: 'Usuarios',
  Ventas: 'Ventas',
};

export function esModuloPermiso(value: string): value is ModuloPermiso {
  return MODULOS_PERMISO_CANONICOS.includes(value as ModuloPermiso);
}

export function etiquetaModuloPermiso(modulo: string): string {
  return esModuloPermiso(modulo) ? ETIQUETAS_MODULO[modulo] : modulo;
}

export function operacionDisponible(modulo: string, operacion: OperacionPermiso): boolean {
  return esModuloPermiso(modulo) && OPERACIONES_POR_MODULO[modulo].includes(operacion);
}

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
