import { Component, inject, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { CrearHabitacionRequest } from '../../core/models/habitacion.model';

@Component({
  selector: 'app-crear-habitacion-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Crear Nueva Habitación</h5>
            <button type="button" class="btn-close" (click)="cerrar.emit()"></button>
          </div>
          <div class="modal-body">
            @if (error) { <div class="alert alert-danger">{{ error }}</div> }

            <form (ngSubmit)="crear()">
              <div class="mb-3">
                <label class="form-label">ID Sucursal *</label>
                <input type="number" class="form-control" [(ngModel)]="request.idSucursal" name="idSucursal" required min="1">
              </div>
              <div class="mb-3">
                <label class="form-label">Número de Habitación *</label>
                <input type="text" class="form-control" [(ngModel)]="request.numeroHabitacion" name="numeroHabitacion" required maxlength="20">
              </div>
              <div class="mb-3">
                <label class="form-label">Tipo de Habitación</label>
                <input type="text" class="form-control" [(ngModel)]="request.tipoHabitacion" name="tipoHabitacion" maxlength="50">
                <small class="text-muted">Ej: Simple, Doble, Suite, UCI</small>
              </div>
              <div class="d-flex justify-content-end gap-2">
                <button type="button" class="btn btn-secondary" (click)="cerrar.emit()">Cancelar</button>
                <button type="submit" class="btn btn-primary" [disabled]="cargando">
                  {{ cargando ? 'Creando...' : 'Crear Habitación' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `
})
export class CrearHabitacionModalComponent {
  private service = inject(HabitacionesService);

  @Output() cerrar = new EventEmitter<void>();
  @Output() creada = new EventEmitter<void>();

  cargando = false;
  error = '';
  request: CrearHabitacionRequest = {
    idSucursal: 1,
    numeroHabitacion: '',
    tipoHabitacion: null
  };

  crear() {
    if (!this.request.numeroHabitacion.trim()) {
      this.error = 'El número de habitación es obligatorio.';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.service.crearHabitacion(this.request).subscribe({
      next: () => {
        this.creada.emit();
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al crear la habitación.';
        this.cargando = false;
      }
    });
  }
}