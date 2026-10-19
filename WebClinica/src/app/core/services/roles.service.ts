import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  GuardarPermisoRolRequest,
  GuardarRolRequest,
  PagedResponse,
  PermisoRolResponse,
  RolResponse,
} from '../models/rol.model';

@Injectable({ providedIn: 'root' })
export class RolesService {
  private readonly http = inject(HttpClient);
  private readonly rolesUrl = `${environment.apiUrl}/roles`;
  private readonly permisosUrl = `${environment.apiUrl}/permisos`;
  private readonly maxPageSize = 100;

  listarRoles(page = 1, pageSize = 20): Observable<PagedResponse<RolResponse>> {
    const params = this.paginationParams(page, pageSize);
    return this.http.get<unknown>(this.rolesUrl, { params }).pipe(
      map(response => this.readPage(response, value => this.readRol(value), page, pageSize)),
    );
  }

  obtenerRol(id: number): Observable<RolResponse> {
    return this.http.get<unknown>(`${this.rolesUrl}/${id}`).pipe(
      map(response => this.requireItem(this.readRol(response), 'rol')),
    );
  }

  crearRol(request: GuardarRolRequest): Observable<RolResponse> {
    return this.http.post<unknown>(this.rolesUrl, request).pipe(
      map(response => this.requireItem(this.readRol(response), 'rol')),
    );
  }

  actualizarRol(id: number, request: GuardarRolRequest): Observable<RolResponse> {
    return this.http.put<unknown>(`${this.rolesUrl}/${id}`, request).pipe(
      map(response => this.requireItem(this.readRol(response), 'rol')),
    );
  }

  eliminarRol(id: number): Observable<void> {
    return this.http.delete<void>(`${this.rolesUrl}/${id}`);
  }

  listarPermisos(page = 1, pageSize = this.maxPageSize): Observable<PagedResponse<PermisoRolResponse>> {
    const params = this.paginationParams(page, pageSize);
    return this.http.get<unknown>(this.permisosUrl, { params }).pipe(
      map(response => this.readPage(
        response,
        value => this.readPermiso(value),
        page,
        pageSize,
      )),
    );
  }

  listarTodosPermisos(): Observable<readonly PermisoRolResponse[]> {
    return this.listarPermisos(1, this.maxPageSize).pipe(
      expand(page => page.page * page.pageSize < page.totalCount
        ? this.listarPermisos(page.page + 1, this.maxPageSize)
        : EMPTY),
      reduce(
        (items, page) => [...items, ...page.items],
        [] as PermisoRolResponse[],
      ),
    );
  }

  listarPermisosDeRol(idRol: number): Observable<readonly PermisoRolResponse[]> {
    return this.listarTodosPermisos().pipe(
      map(permisos => permisos.filter(permiso => permiso.idRol === idRol)),
    );
  }

  obtenerPermiso(id: number): Observable<PermisoRolResponse> {
    return this.http.get<unknown>(`${this.permisosUrl}/${id}`).pipe(
      map(response => this.requireItem(this.readPermiso(response), 'permiso')),
    );
  }

  crearPermiso(request: GuardarPermisoRolRequest): Observable<PermisoRolResponse> {
    return this.http.post<unknown>(this.permisosUrl, request).pipe(
      map(response => this.requireItem(this.readPermiso(response), 'permiso')),
    );
  }

  actualizarPermiso(
    id: number,
    request: GuardarPermisoRolRequest,
  ): Observable<PermisoRolResponse> {
    return this.http.put<unknown>(`${this.permisosUrl}/${id}`, request).pipe(
      map(response => this.requireItem(this.readPermiso(response), 'permiso')),
    );
  }

  eliminarPermiso(id: number): Observable<void> {
    return this.http.delete<void>(`${this.permisosUrl}/${id}`);
  }

  private paginationParams(page: number, pageSize: number): HttpParams {
    return new HttpParams().set('page', page).set('pageSize', pageSize);
  }

  private readPage<T>(
    value: unknown,
    readItem: (item: unknown) => T | null,
    expectedPage: number,
    expectedPageSize: number,
  ): PagedResponse<T> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('La API devolvió una respuesta paginada no válida.');
    }
    const source = value as Record<string, unknown>;
    if (!Array.isArray(source['items'])
      || source['page'] !== expectedPage
      || source['pageSize'] !== expectedPageSize
      || !this.isNonNegativeInteger(source['totalCount'])
      || !this.isNonNegativeInteger(source['totalPages'])) {
      throw new Error('La API devolvió una respuesta paginada no válida.');
    }
    const items = source['items'].map(item => readItem(item));
    if (items.some(item => item === null)) {
      throw new Error('La API devolvió un elemento administrativo no válido.');
    }
    return {
      items: items as T[],
      page: source['page'] as number,
      pageSize: source['pageSize'] as number,
      totalCount: source['totalCount'] as number,
      totalPages: source['totalPages'] as number,
    };
  }

  private readRol(value: unknown): RolResponse | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value as Record<string, unknown>;
    if (!this.isPositiveInteger(source['idRol'])
      || typeof source['nombre'] !== 'string'
      || !source['nombre'].trim()
      || typeof source['activo'] !== 'boolean') return null;
    return {
      idRol: source['idRol'] as number,
      nombre: source['nombre'].trim(),
      activo: source['activo'],
    };
  }

  private readPermiso(value: unknown): PermisoRolResponse | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value as Record<string, unknown>;
    if (!this.isPositiveInteger(source['idPermiso'])
      || !this.isPositiveInteger(source['idRol'])
      || typeof source['modulo'] !== 'string'
      || !source['modulo'].trim()
      || typeof source['puedeConsultar'] !== 'boolean'
      || typeof source['puedeCrear'] !== 'boolean'
      || typeof source['puedeModificar'] !== 'boolean'
      || typeof source['puedeEliminar'] !== 'boolean') return null;
    return {
      idPermiso: source['idPermiso'] as number,
      idRol: source['idRol'] as number,
      modulo: source['modulo'].trim(),
      puedeConsultar: source['puedeConsultar'],
      puedeCrear: source['puedeCrear'],
      puedeModificar: source['puedeModificar'],
      puedeEliminar: source['puedeEliminar'],
    };
  }

  private requireItem<T>(value: T | null, resource: string): T {
    if (!value) throw new Error(`La API devolvió un ${resource} no válido.`);
    return value;
  }

  private isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  private isNonNegativeInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }
}
