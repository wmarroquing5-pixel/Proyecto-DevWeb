import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Paciente, PacienteFormData, SEXOS_OPCIONES, SexoPaciente } from '../../core/models/paciente.model';
import { PacienteService } from '../../core/services/paciente.service';

/**
 * Módulo Pacientes - i. Registro de datos generales.
 * Listado con búsqueda + alta/edición en modal. Las validaciones del
 * formulario replican las restricciones del script SQL (NOT NULL / UNIQUE DPI).
 */
@Component({
  selector: 'app-pacientes-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './pacientes-list.component.html',
  styleUrl: './pacientes-list.component.css',
})
export class PacientesListComponent implements OnInit {
  private svc = inject(PacienteService);

  readonly pacientes = signal<Paciente[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  filtro = this.svc.filtro();
  sexos = SEXOS_OPCIONES;

  /** Fecha máxima para el input date (no se permite nacer en el futuro) */
  readonly todayIso = new Date().toISOString().slice(0, 10);

  /** Estado del modal */
  modalAbierto = false;
  editando = false;
  idEdit: number | null = null;
  guardando = false;
  form: PacienteFormData = this.formVacio();

  ngOnInit(): void {
    this.cargar();
  }

  get tituloModal(): string {
    return this.editando ? 'Editar paciente' : 'Registrar paciente';
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.svc.listar(this.filtro).subscribe({
      next: list => this.pacientes.set(list),
      error: () => this.error.set('No se pudo conectar con el servidor de pacientes.'),
      complete: () => this.cargando.set(false),
    });
  }

  buscar(): void {
    this.svc.filtro.set(this.filtro);
    this.cargar();
  }

  limpiarFiltro(): void {
    this.filtro = '';
    this.buscar();
  }

  /* ----------------------------- Modal ----------------------------- */

  nuevo(): void {
    this.form = this.formVacio();
    this.editando = false;
    this.idEdit = null;
    this.aviso.set('');
    this.modalAbierto = true;
  }

  editar(p: Paciente): void {
    this.form = this.formFrom(p);
    this.editando = true;
    this.idEdit = p.idPaciente;
    this.aviso.set('');
    this.modalAbierto = true;
  }

  cerrar(): void {
    this.modalAbierto = false;
  }

  guardar(f: any): void {
    this.aviso.set('');
    if (!f?.valid) {
      this.aviso.set('Complete los campos obligatorios: nombre, apellidos y fecha de nacimiento.');
      return;
    }
    if (this.form.dpi && !/^(\d{13}|\d{12})$/.test(this.form.dpi.trim())) {
      this.aviso.set('El DPI debe contener 13 dígitos (sin guiones).');
      return;
    }
    if (this.form.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.form.correo.trim())) {
      this.aviso.set('El correo electrónico no tiene un formato válido.');
      return;
    }

    this.guardando = true;
    const req = this.editando && this.idEdit !== null
      ? this.svc.actualizar(this.idEdit, this.form)
      : this.svc.crear(this.form);

    req.subscribe({
      next: p => {
        this.aviso.set(`Paciente ${p.nombres} ${p.apellidos} guardado correctamente.`);
        this.modalAbierto = false;
        this.cargar();
      },
      error: () => this.aviso.set('Error al guardar. Verifique que el DPI no esté duplicado (restricción UNIQUE).'),
      complete: () => (this.guardando = false),
    });
  }

  desactivar(p: Paciente): void {
    if (!confirm(`¿Desactivar al paciente ${p.nombres} ${p.apellidos}? (baja lógica, Activo = 0)`)) return;
    this.svc.desactivar(p.idPaciente).subscribe(() => {
      this.aviso.set('Paciente desactivado.');
      this.cargar();
    });
  }

  reactivar(p: Paciente): void {
    this.svc.actualizar(p.idPaciente, { ...this.formFrom(p), activo: true }).subscribe(() => {
      this.aviso.set('Paciente reactivado.');
      this.cargar();
    });
  }

  /* --------------------------- Utilidades --------------------------- */

  iniciales(p: Paciente): string {
    return `${(p.nombres[0] ?? '').toUpperCase()}${(p.apellidos[0] ?? '').toUpperCase()}`;
  }

  nombreCompleto(p: Paciente): string {
    return `${p.nombres} ${p.apellidos}`;
  }

  /** Edad calculada desde FechaNacimiento (DATE NOT NULL) */
  edad(p: Paciente): number {
    const n = new Date(p.fechaNacimiento);
    const hoy = new Date();
    let e = hoy.getFullYear() - n.getFullYear();
    const m = hoy.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--;
    return e;
  }

  fmtFecha(d: string): string {
    return d ? d.slice(0, 10) : '—';
  }

  fmtFechaHora(d: string): string {
    if (!d) return '—';
    const f = new Date(d);
    return f.toLocaleDateString('es-GT') + ' ' +
           f.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  private formFrom(p: Paciente): PacienteFormData {
    return {
      nombres: p.nombres, apellidos: p.apellidos, dpi: p.dpi ?? '',
      fechaNacimiento: p.fechaNacimiento, sexo: (p.sexo as SexoPaciente) ?? '',
      telefono: p.telefono ?? '', correo: p.correo ?? '', activo: p.activo,
    };
  }

  private formVacio(): PacienteFormData {
    return {
      nombres: '', apellidos: '', dpi: '', fechaNacimiento: '',
      sexo: '', telefono: '', correo: '', activo: true,
    };
  }
}
