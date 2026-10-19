import { Component, inject, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { HabitacionResponse, CrearAsignacionHabitacionRequest } from '../../core/models/habitacion.model';

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
                <label class="form-label">ID del Paciente *</label>
                <input type="number" class="form-control" [(ngModel)]="request.idPaciente" name="idPaciente" required min="1">
                <small class="text-muted">Ingrese el ID del paciente registrado en el sistema.</small>
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

  @Input() habitacion!: HabitacionResponse;
  @Output() cerrar = new EventEmitter<void>();
  @Output() asignado = new EventEmitter<void>();

  cargando = false;
  error = '';
  request: CrearAsignacionHabitacionRequest = {
    idHabitacion: 0,
    idPaciente: 0,
    observaciones: null
  };

  ngOnInit() {
    if (this.habitacion) {
      this.request.idHabitacion = this.habitacion.idHabitacion;
    }
  }

  asignar() {
    if (this.request.idPaciente <= 0) {
      this.error = 'Debe ingresar un ID de paciente válido.';
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