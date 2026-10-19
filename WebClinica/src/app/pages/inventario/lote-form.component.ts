import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { InventarioService } from '../../core/services/inventario.service';
import {
  GuardarLoteMedicamentoRequest,
  ActualizarLoteMedicamentoRequest,
  LoteMedicamentoResponse,
  MedicamentoResponse,
  PagedResponse
} from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
  selector: 'app-lote-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Lote' : 'Nuevo Lote' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Medicamento *</label>
            <select class="form-select" [(ngModel)]="form.idMedicamento"
                    name="idMedicamento" required>
              <option [ngValue]="0">Seleccione...</option>
              @for (m of medicamentos; track m.idMedicamento) {
                <option [ngValue]="m.idMedicamento">{{ m.codigo }} - {{ m.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Número de Lote *</label>
            <input type="text" class="form-control" [(ngModel)]="form.numeroLote"
                   name="numeroLote" required maxlength="50">
          </div>
          <div class="col-md-4">
            <label class="form-label">Fecha de Ingreso *</label>
            <input type="date" class="form-control" [(ngModel)]="form.fechaIngreso"
                   name="fechaIngreso" required>
          </div>
          <div class="col-md-4">
            <label class="form-label">Fecha de Vencimiento *</label>
            <input type="date" class="form-control" [(ngModel)]="form.fechaVencimiento"
                   name="fechaVencimiento" required>
          </div>
          <div class="col-md-4">
            <label class="form-label">Cantidad Disponible *</label>
            <input type="number" class="form-control" [(ngModel)]="form.cantidadDisponible"
                   name="cantidadDisponible" required min="0">
          </div>
          @if (requiereTrazabilidad) {
            <div class="col-md-4">
              <label class="form-label">ID de Sucursal *</label>
              <input type="number" class="form-control" [(ngModel)]="form.idSucursal"
                     name="idSucursal" required min="1">
            </div>
            <div class="col-md-8">
              <label class="form-label">Justificación del ajuste *</label>
              <input type="text" class="form-control" [(ngModel)]="form.observaciones"
                     name="observaciones" required maxlength="300">
            </div>
          }
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando || !puedeGuardar">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/inventario/lotes" class="btn btn-secondary">Cancelar</a>
        </div>
      </form>
    </div>
  `
})
export class LoteFormComponent implements OnInit {
  private service = inject(InventarioService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private apiErrors = inject(ApiErrorService);
  private permisos = inject(PermisosService);

  esEdicion = false;
  cargando = false;
  error = '';
  medicamentos: MedicamentoResponse[] = [];
  cantidadEsperada: number | null = null;

  form: GuardarLoteMedicamentoRequest = {
    idMedicamento: 0,
    numeroLote: '',
    fechaIngreso: '',
    fechaVencimiento: '',
    cantidadDisponible: 0,
    idSucursal: null,
    observaciones: null
  };

  get requiereTrazabilidad(): boolean {
    return this.esEdicion
      ? this.cantidadEsperada !== null && this.form.cantidadDisponible !== this.cantidadEsperada
      : this.form.cantidadDisponible > 0;
  }

  get puedeGuardar(): boolean {
    return this.esEdicion
      ? this.permisos.puedeModificar(MODULOS_PERMISO.LOTES_MEDICAMENTO)
      : this.permisos.puedeCrear(MODULOS_PERMISO.LOTES_MEDICAMENTO);
  }

  ngOnInit() {
    this.cargarMedicamentos();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.cargando = true;
      this.service.obtenerLote(+id).subscribe({
        next: (lote: LoteMedicamentoResponse) => {
          this.form = {
            idMedicamento: lote.idMedicamento,
            numeroLote: lote.numeroLote,
            fechaIngreso: lote.fechaIngreso,
            fechaVencimiento: lote.fechaVencimiento,
            cantidadDisponible: lote.cantidadDisponible,
            idSucursal: null,
            observaciones: null
          };
          this.cantidadEsperada = lote.cantidadDisponible;
          this.cargando = false;
        },
        error: () => {
          this.error = 'Lote no encontrado';
          this.cargando = false;
        }
      });
    }
  }

  cargarMedicamentos() {
    this.service.listarMedicamentos(1, 100).subscribe({
      next: (res: PagedResponse<MedicamentoResponse>) => {
        this.medicamentos = res.items.filter(m => m.activo);
      },
      error: () => console.error('Error cargando medicamentos')
    });
  }

  guardar() {
    this.error = '';

    if (this.cargando || !this.puedeGuardar) return;

    if (this.requiereTrazabilidad &&
        (!this.form.idSucursal || !this.form.observaciones?.trim())) {
      this.error = 'La sucursal y la justificación son obligatorias cuando cambia la existencia.';
      return;
    }

    if (this.requiereTrazabilidad
      && !confirm('¿Confirmas el cambio de existencia de este lote?')) return;

    this.cargando = true;

    if (this.esEdicion) {
      if (this.cantidadEsperada === null) {
        this.error = 'No se pudo determinar la existencia original del lote.';
        this.cargando = false;
        return;
      }
      const id = +this.route.snapshot.paramMap.get('id')!;
      const request: ActualizarLoteMedicamentoRequest = {
        ...this.form,
        cantidadEsperada: this.cantidadEsperada
      };
      this.service.actualizarLote(id, request).subscribe({
        next: () => this.router.navigate(['/inventario/lotes']),
        error: (err: HttpErrorResponse) => {
          this.error = this.apiErrors.messageFor(err, 'No fue posible actualizar el lote.');
          this.cargando = false;
        }
      });
    } else {
      this.service.crearLote(this.form).subscribe({
        next: () => this.router.navigate(['/inventario/lotes']),
        error: (err: HttpErrorResponse) => {
          this.error = this.apiErrors.messageFor(err, 'No fue posible crear el lote.');
          this.cargando = false;
        }
      });
    }
  }
}
