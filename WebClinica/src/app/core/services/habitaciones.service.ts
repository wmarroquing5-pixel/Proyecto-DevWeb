import { Injectable, inject, OnDestroy } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, Subject, takeUntil } from 'rxjs';
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

@Injectable({ providedIn: 'root' })
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
    const token = localStorage.getItem('auth_token'); 
    this.hubConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${this.apiUrl}/hubs/habitaciones`,{
      accessTokenFactory: () => token || ''  // 👈 AGREGAR ESTO
    })
      .withAutomaticReconnect()
      .build();

    this.hubConnection.start()
      .then(() => console.log('✅ SignalR conectado al Hub de Habitaciones'))
      .catch(err => console.error('❌ Error conectando SignalR:', err));

    // Escuchar eventos del backend
    this.hubConnection.on('ActualizarEstadoHabitacion', (data: { habitacionId: number; estado: string }) => {
      console.log('🔄 Habitación actualizada:', data);
      this.actualizarHabitacionEnLista(data.habitacionId, data.estado);
    });
  }

  private actualizarHabitacionEnLista(idHabitacion: number, nuevoEstado: string) {
    const current = this.habitacionesSubject.value;
    const index = current.findIndex(h => h.idHabitacion === idHabitacion);
    if (index !== -1) {
      current[index] = { ...current[index], estado: nuevoEstado };
      this.habitacionesSubject.next([...current]);
    }
  }

  // ==================== HABITACIONES ====================

  cargarHabitaciones(page = 1, pageSize = 100): Observable<PagedResponse<HabitacionResponse>> {
    const params = new HttpParams()
      .set('page', page.toString())
      .set('pageSize', pageSize.toString());

    return this.http.get<PagedResponse<HabitacionResponse>>(`${this.apiUrl}/habitaciones`, { params }).pipe(
      takeUntil(this.destroy$)
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
    this.hubConnection?.stop();
  }
}