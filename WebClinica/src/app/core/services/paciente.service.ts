import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CatalogoMedico,
  CatalogoSucursal,
  Consulta,
  ConsultaNueva,
  Diagnostico,
  DiagnosticoNuevo,
  HistorialPaciente,
  Paciente,
  PacienteFormData,
  Tratamiento,
  TratamientoNuevo,
} from '../models/paciente.model';
import {
  mockActualizarPaciente,
  mockCatalogoMedicos,
  mockCatalogoSucursales,
  mockCrearPaciente,
  mockEliminarPaciente,
  mockListarPacientes,
  mockObtenerHistorial,
  mockObtenerPaciente,
  mockRegistrarConsulta,
  mockRegistrarDiagnostico,
  mockRegistrarTratamiento,
} from '../mock/pacientes.mock';

/**
 * Servicio del módulo Pacientes.
 * Contrato REST esperado del backend .NET (controlador PacientesController):
 *
 *  GET    /api/Pacientes?filtro=            -> Paciente[]
 *  GET    /api/Pacientes/{id}               -> Paciente
 *  POST   /api/Pacientes                    -> Paciente            (registro de datos generales)
 *  PUT    /api/Pacientes/{id}               -> Paciente
 *  DELETE /api/Pacientes/{id}               -> baja lógica (Activo = 0)
 *  GET    /api/Pacientes/{id}/Historial     -> HistorialPaciente   (consultas + tratamientos vinculados)
 *  POST   /api/Pacientes/{id}/Consultas     -> Consulta
 *  POST   /api/Pacientes/{id}/Diagnosticos  -> Diagnostico
 *  POST   /api/Pacientes/{id}/Tratamientos  -> Tratamiento
 *  GET    /api/Catalogos/medicos            -> CatalogoMedico[]    (Empleado WHERE TipoEmpleado='Medico')
 *  GET    /api/Catalogos/sucursales         -> CatalogoSucursal[]
 */
@Injectable({ providedIn: 'root' })
export class PacienteService {

  private http = inject(HttpClient);

  /** Último filtro usado (se conserva al volver del historial) */
  readonly filtro = signal<string>('');

  listar(filtro?: string): Observable<Paciente[]> {
    const q = filtro ?? this.filtro();
    if (environment.useMockApi) return mockListarPacientes(q);
    return this.http.get<Paciente[]>(`${environment.apiUrl}/Pacientes`, {
      params: q ? { filtro: q } : {},
    });
  }

  obtener(id: number): Observable<Paciente> {
    if (environment.useMockApi) return mockObtenerPaciente(id);
    return this.http.get<Paciente>(`${environment.apiUrl}/Pacientes/${id}`);
  }

  crear(data: PacienteFormData): Observable<Paciente> {
    const payload = this.toEntity(data);
    if (environment.useMockApi) return mockCrearPaciente(payload);
    return this.http.post<Paciente>(`${environment.apiUrl}/Pacientes`, payload);
  }

  actualizar(id: number, data: PacienteFormData): Observable<Paciente> {
    const payload = this.toEntity(data);
    if (environment.useMockApi) return mockActualizarPaciente(id, payload);
    return this.http.put<Paciente>(`${environment.apiUrl}/Pacientes/${id}`, payload);
  }

  desactivar(id: number): Observable<{ ok: boolean }> {
    if (environment.useMockApi) return mockEliminarPaciente(id);
    return this.http.delete<{ ok: boolean }>(`${environment.apiUrl}/Pacientes/${id}`);
  }

  historial(id: number): Observable<HistorialPaciente> {
    if (environment.useMockApi) return mockObtenerHistorial(id);
    return this.http.get<HistorialPaciente>(`${environment.apiUrl}/Pacientes/${id}/Historial`);
  }

  registrarConsulta(idPaciente: number, data: ConsultaNueva): Observable<Consulta> {
    if (environment.useMockApi) return mockRegistrarConsulta(idPaciente, data);
    return this.http.post<Consulta>(`${environment.apiUrl}/Pacientes/${idPaciente}/Consultas`, data);
  }

  registrarDiagnostico(idPaciente: number, data: DiagnosticoNuevo): Observable<Diagnostico> {
    if (environment.useMockApi) return mockRegistrarDiagnostico(idPaciente, data);
    return this.http.post<Diagnostico>(`${environment.apiUrl}/Pacientes/${idPaciente}/Diagnosticos`, data);
  }

  registrarTratamiento(idPaciente: number, data: TratamientoNuevo): Observable<Tratamiento> {
    if (environment.useMockApi) return mockRegistrarTratamiento(idPaciente, data);
    return this.http.post<Tratamiento>(`${environment.apiUrl}/Pacientes/${idPaciente}/Tratamientos`, data);
  }

  catalogosMedicos(): Observable<CatalogoMedico[]> {
    if (environment.useMockApi) return mockCatalogoMedicos();
    return this.http.get<CatalogoMedico[]>(`${environment.apiUrl}/Catalogos/medicos`);
  }

  catalogosSucursales(): Observable<CatalogoSucursal[]> {
    if (environment.useMockApi) return mockCatalogoSucursales();
    return this.http.get<CatalogoSucursal[]>(`${environment.apiUrl}/Catalogos/sucursales`);
  }

  /** Convierte el formulario a la entidad Paciente (NULL donde la BD lo permite) */
  private toEntity(d: PacienteFormData): Omit<Paciente, 'idPaciente' | 'fechaRegistro'> {
    return {
      nombres: d.nombres.trim(),
      apellidos: d.apellidos.trim(),
      dpi: d.dpi.trim() || null,
      fechaNacimiento: d.fechaNacimiento,
      sexo: d.sexo || null,
      telefono: d.telefono.trim() || null,
      correo: d.correo.trim() || null,
      activo: d.activo,
    };
  }
}
