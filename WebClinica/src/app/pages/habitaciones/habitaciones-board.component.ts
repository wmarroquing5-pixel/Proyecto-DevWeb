import {
  Component,
  OnInit,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AsignacionHabitacion,
  ESTADO_CONEXION_LABEL,
  ESTADO_HABITACION_UI,
  ESTADOS_HABITACION,
  EstadoHabitacion,
  Habitacion,
  HabitacionEvent,
  HabitacionFormData,
  PacienteCatalogo,
  ResumenHabitaciones,
} from '../../core/models/habitacion.model';
import { HabitacionService } from '../../core/services/habitacion.service';
import { HabitacionRealtimeService } from '../../core/services/habitacion-realtime.service';

/**
 * Módulo Habitaciones disponibles.
 *  i.   Registro y control de estado (Libre / Ocupada / En limpieza) — CHK_Habitacion_Estado.
 *  ii.  Actualización en tiempo real por SignalR (HabitacionRealtimeService).
 *  iii. Pacientes por habitación (tarjetas + historial de asignación).
 *  iv.  Asignar paciente a habitación (POST /Habitaciones/{id}/AsignarPaciente).
 *  v.   Control de fechas de ingreso y egreso (AsignacionHabitacion.FechaIngreso/FechaEgreso).
 */
@Component({
  selector: 'app-habitaciones-board',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './habitaciones-board.component.html',
  styleUrl: './habitaciones-board.component.css',
})
export class HabitacionesBoardComponent implements OnInit {
  private svc = inject(HabitacionService);
  private rt = inject(HabitacionRealtimeService);

  readonly habitaciones = signal<Habitacion[]>([]);
  readonly resumen = signal<ResumenHabitaciones | null>(null);
  readonly eventos = this.rt.eventos; // feed en tiempo real (señal del hub)
  readonly conexion = this.rt.conexion;
  readonly conexionLabel = ESTADO_CONEXION_LABEL;
  readonly estados = ESTADOS_HABITACION;
  /** En el formulario manual «Ocupada» no es elegible: solo se alcanza
   * asignando un paciente (CHK_Habitacion_Estado + regla de negocio). */
  readonly estadosEditables = ESTADOS_HABITACION.filter(e => e !== 'Ocupada');
  readonly estadoUI = ESTADO_HABITACION_UI;

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  filtroEstado = this.svc.filtroEstado();
  idSucursalFiltro = this.svc.filtroSucursal();
  sucursales: { idSucursal: number; nombre: string }[] = [];

  /** Tarjeta seleccionada para ver pacientes/historial (inciso iii). */
  seleccionada: Habitacion | null = null;
  historialSeleccion = signal<AsignacionHabitacion[]>([]);

  /** Modal registro/edición (inciso i). */
  modalAbierto = false;
  editando = false;
  idEdit: number | null = null;
  guardando = false;
  form: HabitacionFormData = this.svc.formVacio();

  /** Modal asignación de paciente (incisos iv y v). */
  modalAsig = false;
  habTarget: Habitacion | null = null;
  pacientes = signal<PacienteCatalogo[]>([]);
  asigForm = this.asignacionVacia();

  /** Modal egreso (inciso v). */
  modalEgreso = false;
  egresoTarget: Habitacion | null = null;
  egresoForm = { fechaEgreso: this.nowLocal(), destino: 'En limpieza' as EstadoHabitacion, obs: '' };

  resaltadas = new Set<number>();

  // =================== ciclo de vida ===================

  ngOnInit(): void {
    this.svc.sucursales().subscribe(s => (this.sucursales = s));
    this.cargar();

    // ii. Suscripción al canal "HabitacionActualizada" del Hub SignalR.
    // El servicio expone una señal que incrementa en cada evento/reconexión;
    // este effect re-sincroniza el tablero automáticamente sin recargar la página.
    effect(() => {
      const n = this.rt.recargar();
      if (n > 0) this.cargar();
    });
    this.rt.connect();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.svc.listar().subscribe({
      next: habs => {
        this.habitaciones.set(habs);
        this.cargando.set(false);
        this.resaltarUltima();
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('No fue posible cargar las habitaciones.');
      },
    });
    this.svc.resumen().subscribe(r => this.resumen.set(r));
  }

  // =================== filtros ===================

