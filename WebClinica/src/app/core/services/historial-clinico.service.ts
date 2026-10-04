import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  CatalogoMedico,
  Consulta,
  ConsultaNueva,
  Diagnostico,
  DiagnosticoNuevo,
  Evolucion,
  EvolucionNueva,
  Examen,
  ExamenNuevo,
  FichaHistorial,
  HistorialFiltro,
  PacienteResumen,
  Tratamiento,
  TratamientoNuevo,
} from '../models/paciente.model';
import {
  mockActualizarClinical,
  mockCatalogoMedicos,
  mockCatalogoPacientesResumen,
  mockListarConsultas,
  mockObtenerFichaHistorial,
  mockRegistrarConsulta,
  mockRegistrarDiagnostico,
  mockRegistrarEvolucion,
  mockRegistrarExamen,
  mockRegistrarTratamiento,
} from '../mock/pacientes.mock';

/**
 * Servicio del módulo **Historial clínico del paciente**.
 * Contrato REST esperado del backend .NET (controlador `HistorialClinicoController`,
 * tablas SQL: Consulta, Diagnostico, Tratamiento, Examen, Evolucion):
 *
 *  GET    /api/HistorialClinico/{idPaciente}          -> FichaHistorial (ficha completa)
 *  GET    /api/HistorialClinico/Consultas?f=&med=&desde=&hasta= -> Consulta[]
 *  POST   /api/HistorialClinico/{idPaciente}/Consultas     -> Consulta      (inciso i)
 *  POST   /api/HistorialClinico/{idPaciente}/Diagnosticos  -> Diagnostico   (incisos i y iii)
 *  PUT    /api/HistorialClinico/Diagnosticos/{id}          -> Diagnostico   (corrección de dx asignados)
 *  POST   /api/HistorialClinico/{idPaciente}/Tratamientos  -> Tratamiento   (inciso i)
 *  POST   /api/HistorialClinico/Examenes                   -> Examen        (inciso ii)
 *  PUT    /api/HistorialClinico/Examenes/{id}              -> Examen        (captura de resultados)
 *  POST   /api/HistorialClinico/Evoluciones                -> Evolucion     (inciso iv)
 *  PUT    /api/HistorialClinico/Evoluciones/{id}           -> Evolucion
 *  GET    /api/Catalogos/medicos                           -> CatalogoMedico[] (Empleado WHERE TipoEmpleado='Medico')
 *  GET    /api/Catalogos/pacientes                         -> PacienteResumen[]
 */
@Injectable({ providedIn: 'root' })
export class HistorialClinicoService {

  private http = inject(HttpClient);

  /** Filtros globales de la vista "Historial clínico" (persisten al navegar) */
  readonly filtros = signal<HistorialFiltro>({
    pacienteId: '', medicoId: '', desde: '', hasta: '', texto: '',
  });

  /** id del paciente seleccionado en la vista global (0 = ninguno) */
  readonly pacienteSel = signal<number>(0);

  /* ----------------------------- Lectura ----------------------------- */

  ficha(idPaciente: number): Observable<FichaHistorial> {
    if (environment.useMockApi) return mockObtenerFichaHistorial(idPaciente);
    return this.http.get<FichaHistorial>(`${environment.apiUrl}/HistorialClinico/${idPaciente}`);
  }

  listarConsultas(f: HistorialFiltro = this.filtros()): Observable<Consulta[]> {
    if (environment.useMockApi) {
      const partes = [f.texto];
      return mockListarConsultas(partes.join(' ')).pipe();
    }
    let params = new HttpParams();
    if (f.pacienteId) params = params.set('paciente', f.pacienteId);
    if (f.medicoId) params = params.set('medico', f.medicoId);
    if (f.desde) params = params.set('desde', f.desde);
    if (f.hasta) params = params.set('hasta', f.hasta);
    if (f.texto) params = params.set('filtro', f.texto);
    return this.http.get<Consulta[]>(`${environment.apiUrl}/HistorialClinico/Consultas`, { params });
  }

  catalogoPacientes(): Observable<PacienteResumen[]> {
    if (environment.useMockApi) return mockCatalogoPacientesResumen();
    return this.http.get<PacienteResumen[]>(`${environment.apiUrl}/Catalogos/pacientes`);
  }

  catalogosMedicos(): Observable<CatalogoMedico[]> {
    if (environment.useMockApi) return mockCatalogoMedicos();
    return this.http.get<CatalogoMedico[]>(`${environment.apiUrl}/Catalogos/medicos`);
  }

  /* ------------------------- Escritura (CRUD) ------------------------- */

  /** i. Registro de consultas médicas */
  registrarConsulta(idPaciente: number, data: ConsultaNueva): Observable<Consulta> {
    if (environment.useMockApi) return mockRegistrarConsulta(idPaciente, data);
    return this.http.post<Consulta>(
      `${environment.apiUrl}/HistorialClinico/${idPaciente}/Consultas`, data);
  }

  /** i + iii. Diagnósticos asignados por los médicos (vinculados a una consulta) */
  registrarDiagnostico(idPaciente: number, data: DiagnosticoNuevo): Observable<Diagnostico> {
    if (environment.useMockApi) return mockRegistrarDiagnostico(idPaciente, data);
    return this.http.post<Diagnostico>(
      `${environment.apiUrl}/HistorialClinico/${idPaciente}/Diagnosticos`, data);
  }

  actualizarDiagnostico(id: number, cambios: { descripcion: string }): Observable<Diagnostico> {
    if (environment.useMockApi) {
      return mockActualizarClinical('diagnostico', id, cambios) as Observable<Diagnostico>;
    }
    return this.http.put<Diagnostico>(
      `${environment.apiUrl}/HistorialClinico/Diagnosticos/${id}`, cambios);
  }

  /** i. Tratamientos vinculados a la consulta */
  registrarTratamiento(idPaciente: number, data: TratamientoNuevo): Observable<Tratamiento> {
    if (environment.useMockApi) return mockRegistrarTratamiento(idPaciente, data);
    return this.http.post<Tratamiento>(
      `${environment.apiUrl}/HistorialClinico/${idPaciente}/Tratamientos`, data);
  }

  /** ii. Exámenes realizados por paciente (resultados y fecha) */
  registrarExamen(data: ExamenNuevo): Observable<Examen> {
    if (environment.useMockApi) return mockRegistrarExamen(data);
    return this.http.post<Examen>(`${environment.apiUrl}/HistorialClinico/Examenes`, data);
  }

  actualizarExamen(id: number, cambios: { resultado: string; fechaExamen?: string }): Observable<Examen> {
    if (environment.useMockApi) return mockActualizarClinical('examen', id, cambios) as Observable<Examen>;
    return this.http.put<Examen>(`${environment.apiUrl}/HistorialClinico/Examenes/${id}`, cambios);
  }

  /** iv. Evolución del paciente (seguimiento médico) */
  registrarEvolucion(data: EvolucionNueva): Observable<Evolucion> {
    if (environment.useMockApi) return mockRegistrarEvolucion(data);
    return this.http.post<Evolucion>(`${environment.apiUrl}/HistorialClinico/Evoluciones`, data);
  }

  actualizarEvolucion(id: number, cambios: { descripcion: string }): Observable<Evolucion> {
    if (environment.useMockApi) {
      return mockActualizarClinical('evolucion', id, cambios) as Observable<Evolucion>;
    }
    return this.http.put<Evolucion>(`${environment.apiUrl}/HistorialClinico/Evoluciones/${id}`, cambios);
  }
}
