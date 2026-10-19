import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PacienteListadoResponse,
  PacienteResponse,
  GuardarPacienteRequest,
  PagedResponse
} from '../models/paciente.model';

@Injectable({ providedIn: 'root' })
export class PacientesService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/pacientes`;

  /**
   * GET /api/pacientes?nombre=...&activo=...&page=1&pageSize=20
   */
  listar(
    nombre?: string,
    activo?: boolean,
    page = 1,
    pageSize = 20
  ): Observable<PagedResponse<PacienteListadoResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (nombre) params = params.set('nombre', nombre);
    if (activo !== undefined) params = params.set('activo', activo.toString());

    return this.http.get<PagedResponse<PacienteListadoResponse>>(this.apiUrl, { params });
  }

  /**
   * GET /api/pacientes/{id}
   */
  obtener(id: number): Observable<PacienteResponse> {
    return this.http.get<PacienteResponse>(`${this.apiUrl}/${id}`);
  }

  /**
   * POST /api/pacientes
   */
  crear(request: GuardarPacienteRequest): Observable<PacienteResponse> {
    return this.http.post<PacienteResponse>(this.apiUrl, request);
  }

  /**
   * PUT /api/pacientes/{id}
   */
  actualizar(id: number, request: GuardarPacienteRequest): Observable<PacienteResponse> {
    return this.http.put<PacienteResponse>(`${this.apiUrl}/${id}`, request);
  }

  /**
   * DELETE /api/pacientes/{id}
   */
  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}