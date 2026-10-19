import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, takeUntil, tap } from 'rxjs';
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

// El tablero y sus modales comparten una conexión que termina al salir de la ruta.
@Injectable()
export class HabitacionesService implements OnDestroy {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;
  private hubConnection?: signalR.HubConnection;
  private destroy$ = new Subject<void>();

  // BehaviorSubject para emitir actualizaciones en tiempo real
  private habitacionesSubject = new BehaviorSubject<HabitacionResponse[]>([]);
  habitaciones$ = this.habitacionesSubject.asObservable();

  constructor() {
    this.iniciarSignalR();
  }

  private iniciarSignalR() {
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(environment.hubUrl, {
        // SignalR invoca esta función también durante las reconexiones.
        accessTokenFactory: () => localStorage.getItem('auth_token') ?? ''
      })
      .withAutomaticReconnect()
      .build();

    // Escuchar eventos del backend
    this.hubConnection.on('ActualizarEstadoHabitacion', (data: { habitacionId: number; estado: string }) => {
      this.actualizarHabitacionEnLista(data.habitacionId, data.estado);
    });

    this.hubConnection.start()
      .catch(err => console.error('Error conectando SignalR:', err));
  }

  private actualizarHabitacionEnLista(idHabitacion: number, nuevoEstado: string) {
    const current = this.habitacionesSubject.value;
    if (current.some(h => h.idHabitacion === idHabitacion)) {
      this.habitacionesSubject.next(current.map(h =>
        h.idHabitacion === idHabitacion ? { ...h, estado: nuevoEstado } : h));
    }
  }

  // ==================== HABITACIONES ====================

  cargarHabitaciones(page = 1, pageSize = 100): Observable<PagedResponse<HabitacionResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PagedResponse<HabitacionResponse>>(`${this.apiUrl}/habitaciones`, { params }).pipe(
      takeUntil(this.destroy$),
      tap(res => this.habitacionesSubject.next(res.items))
    );
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
    this.destroy$.next();
    this.destroy$.complete();
    this.hubConnection?.off('ActualizarEstadoHabitacion');
    void this.hubConnection?.stop().catch(err => console.error('Error desconectando SignalR:', err));
    this.habitacionesSubject.complete();
  }
}
