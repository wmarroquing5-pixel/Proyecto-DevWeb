import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, reduce, throwError } from 'rxjs';
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
  private readonly pageSize = 100;
  private readonly maxPages = 5;

  /**
   * Obtiene todas las sucursales activas.
   * GET /api/sucursales?page=1&pageSize=100
   */
  getSucursales(): Observable<Sucursal[]> {
    return this.getCatalogoCompleto<Sucursal>('sucursales');
  }

  /**
   * Obtiene todas las especialidades activas.
   * GET /api/especialidades?page=1&pageSize=100
   */
  getEspecialidades(): Observable<Especialidad[]> {
    return this.getCatalogoCompleto<Especialidad>('especialidades');
  }

  /**
   * Obtiene todos los turnos activos.
   * GET /api/turnos?page=1&pageSize=100
   */
  getTurnos(): Observable<Turno[]> {
    return this.getCatalogoCompleto<Turno>('turnos');
  }

  private getCatalogoCompleto<T>(ruta: string): Observable<T[]> {
    return this.getPagina<T>(ruta, 1).pipe(
      expand(page => {
        if (page.totalPages > this.maxPages) {
          return throwError(() => new Error(
            `El catálogo ${ruta} excede el límite seguro de consulta.`,
          ));
        }
        return page.page < page.totalPages
          ? this.getPagina<T>(ruta, page.page + 1)
          : EMPTY;
      }),
      reduce((items, page) => [...items, ...page.items], [] as T[]),
    );
  }

  private getPagina<T>(ruta: string, page: number): Observable<PagedResponse<T>> {
    const params = new HttpParams()
      .set('page', page)
      .set('pageSize', this.pageSize);

    return this.http
      .get<PagedResponse<T>>(`${this.apiUrl}/${ruta}`, { params });
  }
}
