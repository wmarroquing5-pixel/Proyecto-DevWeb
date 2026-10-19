import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EmpleadoListadoResponse,
  EmpleadoDetalleResponse,
  CrearEmpleadoRequest,
  ActualizarEmpleadoRequest,
  PagedResponse
} from '../models/empleado.model';

@Injectable({ providedIn: 'root' })
export class EmpleadosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/empleados`;

  listar(
    nombre?: string,
    tipoEmpleado?: string,
    idSucursal?: number,
    activo?: boolean,
    page = 1,
    pageSize = 20
  ): Observable<PagedResponse<EmpleadoListadoResponse>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    if (nombre) params = params.set('nombre', nombre);
    if (tipoEmpleado) params = params.set('tipoEmpleado', tipoEmpleado);
    if (idSucursal) params = params.set('idSucursal', idSucursal.toString());
    if (activo !== undefined) params = params.set('activo', activo.toString());

    return this.http.get<PagedResponse<EmpleadoListadoResponse>>(this.apiUrl, { params });
  }

  obtener(id: number): Observable<EmpleadoDetalleResponse> {
    return this.http.get<EmpleadoDetalleResponse>(`${this.apiUrl}/${id}`);
  }

  crear(request: CrearEmpleadoRequest): Observable<EmpleadoDetalleResponse> {
    return this.http.post<EmpleadoDetalleResponse>(this.apiUrl, request);
  }

  actualizar(id: number, request: ActualizarEmpleadoRequest): Observable<EmpleadoDetalleResponse> {
    return this.http.put<EmpleadoDetalleResponse>(`${this.apiUrl}/${id}`, request);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}