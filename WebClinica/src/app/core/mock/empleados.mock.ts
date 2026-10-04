import { delay, Observable, of, throwError } from 'rxjs';
import {
  CatalogoEspecialidad,
  CatalogoSucursalSimple,
  Empleado,
  Rol,
} from '../models/empleado.model';

/**
 * Datos de prueba del módulo Empleados (Recursos Humanos).
 * Espejo de las tablas SQL: Sucursal, Especialidad, Empleado, Rol.
 * Se elimina cuando environment.useMockApi = false.
 */
let SEQ_EMPLEADO = 100;
let SEQ_ESPECIALIDAD = 100;

const HOY = new Date();
const fechaHora = (d: Date) => d.toISOString();
const diasAtras = (n: number) => {
  const d = new Date(HOY);
  d.setDate(d.getDate() - n);
  return d;
};

let SUCURSALES: CatalogoSucursalSimple[] = [
  { idSucursal: 1, nombre: 'Sucursal Central', activa: true },
  { idSucursal: 2, nombre: 'Sucursal Zona 10', activa: true },
  { idSucursal: 3, nombre: 'Sucursal Mixco', activa: true },
];

let ESPECIALIDADES: CatalogoEspecialidad[] = [
  { idEspecialidad: 1, nombre: 'Medicina General', activa: true },
  { idEspecialidad: 2, nombre: 'Cardiología', activa: true },
  { idEspecialidad: 3, nombre: 'Neurología', activa: true },
  { idEspecialidad: 4, nombre: 'Pediatría', activa: true },
  { idEspecialidad: 5, nombre: 'Ginecología y Obstetricia', activa: true },
  { idEspecialidad: 6, nombre: 'Traumatología', activa: true },
  { idEspecialidad: 7, nombre: 'Enfermería General', activa: true },
  { idEspecialidad: 8, nombre: 'Enfermería Quirúrgica', activa: true },
];

let ROLES: Rol[] = [
  { idRol: 1, nombre: 'ADMIN', descripcion: 'Administrador del sistema', activo: true },
  { idRol: 2, nombre: 'MEDICO', descripcion: 'Acceso a historial clínico', activo: true },
  { idRol: 3, nombre: 'ENFERMERIA', descripcion: 'Apoyo clínico y evoluciones', activo: true },
  { idRol: 4, nombre: 'FARMACIA', descripcion: 'Ventas e inventario', activo: true },
  { idRol: 5, nombre: 'RECEPCION', descripcion: 'Registro de pacientes y citas', activo: true },
];

