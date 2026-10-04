import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  CatalogoEspecialidad,
  CatalogoSucursalSimple,
  Empleado,
  EmpleadoFormData,
  ResumenEmpleados,
  Rol,
  TIPOS_EMPLEADO,
  TIPO_EMPLEADO_LABEL,
  TipoEmpleado,
} from '../../core/models/empleado.model';
import { EmpleadoService } from '../../core/services/empleado.service';

/**
 * Módulo Empleados
 *  i.  Registro de doctores, enfermeras y personal administrativo
 *      (tabla Empleado con CHK_Empleado_Tipo = Medico | Enfermera | Administrativo).
 *  ii. Asignación de especialidades (FK Empleado.IdEspecialidad -> Especialidad)
 *      y roles dentro del sistema (Usuario.IdRol -> Rol).
 */
@Component({
  selector: 'app-empleados-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './empleados-list.component.html',
  styleUrl: './empleados-list.component.css',
})
export class EmpleadosListComponent implements OnInit {
  private svc = inject(EmpleadoService);

  readonly empleados = signal<Empleado[]>([]);
  readonly sucursales = signal<CatalogoSucursalSimple[]>([]);
  readonly especialidades = signal<CatalogoEspecialidad[]>([]);
  readonly roles = signal<Rol[]>([]);
  readonly resumen = signal<ResumenEmpleados | null>(null);

  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  filtro = this.svc.filtro();
  tipoFiltro = this.svc.tipoFiltro();
  mostrarInactivos = false;

  tipos = TIPOS_EMPLEADO;
  tipoLabel = TIPO_EMPLEADO_LABEL;

  /** Modal registro/edición */
  modalAbierto = false;
  editando = false;
  idEdit: number | null = null;
  guardando = false;
  form: EmpleadoFormData = this.svc.formVacio();

  /** Modal asignación rápida de especialidad y roles (inciso ii) */
  modalAsig = false;
  asigEmpleado: Empleado | null = null;
  asigEspecialidad: number | '' = '';
  asigRolesIds: number[] = [];
  guardandoAsig = false;

  /** Catálogo de especialidades (alta inline) */
  modalEsp = false;
  nuevaEsp = '';
  guardandoEsp = false;

  readonly todayIso = new Date().toISOString().slice(0, 10);

  ngOnInit(): void {
    this.svc.sucursales().subscribe(s => this.sucursales.set(s));
    this.svc.especialidades().subscribe(e => this.especialidades.set(e));
    this.svc.roles().subscribe(r => this.roles.set(r));
    this.cargar();
  }

  get tituloModal(): string {
    return this.editando ? 'Editar empleado' : 'Registrar empleado';
  }

  /** Médicos: la especialidad es obligatoria (regla de negocio sobre FK NULL) */
  get especialidadObligatoria(): boolean {
    return this.form.tipoEmpleado === 'Medico';
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.svc.listar(this.filtro, this.tipoFiltro).subscribe({
      next: list => this.empleados.set(list),
      error: () => this.error.set('No se pudo conectar con el servidor de empleados.'),
      complete: () => {
        this.cargando.set(false);
        this.svc.resumen().subscribe(r => this.resumen.set(r));
      },
    });
  }

  buscar(): void {
    this.svc.filtro.set(this.filtro);
    this.svc.tipoFiltro.set(this.tipoFiltro);
    this.cargar();
  }

  limpiarFiltro(): void {
    this.filtro = '';
    this.tipoFiltro = '';
    this.buscar();
  }

  cambiarTipo(t: string): void {
    this.tipoFiltro = t;
    this.buscar();
  }

  toggleInactivos(): void {
    this.mostrarInactivos = !this.mostrarInactivos;
  }

  visibles(): Empleado[] {
    const lista = this.empleados();
    return this.mostrarInactivos ? lista : lista.filter(e => e.activo);
  }

  /* ------------------- i. Registro de empleados ------------------- */

  nuevo(): void {
    this.form = this.svc.formVacio();
    this.editando = false;
    this.idEdit = null;
    this.aviso.set('');
    this.modalAbierto = true;
  }

  editar(e: Empleado): void {
    this.form = this.svc.formFromEmpleado(e, this.roles());
    this.editando = true;
    this.idEdit = e.idEmpleado;
    this.aviso.set('');
    this.modalAbierto = true;
  }

  cerrar(): void {
    this.modalAbierto = false;
  }

  /** Alterna un rol del sistema en el formulario de registro */
  toggleFormRol(idRol: number): void {
    this.form.rolesIds = this.form.rolesIds.includes(idRol)
      ? this.form.rolesIds.filter(x => x !== idRol)
      : [...this.form.rolesIds, idRol];
  }

  onTipoCambio(): void {
    // El personal administrativo no maneja especialidad clínica
    if (this.form.tipoEmpleado === 'Administrativo') this.form.idEspecialidad = '';
  }

