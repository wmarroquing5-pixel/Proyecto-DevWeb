import { Component, inject, Output, EventEmitter, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { CrearHabitacionRequest } from '../../core/models/habitacion.model';
import { Sucursal } from '../../core/models/catalogos.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PermisosService } from '../../core/services/permisos.service';

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
                <label class="form-label">Sucursal *</label>
                <select class="form-select" [(ngModel)]="request.idSucursal" name="idSucursal" required>
                  <option [ngValue]="0">Seleccione una sucursal activa</option>
                  @for (sucursal of sucursales; track sucursal.idSucursal) {
                    <option [ngValue]="sucursal.idSucursal">{{ sucursal.nombre }}</option>
                  }
                </select>
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
export class CrearHabitacionModalComponent implements OnInit {
  private service = inject(HabitacionesService);
  private catalogos = inject(CatalogosService);
  private permisos = inject(PermisosService);

  @Output() cerrar = new EventEmitter<void>();
  @Output() creada = new EventEmitter<void>();

  cargando = false;
  error = '';
  sucursales: Sucursal[] = [];
  request: CrearHabitacionRequest = {
    idSucursal: 0,
    numeroHabitacion: '',
    tipoHabitacion: null
  };

  ngOnInit() {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)) {
      this.error = 'No tiene permiso para consultar las sucursales disponibles.';
      return;
    }

    this.catalogos.getSucursales().subscribe({
      next: items => this.sucursales = items.filter(item => item.activa),
      error: () => this.error = 'No fue posible cargar las sucursales.',
    });
  }

  crear() {
    if (this.cargando) return;
    if (!this.sucursales.some(item => item.idSucursal === this.request.idSucursal && item.activa)) {
      this.error = 'Seleccione una sucursal activa.';
      return;
    }
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
