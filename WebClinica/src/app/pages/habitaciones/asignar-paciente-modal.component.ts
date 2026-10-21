import { Component, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { HabitacionResponse, CrearAsignacionHabitacionRequest } from '../../core/models/habitacion.model';
import { PacienteListadoResponse } from '../../core/models/paciente.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
  selector: 'app-asignar-paciente-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Asignar Paciente a Habitación {{ habitacion.numeroHabitacion }}</h5>
            <button type="button" class="btn-close" (click)="cerrar.emit()"></button>
          </div>
          <div class="modal-body">
            @if (error) { <div class="alert alert-danger">{{ error }}</div> }

            <form (ngSubmit)="asignar()">
              <div class="mb-3">
                <label class="form-label">Buscar paciente</label>
                <div class="input-group mb-2">
                  <input type="search" class="form-control" [(ngModel)]="busquedaPaciente"
                         name="busquedaPaciente" placeholder="Nombre o apellido">
                  <button type="button" class="btn btn-outline-secondary"
                          (click)="cargarPacientes()" [disabled]="cargandoPacientes">
                    Buscar
                  </button>
                </div>
                <label class="form-label">Paciente *</label>
                <select class="form-select" [(ngModel)]="request.idPaciente" name="idPaciente" required>
                  <option [ngValue]="0">Seleccione un paciente activo</option>
                  @for (paciente of pacientes; track paciente.idPaciente) {
                    <option [ngValue]="paciente.idPaciente">
                      {{ paciente.nombres }} {{ paciente.apellidos }}
                    </option>
                  }
                </select>
              </div>
              <div class="mb-3">
                <label class="form-label">Observaciones</label>
                <textarea class="form-control" rows="3" [(ngModel)]="request.observaciones" name="observaciones"></textarea>
              </div>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-secondary" (click)="cerrar.emit()">Cancelar</button>
                <button type="submit" class="btn btn-success" [disabled]="cargando">
                  {{ cargando ? 'Asignando...' : 'Confirmar Asignación' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AsignarPacienteModalComponent implements OnInit {
  private service = inject(HabitacionesService);
  private pacientesService = inject(PacientesService);
  private permisos = inject(PermisosService);

  @Input() habitacion!: HabitacionResponse;
  @Output() cerrar = new EventEmitter<void>();
  @Output() asignado = new EventEmitter<void>();

  cargando = false;
  cargandoPacientes = false;
  error = '';
  busquedaPaciente = '';
  pacientes: PacienteListadoResponse[] = [];
  request: CrearAsignacionHabitacionRequest = {
    idHabitacion: 0,
    idPaciente: 0,
    observaciones: null
  };

  ngOnInit() {
    if (this.habitacion) {
      this.request.idHabitacion = this.habitacion.idHabitacion;
    }
    this.cargarPacientes();
  }

  cargarPacientes() {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
      this.error = 'No tiene permiso para consultar pacientes.';
      return;
    }

    this.cargandoPacientes = true;
    this.pacientesService.listar(this.busquedaPaciente.trim() || undefined, true, 1, 50).subscribe({
      next: pagina => {
        this.pacientes = pagina.items.filter(item => item.activo);
        this.cargandoPacientes = false;
      },
      error: () => {
        this.error = 'No fue posible cargar los pacientes.';
        this.cargandoPacientes = false;
      },
    });
  }

  asignar() {
    if (this.cargando) return;
    if (!this.pacientes.some(
      item => item.idPaciente === this.request.idPaciente && item.activo,
    )) {
      this.error = 'Seleccione un paciente activo.';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.service.asignarPaciente(this.request).subscribe({
      next: () => {
        this.asignado.emit();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al asignar el paciente.';
        this.cargando = false;
      }
    });
  }
}
