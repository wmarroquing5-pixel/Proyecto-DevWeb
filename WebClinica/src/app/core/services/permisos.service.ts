import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  EstadoPermisos,
  OperacionPermiso,
  PermisoActual,
  PermisoRequerido,
} from '../models/permiso.model';
import { AuthSessionService } from './auth-session.service';

interface CargaEnCurso {
  identidad: string;
  observable: Observable<readonly PermisoActual[]>;
}

@Injectable({ providedIn: 'root' })
export class PermisosService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(AuthSessionService);
  private readonly permisosPorModuloState = signal<ReadonlyMap<string, PermisoActual>>(new Map());
  private readonly estadoState = signal<EstadoPermisos>('no-cargados');
  private readonly errorState = signal<unknown>(null);
  private readonly cacheVigenteState = signal(false);
  private readonly actualizandoState = signal(false);
  private readonly ultimaValidacionState = signal<number | null>(null);
  private identidadObservada: string | null = null;
  private identidadCargada: string | null = null;
  private cargaEnCurso?: CargaEnCurso;

  readonly permisos = computed<readonly PermisoActual[]>(() =>
    Array.from(this.permisosPorModuloState().values()),
  );
  readonly estado = this.estadoState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly actualizando = this.actualizandoState.asReadonly();
  readonly ultimaValidacion = this.ultimaValidacionState.asReadonly();
  readonly cargados = computed(() => this.estadoState() === 'cargados');
  readonly autorizacionVigente = computed(() =>
    this.cacheVigenteState() && this.sesionCoincideConPermisos(),
  );

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      if (!identidad) {
        this.limpiarPermisos();
        this.identidadObservada = null;
        return;
      }

      if (this.identidadObservada !== identidad) {
        this.limpiarPermisos();
        this.identidadObservada = identidad;
      }

      if (this.estadoState() === 'no-cargados') {
        this.cargarPermisos().subscribe({ error: () => undefined });
      }
    }, { allowSignalWrites: true });
  }

  cargarPermisos(): Observable<readonly PermisoActual[]> {
    return this.obtenerPermisos(false);
  }

  revalidarPermisos(): Observable<readonly PermisoActual[]> {
    return this.obtenerPermisos(true);
  }

  estaDesactualizado(maxAgeMs: number): boolean {
    const ultimaValidacion = this.ultimaValidacionState();
    return !this.autorizacionVigente() || ultimaValidacion === null
      || Date.now() - ultimaValidacion >= maxAgeMs;
  }

  invalidarSiCaducada(maxAgeMs: number): boolean {
    if (!this.estaDesactualizado(maxAgeMs) || !this.cacheVigenteState()) return false;
    this.permisosPorModuloState.set(new Map());
    this.cacheVigenteState.set(false);
    this.identidadCargada = null;
    this.estadoState.set('error');
    this.errorState.set(new Error('No fue posible verificar la autorización vigente.'));
    return true;
  }

  tiempoHastaCaducidad(maxAgeMs: number): number | null {
    const ultimaValidacion = this.ultimaValidacionState();
    if (!this.autorizacionVigente() || ultimaValidacion === null) return null;
    return Math.max(0, maxAgeMs - (Date.now() - ultimaValidacion));
  }

  private obtenerPermisos(forzar: boolean): Observable<readonly PermisoActual[]> {
    const identidad = this.identidadActual();
    if (!identidad) {
      this.limpiarPermisos();
      return throwError(() => new Error('No existe una sesión autenticada vigente.'));
    }

    if (!forzar && this.autorizacionVigente()) {
      return of(this.permisos());
    }

    if (this.cargaEnCurso?.identidad === identidad) {
      return this.cargaEnCurso.observable;
    }

    const teniaCacheVigente = this.identidadCargada === identidad && this.cacheVigenteState();
    if (!teniaCacheVigente) this.estadoState.set('cargando');
    this.actualizandoState.set(true);
    this.errorState.set(null);
    let request$!: Observable<readonly PermisoActual[]>;
    request$ = this.http.get<unknown>(`${environment.apiUrl}/auth/permisos`).pipe(
      map(response => this.normalizarRespuesta(response)),
      tap(permisos => {
        if (!this.coincideConSesionActual(identidad)) return;
        this.permisosPorModuloState.set(new Map(
          permisos.map(permiso => [this.normalizarModulo(permiso.modulo), permiso]),
        ));
        this.identidadCargada = identidad;
        this.cacheVigenteState.set(true);
        this.ultimaValidacionState.set(Date.now());
        this.estadoState.set('cargados');
      }),
      catchError(error => {
        if (this.coincideConSesionActual(identidad)) {
          if (!teniaCacheVigente) {
            this.permisosPorModuloState.set(new Map());
            this.identidadCargada = null;
            this.cacheVigenteState.set(false);
          }
          this.errorState.set(error);
          this.estadoState.set('error');
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.cargaEnCurso?.observable === request$) {
          this.cargaEnCurso = undefined;
          this.actualizandoState.set(false);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );

    this.cargaEnCurso = { identidad, observable: request$ };
    return request$;
  }

  tienePermiso(modulo: string, operacion: OperacionPermiso): boolean {
    if (!this.autorizacionVigente()) {
      return false;
    }

    const permiso = this.permisosPorModuloState().get(this.normalizarModulo(modulo));
    if (!permiso) return false;
    switch (operacion) {
      case 'Consultar': return permiso.puedeConsultar;
      case 'Crear': return permiso.puedeCrear;
      case 'Modificar': return permiso.puedeModificar;
      case 'Eliminar': return permiso.puedeEliminar;
    }
  }

  tieneTodos(requisitos: readonly PermisoRequerido[]): boolean {
    return requisitos.length > 0
      && requisitos.every(requisito => this.tienePermiso(requisito.modulo, requisito.operacion));
  }

  puedeConsultar(modulo: string): boolean {
    return this.tienePermiso(modulo, 'Consultar');
  }

  puedeCrear(modulo: string): boolean {
    return this.tienePermiso(modulo, 'Crear');
  }

  puedeModificar(modulo: string): boolean {
    return this.tienePermiso(modulo, 'Modificar');
  }

  puedeEliminar(modulo: string): boolean {
    return this.tienePermiso(modulo, 'Eliminar');
  }

  limpiarPermisos(): void {
    this.permisosPorModuloState.set(new Map());
    this.estadoState.set('no-cargados');
    this.errorState.set(null);
    this.cacheVigenteState.set(false);
    this.actualizandoState.set(false);
    this.ultimaValidacionState.set(null);
    this.identidadCargada = null;
    this.cargaEnCurso = undefined;
  }

  private normalizarRespuesta(response: unknown): readonly PermisoActual[] {
    if (!Array.isArray(response)) {
      throw new Error('La API devolvió una respuesta de permisos no válida.');
    }

    const unicos = new Map<string, PermisoActual>();
    for (const item of response) {
      const permiso = this.leerPermiso(item);
      if (!permiso) throw new Error('La API devolvió un permiso no válido.');
      const modulo = this.normalizarModulo(permiso.modulo);
      if (unicos.has(modulo)) {
        throw new Error('La API devolvió permisos duplicados para un módulo.');
      }
      unicos.set(modulo, permiso);
    }

    return Array.from(unicos.values());
  }

  private leerPermiso(value: unknown): PermisoActual | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const source = value as Record<string, unknown>;
    if (typeof source['idPermiso'] !== 'number'
      || typeof source['modulo'] !== 'string' || !source['modulo'].trim()
      || typeof source['puedeConsultar'] !== 'boolean'
      || typeof source['puedeCrear'] !== 'boolean'
      || typeof source['puedeModificar'] !== 'boolean'
      || typeof source['puedeEliminar'] !== 'boolean') {
      return null;
    }

    return {
      idPermiso: source['idPermiso'],
      modulo: source['modulo'].trim(),
      puedeConsultar: source['puedeConsultar'],
      puedeCrear: source['puedeCrear'],
      puedeModificar: source['puedeModificar'],
      puedeEliminar: source['puedeEliminar'],
    };
  }

  private sesionCoincideConPermisos(): boolean {
    const identidad = this.identidadActual();
    return identidad !== null && identidad === this.identidadCargada;
  }

  private coincideConSesionActual(identidad: string): boolean {
    return this.identidadActual() === identidad;
  }

  private identidadActual(): string | null {
    const userId = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && userId && token ? `${userId}:${token}` : null;
  }

  private normalizarModulo(modulo: string): string {
    return modulo.trim().toLocaleLowerCase('en-US');
  }
}
