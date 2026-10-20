import { HttpClient } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { MenuItem } from '../models/menu-item.model';
import { AuthService } from './auth.service';
import { MODULOS_PERMISO } from '../models/permiso.model';
import { PermisosService } from './permisos.service';

const MODULO_POR_RUTA: Readonly<Record<string, string>> = {
  '/pacientes': MODULOS_PERMISO.PACIENTES,
  '/consultas': MODULOS_PERMISO.CONSULTAS,
  '/medicamentos': MODULOS_PERMISO.MEDICAMENTOS,
  '/inventario/lotes': MODULOS_PERMISO.LOTES_MEDICAMENTO,
  '/habitaciones': MODULOS_PERMISO.HABITACIONES,
  '/ventas': MODULOS_PERMISO.VENTAS,
  '/admin/usuarios': MODULOS_PERMISO.USUARIOS,
  '/admin/roles': MODULOS_PERMISO.ROLES,
  '/admin/empleados': MODULOS_PERMISO.EMPLEADOS,
  '/admin/permisos': MODULOS_PERMISO.PERMISOS,
};

export type EstadoMenu = 'no-cargado' | 'cargando' | 'cargado' | 'error';

@Injectable({ providedIn: 'root' })
export class MenuService {

  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private permisos = inject(PermisosService);

  private _items = signal<MenuItem[]>([]);
  private estadoState = signal<EstadoMenu>('no-cargado');
  private errorState = signal<unknown>(null);
  private ultimaActualizacionState = signal<number | null>(null);
  private cargaEnCurso?: { identidad: string; observable: Observable<MenuItem[]> };
  readonly ultimaActualizacion = this.ultimaActualizacionState.asReadonly();
  readonly estado = this.estadoState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly elementosRecibidos = computed(() => this._items().length);

  /** La API filtra por permisos; aquí solo se ocultan elementos de presentación. */
  readonly menu = computed(() => {
    if (!this.auth.isAuthenticated() || !this.permisos.autorizacionVigente()) return [];
    return this.filterVisibleItems(this._items());
  });

  constructor() {
    // Si el usuario recarga la pagina con sesion activa, volver a cargar el menu
    if (this.auth.isAuthenticated()) {
      this.loadMenu().subscribe({ error: () => undefined });
    }
    effect(() => {
      if (!this.auth.isAuthenticated()) this.clearMenu();
    }, { allowSignalWrites: true });
  }

  /**
   * Carga el menu desde la API .NET.
   * Recomendado: que el backend ya lo devuelva filtrado por rol.
   * shareReplay(1) evita peticiones repetidas.
   */
  loadMenu(): Observable<MenuItem[]> {
    const identidad = this.identidadActual();
    if (!identidad) {
      this.clearMenu();
      return throwError(() => new Error('No existe una sesión autenticada vigente.'));
    }
    if (this.cargaEnCurso?.identidad === identidad) return this.cargaEnCurso.observable;

    this.estadoState.set('cargando');
    this.errorState.set(null);
    let request$!: Observable<MenuItem[]>;
    request$ = this.http.get<unknown>(`${environment.apiUrl}/menu`).pipe(
      map(response => this.normalizarMenu(response)),
      tap(items => {
        if (this.identidadActual() === identidad) {
          this._items.set(items);
          this.ultimaActualizacionState.set(Date.now());
          this.estadoState.set('cargado');
        }
      }),
      catchError(error => {
        if (this.identidadActual() === identidad) {
          this.estadoState.set('error');
          this.errorState.set(error);
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.cargaEnCurso?.observable === request$) this.cargaEnCurso = undefined;
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.cargaEnCurso = { identidad, observable: request$ };
    return request$;
  }

  estaDesactualizado(maxAgeMs: number): boolean {
    const ultimaActualizacion = this.ultimaActualizacionState();
    return ultimaActualizacion === null || Date.now() - ultimaActualizacion >= maxAgeMs;
  }

  /** Permite inyectar un menu mock durante el desarrollo */
  setMenu(items: MenuItem[]): void {
    this._items.set(items);
    this.estadoState.set('cargado');
    this.errorState.set(null);
    this.ultimaActualizacionState.set(Date.now());
  }

  clearMenu(): void {
    this._items.set([]);
    this.estadoState.set('no-cargado');
    this.errorState.set(null);
    this.ultimaActualizacionState.set(null);
    this.cargaEnCurso = undefined;
  }

  /** /auth/me no entrega roles; los roles decorativos del menú no son permisos. */
  private filterVisibleItems(items: MenuItem[]): MenuItem[] {
    return items
      .filter(i => !i.hidden)
      .map(i => ({
        ...i,
        children: i.children ? this.filterVisibleItems(i.children) : undefined,
      }))
      .filter(item => item.children?.length
        || item.route === '/dashboard'
        || (!!item.route && !!MODULO_POR_RUTA[item.route]
          && this.permisos.puedeConsultar(MODULO_POR_RUTA[item.route])));
  }

  private identidadActual(): string | null {
    const userId = this.auth.currentUser()?.idUsuario;
    const token = this.auth.token;
    return this.auth.isAuthenticated() && userId && token ? `${userId}:${token}` : null;
  }

  private normalizarMenu(response: unknown): MenuItem[] {
    if (!Array.isArray(response)) throw new Error('La API devolvió un menú no válido.');
    return this.normalizarItems(response);
  }

  private normalizarItems(items: unknown[]): MenuItem[] {
    const result: MenuItem[] = [];
    const keys = new Set<string>();
    for (const value of items) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('La API devolvió un elemento de menú no válido.');
      }
      const source = value as Record<string, unknown>;
      if (typeof source['label'] !== 'string' || !source['label'].trim()) {
        throw new Error('La API devolvió un elemento de menú sin etiqueta válida.');
      }
      const routeValue = source['route'];
      if (routeValue !== undefined && routeValue !== null && typeof routeValue !== 'string') {
        throw new Error('La API devolvió una ruta de menú no válida.');
      }
      const childrenValue = source['children'];
      if (childrenValue !== undefined && childrenValue !== null && !Array.isArray(childrenValue)) {
        throw new Error('La API devolvió hijos de menú no válidos.');
      }
      const item: MenuItem = {
        label: source['label'].trim(),
        route: typeof routeValue === 'string' ? this.normalizarRuta(routeValue) : undefined,
        icon: typeof source['icon'] === 'string' ? source['icon'] : undefined,
        roles: Array.isArray(source['roles'])
          ? source['roles'].filter((role): role is string => typeof role === 'string')
          : undefined,
        hidden: typeof source['hidden'] === 'boolean' ? source['hidden'] : undefined,
        children: Array.isArray(childrenValue) ? this.normalizarItems(childrenValue) : undefined,
      };
      const key = `${item.label.toLocaleLowerCase('en-US')}\u0000${item.route ?? ''}`;
      if (!keys.has(key)) {
        keys.add(key);
        result.push(item);
      }
    }
    return result;
  }

  private normalizarRuta(route: string): string | undefined {
    const trimmed = route.trim();
    if (!trimmed) return undefined;
    if (!trimmed.startsWith('/') || trimmed.startsWith('//')
      || trimmed.includes('?') || trimmed.includes('#')) {
      throw new Error('La API devolvió una ruta de menú no válida.');
    }
    return trimmed.length > 1 ? trimmed.replace(/\/+$/, '') : trimmed;
  }
}
