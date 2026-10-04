import { Injectable, OnDestroy, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import {
  EstadoConexion,
  Habitacion,
  HabitacionEvent,
} from '../models/habitacion.model';
import { mockHabitacionesHub } from '../mock/habitaciones.mock';

/**
 * Inciso ii: actualización en tiempo real del estado de las habitaciones
 * mediante comunicación bidireccional cliente-servidor (SignalR).
 *
 * CONTRATO DEL HUB .NET 10 (ASP.NET Core SignalR) — HabitacionesHub:
 * ┌────────────────────────────┬──────────────────────────┬─────────────────────────┐
 * │ Dirección                  | Canal / método           │ Payload                 │
 * ├────────────────────────────┼──────────────────────────┼─────────────────────────┤
 * │ Servidor → todos los       │ "HabitacionActualizada"  │ HabitacionEvent         │
 * │ clientes (broadcast)       │                          │ (estado anterior/nuevo) │
 * │ Servidor → grupo sucursal  │ "Sucursal_{id}" group    │ HabitacionEvent         │
 * │ Cliente → servidor (invoc.)│ AssignPaciente(req)      │ AsignacionNueva → hab.  │
 * │ Cliente → servidor (invoc.)│ RegistrarEgreso(req)     │ EgresoRegistro → hab.   │
 * │ Cliente → servidor (invoc.)│ CambiarEstado(id, estado)│ Habitacion              │
 * └────────────────────────────┴──────────────────────────┴─────────────────────────┘
 *
 * El backend lo registra así (Program.cs):
 *   builder.Services.AddSignalR();
 *   ...
 *   app.MapHub<HabitacionesHub>("/hubs/habitaciones");
 * y al modificar una habitación hace:
 *   await _hub.Clients.Group($"Sucursal_{hab.IdSucursal}")
 *              .SendAsync("HabitacionActualizada", evt);
 *
 * FRONTEND REAL (producción): requiere la librería oficial
 *   npm i @microsoft/signalr
 * y entonces `conectar()` sustituye el simulador por:
 *   this.connection = new signalR.HubConnectionBuilder()
 *     .withUrl(environment.hubUrl)                    // http://localhost:5000/hubs/habitaciones
 *     .withAutomaticReconnect([0, 2000, 5000, 10000]) // reintentos bidireccionales
 *     .configureLogging(signalR.LogLevel.Information)
 *     .build();
 *   this.connection.on("HabitacionActualizada", e => this.eventos.update(e));
 *   this.connection.onreconnected(() => this.recargarSubject.next());
 *   await this.connection.start();
 *   // Invocaciones cliente→servidor (bidireccional):
 *   //   await this.connection.invoke("AssignPaciente", request)
 *
 * En modo mock (environment.useMockApi = true) se usa un simulador con el mismo
 * contrato de eventos, para que el tablero funcable sin backend. Al pasar el
 * flag a false Y tener @microsoft/signalr instalado, se activa la conexión real;
 * si la librería no está disponible, degrada amablemente a polling cada 10 s.
 */
@Injectable({ providedIn: 'root' })
export class HabitacionRealtimeService implements OnDestroy {
  /** Últimos eventos recibidos (más reciente primero). */
  readonly eventos = signal<HabitacionEvent[]>([]);
  /** Estado de la conexión para el indicador del tablero. */
  readonly conexion = signal<EstadoConexion>('desconectado');
  /** Señal para que el componente recargue datos tras reconexión. */
  readonly recargar = signal(0);

  private offMock: (() => void) | null = null;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  // Propiedad tipada como any para no obligar a instalar @microsoft/signalr aún.
  // Cuando instalen la librería, cambie a `HubConnection | null`.
  private connection: any = null;

  connect(): void {
    if (this.conexion() === 'conectado' || this.conexion() === 'conectando') return;

    if (environment.useMockApi) {
      this.conexion.set('conectando');
      mockHabitacionesHub.start();
      this.offMock = mockHabitacionesHub.on(e => this.push(e));
      setTimeout(() => this.conexion.set('conectado'), 600);
      return;
    }

    // ---- Ruta real SignalR ----
    this.conexion.set('conectando');
    import('@microsoft/signalr')
      .then(({ HubConnectionBuilder, LogLevel }) => {
        this.connection = new HubConnectionBuilder()
          .withUrl(environment.hubUrl)
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(LogLevel.Warning)
          .build();
        this.connection.on('HabitacionActualizada', (e: HabitacionEvent) => this.push(e));
        this.connection.onreconnecting(() => this.conexion.set('error'));
        this.connection.onreconnected(() => {
          this.conexion.set('conectado');
          this.recargar.update(n => n + 1);
        });
        this.connection.onclose(() => this.conexion.set('desconectado'));
        return this.connection.start();
      })
      .then(() => this.conexion.set('conectado'))
      .catch(() => this.iniciarPolling()); // librería no instalada o hub caído
  }

  /**
   * Invocación cliente→servidor vía SignalR cuando hay hub activo
   * (ejemplo del canal bidireccional; el servicio REST la usa como fallback).
   */
  async invoke<T>(metodo: string, ...args: unknown[]): Promise<T | null> {
    if (this.connection?.state === 'Connected') {
      return (await this.connection.invoke(metodo, ...args)) as T;
    }
    return null; // el llamador usará el endpoint HTTP equivalente
  }

  /** Polling de degradación (solo si SignalR real no está disponible). */
  private iniciarPolling(): void {
    this.conexion.set('error');
    this.pollTimer = setInterval(() => this.recargar.update(n => n + 1), 10_000);
  }

  private push(e: HabitacionEvent): void {
    this.eventos.update(list => [e, ...list].slice(0, 30));
  }

  /** Actualización optimista local: pinta el cambio antes del broadcast. */
  aplicarLocal(evt: HabitacionEvent): void {
    this.push(evt);
  }

  ngOnDestroy(): void {
    this.desconectar();
  }

  private desconectar(): void {
    this.offMock?.();
    this.offMock = null;
    mockHabitacionesHub.stop();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.connection?.stop?.();
    this.connection = null;
    this.conexion.set('desconectado');
  }
}
