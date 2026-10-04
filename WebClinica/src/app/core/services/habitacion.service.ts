import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AsignacionHabitacion,
  AsignacionNueva,
  EgresoRegistro,
  EstadoHabitacion,
  Habitacion,
  HabitacionFormData,
  ResumenHabitaciones,
} from '../models/habitacion.model';
import {
  mockAsignarPaciente,
  mockActualizarHabitacion,
  mockCambiarEstado,
  mockCrearHabitacion,
  mockEliminarHabitacion,
  mockListarAsignaciones,
  mockListarHabitaciones,
  mockListarPacientesCatalogo,
  mockRegistrarEgreso,
  mockResumenHabitaciones,
} from '../mock/habitaciones.mock';
import { CatalogoSucursalSimple } from '../models/empleado.model';

/**
 * Servicio CRUD del módulo Habitaciones.
 * Contrato REST esperado del backend .NET (HabitacionesController):
 *
 *  GET    /api/Habitaciones?estado=&idSucursal=   -> Habitacion[] (con paciente asignado en JOIN)
 *  POST   /api/Habitaciones                       -> Habitacion            (inciso i: registro)
 *  PUT    /api/Habitaciones/{id}                  -> Habitacion            (edición datos generales)
 *  PATCH  /api/Habitaciones/{id}/Estado           -> Habitacion            (inciso i: control de estado)
 *  DELETE /api/Habitaciones/{id}                  -> baja lógica (Activa = 0)
 *  GET    /api/Habitaciones/Resumen               -> ResumenHabitaciones   (KPIs del semáforo)
 *  GET    /api/Habitaciones/Pacientes             -> PacienteCatalogo[]    (inciso iii)
 *  POST   /api/Habitaciones/{id}/AsignarPaciente  -> { habitacion, asignacion } (inciso iv;
 *         pone Estado='Ocupada' y crea AsignacionHabitacion con FechaIngreso)
 *  GET    /api/Asignaciones?filtro=&soloActivas=  -> AsignacionHabitacion[] (inciso v)
 *  PUT    /api/Asignaciones/{id}/Egreso           -> { habitacion, asignacion } (inciso v;
 *         fija FechaEgreso y mueve la habitación a 'En limpieza')
 *  GET    /api/Catalogos/sucursales               -> sucursales activas
 */
@Injectable({ providedIn: 'root' })
export class HabitacionService {
  private http = inject(HttpClient);

  readonly filtroEstado = signal<string>('');
  readonly filtroSucursal = signal<number>(0);

  listar(estado?: string, idSucursal?: number): Observable<Habitacion[]> {
    const e = estado ?? this.filtroEstado();
    const s = idSucursal ?? this.filtroSucursal();
    if (environment.useMockApi) return mockListarHabitaciones(e, s);
    return this.http.get<Habitacion[]>(`${environment.apiUrl}/Habitaciones`, {
      params: { ...(e ? { estado: e } : {}), ...(s ? { idSucursal: s } : {}) },
    });
  }

  resumen(): Observable<ResumenHabitaciones> {
    if (environment.useMockApi) return mockResumenHabitaciones();
    return this.http.get<ResumenHabitaciones>(`${environment.apiUrl}/Habitaciones/Resumen`);
  }

  crear(data: HabitacionFormData): Observable<Habitacion> {
    if (environment.useMockApi) return mockCrearHabitacion(data);
    return this.http.post<Habitacion>(`${environment.apiUrl}/Habitaciones`, data);
  }

  actualizar(id: number, data: HabitacionFormData): Observable<Habitacion> {
    if (environment.useMockApi) return mockActualizarHabitacion(id, data);
    return this.http.put<Habitacion>(`${environment.apiUrl}/Habitaciones/${id}`, data);
  }

  cambiarEstado(id: number, estado: EstadoHabitacion): Observable<Habitacion> {
    if (environment.useMockApi) return mockCambiarEstado(id, estado);
    return this.http.patch<Habitacion>(`${environment.apiUrl}/Habitaciones/${id}/Estado`, { estado });
  }

  eliminar(id: number): Observable<boolean> {
    if (environment.useMockApi) return mockEliminarHabitacion(id);
    return this.http.delete<boolean>(`${environment.apiUrl}/Habitaciones/${id}`);
  }

  pacientesCatalogo(): Observable<any[]> {
    if (environment.useMockApi) return mockListarPacientesCatalogo();
    return this.http.get<any[]>(`${environment.apiUrl}/Habitaciones/Pacientes`);
  }

  sucursales(): Observable<CatalogoSucursalSimple[]> {
    if (environment.useMockApi) {
      return new Observable(obs => {
        obs.next([
          { idSucursal: 1, nombre: 'Sucursal Central', activa: true },
          { idSucursal: 2, nombre: 'Sucursal Zona 10', activa: true },
          { idSucursal: 3, nombre: 'Sucursal Mixco', activa: true },
        ]);
        obs.complete();
      });
    }
    return this.http.get<CatalogoSucursalSimple[]>(`${environment.apiUrl}/Catalogos/sucursales`);
  }

  /** Inciso iv: asignar un paciente a una habitación libre. */
  asignarPaciente(idHabitacion: number, data: AsignacionNueva): Observable<{ habitacion: Habitacion; asignacion: AsignacionHabitacion }> {
    if (environment.useMockApi) return mockAsignarPaciente(idHabitacion, data);
    return this.http.post<{ habitacion: Habitacion; asignacion: AsignacionHabitacion }>(
      `${environment.apiUrl}/Habitaciones/${idHabitacion}/AsignarPaciente`,
      data,
    );
  }

  /** Inciso v: registrar egreso (FechaEgreso) y transición de estado. */
  registrarEgreso(idAsignacion: number, data: EgresoRegistro): Observable<{ habitacion: Habitacion; asignacion: AsignacionHabitacion }> {
    if (environment.useMockApi) return mockRegistrarEgreso(idAsignacion, data);
    return this.http.put<{ habitacion: Habitacion; asignacion: AsignacionHabitacion }>(
      `${environment.apiUrl}/Asignaciones/${idAsignacion}/Egreso`,
      data,
    );
  }

  listarAsignaciones(filtro: string, incluirEgresadas: boolean): Observable<AsignacionHabitacion[]> {
    if (environment.useMockApi) return mockListarAsignaciones(filtro, incluirEgresadas);
    return this.http.get<AsignacionHabitacion[]>(`${environment.apiUrl}/Asignaciones`, {
      params: { filtro, soloActivas: (!incluirEgresadas).toString() },
    });
  }

  formVacio(): HabitacionFormData {
    return { idSucursal: null, numeroHabitacion: '', tipoHabitacion: '', estado: 'Libre' };
  }
}