  setFiltroEstado(e: string): void {
    this.filtroEstado = e === this.filtroEstado ? '' : e;
    this.svc.filtroEstado.set(this.filtroEstado);
    this.cargar();
  }

  onSucursalChange(): void {
    this.svc.filtroSucursal.set(this.idSucursalFiltro);
    this.cargar();
  }

  get visibles(): Habitacion[] {
    return this.habitaciones().filter(
      h => h.activa && (!this.filtroEstado || h.estado === this.filtroEstado),
    );
  }

  // =================== i. registro y control de estado ===================

  abrirNueva(): void {
    this.editando = false;
    this.idEdit = null;
    this.form = this.svc.formVacio();
    this.modalAbierto = true;
  }

  abrirEditar(h: Habitacion): void {
    this.editando = true;
    this.idEdit = h.idHabitacion;
    this.form = {
      idSucursal: h.idSucursal,
      numeroHabitacion: h.numeroHabitacion,
      tipoHabitacion: h.tipoHabitacion ?? '',
      estado: h.estado,
    };
    this.modalAbierto = true;
  }

  guardar(): void {
    if (!this.form.idSucursal || !this.form.numeroHabitacion.trim()) {
      this.error.set('La sucursal y el número de habitación son obligatorios.');
      return;
    }
    this.guardando = true;
    const req$ = this.editando
      ? this.svc.actualizar(this.idEdit!, this.form)
      : this.svc.crear(this.form);
    req$.subscribe({
      next: h => {
        this.guardando = false;
        this.modalAbierto = false;
        this.aviso.set(`Habitación ${h.numeroHabitacion} guardada correctamente.`);
        // El backend hace broadcast por SignalR; localmente pintamos ya el cambio:
        this.emitirLocal('estado', h, null, h.estado, `Habitación ${h.numeroHabitacion} registrada/actualizada.`);
        this.cargar();
      },
      error: err => {
        this.guardando = false;
        this.error.set(err?.error?.message ?? 'No se pudo guardar la habitación.');
      },
    });
  }

  /** Cambio rápido hacia En limpieza / Libre desde la tarjeta (inciso i). */
  cambiarEstado(h: Habitacion, estado: EstadoHabitacion): void {
    this.error.set('');
    this.svc.cambiarEstado(h.idHabitacion, estado).subscribe({
      next: act => {
        this.aviso.set(`Habitación ${act.numeroHabitacion}: ${estado}.`);
        this.emitirLocal('estado', act, h.estado, estado, `Estado cambiado por ${this.usuarioActual()}.`);
        this.cargar();
      },
      error: err => this.error.set(err?.error?.message ?? 'No se pudo cambiar el estado.'),
    });
  }

  desactivar(h: Habitacion): void {
    if (!confirm(`¿Dar de baja la habitación ${h.numeroHabitacion}?`)) return;
    this.svc.eliminar(h.idHabitacion).subscribe({
      next: () => {
        this.aviso.set(`Habitación ${h.numeroHabitacion} dada de baja (Activa = 0).`);
        this.cargar();
      },
      error: err => this.error.set(err?.error?.message ?? 'No se pudo dar de baja.'),
    });
  }

  // =================== iii. pacientes por habitación ===================

  seleccionar(h: Habitacion): void {
    this.seleccionada = h;
    this.svc.listarAsignaciones(h.numeroHabitacion, true).subscribe(list => {
      this.historialSeleccion.set(list.filter(a => a.idHabitacion === h.idHabitacion));
    });
  }

  cerrarDetalle(): void {
    this.seleccionada = null;
  }

  diasDe(h: Habitacion): number {
    if (!h.fechaIngreso) return 0;
    return Math.max(1, Math.round((Date.now() - new Date(h.fechaIngreso).getTime()) / 86_400_000));
  }

  // =================== iv. asignar paciente ===================

  abrirAsignacion(h: Habitacion): void {
    this.habTarget = h;
    this.asigForm = this.asignacionVacia();
    this.modalAsig = true;
    this.svc.pacientesCatalogo().subscribe(p => this.pacientes.set(p));
  }

  asignacionVacia() {
    return { idPaciente: 0, fechaIngreso: this.nowLocal(), observaciones: '' };
  }

