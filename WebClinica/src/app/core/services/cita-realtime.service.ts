import { Injectable, OnDestroy, signal } from '@angular/core';
import { environment } from '../../../environments/environment';
import { EstadoConexion } from '../models/habitacion.model';
import { CitaEvento } from '../models/cita.model';
import { iniciarSimuladorCitas, mockEventosCitas, onCitaEvento } from '../mock/citas.mock';

/**
 * Tiempo real del módulo Citas — comunicación bidireccional cliente-servidor
 * con ASP.NET Core SignalR (.NET 10), igual que el hub de Habitaciones.
 *
 * CONTRATO DEL HUB .NET (CitasHub):
 * ┌──────────────────────────────┬─────────────────────────┬────────────────────────┐
 * │ Dirección                    │ Canal / método          │ Payload                │
 * ├──────────────────────────────┼─────────────────────────┼────────────────────────┤
 * │ Servidor → todos (broadcast) │ "CitaActualizada"       │ CitaEvento             │
 * │ Servidor → grupo sucursal    │ "Sucursal_{id}" group   │ CitaEvento             │
 * │ Cliente → servidor (invoc.)  │ CambiarEstado(req)      │ id + estado            │
 * │ Cliente → servidor (invoc.)  │ ProgramarCita(req)      │ CitaFormData → Cita    │
 * └──────────────────────────────┴─────────────────────────┴────────────────────────┘
 *
 * Registro en el backend (Program.cs):
 *   builder.Services.AddSignalR();
 *   app.MapHub<CitasHub>("/hubs/citas");
 * y en CitasController, tras cada cambio de estado:
 *   await _hub.Clients.All.SendAsync("CitaActualizada", evt);
 *
 * FRONTEND REAL (producción): `npm i @microsoft/signalr` y conectar() usará
 *   new HubConnectionBuilder()
 *     .withUrl(environment.hubUrlCitas)                       // /hubs/citas
 *     .withAutomaticReconnect([0, 2000, 5000, 10000])
 *     .build();
 *   connection.on("CitaActualizada", e => this.push(e));
 *   connection.onreconnected(() => this.recargar.update(n => n + 1));
 *   await connection.start();
 *   // Bidireccional: await connection.invoke("CambiarEstado", { id, estado })
 *
 * En modo mock se usa un simulador con idéntico contrato de eventos: los
 * cambios que hace el usuario local se emiten por el mismo canal y un job del
 * "servidor" genera movimientos de otras usuarios cada 12 s para demostrar
 * que la agenda se actualiza sola.
 */
@Injectable({ providedIn: 'root' })
export class CitaRealtimeService implements OnDestroy {

  /** Feed de cambios recibidos por el hub (más reciente primero) */
  readonly eventos = signal<CitaEvento[]>([]);
  readonly conexion = signal<EstadoConexion>('desconectado');
  /** Contador que incrementa en cada evento: las vistas lo observan para recargar */
  readonly recargar = signal(0);

  private offMock: (() => void) | null = null;
  private offSim: (() => void) | null = null;
  private connection: any = null; // signalr.HubConnection cuando hay backend

  conectar(): void {
    if (this.conexion() !== 'desconectado') return;
    this.conexion.set('conectando');

    if (environment.useMockApi) {
      this.offMock = onCitaEvento(e => this.push(e));
      this.offSim = iniciarSimuladorCitas();
      mockEventosCitas().subscribe(list => this.eventos.set(list));
      setTimeout(() => this.conexion.set('conectado'), 500);
      return;
    }

    import('@microsoft/signalr')
      .then(({ HubConnectionBuilder, LogLevel }) => {
        this.connection = new HubConnectionBuilder()
          .withUrl(environment.hubUrlCitas)
          .withAutomaticReconnect([0, 2000, 5000, 10000])
          .configureLogging(LogLevel.Information)
          .build();
        this.connection.on('CitaActualizada', (e: CitaEvento) => this.push(e));
        this.connection.onreconnecting(() => this.conexion.set('error'));
        this.connection.onreconnected(() => {
          this.conexion.set('conectado');
          this.recargar.update(n => n + 1);
        });
        this.connection.onclose(() => this.conexion.set('desconectado'));
        return this.connection.start();
      })
      .then(() => this.conexion.set('conectado'))
      .catch(() => this.conexion.set('error')); // librería no instalada o hub caído
  }

  /** Invocación cliente → servidor (bidireccional). En mock es no-op: el REST ya aplicó el cambio. */
  async invocarCambiarEstado(id: number, estado: string): Promise<void> {
    if (!environment.useMockApi && this.connection?.state === 'Connected') {
      await this.connection.invoke('CambiarEstado', { id, estado });
    }
  }

  private push(e: CitaEvento) {
    this.eventos.update(list => [e, ...list].slice(0, 30));
    this.recargar.update(n => n + 1);
  }

  limpiarFeed(): void {
    this.eventos.set([]);
  }

  ngOnDestroy(): void {
    this.desconectar();
  }

  private desconectar(): void {
    this.offMock?.();
    this.offSim?.();
    this.offMock = this.offSim = null;
    this.connection?.stop?.().catch(() => {});
    this.connection = null;
    this.conexion.set('desconectado');
  }
}
