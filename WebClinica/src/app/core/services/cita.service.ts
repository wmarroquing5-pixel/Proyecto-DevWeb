import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Cita,
  CitaFormData,
  EstadoCita,
  FranjaAgenda,
  ResumenCitas,
} from '../models/cita.model';
import {
  mockAgenda,
  mockCambiarEstado,
  mockCatalogoMedicos,
  mockCatalogoPacientes,
  mockCrearCita,
  mockListarCitas,
  mockReprogramar,
  mockResumenCitas,
} from '../mock/citas.mock';

/**
 * Servicio del módulo Citas.
 * Contrato REST esperado del backend .NET (CitasController):
 *
 *  GET    /api/Citas?fecha=&estado=            -> Cita[]           (agenda por día)
 *  GET    /api/Citas/Resumen?fecha=            -> ResumenCitas     (KPIs)
 *  GET    /api/Citas/Agenda?fecha=&idMedico=   -> FranjaAgenda[]   (disponibilidad por franjas)
 *  POST   /api/Citas                            -> Cita             (programación; valida UNIQUE médico-horario)
 *  PUT    /api/Citas/{id}                       -> Cita             (reprogramación fecha/hora/motivo)
 *  PATCH  /api/Citas/{id}/Estado                -> Cita             (Confirmada/Atendida/Cancelada + auditoría)
 *  GET    /api/Catalogos/pacientes              -> { idPaciente, nombre }[]
 *  GET    /api/Catalogos/medicos                -> { idEmpleado, nombre, especialidad, idSucursal }[]
 */
@Injectable({ providedIn: 'root' })
export class CitaService {

  private http = inject(HttpClient);

  listar(fecha?: string, estado?: EstadoCita | ''): Observable<Cita[]> {
    if (environment.useMockApi) return mockListarCitas(fecha, estado || undefined);
    const params: Record<string, string> = {};
    if (fecha) params['fecha'] = fecha;
    if (estado) params['estado'] = estado;
    return this.http.get<Cita[]>(`${environment.apiUrl}/Citas`, { params });
  }

  resumen(fecha: string): Observable<ResumenCitas> {
    if (environment.useMockApi) return mockResumenCitas(fecha);
    return this.http.get<ResumenCitas>(`${environment.apiUrl}/Citas/Resumen`, {
      params: { fecha },
    });
  }

  agenda(fecha: string, idMedico: number): Observable<FranjaAgenda[]> {
    if (environment.useMockApi) return mockAgenda(fecha, idMedico);
    return this.http.get<FranjaAgenda[]>(`${environment.apiUrl}/Citas/Agenda`, {
      params: { fecha, idMedico: String(idMedico) },
    });
  }

  crear(data: CitaFormData): Observable<Cita> {
    if (environment.useMockApi) return mockCrearCita(data);
    return this.http.post<Cita>(`${environment.apiUrl}/Citas`, data);
  }

  cambiarEstado(id: number, estado: EstadoCita, observaciones?: string): Observable<Cita> {
    if (environment.useMockApi) return mockCambiarEstado(id, estado, observaciones);
    return this.http.patch<Cita>(`${environment.apiUrl}/Citas/${id}/Estado`, { estado, observaciones });
  }

  reprogramar(id: number, data: Pick<CitaFormData, 'fecha' | 'hora' | 'motivo'>): Observable<Cita> {
    if (environment.useMockApi) return mockReprogramar(id, data);
    return this.http.put<Cita>(`${environment.apiUrl}/Citas/${id}`, data);
  }

  pacientes(): Observable<{ idPaciente: number; nombre: string }[]> {
    if (environment.useMockApi) return mockCatalogoPacientes();
    return this.http.get<{ idPaciente: number; nombre: string }[]>(
      `${environment.apiUrl}/Catalogos/pacientes`);
  }

  medicos(): Observable<
    { idEmpleado: number; nombre: string; especialidad: string; idSucursal: number }[]
  > {
    if (environment.useMockApi) return mockCatalogoMedicos();
    return this.http.get(
      `${environment.apiUrl}/Catalogos/medicos`) as Observable<
      { idEmpleado: number; nombre: string; especialidad: string; idSucursal: number }[]
    >;
  }
}
