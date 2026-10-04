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
  Cita,
  CitaFormData,
  CitaEvento,
  ESTADO_CITA_CLASE,
  ESTADO_CITA_LABEL,
  ESTADOS_CITA,
  EstadoCita,
  FranjaAgenda,
  HORAS_DISPONIBLES,
  ResumenCitas,
} from '../../core/models/cita.model';
import { CitaService } from '../../core/services/cita.service';
import { CitaRealtimeService } from '../../core/services/cita-realtime.service';

interface MedicoCatalogo { idEmpleado: number; nombre: string; especialidad: string; idSucursal: number; }
interface PacienteCatalogo { idPaciente: number; nombre: string; }

/**
 * Módulo Citas.
 *  - Programación de citas paciente ↔ médico (POST /api/Citas).
 *  - Control de disponibilidad por franjas horarias (agenda del médico).
 *  - Estados con máquina de transiciones: Programada → Confirmada → Atendida / Cancelada.
 *  - Actualización en tiempo real vía SignalR (CitaRealtimeService, mismo patrón que Habitaciones).
 */
@Component({
  selector: 'app-citas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './citas-list.component.html',
  styleUrl: './citas-list.component.css',
})
export class CitasListComponent implements OnInit {
  private svc = inject(CitaService);
  private rt = inject(CitaRealtimeService);

  /* ---------- constantes expuestas a la plantilla ---------- */
  readonly estados = ESTADOS_CITA;
  readonly estadoLabel = ESTADO_CITA_LABEL;
  readonly estadoClase = ESTADO_CITA_CLASE;
  readonly horas = HORAS_DISPONIBLES;

  /* ---------- estado de la vista ---------- */
  readonly citas = signal<Cita[]>([]);
  readonly resumen = signal<ResumenCitas | null>(null);
  readonly eventos = this.rt.eventos;          // feed SignalR (señal)
  readonly conexion = this.rt.conexion;        // estado del hub (señal)
  readonly agenda = signal<FranjaAgenda[]>([]);
  readonly medicos = signal<MedicoCatalogo[]>([]);
  readonly pacientes = signal<PacienteCatalogo[]>([]);

  fechaDia = this.hoy();                        // día seleccionado en la agenda
  filtroEstado: EstadoCita | '' = '';
  medicoSel = 0;                                // médico de la columna de disponibilidad

  cargando = false;
  guardando = false;
  error = '';
  aviso = '';

  /* modal de programación */
  modalAbierto = false;
  form: CitaFormData = this.formVacio();

  /* modal de reprogramación */
  modalReprog = false;
  reprogTarget: Cita | null = null;
  reprogForm = { fecha: '', hora: '', motivo: '' };

  /* resaltado temporal de filas actualizadas por el hub */
  resaltadas = new Set<number>();

  /* ---------------- ciclo de vida ---------------- */

  ngOnInit(): void {
    this.svc.medicos().subscribe(m => {
      this.medicos.set(m);
      if (m.length && !this.medicoSel) {
        this.medicoSel = m[0].idEmpleado;
        this.cargarAgenda();
      }
    });
    this.svc.pacientes().subscribe(p => this.pacientes.set(p));

    this.cargar();

    // Tiempo real: cada evento "CitaActualizada" del hub incrementa la señal
    // `recargar`; este effect re-sincroniza la agenda sin recargar la página.
    effect(() => {
      const n = this.rt.recargar();
      if (n > 0) this.cargar();
    });

    this.rt.conectar();
  }

