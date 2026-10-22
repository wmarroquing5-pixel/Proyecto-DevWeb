import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { HabitacionResponse, ESTADOS_HABITACION } from '../../core/models/habitacion.model';
import { AsignarPacienteModalComponent } from './asignar-paciente-modal.component';
import { RegistrarEgresoModalComponent } from './registrar-egreso-modal.component';
import { CrearHabitacionModalComponent } from './crear-habitacion-modal.component';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { finalize, Subscription } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';

@Component({
    selector: 'app-habitaciones-board',
    providers: [HabitacionesService],
    imports: [
        CommonModule,
        FormsModule,
        AsignarPacienteModalComponent,
        RegistrarEgresoModalComponent,
        CrearHabitacionModalComponent,
        ConfirmDialogComponent
    ],
    template: `
    <div class="container-fluid mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="fa fa-bed"></i> Tablero de Habitaciones</h2>
        @if (permisos.puedeCrear(MODULOS_PERMISO.HABITACIONES)) {
          <button class="btn btn-primary" (click)="mostrarModalCrear = true">
            <i class="fa fa-plus"></i> Nueva Habitación
          </button>
        }
      </div>

      @if (errorBaja) { <div class="alert alert-danger" role="alert">{{ errorBaja }}</div> }
      @if (avisoBaja) { <div class="alert alert-success" role="status">{{ avisoBaja }}</div> }

      <div class="d-flex flex-wrap align-items-center gap-2 mb-3" role="status" aria-live="polite">
        <span class="badge" [ngClass]="claseEstadoConexion()">
          {{ mensajeEstadoConexion() }}
        </span>
        <span class="small text-muted">
          {{ mensajeSincronizacion() }}
        </span>
        @if (service.datosPotencialmenteDesactualizados()) {
          <span class="badge bg-warning text-dark">Datos potencialmente desactualizados</span>
        }
        @if (service.estadoConexion() === 'error') {
          <button type="button" class="btn btn-sm btn-outline-secondary"
                  (click)="service.reintentarConexion()">
            Reintentar conexión
          </button>
        }
      </div>

      @if (service.errorSincronizacion()) {
        <div class="alert alert-warning d-flex flex-wrap justify-content-between align-items-center gap-2">
          <span>{{ service.errorSincronizacion() }}</span>
          <button type="button" class="btn btn-sm btn-outline-dark"
                  (click)="service.reintentarSincronizacion()"
                  [disabled]="service.estadoSincronizacion() === 'sincronizando'">
            Reintentar sincronización
          </button>
        </div>
      }

      <!-- Leyenda de estados -->
      <div class="d-flex gap-3 mb-4 flex-wrap">
        <span class="badge bg-success p-2">Libre</span>
        <span class="badge bg-danger p-2">Ocupada</span>
        <span class="badge bg-warning text-dark p-2">En limpieza</span>
      </div>

      @if (cargando) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
      } @else if (habitaciones.length === 0) {
        <div class="alert alert-info text-center">No hay habitaciones registradas.</div>
      } @else {
        <div class="row g-3">
          @for (hab of habitaciones; track hab.idHabitacion) {
            <div class="col-md-3 col-sm-6">
              <div class="card h-100 shadow-sm" [ngClass]="getCardClass(hab.estado)">
                <div class="card-body">
                  <div class="d-flex justify-content-between align-items-start mb-2">
                    <h5 class="card-title mb-0">Hab. {{ hab.numeroHabitacion }}</h5>
                    <span class="badge" [ngClass]="getBadgeClass(hab.estado)">
                      {{ hab.estado }}
                    </span>
                  </div>
                  <p class="card-text text-muted small mb-1">
                    <i class="fa fa-tag"></i> {{ hab.tipoHabitacion || 'Sin tipo' }}
                  </p>
                  <p class="card-text text-muted small">
                    <i class="fa fa-building"></i> Sucursal: {{ hab.idSucursal }}
                  </p>
                </div>
                <div class="card-footer bg-transparent border-0 d-flex gap-1 flex-wrap">
                  @if (hab.estado === ESTADOS_HABITACION.LIBRE && hab.activa && permisos.puedeCrear(MODULOS_PERMISO.ASIGNACIONES_HABITACION)) {
                    <button class="btn btn-sm btn-success flex-fill" (click)="abrirModalAsignar(hab)">
                      <i class="fa fa-user-plus"></i> Asignar
                    </button>
                  } @else if (hab.estado === ESTADOS_HABITACION.OCUPADA && permisos.puedeModificar(MODULOS_PERMISO.ASIGNACIONES_HABITACION)) {
                    <button class="btn btn-sm btn-warning flex-fill" (click)="abrirModalEgreso(hab)">
                      <i class="fa fa-sign-out"></i> Egreso
                    </button>
                  } @else if (hab.estado === ESTADOS_HABITACION.EN_LIMPIEZA && permisos.puedeModificar(MODULOS_PERMISO.HABITACIONES)) {
                    <button class="btn btn-sm btn-success flex-fill" (click)="cambiarEstado(hab, 'Libre')">
                      <i class="fa fa-check"></i> Libre
                    </button>
                  }
                  <button class="btn btn-sm btn-outline-secondary" (click)="verDetalles(hab)">
                    <i class="fa fa-eye"></i>
                  </button>
                  @if (permisos.puedeEliminar(MODULOS_PERMISO.HABITACIONES) && hab.activa) {
                    <button type="button" class="btn btn-sm btn-outline-danger"
                            [disabled]="!puedeDesactivar(hab) || desactivando"
                            [attr.aria-label]="'Dar de baja la habitación ' + hab.numeroHabitacion"
                            (click)="abrirBaja(hab)">
                      <i class="bi bi-trash" aria-hidden="true"></i> Dar de baja
                    </button>
                  }
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Modal Asignar Paciente -->
    @if (habitacionSeleccionada) {
      <app-asignar-paciente-modal
        [habitacion]="habitacionSeleccionada"
        (cerrar)="habitacionSeleccionada = null"
        (asignado)="onAsignacionExitosa()">
      </app-asignar-paciente-modal>
    }

    <!-- Modal Registrar Egreso -->
    @if (habitacionParaEgreso) {
      <app-registrar-egreso-modal
        [habitacion]="habitacionParaEgreso"
        (cerrar)="habitacionParaEgreso = null"
        (egresado)="onEgresoExitoso()">
      </app-registrar-egreso-modal>
    }

    <!-- Modal Crear Habitación -->
    @if (mostrarModalCrear) {
      <app-crear-habitacion-modal
        (cerrar)="mostrarModalCrear = false"
        (creada)="onHabitacionCreada()">
      </app-crear-habitacion-modal>
    }
    @if (habitacionParaBaja) {
      <app-confirm-dialog title="Dar de baja habitación"
        [description]="'¿Dar de baja la habitación ' + habitacionParaBaja.numeroHabitacion + '?'"
        consequence="La habitación quedará inactiva. Se conservará su historial de asignaciones."
        confirmLabel="Dar de baja" [busy]="desactivando"
        (cancelled)="cancelarBaja()" (confirmed)="confirmarBaja()">
      </app-confirm-dialog>
    }
  `,
    styles: [`
    .card { transition: all 0.3s ease; cursor: pointer; }
    .card:hover { transform: translateY(-3px); }
    .bg-libre { border-left: 5px solid #198754; }
    .bg-ocupada { border-left: 5px solid #dc3545; }
    .bg-limpieza { border-left: 5px solid #ffc107; }
  `]
})
export class HabitacionesBoardComponent implements OnInit {
  readonly service = inject(HabitacionesService);
  private destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  private readonly session = inject(AuthSessionService);
  private readonly apiErrors = inject(ApiErrorService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;

  habitaciones: HabitacionResponse[] = [];
  cargando = false;
  habitacionSeleccionada: HabitacionResponse | null = null;
  habitacionParaEgreso: HabitacionResponse | null = null;
  mostrarModalCrear = false;
  habitacionParaBaja: HabitacionResponse | null = null;
  desactivando = false;
  errorBaja = '';
  avisoBaja = '';
  private identidadBaja: string | null = null;
  private revisionBaja = 0;
  private solicitudBaja?: Subscription;
  private focoBaja: HTMLElement | null = null;

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const permitido = this.permisos.puedeEliminar(MODULOS_PERMISO.HABITACIONES);
      if (this.identidadBaja && (identidad !== this.identidadBaja || !permitido)) {
        this.invalidarBaja();
        this.errorBaja = 'La sesión o los permisos cambiaron. No se puede confirmar la baja.';
      }
    });
    this.destroyRef.onDestroy(() => this.invalidarBaja());
  }

  ESTADOS_HABITACION = ESTADOS_HABITACION;

  ngOnInit() {
    this.cargar();
    // Suscribirse a actualizaciones en tiempo real
    this.service.habitaciones$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(habs => {
      this.habitaciones = habs;
    });
  }

  cargar() {
    this.cargando = true;
    this.service.cargarHabitaciones().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.cargando = false),
    ).subscribe({ error: () => undefined });
  }

  mensajeEstadoConexion(): string {
    const mensajes = {
      desconectado: 'Tiempo real desconectado',
      conectando: 'Conectando tiempo real',
      conectado: 'Tiempo real conectado',
      reconectando: 'Reconectando tiempo real',
      error: 'Error de conexión en tiempo real',
    } as const;
    return mensajes[this.service.estadoConexion()];
  }

  claseEstadoConexion(): string {
    const clases = {
      desconectado: 'bg-secondary',
      conectando: 'bg-info text-dark',
      conectado: 'bg-success',
      reconectando: 'bg-warning text-dark',
      error: 'bg-danger',
    } as const;
    return clases[this.service.estadoConexion()];
  }

  mensajeSincronizacion(): string {
    const ultima = this.service.ultimaSincronizacion();
    switch (this.service.estadoSincronizacion()) {
      case 'sincronizando': return 'Sincronizando la fotografía confirmada por la API…';
      case 'actualizado': return ultima
        ? `Última sincronización HTTP: ${new Date(ultima).toLocaleTimeString()}`
        : 'Sincronización HTTP completada.';
      case 'desactualizado': return 'La conexión cambió; se requiere confirmar el estado con la API.';
      case 'error': return 'No fue posible confirmar el estado actual mediante HTTP.';
      default: return 'Aún no se ha completado una sincronización HTTP.';
    }
  }

  getCardClass(estado: string): string {
    const map: Record<string, string> = {
      'Libre': 'bg-libre',
      'Ocupada': 'bg-ocupada',
      'En limpieza': 'bg-limpieza'
    };
    return map[estado] || '';
  }

  getBadgeClass(estado: string): string {
    const map: Record<string, string> = {
      'Libre': 'bg-success',
      'Ocupada': 'bg-danger',
      'En limpieza': 'bg-warning text-dark'
    };
    return map[estado] || 'bg-info';
  }

  abrirModalAsignar(hab: HabitacionResponse) {
    this.habitacionSeleccionada = hab;
  }

  abrirModalEgreso(hab: HabitacionResponse) {
    this.habitacionParaEgreso = hab;
  }

  puedeDesactivar(hab: HabitacionResponse): boolean {
    return this.permisos.puedeEliminar(MODULOS_PERMISO.HABITACIONES)
      && hab.activa && (hab.estado === ESTADOS_HABITACION.LIBRE
        || hab.estado === ESTADOS_HABITACION.EN_LIMPIEZA);
  }

  abrirBaja(hab: HabitacionResponse): void {
    if (this.desactivando || this.habitacionParaBaja || !this.puedeDesactivar(hab)) return;
    const actual = this.habitaciones.find(item => item.idHabitacion === hab.idHabitacion);
    const identidad = this.identidadActual();
    if (!actual || !this.puedeDesactivar(actual) || !identidad) return;
    this.errorBaja = '';
    this.avisoBaja = '';
    this.focoBaja = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.identidadBaja = identidad;
    this.habitacionParaBaja = { ...actual };
  }

  cancelarBaja(): void {
    if (this.desactivando) return;
    this.invalidarBaja();
    this.focoBaja?.focus();
  }

  confirmarBaja(): void {
    if (this.desactivando || !this.habitacionParaBaja) return;
    const seleccion = this.habitacionParaBaja;
    const identidad = this.identidadBaja;
    const actual = this.habitaciones.find(item => item.idHabitacion === seleccion.idHabitacion);
    if (!identidad || identidad !== this.identidadActual() || !actual || !this.puedeDesactivar(actual)) {
      this.errorBaja = 'La habitación, la sesión o los permisos cambiaron. No se realizó la baja.';
      this.invalidarBaja();
      this.focoBaja?.focus();
      return;
    }
    const revision = ++this.revisionBaja;
    this.desactivando = true;
    this.errorBaja = '';
    this.solicitudBaja = this.service.desactivarHabitacion(seleccion.idHabitacion).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => { if (revision === this.revisionBaja) this.desactivando = false; }),
    ).subscribe({
      next: () => {
        if (revision !== this.revisionBaja || identidad !== this.identidadActual()
          || !this.permisos.puedeEliminar(MODULOS_PERMISO.HABITACIONES)) return;
        this.habitacionParaBaja = null;
        this.identidadBaja = null;
        this.avisoBaja = `La habitación ${seleccion.numeroHabitacion} quedó inactiva.`;
        this.cargar();
        this.focoBaja?.focus();
      },
      error: (error: HttpErrorResponse) => {
        if (revision !== this.revisionBaja || identidad !== this.identidadActual()) return;
        this.habitacionParaBaja = null;
        this.identidadBaja = null;
        this.errorBaja = this.apiErrors.messageFor(error, error.status === 401
          ? 'La sesión expiró. Inicia sesión nuevamente.' : 'No fue posible dar de baja la habitación.');
        this.focoBaja?.focus();
      },
    });
  }

  private invalidarBaja(): void {
    this.revisionBaja++;
    this.solicitudBaja?.unsubscribe();
    this.habitacionParaBaja = null;
    this.identidadBaja = null;
    this.desactivando = false;
  }

  private identidadActual(): string | null {
    const id = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && id && token ? `${id}:${token}` : null;
  }

  cambiarEstado(hab: HabitacionResponse, nuevoEstado: string) {
    if (confirm(`¿Cambiar estado de Habitación ${hab.numeroHabitacion} a "${nuevoEstado}"?`)) {
      this.service.actualizarHabitacion(hab.idHabitacion, {
        idSucursal: hab.idSucursal,
        numeroHabitacion: hab.numeroHabitacion,
        tipoHabitacion: hab.tipoHabitacion,
        estado: nuevoEstado
      }).subscribe({
        next: () => this.cargar(),
        error: () => alert('Error al cambiar el estado')
      });
    }
  }

  onAsignacionExitosa() {
    this.habitacionSeleccionada = null;
    this.cargar();
  }

  onEgresoExitoso() {
    this.habitacionParaEgreso = null;
    this.cargar();
  }

  onHabitacionCreada() {
    this.mostrarModalCrear = false;
    this.cargar();
  }

  verDetalles(hab: HabitacionResponse) {
    alert(`Detalles de Habitación ${hab.numeroHabitacion}\nTipo: ${hab.tipoHabitacion}\nEstado: ${hab.estado}\nSucursal: ${hab.idSucursal}`);
  }
}