let EMPLEADOS: Empleado[] = [
  {
    idEmpleado: 1, idSucursal: 1, sucursalNombre: 'Sucursal Central',
    idEspecialidad: 2, especialidadNombre: 'Cardiología',
    nombres: 'Juan Carlos', apellidos: 'Méndez Aguilar', dpi: '1234567800011',
    tipoEmpleado: 'Medico', telefono: '5551110001', correo: 'jmendez@clinica.com',
    fechaIngreso: fechaHora(diasAtras(900)), activo: true, roles: ['MEDICO'], numConsultas: 2,
  },
  {
    idEmpleado: 2, idSucursal: 2, sucursalNombre: 'Sucursal Zona 10',
    idEspecialidad: 1, especialidadNombre: 'Medicina General',
    nombres: 'Petra Sofía', apellidos: 'Ramos Gironz', dpi: '0987654300022',
    tipoEmpleado: 'Medico', telefono: '5551110002', correo: 'pramos@clinica.com',
    fechaIngreso: fechaHora(diasAtras(700)), activo: true, roles: ['MEDICO'], numConsultas: 1,
  },
  {
    idEmpleado: 3, idSucursal: 1, sucursalNombre: 'Sucursal Central',
    idEspecialidad: 3, especialidadNombre: 'Neurología',
    nombres: 'Luis Fernando', apellidos: 'Aguilar Solís', dpi: '1122334400033',
    tipoEmpleado: 'Medico', telefono: '5551110003', correo: 'laguilar@clinica.com',
    fechaIngreso: fechaHora(diasAtras(420)), activo: true, roles: ['MEDICO'], numConsultas: 1,
  },
  {
    idEmpleado: 4, idSucursal: 1, sucursalNombre: 'Sucursal Central',
    idEspecialidad: 7, especialidadNombre: 'Enfermería General',
    nombres: 'María Elena', apellidos: 'Cordón de López', dpi: '5566778800044',
    tipoEmpleado: 'Enfermera', telefono: '5551110004', correo: 'mcordon@clinica.com',
    fechaIngreso: fechaHora(diasAtras(365)), activo: true, roles: ['ENFERMERIA'], numConsultas: 0,
  },
  {
    idEmpleado: 5, idSucursal: 3, sucursalNombre: 'Sucursal Mixco',
    idEspecialidad: 8, especialidadNombre: 'Enfermería Quirúrgica',
    nombres: 'Kevin Alexander', apellidos: 'Batres Molina', dpi: '9988776600055',
    tipoEmpleado: 'Enfermera', telefono: '5551110005', correo: null,
    fechaIngreso: fechaHora(diasAtras(180)), activo: true, roles: ['ENFERMERIA'], numConsultas: 0,
  },
  {
    idEmpleado: 6, idSucursal: 1, sucursalNombre: 'Sucursal Central',
    idEspecialidad: null, especialidadNombre: null,
    nombres: 'Rosa Amelia', apellidos: 'Sacal de Monterroso', dpi: '4433221100066',
    tipoEmpleado: 'Administrativo', telefono: '5551110006', correo: 'rsacal@clinica.com',
    fechaIngreso: fechaHora(diasAtras(1200)), activo: true, roles: ['FARMACIA'], numConsultas: 0,
  },
  {
    idEmpleado: 7, idSucursal: 2, sucursalNombre: 'Sucursal Zona 10',
    idEspecialidad: null, especialidadNombre: null,
    nombres: 'Diego Armando', apellidos: 'Quiroa Villatoro', dpi: '7788990007788'.slice(0, 13),
    tipoEmpleado: 'Administrativo', telefono: '5551110007', correo: 'dquiroa@clinica.com',
    fechaIngreso: fechaHora(diasAtras(90)), activo: true, roles: ['RECEPCION'], numConsultas: 0,
  },
  {
    idEmpleado: 8, idSucursal: 1, sucursalNombre: 'Sucursal Central',
    idEspecialidad: null, especialidadNombre: null,
    nombres: 'Ana Beatriz', apellidos: 'Fuentes Castillo', dpi: '1010101000088',
    tipoEmpleado: 'Administrativo', telefono: '5551110008', correo: 'afuentes@clinica.com',
    fechaIngreso: fechaHora(diasAtras(1500)), activo: false, roles: ['ADMIN'], numConsultas: 0,
  },
];

/* ------------------------------------------------------------------ */
/* "Endpoints" simulados                                                */
/* ------------------------------------------------------------------ */

const DEMORA = 400;

export function mockListarEmpleados(filtro?: string): Observable<Empleado[]> {
  const q = (filtro ?? '').trim().toLowerCase();
  const lista = !q
    ? [...EMPLEADOS]
    : EMPLEADOS.filter(e =>
        `${e.nombres} ${e.apellidos} ${e.dpi} ${e.tipoEmpleado} ${e.sucursalNombre} ${e.especialidadNombre ?? ''}`
          .toLowerCase().includes(q));
  return of(lista).pipe(delay(DEMORA));
}

export function mockObtenerEmpleado(id: number): Observable<Empleado> {
  const e = EMPLEADOS.find(x => x.idEmpleado === id);
  if (!e) return throwError(() => new Error(`Empleado ${id} no encontrado`));
  return of({ ...e }).pipe(delay(DEMORA));
}

/** DPI único (constraint UNIQUE DPI del script SQL) */
function dpiDuplicado(dpi: string, idExcluir?: number): boolean {
  return EMPLEADOS.some(e => e.dpi === dpi && e.idEmpleado !== idExcluir);
}

