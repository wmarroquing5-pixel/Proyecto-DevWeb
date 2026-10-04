import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CatalogoEspecialidad,
  CatalogoSucursalSimple,
  Empleado,
  EmpleadoFormData,
  FichaEmpleado,
  ResumenEmpleados,
  Rol,
} from '../models/empleado.model';
import {
  mockActualizarEmpleado,
  mockCatalogoEspecialidades,
  mockCatalogoRoles,
  mockCatalogoSucursales,
  mockCrearEmpleado,
  mockCrearEspecialidad,
  mockDesactivarEmpleado,
  mockListarEmpleados,
  mockObtenerEmpleado,
  mockResumenEmpleados,
} from '../mock/empleados.mock';

/**
 * Servicio del módulo Empleados.
 * Contrato REST esperado del backend .NET (controlador EmpleadosController):
 *
 *  GET    /api/Empleados?filtro=&tipo=        -> Empleado[]      (registro de doctores, enfermeras y administrativos)
 *  GET    /api/Empleados/{id}                  -> Empleado
 *  GET    /api/Empleados/{id}/Ficha            -> FichaEmpleado   (datos + roles + actividad reciente)
 *  POST   /api/Empleados                        -> Empleado       (payload: Empleado + rolesIds[])
 *  PUT    /api/Empleados/{id}                   -> Empleado       (incluye re-asignación de especialidad y roles)
 *  DELETE /api/Empleados/{id}                   -> baja lógica (Activo = 0)
 *  GET    /api/Catalogos/sucursales             -> CatalogoSucursalSimple[]
 *  GET    /api/Catalogos/especialidades         -> CatalogoEspecialidad[]
 *  POST   /api/Catalogos/especialidades         -> CatalogoEspecialidad (nombre, UNIQUE)
 *  GET    /api/Catalogos/roles                  -> Rol[]           (tabla Rol)
 *  GET    /api/Empleados/Resumen                -> ResumenEmpleados
 */
@Injectable({ providedIn: 'root' })
export class EmpleadoService {

  private http = inject(HttpClient);

  /** Último filtro usado (se conserva al volver de la ficha) */
  readonly filtro = signal<string>('');
  /** Filtro por tipo de empleado ('' = todos) — CHK_Empleado_Tipo */
  readonly tipoFiltro = signal<string>('');

  /* ------------------------- Catálogos ------------------------- */

  sucursales(): Observable<CatalogoSucursalSimple[]> {
    if (environment.useMockApi) return mockCatalogoSucursales();
    return this.http.get<CatalogoSucursalSimple[]>(`${environment.apiUrl}/Catalogos/sucursales`);
  }

  especialidades(): Observable<CatalogoEspecialidad[]> {
    if (environment.useMockApi) return mockCatalogoEspecialidades();
    return this.http.get<CatalogoEspecialidad[]>(`${environment.apiUrl}/Catalogos/especialidades`);
  }

  crearEspecialidad(nombre: string): Observable<CatalogoEspecialidad> {
    if (environment.useMockApi) return mockCrearEspecialidad(nombre.trim());
    return this.http.post<CatalogoEspecialidad>(`${environment.apiUrl}/Catalogos/especialidades`, { nombre });
  }

  roles(): Observable<Rol[]> {
    if (environment.useMockApi) return mockCatalogoRoles();
    return this.http.get<Rol[]>(`${environment.apiUrl}/Catalogos/roles`);
  }

  resumen(): Observable<ResumenEmpleados> {
    if (environment.useMockApi) {
      return mockResumenEmpleados().pipe(map(r => ({
        total: r.total, medicos: r.medicos, enfermeras: r.enfermeras,
        administrativos: r.administrativos, inactivos: r.inactivos,
      })));
    }
    return this.http.get<ResumenEmpleados>(`${environment.apiUrl}/Empleados/Resumen`);
  }

  /* ---------------- i. Registro de empleados ------------------- */

