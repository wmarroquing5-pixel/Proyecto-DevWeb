import { Component, inject, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { HabitacionResponse } from '../../core/models/habitacion.model';

@Component({
  selector: 'app-registrar-egreso-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Registrar Egreso - Habitación {{ habitacion.numeroHabitacion }}</h5>
            <button type="button" class="btn-close" (click)="cerrar.emit()"></button>
          </div>
          <div class="modal-body">
            @if (error) { <div class="alert alert-danger">{{ error }}</div> }

            <p>¿Está seguro de registrar el egreso del paciente de la habitación <strong>{{ habitacion.numeroHabitacion }}</strong>?</p>
            <p class="text-muted">La habitación pasará al estado "En limpieza".</p>

            <div class="d-flex justify-content-end gap-2 mt-4">
              <button class="btn btn-secondary" (click)="cerrar.emit()">Cancelar</button>
              <button class="btn btn-warning" (click)="registrarEgreso()" [disabled]="cargando">
                {{ cargando ? 'Registrando...' : 'Confirmar Egreso' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegistrarEgresoModalComponent {
  private service = inject(HabitacionesService);

  @Input() habitacion!: HabitacionResponse;
  @Output() cerrar = new EventEmitter<void>();
  @Output() egresado = new EventEmitter<void>();

  cargando = false;
  error = '';

  registrarEgreso() {
    this.cargando = true;
    this.error = '';

    // Primero obtenemos la asignación activa de esta habitación
    this.service.listarAsignaciones(1, 100).subscribe({
      next: (res) => {
        const asignacionActiva = res.items.find(a => a.idHabitacion === this.habitacion.idHabitacion && !a.fechaEgreso);
        if (!asignacionActiva) {
          this.error = 'No se encontró una asignación activa para esta habitación.';
          this.cargando = false;
          return;
        }

        this.service.registrarEgreso(asignacionActiva.idAsignacion).subscribe({
          next: () => {
            this.egresado.emit();
          },
          error: (err) => {
            this.error = err.error?.message || 'Error al registrar el egreso.';
            this.cargando = false;
          }
        });
      },
      error: () => {
        this.error = 'Error al cargar las asignaciones.';
        this.cargando = false;
      }
    });
  }
}