export function mockCrearEmpleado(
  data: Omit<Empleado, 'idEmpleado' | 'sucursalNombre' | 'especialidadNombre' | 'roles' | 'numConsultas'>,
  rolesIds: number[],
): Observable<Empleado> {
  if (dpiDuplicado(data.dpi)) {
    return throwError(() => new Error('DPI duplicado'));
  }
  const nuevo: Empleado = {
    ...data,
    idEmpleado: ++SEQ_EMPLEADO,
    sucursalNombre: SUCURSALES.find(s => s.idSucursal === data.idSucursal)?.nombre ?? '—',
    especialidadNombre: data.idEspecialidad
      ? ESPECIALIDADES.find(s => s.idEspecialidad === data.idEspecialidad)?.nombre ?? null
      : null,
    roles: rolesIds.map(id => ROLES.find(r => r.idRol === id)?.nombre ?? '').filter(Boolean),
    numConsultas: 0,
  };
  EMPLEADOS = [nuevo, ...EMPLEADOS];
  return of(nuevo).pipe(delay(DEMORA));
}

export function mockActualizarEmpleado(
  id: number,
  data: Partial<Empleado>,
  rolesIds: number[],
): Observable<Empleado> {
  const idx = EMPLEADOS.findIndex(e => e.idEmpleado === id);
  if (idx < 0) return throwError(() => new Error(`Empleado ${id} no encontrado`));
  if (data.dpi && dpiDuplicado(data.dpi, id)) {
    return throwError(() => new Error('DPI duplicado'));
  }
  const merged: Empleado = {
    ...EMPLEADOS[idx],
    ...data,
    idEmpleado: id,
    sucursalNombre: SUCURSALES.find(s => s.idSucursal === (data.idSucursal ?? EMPLEADOS[idx].idSucursal))?.nombre
      ?? EMPLEADOS[idx].sucursalNombre,
    especialidadNombre: data.idEspecialidad === undefined
      ? EMPLEADOS[idx].especialidadNombre
      : (data.idEspecialidad
        ? ESPECIALIDADES.find(s => s.idEspecialidad === data.idEspecialidad)?.nombre ?? null
        : null),
    roles: rolesIds.map(r => ROLES.find(x => x.idRol === r)?.nombre ?? '').filter(Boolean),
  };
  EMPLEADOS[idx] = merged;
  return of({ ...merged }).pipe(delay(DEMORA));
}

/** Baja lógica: Empleado.Activo BIT = 0 */
export function mockDesactivarEmpleado(id: number): Observable<{ ok: boolean }> {
  const idx = EMPLEADOS.findIndex(e => e.idEmpleado === id);
  if (idx >= 0) EMPLEADOS[idx] = { ...EMPLEADOS[idx], activo: false };
  return of({ ok: true }).pipe(delay(DEMORA));
}

export function mockCatalogoSucursales(): Observable<CatalogoSucursalSimple[]> {
  return of(SUCURSALES.filter(s => s.activa)).pipe(delay(200));
}

export function mockCatalogoEspecialidades(): Observable<CatalogoEspecialidad[]> {
  return of(ESPECIALIDADES.filter(e => e.activa)).pipe(delay(200));
}

export function mockCatalogoRoles(): Observable<Rol[]> {
  return of(ROLES.filter(r => r.activo)).pipe(delay(200));
}

/** Alta de especialidad desde el catálogo (POST /api/Catalogos/especialidades) */
export function mockCrearEspecialidad(nombre: string): Observable<CatalogoEspecialidad> {
  const existe = ESPECIALIDADES.find(e => e.nombre.toLowerCase() === nombre.toLowerCase());
  if (existe) return throwError(() => new Error('Especialidad duplicada (UNIQUE)'));
  const nueva: CatalogoEspecialidad = { idEspecialidad: ++SEQ_ESPECIALIDAD, nombre, activa: true };
  ESPECIALIDADES = [...ESPECIALIDADES, nueva];
  return of(nueva).pipe(delay(200));
}

/** Estadísticas para los KPIs de la vista de Empleados */
export function mockResumenEmpleados(): Observable<{
  total: number; medicos: number; enfermeras: number; administrativos: number; inactivos: number;
}> {
  return of({
    total: EMPLEADOS.length,
    medicos: EMPLEADOS.filter(e => e.tipoEmpleado === 'Medico').length,
    enfermeras: EMPLEADOS.filter(e => e.tipoEmpleado === 'Enfermera').length,
    administrativos: EMPLEADOS.filter(e => e.tipoEmpleado === 'Administrativo').length,
    inactivos: EMPLEADOS.filter(e => !e.activo).length,
  }).pipe(delay(DEMORA));
}