  confirmarAsignacion(): void {
    if (!this.habTarget || !this.asigForm.idPaciente) {
      this.error.set('Seleccione el paciente a asignar.');
      return;
    }
    if (new Date(this.asigForm.fechaIngreso) > new Date()) {
      this.error.set('La fecha de ingreso no puede ser futura.');
      return;
    }
    this.guardando = true;
    this.svc
      .asignarPaciente(this.habTarget.idHabitacion, {
        idPaciente: this.asigForm.idPaciente,
        fechaIngreso: new Date(this.asigForm.fechaIngreso).toISOString(),
        observaciones: this.asigForm.observaciones,
      })
      .subscribe({
        next: ({ habitacion, asignacion }) => {
          this.guardando = false;
          this.modalAsig = false;
          this.aviso.set(
            `${asignacion.pacienteNombre} asignado a la habitación ${habitacion.numeroHabitacion} (ingreso registrado).`,
          );
          this.emitirLocal(
            'asignacion', habitacion, 'Libre', 'Ocupada',
            `Ingreso de ${asignacion.pacienteNombre}.`,
          );
          this.cargar();
        },
        error: err => {
          this.guardando = false;
          this.error.set(err?.error?.message ?? 'No se pudo asignar el paciente.');
        },
      });
  }

  // =================== v. egreso ===================

  abrirEgreso(h: Habitacion): void {
    this.egresoTarget = h;
    this.egresoForm = { fechaEgreso: this.nowLocal(), destino: 'En limpieza', obs: '' };
    this.modalEgreso = true;
  }

  confirmarEgreso(): void {
    const h = this.egresoTarget!;
    if (!h.idAsignacionActiva) return;
    if (new Date(this.egresoForm.fechaEgreso) <= new Date(h.fechaIngreso!)) {
      this.error.set('La fecha de egreso debe ser posterior a la de ingreso.');
      return;
    }
    this.guardando = true;
    this.svc
      .registrarEgreso(h.idAsignacionActiva, {
        fechaEgreso: new Date(this.egresoForm.fechaEgreso).toISOString(),
        destinoEstado: this.egresoForm.destino,
        observaciones: this.egresoForm.obs,
      })
      .subscribe({
        next: ({ habitacion, asignacion }) => {
          this.guardando = false;
          this.modalEgreso = false;
          this.aviso.set(
            `Egreso de ${asignacion.pacienteNombre} registrado (${asignacion.diasEstancia} día(s) de estancia). Habitación en "${habitacion.estado}".`,
          );
          this.emitirLocal(
            'egreso', habitacion, 'Ocupada', habitacion.estado,
            `Egreso de ${asignacion.pacienteNombre}.`,
          );
          this.cargar();
        },
        error: err => {
          this.guardando = false;
          this.error.set(err?.error?.message ?? 'No se pudo registrar el egreso.');
        },
      });
  }

  // =================== helpers ===================

  private nowLocal(): string {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  private usuarioActual(): string {
    try {
      return JSON.parse(localStorage.getItem('sesion') ?? '{}')?.username ?? 'usuario';
    } catch {
      return 'usuario';
    }
  }

  /** ii. Publica el evento en el feed local (optimista) con el mismo
   * contrato que envía el Hub "HabitacionActualizada" del backend .NET. */
  private emitirLocal(
    tipo: HabitacionEvent['tipoEvento'],
    h: Habitacion,
    anterior: EstadoHabitacion | null,
    nuevo: EstadoHabitacion,
    mensaje: string,
  ): void {
    this.rt.aplicarLocal({
      tipoEvento: tipo,
      idHabitacion: h.idHabitacion,
      habitacionNumero: h.numeroHabitacion,
      sucursalNombre: h.sucursalNombre,
      estadoAnterior: anterior,
      estadoNuevo: nuevo,
      pacienteNombre: h.pacienteNombre,
      mensaje,
      fechaHora: new Date().toISOString(),
      usuarioOrigen: this.usuarioActual(),
    });
  }

  private resaltarUltima(): void {
    const ult = this.eventos()[0];
    if (ult) {
      this.resaltadas.add(ult.idHabitacion);
      setTimeout(() => this.resaltadas.delete(ult.idHabitacion), 2500);
    }
  }

  fmtFecha(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-GT', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  horaEvento(iso: string): string {
    return new Date(iso).toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