  guardar(f: any): void {
    this.aviso.set('');
    if (!f?.valid) {
      this.aviso.set('Complete los campos obligatorios: nombres, apellidos, DPI, tipo y sucursal.');
      return;
    }
    if (!this.form.dpi || !/^(\d{13}|\d{12})$/.test(this.form.dpi.trim())) {
      this.aviso.set('El DPI es obligatorio y debe contener 13 dígitos (sin guiones).');
      return;
    }
    if (this.form.correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(this.form.correo.trim())) {
      this.aviso.set('El correo electrónico no tiene un formato válido.');
      return;
    }
    if (this.especialidadObligatoria && !this.form.idEspecialidad) {
      this.aviso.set('Los médicos deben tener una especialidad asignada.');
      return;
    }
    if (!this.form.rolesIds.length) {
      this.aviso.set('Asigne al menos un rol dentro del sistema.');
      return;
    }

    this.guardando = true;
    const req = this.editando && this.idEdit !== null
      ? this.svc.actualizar(this.idEdit, this.form)
      : this.svc.crear(this.form);

    req.subscribe({
      next: e => {
        this.aviso.set(`Empleado ${e.nombres} ${e.apellidos} guardado correctamente.`);
        this.modalAbierto = false;
        this.cargar();
      },
      error: () => this.aviso.set('Error al guardar. Verifique que el DPI no esté duplicado (restricción UNIQUE).'),
      complete: () => (this.guardando = false),
    });
  }

  desactivar(e: Empleado): void {
    if (!confirm(`¿Desactivar al empleado ${e.nombres} ${e.apellidos}? (baja lógica, Activo = 0)`)) return;
    this.svc.desactivar(e.idEmpleado).subscribe(() => {
      this.aviso.set('Empleado desactivado.');
      this.cargar();
    });
  }

  reactivar(e: Empleado): void {
    this.svc.actualizar(e.idEmpleado, { ...this.svc.formFromEmpleado(e, this.roles()), activo: true })
      .subscribe(() => {
        this.aviso.set('Empleado reactivado.');
        this.cargar();
      });
  }

  /* ------- ii. Asignación de especialidad y roles (expresada) ------- */

  abrirAsignacion(e: Empleado): void {
    this.asigEmpleado = e;
    this.asigEspecialidad = e.idEspecialidad ?? '';
    this.asigRolesIds = e.roles
      .map(n => this.roles().find(r => r.nombre === n)?.idRol)
      .filter((x): x is number => !!x);
    this.aviso.set('');
    this.modalAsig = true;
  }

  cerrarAsignacion(): void {
    this.modalAsig = false;
    this.asigEmpleado = null;
  }

  toggleRol(idRol: number): void {
    this.asigRolesIds = this.asigRolesIds.includes(idRol)
      ? this.asigRolesIds.filter(x => x !== idRol)
      : [...this.asigRolesIds, idRol];
  }

  guardarAsignacion(): void {
    const e = this.asigEmpleado;
    if (!e) return;
    if (e.tipoEmpleado === 'Medico' && !this.asigEspecialidad) {
      this.aviso.set('Un médico debe conservar su especialidad asignada.');
      return;
    }
    if (!this.asigRolesIds.length) {
      this.aviso.set('Seleccione al menos un rol dentro del sistema.');
      return;
    }
    this.guardandoAsig = true;
    this.svc.actualizar(e.idEmpleado, {
      ...this.svc.formFromEmpleado(e, this.roles()),
      idEspecialidad: this.asigEspecialidad,
      rolesIds: this.asigRolesIds,
    }).subscribe({
      next: act => {
        this.cerrarAsignacion();
        this.aviso.set(
          `${act.nombres} ${act.apellidos}: especialidad y roles actualizados (${act.roles.join(', ') || 'ninguno'}).`,
        );
        this.cargar();
      },
      error: () => this.aviso.set('Error al actualizar la asignación.'),
      complete: () => (this.guardandoAsig = false),
    });
  }

  /* -------------------- Catálogo de especialidades -------------------- */

  abrirCatalogoEsp(): void {
    this.nuevaEsp = '';
    this.aviso.set('');
    this.modalEsp = true;
  }

  guardarEspecialidad(): void {
    const nombre = this.nuevaEsp.trim();
    if (nombre.length < 3) {
      this.aviso.set('El nombre de la especialidad debe tener al menos 3 caracteres.');
      return;
    }
    this.guardandoEsp = true;
    this.svc.crearEspecialidad(nombre).subscribe({
      next: esp => {
        this.especialidades.update(list => [...list, esp]);
        this.nuevaEsp = '';
        this.aviso.set(`Especialidad "${esp.nombre}" registrada en el catálogo.`);
      },
      error: () => this.aviso.set('No se pudo registrar. La especialidad puede estar duplicada (UNIQUE).'),
      complete: () => (this.guardandoEsp = false),
    });
  }

  /* --------------------------- Helpers --------------------------- */

  iniciales(e: Empleado): string {
    return `${(e.nombres[0] ?? '').toUpperCase()}${(e.apellidos[0] ?? '').toUpperCase()}`;
  }

  nombreCompleto(e: Empleado): string {
    return `${e.nombres} ${e.apellidos}`;
  }

  badgeTipo(t: TipoEmpleado): string {
    return t === 'Medico' ? 'text-bg-primary' : t === 'Enfermera' ? 'text-bg-success' : 'text-bg-secondary';
  }

  antiguedad(e: Empleado): string {
    if (!e.fechaIngreso) return '—';
    const m = Math.max(0, Math.floor((Date.now() - new Date(e.fechaIngreso).getTime()) / (1000 * 60 * 60 * 24 * 30.44)));
    if (m < 12) return `${m} mes${m === 1 ? '' : 'es'}`;
    const años = Math.floor(m / 12);
    const meses = m % 12;
    return `${años} año${años === 1 ? '' : 's'}${meses ? `, ${meses} m` : ''}`;
  }

  fmtFechaHora(d: string): string {
    if (!d) return '—';
    const f = new Date(d);
    return f.toLocaleDateString('es-GT') + ' ' +
           f.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  rolNombre(idRol: number): string {
    return this.roles().find(r => r.idRol === idRol)?.nombre ?? '';
  }
}