  /* ---------------- carga ---------------- */

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.svc.listar(this.fechaDia, this.filtroEstado).subscribe({
      next: lista => {
        this.citas.set(lista);
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        this.error = 'No fue posible cargar las citas.';
      },
    });
    this.svc.resumen(this.fechaDia).subscribe(r => this.resumen.set(r));
  }

  cargarAgenda(): void {
    this.svc.agenda(this.fechaDia, this.medicoSel).subscribe(a => this.agenda.set(a));
  }

  cambiarDia(dias: number): void {
    const d = new Date(this.fechaDia + 'T12:00:00');
    d.setDate(d.getDate() + dias);
    this.fechaDia = this.ymd(d);
    this.cargar();
    this.cargarAgenda();
  }

  onFechaChange(): void {
    this.cargar();
    this.cargarAgenda();
  }

  setFiltroEstado(e: EstadoCita | ''): void {
    this.filtroEstado = e;
    this.cargar();
  }

  /* ---------------- helpers de presentación ---------------- */

  hoy(): string { return this.ymd(new Date()); }

  ymd(d: Date): string {
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  /** 'YYYY-MM-DDTHH:mm:ss' -> 'HH:mm' (sin lógica en plantilla) */
  horaDe(c: Cita): string { return c.fechaCita.slice(11, 16); }

  /** 'YYYY-MM-DD' -> 'lunes, 5 de octubre de 2026' */
  fechaLegible(fecha: string): string {
    return new Date(fecha + 'T12:00:00').toLocaleDateString('es-GT', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  }

  /** ISO -> 'HH:mm:ss' para el feed en vivo */
  horaEvento(e: CitaEvento): string {
    return new Date(e.fechaHora).toLocaleTimeString('es-GT', { hour12: false });
  }

  accionClase(accion: CitaEvento['accion']): string {
    switch (accion) {
      case 'CREADA': return 'text-bg-warning';
      case 'CONFIRMADA': return 'text-bg-primary';
      case 'ATENDIDA': return 'text-bg-success';
      case 'CANCELADA': return 'text-bg-danger';
      default: return 'text-bg-info';
    }
  }

  esHoy(): boolean { return this.fechaDia === this.hoy(); }

  /** El color de fondo de cada fila según estado */
  filaClase(c: Cita): string {
    const base: Record<EstadoCita, string> = {
      Programada: 'fila-programada',
      Confirmada: 'fila-confirmada',
      Atendida: 'fila-atendida',
      Cancelada: 'fila-cancelada',
    };
    const flash = this.resaltadas.has(c.idCita) ? ' fila-flash' : '';
    return base[c.estado] + flash;
  }

  /** Botones de transición permitidos (máquina de estados espejo del backend) */
  accionesDe(c: Cita): EstadoCita[] {
    const mapa: Record<EstadoCita, EstadoCita[]> = {
      Programada: ['Confirmada', 'Atendida', 'Cancelada'],
      Confirmada: ['Atendida', 'Cancelada'],
      Atendida: [],
      Cancelada: ['Programada'],
    };
    return mapa[c.estado];
  }

  iconoEstado(e: EstadoCita): string {
    switch (e) {
      case 'Programada': return 'bi bi-clock-history';
      case 'Confirmada': return 'bi bi-check2-circle';
      case 'Atendida': return 'bi bi-clipboard2-pulse';
      default: return 'bi bi-x-octagon';
    }
  }

  /* ---------------- i/ii. programar cita ---------------- */

  formVacio(): CitaFormData {
    return {
      idPaciente: null, idMedico: null, idSucursal: null,
      fecha: this.fechaDia, hora: '', duracionMin: 30, motivo: '',
    };
  }

  abrirNueva(hora?: string): void {
    this.form = this.formVacio();
    if (hora) this.form.hora = hora;
    this.modalAbierto = true;
  }

  /** Al elegir médico se fija su sucursal (FK_Empleado_Sucursal) */
  onMedicoChange(): void {
    const med = this.medicos().find(m => m.idEmpleado === Number(this.form.idMedico));
    this.form.idSucursal = med ? med.idSucursal : null;
    if (med) {
      this.medicoSel = med.idEmpleado;
      this.cargarAgenda();
    }
  }

  guardar(): void {
    this.error = '';
    this.aviso = '';
    if (!this.form.idPaciente || !this.form.idMedico || !this.form.fecha || !this.form.hora) {
      this.error = 'Paciente, médico, fecha y hora son obligatorios.';
      return;
    }
    if (!(this.form.duracionMin > 0)) {
      this.error = 'La duración debe ser mayor a cero.';
      return;
    }
    this.guardando = true;
    this.svc.crear(this.form).subscribe({
      next: c => {
        this.guardando = false;
        this.modalAbierto = false;
        this.aviso = `Cita #${c.idCita} programada: ${c.pacienteNombre} con ${c.medicoNombre} a las ${this.horaDe(c)}.`;
        if (c.fechaCita.slice(0, 10) !== this.fechaDia) {
          this.fechaDia = c.fechaCita.slice(0, 10);
        }
        this.cargar();
        this.cargarAgenda();
      },
      error: err => {
        this.guardando = false;
        this.error = err?.error?.message ?? 'No se pudo programar la cita.';
      },
    });
  }

  /* ---------------- estados en vivo ---------------- */

  cambiarEstado(c: Cita, estado: EstadoCita): void {
    this.error = '';
    this.svc.cambiarEstado(c.idCita, estado).subscribe({
      next: act => {
        this.aviso = `Cita de ${act.pacienteNombre}: ${estado}.`;
        this.parpadear(act.idCita);
        this.rt.invocarCambiarEstado(act.idCita, estado); // bidireccional (no-op en mock)
        this.cargar();
        this.cargarAgenda();
      },
      error: err => (this.error = err?.error?.message ?? 'No se pudo actualizar el estado.'),
    });
  }

  /* ---------------- reprogramación ---------------- */

  abrirReprogramar(c: Cita): void {
    this.reprogTarget = c;
    this.reprogForm = {
      fecha: c.fechaCita.slice(0, 10),
      hora: this.horaDe(c),
      motivo: c.motivo ?? '',
    };
    this.modalReprog = true;
  }

  confirmarReprogramar(): void {
    if (!this.reprogTarget) return;
    this.error = '';
    this.svc.reprogramar(this.reprogTarget.idCita, this.reprogForm).subscribe({
      next: c => {
        this.modalReprog = false;
        this.reprogTarget = null;
        this.aviso = `Cita #${c.idCita} reprogramada para ${c.fechaCita.slice(0, 10)} ${this.horaDe(c)}.`;
        this.parpadear(c.idCita);
        this.cargar();
        this.cargarAgenda();
      },
      error: err => (this.error = err?.error?.message ?? 'No se pudo reprogramar.'),
    });
  }

  cerrarModalReprog(): void {
    this.modalReprog = false;
    this.reprogTarget = null;
  }

  /** Parpadeo visual de la fila cuando llega un cambio por el hub */
  private parpadear(id: number): void {
    this.resaltadas.add(id);
    setTimeout(() => this.resaltadas.delete(id), 1800);
  }

  get citasOrdenadas(): Cita[] {
    return [...this.citas()].sort((a, b) => a.fechaCita.localeCompare(b.fechaCita));
  }
}
