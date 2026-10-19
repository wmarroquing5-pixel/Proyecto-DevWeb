import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Sucursal,
  Especialidad,
  Turno,
  PagedResponse
} from '../models/catalogos.model';

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  /**
   * Obtiene todas las sucursales activas.
   * GET /api/sucursales?page=1&pageSize=100
   */
  getSucursales(): Observable<Sucursal[]> {
    const params = new HttpParams()
      .set('page', '1')
      .set('pageSize', '100');

    return this.http
      .get<PagedResponse<Sucursal>>(`${this.apiUrl}/sucursales`, { params })
      .pipe(map(res => res.items));
  }

  /**
   * Obtiene todas las especialidades activas.
   * GET /api/especialidades?page=1&pageSize=100
   */
  getEspecialidades(): Observable<Especialidad[]> {
    const params = new HttpParams()
      .set('page', '1')
      .set('pageSize', '100');

    return this.http
      .get<PagedResponse<Especialidad>>(`${this.apiUrl}/especialidades`, { params })
      .pipe(map(res => res.items));
  }

  /**
   * Obtiene todos los turnos activos.
   * GET /api/turnos?page=1&pageSize=100
   */
  getTurnos(): Observable<Turno[]> {
    const params = new HttpParams()
      .set('page', '1')
      .set('pageSize', '100');

    return this.http
      .get<PagedResponse<Turno>>(`${this.apiUrl}/turnos`, { params })
      .pipe(map(res => res.items));
  }
}