  listar(filtro?: string, tipo?: string): Observable<Empleado[]> {
    const q = filtro ?? this.filtro();
    const t = tipo ?? this.tipoFiltro();
    if (environment.useMockApi) {
      return mockListarEmpleados(q).pipe(
        map(list => (t ? list.filter(e => e.tipoEmpleado === t) : list)),
      );
    }
    return this.http.get<Empleado[]>(`${environment.apiUrl}/Empleados`, {
      params: { ...(q ? { filtro: q } : {}), ...(t ? { tipo: t } : {}) },
    });
  }

  obtener(id: number): Observable<Empleado> {
    if (environment.useMockApi) return mockObtenerEmpleado(id);
    return this.http.get<Empleado>(`${environment.apiUrl}/Empleados/${id}`);
  }

  ficha(id: number): Observable<FichaEmpleado> {
    if (environment.useMockApi) {
      return mockObtenerEmpleado(id).pipe(
        map(e => ({ empleado: e, consultasRecientes: [] })),
      );
    }
    return this.http.get<FichaEmpleado>(`${environment.apiUrl}/Empleados/${id}/Ficha`);
  }

  crear(data: EmpleadoFormData): Observable<Empleado> {
    const payload = this.toEntity(data);
    if (environment.useMockApi) return mockCrearEmpleado(payload, data.rolesIds);
    return this.http.post<Empleado>(`${environment.apiUrl}/Empleados`, {
      ...payload, rolesIds: data.rolesIds,
    });
  }

  actualizar(id: number, data: EmpleadoFormData): Observable<Empleado> {
    const payload = this.toEntity(data);
    if (environment.useMockApi) return mockActualizarEmpleado(id, payload, data.rolesIds);
    return this.http.put<Empleado>(`${environment.apiUrl}/Empleados/${id}`, {
      ...payload, rolesIds: data.rolesIds,
    });
  }

  /** ii. Re-asignación puntual de roles dentro del sistema */
  asignarRoles(id: number, rolesIds: number[]): Observable<Empleado> {
    if (environment.useMockApi) return mockActualizarEmpleado(id, {}, rolesIds);
    return this.http.put<Empleado>(`${environment.apiUrl}/Empleados/${id}/roles`, { rolesIds });
  }

  desactivar(id: number): Observable<{ ok: boolean }> {
    if (environment.useMockApi) return mockDesactivarEmpleado(id);
    return this.http.delete<{ ok: boolean }>(`${environment.apiUrl}/Empleados/${id}`);
  }

  /* --------------------------- Helpers -------------------------- */

  /** Convierte el formulario a la entidad que espera la tabla Empleado */
  private toEntity(d: EmpleadoFormData): Omit<Empleado,
    'idEmpleado' | 'sucursalNombre' | 'especialidadNombre' | 'roles' | 'numConsultas'> {
    return {
      idSucursal: Number(d.idSucursal),
      idEspecialidad: d.idEspecialidad === '' ? null : Number(d.idEspecialidad),
      nombres: d.nombres.trim(),
      apellidos: d.apellidos.trim(),
      dpi: d.dpi.trim(),
      tipoEmpleado: d.tipoEmpleado as Empleado['tipoEmpleado'],
      telefono: d.telefono.trim() || null,
      correo: d.correo.trim() || null,
      fechaIngreso: d.fechaIngreso ? new Date(d.fechaIngreso).toISOString() : new Date().toISOString(),
      activo: d.activo,
    };
  }

  formVacio(): EmpleadoFormData {
    return {
      idSucursal: '', idEspecialidad: '', nombres: '', apellidos: '', dpi: '',
      tipoEmpleado: '', telefono: '', correo: '',
      fechaIngreso: new Date().toISOString().slice(0, 10),
      activo: true, rolesIds: [],
    };
  }

  formFromEmpleado(e: Empleado, roles: Rol[]): EmpleadoFormData {
    return {
      idSucursal: e.idSucursal,
      idEspecialidad: e.idEspecialidad ?? '',
      nombres: e.nombres, apellidos: e.apellidos, dpi: e.dpi,
      tipoEmpleado: e.tipoEmpleado,
      telefono: e.telefono ?? '', correo: e.correo ?? '',
      fechaIngreso: (e.fechaIngreso ?? '').slice(0, 10),
      activo: e.activo,
      rolesIds: e.roles.map(n => roles.find(r => r.nombre === n)?.idRol).filter((x): x is number => !!x),
    };
  }
}
