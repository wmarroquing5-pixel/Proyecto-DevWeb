import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../core/services/inventario.service';
import { LoteMedicamentoResponse, PagedResponse } from '../../core/models/inventario.model';

@Component({
  selector: 'app-lotes-medicamento',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container-fluid mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="fa fa-boxes"></i> Gestión de Lotes</h2>
        <div class="d-flex gap-2">
          <a routerLink="/inventario" class="btn btn-secondary">
            <i class="fa fa-arrow-left"></i> Volver a Medicamentos
          </a>
          <a routerLink="/inventario/lotes/nuevo" class="btn btn-primary">
            <i class="fa fa-plus"></i> Nuevo Lote
          </a>
        </div>
      </div>

      @if (cargando) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (lotes.length === 0) {
        <div class="alert alert-info text-center">No hay lotes registrados.</div>
      } @else {
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead class="table-dark">
              <tr>
                <th>#</th>
                <th>Número de Lote</th>
                <th>Medicamento</th>
                <th>Fecha Ingreso</th>
                <th>Fecha Vencimiento</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (lote of lotes; track lote.idLote) {
                <tr>
                  <td>{{ lote.idLote }}</td>
                  <td><code>{{ lote.numeroLote }}</code></td>
                  <td>{{ lote.idMedicamento }}</td>
                  <td>{{ lote.fechaIngreso | date:'dd/MM/yyyy' }}</td>
                  <td>
                    <span [class.text-danger]="isVencido(lote.fechaVencimiento)">
                      {{ lote.fechaVencimiento | date:'dd/MM/yyyy' }}
                    </span>
                  </td>
                  <td>
                    <span class="badge"
                          [class.bg-success]="lote.cantidadDisponible > 10"
                          [class.bg-warning]="lote.cantidadDisponible > 0 && lote.cantidadDisponible <= 10"
                          [class.bg-danger]="lote.cantidadDisponible === 0">
                      {{ lote.cantidadDisponible }}
                    </span>
                  </td>
                  <td>
                    <button (click)="abrirModalEntrada(lote)" class="btn btn-sm btn-success me-1">
                      <i class="fa fa-plus"></i> Entrada
                    </button>
                    <a [routerLink]="['/inventario/lotes/editar', lote.idLote]"
                       class="btn btn-sm btn-warning me-1">
                      <i class="fa fa-edit"></i>
                    </a>
                    <button (click)="eliminar(lote.idLote)" class="btn btn-sm btn-danger">
                      <i class="fa fa-trash"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} lotes</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2"
                    (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">
              Anterior
            </button>
            <span class="mx-2">Página {{ page }}</span>
            <button class="btn btn-outline-secondary btn-sm"
                    (click)="cambiarPagina(page + 1)" [disabled]="lotes.length < pageSize">
              Siguiente
            </button>
          </div>
        </div>
      }

      <!-- Modal Entrada -->
      @if (loteSeleccionado) {
        <div class="modal d-block" tabindex="-1" style="background: rgba(0,0,0,0.5);">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Registrar Entrada - Lote {{ loteSeleccionado.numeroLote }}</h5>
                <button type="button" class="btn-close" (click)="loteSeleccionado = null"></button>
              </div>
              <div class="modal-body">
                @if (errorEntrada) { <div class="alert alert-danger">{{ errorEntrada }}</div> }
                <form (ngSubmit)="registrarEntrada()">
                  <div class="mb-3">
                    <label class="form-label">ID Sucursal *</label>
                    <input type="number" class="form-control" [(ngModel)]="entradaForm.idSucursal"
                           name="idSucursal" required min="1">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Cantidad *</label>
                    <input type="number" class="form-control" [(ngModel)]="entradaForm.cantidad"
                           name="cantidad" required min="1">
                  </div>
                  <div class="mb-3">
                    <label class="form-label">Observaciones</label>
                    <textarea class="form-control" rows="2" [(ngModel)]="entradaForm.observaciones"
                              name="observaciones" maxlength="300"></textarea>
                  </div>
                  <div class="d-flex justify-content-end gap-2">
                    <button type="button" class="btn btn-secondary" (click)="loteSeleccionado = null">Cancelar</button>
                    <button type="submit" class="btn btn-success" [disabled]="cargandoEntrada">
                      {{ cargandoEntrada ? 'Registrando...' : 'Confirmar Entrada' }}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class LotesMedicamentoComponent implements OnInit {
  private service = inject(InventarioService);

  lotes: LoteMedicamentoResponse[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';

  loteSeleccionado: LoteMedicamentoResponse | null = null;
  cargandoEntrada = false;
  errorEntrada = '';
  entradaForm = {
    idSucursal: 1,
    cantidad: 0,
    observaciones: null as string | null
  };

  ngOnInit() {
    this.cargarLotes();
  }

  cargarLotes() {
    this.cargando = true;
    this.error = '';
    this.service.listarLotes(this.page, this.pageSize).subscribe({
      next: (res: PagedResponse<LoteMedicamentoResponse>) => {
        this.lotes = res.items;
        this.total = res.total;
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar los lotes. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  isVencido(fechaVencimiento: string): boolean {
    return new Date(fechaVencimiento) < new Date();
  }

  abrirModalEntrada(lote: LoteMedicamentoResponse) {
    this.loteSeleccionado = lote;
    this.entradaForm = { idSucursal: 1, cantidad: 0, observaciones: null };
    this.errorEntrada = '';
  }

  registrarEntrada() {
    if (!this.loteSeleccionado) return;
    this.cargandoEntrada = true;
    this.errorEntrada = '';
    this.service.registrarEntrada(this.loteSeleccionado.idLote, this.entradaForm).subscribe({
      next: () => {
        this.loteSeleccionado = null;
        this.cargarLotes();
      },
      error: (err) => {
        this.errorEntrada = err.error?.message || 'Error al registrar la entrada';
        this.cargandoEntrada = false;
      }
    });
  }

  eliminar(id: number) {
    if (confirm('¿Estás seguro de eliminar este lote?')) {
      this.service.eliminarLote(id).subscribe({
        next: () => this.cargarLotes(),
        error: (err) => alert(err.error?.message || 'No se pudo eliminar el lote')
      });
    }
  }

  cambiarPagina(n: number) {
    if (n > 0) {
      this.page = n;
      this.cargarLotes();
    }
  }
}