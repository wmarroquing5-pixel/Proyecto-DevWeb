import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EmpleadosService } from '../../core/services/empleado.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import {
  CrearEmpleadoRequest,
  ActualizarEmpleadoRequest,
  EmpleadoDetalleResponse
} from '../../core/models/empleado.model';
import { Sucursal, Especialidad, Turno } from '../../core/models/catalogos.model';

@Component({
  selector: 'app-empleado-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Empleado' : 'Nuevo Empleado' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <div class="row g-3">
          <!-- Datos Personales -->
          <div class="col-md-6">
            <label class="form-label">Nombres *</label>
            <input type="text" class="form-control" [(ngModel)]="form.nombres" name="nombres" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Apellidos *</label>
            <input type="text" class="form-control" [(ngModel)]="form.apellidos" name="apellidos" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">DPI *</label>
            <input type="text" class="form-control" [(ngModel)]="form.dpi" name="dpi" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Tipo de Empleado *</label>
            <select class="form-select" [(ngModel)]="form.tipoEmpleado" name="tipoEmpleado" required>
              <option value="">Seleccione...</option>
              <option value="Medico">Médico</option>
              <option value="Enfermero">Enfermero</option>
              <option value="Recepcionista">Recepcionista</option>
              <option value="Administrativo">Administrativo</option>
              <option value="Bodeguero">Bodeguero</option>
            </select>
          </div>

          <!-- Contacto -->
          <div class="col-md-6">
            <label class="form-label">Teléfono</label>
            <input type="tel" class="form-control" [(ngModel)]="form.telefono" name="telefono">
          </div>
          <div class="col-md-6">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" class="form-control" [(ngModel)]="form.correoElectronico" name="correoElectronico">
          </div>
          <div class="col-12">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-control" [(ngModel)]="form.direccion" name="direccion">
          </div>

          <!-- Información Laboral -->
          <div class="col-md-4">
            <label class="form-label">Sucursal *</label>
            <select class="form-select" [(ngModel)]="form.idSucursal" name="idSucursal" required>
              <option value="">Seleccione...</option>
              @for (s of sucursales; track s.idSucursal) {
                <option [ngValue]="s.idSucursal">{{ s.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Especialidad</label>
            <select class="form-select" [(ngModel)]="form.idEspecialidad" name="idEspecialidad">
              <option value="null">Seleccione...</option>
              @for (e of especialidades; track e.idEspecialidad) {
                <option [ngValue]="e.idEspecialidad">{{ e.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Turno</label>
            <select class="form-select" [(ngModel)]="form.idTurno" name="idTurno">
              <option value="">Seleccione...</option>
              @for (t of turnos; track t.idTurno) {
                <option [ngValue]="t.idTurno">{{ t.nombre }} ({{ t.jornada }})</option>
              }
            </select>
          </div>
          <div class="col-md-4">
            <label class="form-label">Fecha de Ingreso</label>
            <input type="date" class="form-control" [(ngModel)]="form.fechaIngreso" name="fechaIngreso">
          </div>
          <div class="col-md-4">
            <label class="form-label">Tipo de Sangre</label>
            <select class="form-select" [(ngModel)]="form.tipoSangre" name="tipoSangre">
              <option value="">Seleccione...</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          @if (esEdicion) {
            <div class="col-md-4 d-flex align-items-end">
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="activo" [(ngModel)]="form.activo" name="activo">
                <label class="form-check-label" for="activo">Activo</label>
              </div>
            </div>
          }
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/admin/empleados" class="btn btn-secondary">Cancelar</a>
        </div>
      </form>
    </div>
  `
})
export class EmpleadoFormComponent implements OnInit {
  private empleadosService = inject(EmpleadosService);
  private catalogosService = inject(CatalogosService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  esEdicion = false;
  cargando = false;
  error = '';

  sucursales: Sucursal[] = [];
  especialidades: Especialidad[] = [];
  turnos: Turno[] = [];

  form: any = {
    idSucursal: null,
    idEspecialidad: null,
    nombres: '',
    apellidos: '',
    dpi: '',
    tipoEmpleado: '',
    fechaIngreso: null,
    tipoSangre: null,
    idTurno: null,
    direccion: '',
    telefono: '',
    correoElectronico: '',
    activo: true
  };

  ngOnInit() {
    this.cargarCatalogos();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.cargando = true;
      this.empleadosService.obtener(+id).subscribe({
        next: (emp: EmpleadoDetalleResponse) => {
          this.form = { ...emp };
          this.cargando = false;
        },
        error: () => {
          this.error = 'Empleado no encontrado';
          this.cargando = false;
        }
      });
    }
  }

  cargarCatalogos() {
    this.catalogosService.getSucursales().subscribe({
      next: (data) => (this.sucursales = data),
      error: () => console.error('Error cargando sucursales')
    });

    this.catalogosService.getEspecialidades().subscribe({
      next: (data) => (this.especialidades = data),
      error: () => console.error('Error cargando especialidades')
    });

    this.catalogosService.getTurnos().subscribe({
      next: (data) => (this.turnos = data),
      error: () => console.error('Error cargando turnos')
    });
  }

  guardar() {
    this.cargando = true;
    this.error = '';

    if (this.esEdicion) {
      const request: ActualizarEmpleadoRequest = this.form;
      this.empleadosService.actualizar(this.form.idEmpleado, request).subscribe({
        next: () => this.router.navigate(['/admin/empleados']),
        error: () => {
          this.error = 'Error al actualizar';
          this.cargando = false;
        }
      });
    } else {
      const request: CrearEmpleadoRequest = this.form;
      this.empleadosService.crear(request).subscribe({
        next: () => this.router.navigate(['/admin/empleados']),
        error: () => {
          this.error = 'Error al crear';
          this.cargando = false;
        }
      });
    }
  }
}