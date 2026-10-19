import { EffectRef, Injectable, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import {
  BehaviorSubject,
  Observable,
  Subject,
  catchError,
  filter,
  finalize,
  shareReplay,
  takeUntil,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  HabitacionResponse,
  AsignacionHabitacionResponse,
  CrearAsignacionHabitacionRequest,
  ActualizarAsignacionHabitacionRequest,
  CrearHabitacionRequest,
  ActualizarHabitacionRequest,
  PagedResponse
} from '../models/habitacion.model';
import * as signalR from '@microsoft/signalr';
import { AuthSessionService } from './auth-session.service';
import { MODULOS_PERMISO } from '../models/permiso.model';
import { ApiErrorService } from './api-error.service';
import { PermisosService } from './permisos.service';

export type EstadoConexionHabitaciones =
  'desconectado' | 'conectando' | 'conectado' | 'reconectando' | 'error';
export type EstadoSincronizacionHabitaciones =
  'sin-datos' | 'sincronizando' | 'actualizado' | 'desactualizado' | 'error';

interface SincronizacionEnCurso {
  identidad: string;
  observable: Observable<PagedResponse<HabitacionResponse>>;
}

const RETRASOS_REINTENTO_INICIO_MS = [1_000, 3_000, 5_000] as const;

// El tablero y sus modales comparten una conexión que termina al salir de la ruta.
@Injectable()
export class HabitacionesService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authSession = inject(AuthSessionService);
  private readonly permisos = inject(PermisosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly apiUrl = `${environment.apiUrl}`;
  private hubConnection?: signalR.HubConnection;
  private readonly destroy$ = new Subject<void>();
  private readonly cambioDeIdentidad$ = new Subject<void>();
  private sessionEffect?: EffectRef;
  private identidadActiva: string | null = null;
  private generacionConexion = 0;
  private revisionEventos = 0;
  private inicioEnCurso?: Promise<void>;
  private temporizadorReintento?: ReturnType<typeof setTimeout>;
  private intentosInicio = 0;
  private sincronizacionEnCurso?: SincronizacionEnCurso;
  private resincronizarAlFinalizar = false;

  private readonly habitacionesSubject = new BehaviorSubject<HabitacionResponse[]>([]);
  private readonly estadoConexionState = signal<EstadoConexionHabitaciones>('desconectado');
  private readonly estadoSincronizacionState = signal<EstadoSincronizacionHabitaciones>('sin-datos');
  private readonly ultimaSincronizacionState = signal<number | null>(null);
  private readonly errorSincronizacionState = signal<string | null>(null);

  readonly habitaciones$ = this.habitacionesSubject.asObservable();
  readonly estadoConexion = this.estadoConexionState.asReadonly();
  readonly estadoSincronizacion = this.estadoSincronizacionState.asReadonly();
  readonly ultimaSincronizacion = this.ultimaSincronizacionState.asReadonly();
  readonly errorSincronizacion = this.errorSincronizacionState.asReadonly();
  readonly datosPotencialmenteDesactualizados = computed(() =>
    this.estadoConexionState() !== 'conectado'
      || this.estadoSincronizacionState() !== 'actualizado',
  );

  constructor() {
    this.aplicarAutorizacionActual();
    this.sessionEffect = effect(() => {
      this.aplicarAutorizacionActual();
    }, { allowSignalWrites: true });
  }

  private aplicarAutorizacionActual(): void {
    const identidad = this.identidadAutorizadaActual();
    if (!identidad) {
      this.detenerComunicacion(true);
      return;
    }
    if (this.identidadActiva === identidad && this.hubConnection) return;

    this.detenerComunicacion(true);
    this.identidadActiva = identidad;
    this.crearConexion(identidad);
  }

  private crearConexion(identidad: string): void {
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        accessTokenFactory: () => this.authSession.token ?? ''
      })
      .withAutomaticReconnect()
      .build();
    const generacion = ++this.generacionConexion;
    this.hubConnection = connection;

    connection.on('ActualizarEstadoHabitacion', (data: { habitacionId: number; estado: string }) => {
      if (!this.esConexionVigente(connection, generacion, identidad)
        || !data || !Number.isInteger(data.habitacionId) || data.habitacionId <= 0
        || typeof data.estado !== 'string' || !data.estado.trim()) return;
      this.revisionEventos++;
      if (this.sincronizacionEnCurso) {
        this.resincronizarAlFinalizar = true;
        this.estadoSincronizacionState.set('desactualizado');
      }
      this.actualizarHabitacionEnLista(data.habitacionId, data.estado);
    });

    connection.onreconnecting(() => {
      if (!this.esConexionVigente(connection, generacion, identidad)) return;
      this.estadoConexionState.set('reconectando');
      this.estadoSincronizacionState.set('desactualizado');
    });

    connection.onreconnected(() => {
      if (!this.esConexionVigente(connection, generacion, identidad)) return;
      this.limpiarReintento();
      this.intentosInicio = 0;
      this.estadoConexionState.set('conectado');
      this.sincronizarAutomaticamente();
    });

    connection.onclose(error => {
      if (!this.esConexionVigente(connection, generacion, identidad)) return;
      this.estadoConexionState.set(error ? 'error' : 'desconectado');
      this.estadoSincronizacionState.set('desactualizado');
      this.programarReintento(connection, generacion, identidad);
    });

    this.iniciarConexion(connection, generacion, identidad, false);
  }

  private iniciarConexion(
    connection: signalR.HubConnection,
    generacion: number,
    identidad: string,
    recuperarEstado: boolean,
  ): void {
    if (this.inicioEnCurso || !this.esConexionVigente(connection, generacion, identidad)) return;
    this.estadoConexionState.set('conectando');
    const inicio = connection.start();
    this.inicioEnCurso = inicio;
    void inicio.then(() => {
      if (!this.esConexionVigente(connection, generacion, identidad)) {
        void connection.stop().catch(() => undefined);
        return;
      }
      this.intentosInicio = 0;
      this.estadoConexionState.set('conectado');
      if (recuperarEstado) this.sincronizarAutomaticamente();
    }).catch(() => {
      if (!this.esConexionVigente(connection, generacion, identidad)) return;
      this.estadoConexionState.set('error');
      this.estadoSincronizacionState.set('desactualizado');
      this.programarReintento(connection, generacion, identidad);
    }).finally(() => {
      if (this.inicioEnCurso === inicio) this.inicioEnCurso = undefined;
    });
  }

  private programarReintento(
    connection: signalR.HubConnection,
    generacion: number,
    identidad: string,
  ): void {
    if (this.temporizadorReintento
      || this.intentosInicio >= RETRASOS_REINTENTO_INICIO_MS.length
      || !this.esConexionVigente(connection, generacion, identidad)) return;
    const delay = RETRASOS_REINTENTO_INICIO_MS[this.intentosInicio++];
    this.temporizadorReintento = setTimeout(() => {
      this.temporizadorReintento = undefined;
      this.iniciarConexion(connection, generacion, identidad, true);
    }, delay);
  }

  reintentarConexion(): void {
    const connection = this.hubConnection;
    const identidad = this.identidadActiva;
    if (!connection || !identidad || this.inicioEnCurso
      || this.estadoConexionState() === 'conectado'
      || this.estadoConexionState() === 'reconectando') return;
    this.limpiarReintento();
    this.intentosInicio = 0;
    this.iniciarConexion(connection, this.generacionConexion, identidad, true);
  }

  private detenerComunicacion(limpiarDatos: boolean): void {
    if (!this.identidadActiva && !this.hubConnection && !this.temporizadorReintento) {
      this.estadoConexionState.set('desconectado');
      if (limpiarDatos) this.limpiarDatos();
      return;
    }

    this.identidadActiva = null;
    this.generacionConexion++;
    this.cambioDeIdentidad$.next();
    this.sincronizacionEnCurso = undefined;
    this.resincronizarAlFinalizar = false;
    this.inicioEnCurso = undefined;
    this.limpiarReintento();
    const connection = this.hubConnection;
    this.hubConnection = undefined;
    connection?.off('ActualizarEstadoHabitacion');
    if (connection) void connection.stop().catch(() => undefined);
    this.estadoConexionState.set('desconectado');
    if (limpiarDatos) this.limpiarDatos();
  }

  private limpiarReintento(): void {
    if (this.temporizadorReintento) clearTimeout(this.temporizadorReintento);
    this.temporizadorReintento = undefined;
  }

  private limpiarDatos(): void {
    this.habitacionesSubject.next([]);
    this.estadoSincronizacionState.set('sin-datos');
    this.ultimaSincronizacionState.set(null);
    this.errorSincronizacionState.set(null);
  }

  private actualizarHabitacionEnLista(idHabitacion: number, nuevoEstado: string): void {
    const current = this.habitacionesSubject.value;
    if (current.some(h => h.idHabitacion === idHabitacion)) {
      this.habitacionesSubject.next(current.map(h =>
        h.idHabitacion === idHabitacion ? { ...h, estado: nuevoEstado } : h));
    }
  }

  // ==================== HABITACIONES ====================

  cargarHabitaciones(page = 1, pageSize = 100): Observable<PagedResponse<HabitacionResponse>> {
    return this.sincronizarHabitaciones(page, pageSize);
  }

  sincronizarHabitaciones(
    page = 1,
    pageSize = 100,
  ): Observable<PagedResponse<HabitacionResponse>> {
    const identidad = this.identidadAutorizadaActual();
    if (!identidad || identidad !== this.identidadActiva) {
      return throwError(() => new Error('No existe autorización vigente para consultar habitaciones.'));
    }
    if (this.sincronizacionEnCurso?.identidad === identidad) {
      return this.sincronizacionEnCurso.observable;
    }

    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    const revisionEventosInicial = this.revisionEventos;
    this.estadoSincronizacionState.set('sincronizando');
    this.errorSincronizacionState.set(null);
    let request$!: Observable<PagedResponse<HabitacionResponse>>;
    request$ = this.http.get<PagedResponse<HabitacionResponse>>(
      `${this.apiUrl}/habitaciones`, { params },
    ).pipe(
      takeUntil(this.destroy$),
      takeUntil(this.cambioDeIdentidad$),
      filter(() => this.identidadAutorizadaActual() === identidad
        && this.identidadActiva === identidad),
      tap(response => {
        if (revisionEventosInicial !== this.revisionEventos) {
          this.resincronizarAlFinalizar = true;
          this.estadoSincronizacionState.set('desactualizado');
          return;
        }
        this.habitacionesSubject.next(response.items);
        this.ultimaSincronizacionState.set(Date.now());
        this.estadoSincronizacionState.set('actualizado');
      }),
      catchError(error => {
        if (this.identidadAutorizadaActual() === identidad && this.identidadActiva === identidad) {
          this.estadoSincronizacionState.set('error');
          this.errorSincronizacionState.set(error instanceof HttpErrorResponse
            ? this.apiErrors.messageFor(error, 'No fue posible sincronizar las habitaciones.')
            : 'No fue posible sincronizar las habitaciones.');
        }
        return throwError(() => error);
      }),
      finalize(() => {
        if (this.sincronizacionEnCurso?.observable !== request$) return;
        this.sincronizacionEnCurso = undefined;
        const debeResincronizar = this.resincronizarAlFinalizar;
        this.resincronizarAlFinalizar = false;
        if (debeResincronizar && this.identidadAutorizadaActual() === identidad
          && this.identidadActiva === identidad) {
          this.sincronizarAutomaticamente(page, pageSize);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.sincronizacionEnCurso = { identidad, observable: request$ };
    return request$;
  }

  reintentarSincronizacion(): void {
    if (this.estadoSincronizacionState() === 'sincronizando') return;
    this.sincronizarAutomaticamente();
  }

  private sincronizarAutomaticamente(page = 1, pageSize = 100): void {
    this.sincronizarHabitaciones(page, pageSize).subscribe({ error: () => undefined });
  }

  obtenerHabitacion(id: number): Observable<HabitacionResponse> {
    return this.http.get<HabitacionResponse>(`${this.apiUrl}/habitaciones/${id}`);
  }

  crearHabitacion(request: CrearHabitacionRequest): Observable<HabitacionResponse> {
    return this.http.post<HabitacionResponse>(`${this.apiUrl}/habitaciones`, request);
  }

  actualizarHabitacion(id: number, request: ActualizarHabitacionRequest): Observable<HabitacionResponse> {
    return this.http.put<HabitacionResponse>(`${this.apiUrl}/habitaciones/${id}`, request);
  }

  desactivarHabitacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/habitaciones/${id}`);
  }

  // ==================== ASIGNACIONES ====================

  asignarPaciente(request: CrearAsignacionHabitacionRequest): Observable<AsignacionHabitacionResponse> {
    return this.http.post<AsignacionHabitacionResponse>(`${this.apiUrl}/asignaciones-habitacion`, request);
  }

  registrarEgreso(idAsignacion: number): Observable<AsignacionHabitacionResponse> {
    return this.http.post<AsignacionHabitacionResponse>(`${this.apiUrl}/asignaciones-habitacion/${idAsignacion}/egreso`, {});
  }

  listarAsignaciones(page = 1, pageSize = 20): Observable<PagedResponse<AsignacionHabitacionResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());
    return this.http.get<PagedResponse<AsignacionHabitacionResponse>>(`${this.apiUrl}/asignaciones-habitacion`, { params });
  }

  actualizarAsignacion(id: number, request: ActualizarAsignacionHabitacionRequest): Observable<AsignacionHabitacionResponse> {
    return this.http.put<AsignacionHabitacionResponse>(`${this.apiUrl}/asignaciones-habitacion/${id}`, request);
  }

  eliminarAsignacion(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/asignaciones-habitacion/${id}`);
  }

  ngOnDestroy() {
    this.sessionEffect?.destroy();
    this.detenerComunicacion(true);
    this.destroy$.next();
    this.destroy$.complete();
    this.cambioDeIdentidad$.complete();
    this.habitacionesSubject.complete();
  }

  private esConexionVigente(
    connection: signalR.HubConnection,
    generacion: number,
    identidad: string,
  ): boolean {
    return this.hubConnection === connection
      && this.generacionConexion === generacion
      && this.identidadActiva === identidad
      && this.identidadAutorizadaActual() === identidad;
  }

  private identidadAutorizadaActual(): string | null {
    const userId = this.authSession.currentUser()?.idUsuario;
    const token = this.authSession.token;
    return this.authSession.isAuthenticated() && userId && token
      && this.permisos.puedeConsultar(MODULOS_PERMISO.HABITACIONES)
      ? `${userId}:${token}`
      : null;
  }
}
