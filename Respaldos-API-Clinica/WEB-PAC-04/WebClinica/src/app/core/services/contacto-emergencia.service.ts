import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ContactoEmergenciaRequest,
  ContactoEmergenciaResponse,
  ContactosEmergenciaPagina,
} from '../models/contacto-emergencia.model';

@Injectable({ providedIn: 'root' })
export class ContactosEmergenciaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/contactos-emergencia`;

  listar(idPaciente: number, page = 1, pageSize = 10): Observable<ContactosEmergenciaPagina> {
    const params = new HttpParams()
      .set('idPaciente', idPaciente.toString())
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<ContactosEmergenciaPagina>(this.apiUrl, { params });
  }

  crear(request: ContactoEmergenciaRequest): Observable<ContactoEmergenciaResponse> {
    return this.http.post<ContactoEmergenciaResponse>(this.apiUrl, request);
  }

  actualizar(id: number, request: ContactoEmergenciaRequest): Observable<ContactoEmergenciaResponse> {
    return this.http.put<ContactoEmergenciaResponse>(`${this.apiUrl}/${id}`, request);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
