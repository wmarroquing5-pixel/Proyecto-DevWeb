import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Clinica,
  Especialidad,
  GuardarClinicaRequest,
  GuardarEspecialidadRequest,
  GuardarServicioRequest,
  GuardarSucursalRequest,
  GuardarTurnoRequest,
  JORNADAS_TURNO,
  PagedResponse,
  Servicio,
  Sucursal,
  TIPOS_SERVICIO,
  Turno,
} from '../models/catalogos.model';

type ItemValidator<T> = (value: unknown) => value is T;

@Injectable({ providedIn: 'root' })
export class CatalogosService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly selectorPageSize = 100;
  private readonly maxSelectorPages = 5;

  /** Obtiene el catálogo completo. El consumidor decide cómo tratar registros inactivos. */
  getSucursales(): Observable<Sucursal[]> {
    return this.getCatalogoCompleto('sucursales', this.esSucursal);
  }

  getEspecialidades(): Observable<Especialidad[]> {
    return this.getCatalogoCompleto('especialidades', this.esEspecialidad);
  }

  getTurnos(): Observable<Turno[]> {
    return this.getCatalogoCompleto('turnos', this.esTurno);
  }

  getServicios(): Observable<Servicio[]> {
    return this.getCatalogoCompleto('servicios', this.esServicio);
  }

  getClinicas(): Observable<Clinica[]> {
    return this.getCatalogoCompleto('clinicas', this.esClinica);
  }

  listarSucursales(page = 1, pageSize = 20): Observable<PagedResponse<Sucursal>> {
    return this.listar('sucursales', page, pageSize, this.esSucursal);
  }

  obtenerSucursal(id: number): Observable<Sucursal> {
    return this.obtener('sucursales', id, this.esSucursal);
  }

  crearSucursal(request: GuardarSucursalRequest): Observable<Sucursal> {
    return this.crear('sucursales', request, this.esSucursal);
  }

  actualizarSucursal(id: number, request: GuardarSucursalRequest): Observable<Sucursal> {
    return this.actualizar('sucursales', id, request, this.esSucursal);
  }

  desactivarSucursal(id: number): Observable<void> {
    return this.desactivar('sucursales', id);
  }

  listarEspecialidades(page = 1, pageSize = 20): Observable<PagedResponse<Especialidad>> {
    return this.listar('especialidades', page, pageSize, this.esEspecialidad);
  }

  obtenerEspecialidad(id: number): Observable<Especialidad> {
    return this.obtener('especialidades', id, this.esEspecialidad);
  }

  crearEspecialidad(request: GuardarEspecialidadRequest): Observable<Especialidad> {
    return this.crear('especialidades', request, this.esEspecialidad);
  }

  actualizarEspecialidad(id: number, request: GuardarEspecialidadRequest): Observable<Especialidad> {
    return this.actualizar('especialidades', id, request, this.esEspecialidad);
  }

  desactivarEspecialidad(id: number): Observable<void> {
    return this.desactivar('especialidades', id);
  }

  listarTurnos(page = 1, pageSize = 20): Observable<PagedResponse<Turno>> {
    return this.listar('turnos', page, pageSize, this.esTurno);
  }

  obtenerTurno(id: number): Observable<Turno> {
    return this.obtener('turnos', id, this.esTurno);
  }

  crearTurno(request: GuardarTurnoRequest): Observable<Turno> {
    return this.crear('turnos', request, this.esTurno);
  }

  actualizarTurno(id: number, request: GuardarTurnoRequest): Observable<Turno> {
    return this.actualizar('turnos', id, request, this.esTurno);
  }

  desactivarTurno(id: number): Observable<void> {
    return this.desactivar('turnos', id);
  }

  listarServicios(page = 1, pageSize = 20): Observable<PagedResponse<Servicio>> {
    return this.listar('servicios', page, pageSize, this.esServicio);
  }

  obtenerServicio(id: number): Observable<Servicio> {
    return this.obtener('servicios', id, this.esServicio);
  }

  crearServicio(request: GuardarServicioRequest): Observable<Servicio> {
    return this.crear('servicios', request, this.esServicio);
  }

  actualizarServicio(id: number, request: GuardarServicioRequest): Observable<Servicio> {
    return this.actualizar('servicios', id, request, this.esServicio);
  }

  desactivarServicio(id: number): Observable<void> {
    return this.desactivar('servicios', id);
  }

  listarClinicas(page = 1, pageSize = 20): Observable<PagedResponse<Clinica>> {
    return this.listar('clinicas', page, pageSize, this.esClinica);
  }

  obtenerClinica(id: number): Observable<Clinica> {
    return this.obtener('clinicas', id, this.esClinica);
  }

  crearClinica(request: GuardarClinicaRequest): Observable<Clinica> {
    return this.crear('clinicas', request, this.esClinica);
  }

  actualizarClinica(id: number, request: GuardarClinicaRequest): Observable<Clinica> {
    return this.actualizar('clinicas', id, request, this.esClinica);
  }

  desactivarClinica(id: number): Observable<void> {
    return this.desactivar('clinicas', id);
  }

  private getCatalogoCompleto<T>(ruta: string, validator: ItemValidator<T>): Observable<T[]> {
    return this.listar(ruta, 1, this.selectorPageSize, validator).pipe(
      expand(page => {
        if (page.totalPages > this.maxSelectorPages) {
          return throwError(() => new Error(
            `El catálogo ${ruta} excede el límite seguro de consulta.`,
          ));
        }
        return page.page < page.totalPages
          ? this.listar(ruta, page.page + 1, this.selectorPageSize, validator)
          : EMPTY;
      }),
      reduce((items, page) => [...items, ...page.items], [] as T[]),
    );
  }

  private listar<T>(
    ruta: string,
    page: number,
    pageSize: number,
    validator: ItemValidator<T>,
  ): Observable<PagedResponse<T>> {
    const params = new HttpParams().set('page', page).set('pageSize', pageSize);
    return this.http.get<unknown>(`${this.apiUrl}/${ruta}`, { params }).pipe(
      map(response => this.normalizarPagina(response, validator, ruta)),
    );
  }

  private obtener<T>(ruta: string, id: number, validator: ItemValidator<T>): Observable<T> {
    return this.http.get<unknown>(`${this.apiUrl}/${ruta}/${id}`).pipe(
      map(response => this.normalizarItem(response, validator, ruta)),
    );
  }

  private crear<TRequest, TResponse>(
    ruta: string,
    request: TRequest,
    validator: ItemValidator<TResponse>,
  ): Observable<TResponse> {
    return this.http.post<unknown>(`${this.apiUrl}/${ruta}`, request).pipe(
      map(response => this.normalizarItem(response, validator, ruta)),
    );
  }

  private actualizar<TRequest, TResponse>(
    ruta: string,
    id: number,
    request: TRequest,
    validator: ItemValidator<TResponse>,
  ): Observable<TResponse> {
    return this.http.put<unknown>(`${this.apiUrl}/${ruta}/${id}`, request).pipe(
      map(response => this.normalizarItem(response, validator, ruta)),
    );
  }

  private desactivar(ruta: string, id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${ruta}/${id}`);
  }

  private normalizarPagina<T>(
    value: unknown,
    validator: ItemValidator<T>,
    ruta: string,
  ): PagedResponse<T> {
    if (!this.esRegistro(value)
      || !Array.isArray(value['items'])
      || !value['items'].every(validator)
      || !this.esEnteroPositivo(value['page'])
      || !this.esEnteroPositivo(value['pageSize'])
      || !this.esEnteroNoNegativo(value['totalCount'])
      || !this.esEnteroNoNegativo(value['totalPages'])) {
      throw new Error(`La API devolvió una página de ${ruta} no válida.`);
    }
    return {
      items: value['items'],
      page: value['page'],
      pageSize: value['pageSize'],
      totalCount: value['totalCount'],
      totalPages: value['totalPages'],
    };
  }

  private normalizarItem<T>(value: unknown, validator: ItemValidator<T>, ruta: string): T {
    if (!validator(value)) throw new Error(`La API devolvió un registro de ${ruta} no válido.`);
    return value;
  }

  private readonly esSucursal = (value: unknown): value is Sucursal =>
    this.esRegistro(value)
    && this.esId(value['idSucursal'])
    && this.esTexto(value['nombre'])
    && this.esTextoNullable(value['direccion'])
    && typeof value['activa'] === 'boolean';

  private readonly esEspecialidad = (value: unknown): value is Especialidad =>
    this.esRegistro(value)
    && this.esId(value['idEspecialidad'])
    && this.esTexto(value['nombre'])
    && typeof value['activa'] === 'boolean';

  private readonly esTurno = (value: unknown): value is Turno =>
    this.esRegistro(value)
    && this.esId(value['idTurno'])
    && this.esTexto(value['nombre'])
    && this.esTexto(value['codigo'])
    && this.esTexto(value['horaEntrada'])
    && this.esTexto(value['horaSalida'])
    && typeof value['jornada'] === 'string'
    && JORNADAS_TURNO.some(jornada => jornada === value['jornada'])
    && typeof value['activo'] === 'boolean';

  private readonly esServicio = (value: unknown): value is Servicio =>
    this.esRegistro(value)
    && this.esId(value['idServicio'])
    && this.esTexto(value['codigo'])
    && this.esTexto(value['nombre'])
    && this.esTextoNullable(value['descripcion'])
    && typeof value['precioBase'] === 'number'
    && Number.isFinite(value['precioBase'])
    && typeof value['tipoServicio'] === 'string'
    && TIPOS_SERVICIO.some(tipo => tipo === value['tipoServicio'])
    && typeof value['activo'] === 'boolean';

  private readonly esClinica = (value: unknown): value is Clinica =>
    this.esRegistro(value)
    && this.esId(value['idClinica'])
    && this.esTexto(value['nombreClinica'])
    && this.esTextoNullable(value['especialidad'])
    && typeof value['activa'] === 'boolean'
    && this.esId(value['idSucursal']);

  private esRegistro(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }

  private esId(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  private esEnteroPositivo(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value > 0;
  }

  private esEnteroNoNegativo(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 0;
  }

  private esTexto(value: unknown): value is string {
    return typeof value === 'string';
  }

  private esTextoNullable(value: unknown): value is string | null {
    return value === null || typeof value === 'string';
  }
}
