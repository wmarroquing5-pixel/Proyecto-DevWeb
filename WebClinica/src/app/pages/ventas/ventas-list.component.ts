import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VentasService } from '../../core/services/venta.service';
import { VentaConsultaResumenResponse, PagedResponse } from '../../core/models/venta.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { correlativoPaginado } from '../../shared/utils/correlativo';

@Component({
  selector: 'app-ventas-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <h2><i class="fa fa-cash-register"></i> Ventas de Farmacia</h2>
        @if (permisos.puedeCrear(MODULOS_PERMISO.VENTAS)) {
          <a routerLink="/ventas/nueva" class="btn btn-primary">
            <i class="fa fa-plus"></i> Nueva Venta
          </a>
        }
      </header>

      <!-- Filtros -->
      <div class="ui-card ui-form mb-4">
        <div class="row g-3">
          <div class="col-md-3">
            <label for="venta-id" class="form-label">ID Venta</label>
            <input id="venta-id" type="number" class="form-control" [(ngModel)]="filtro.idVenta" (change)="buscar()">
          </div>
          <div class="col-md-3">
            <label for="venta-desde" class="form-label">Desde</label>
            <input id="venta-desde" type="date" class="form-control" [(ngModel)]="filtro.fechaDesde" (change)="buscar()">
          </div>
          <div class="col-md-3">
            <label for="venta-hasta" class="form-label">Hasta</label>
            <input id="venta-hasta" type="date" class="form-control" [(ngModel)]="filtro.fechaHasta" (change)="buscar()">
          </div>
          <div class="col-md-3 d-flex align-items-end">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()">
              <i class="fa fa-times"></i> Limpiar
            </button>
          </div>
        </div>
      </div>

      @if (cargando) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (ventas.length === 0) {
        <div class="alert alert-info text-center">No hay ventas registradas.</div>
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-striped table-hover ui-table">
            <thead>
              <tr>
                <th class="ui-col-index">No.</th>
                <th class="ui-col-date">Fecha</th>
                <th>Sucursal</th>
                <th>Usuario</th>
                <th class="ui-col-number">Total</th>
                <th class="ui-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (v of ventas; track v.idVenta; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  <td class="ui-col-date">{{ v.fechaVenta | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ v.idSucursal }}</td>
                  <td>{{ v.idUsuario }}</td>
                  <td class="fw-bold text-success ui-col-number">Q{{ v.total | number:'1.2-2' }}</td>
                  <td class="ui-actions ui-col-actions">
                    <a [routerLink]="['/ventas', v.idVenta]" class="btn btn-sm btn-outline-info" aria-label="Ver detalle de venta" title="Ver detalle">
                      <i class="fa fa-eye"></i> Ver
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} ventas</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2"
                    (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">Anterior</button>
            <span class="mx-2">Página {{ page }}</span>
            <button class="btn btn-outline-secondary btn-sm"
                    (click)="cambiarPagina(page + 1)" [disabled]="ventas.length < pageSize">Siguiente</button>
          </div>
        </div>
      }
    </div>
  `
})
export class VentasListComponent implements OnInit {
  private service = inject(VentasService);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  ventas: VentaConsultaResumenResponse[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';

  filtro: any = {
    idVenta: null,
    fechaDesde: null,
    fechaHasta: null,
    idSucursal: null,
    idUsuario: null
  };

  ngOnInit() {
    this.cargarVentas();
  }

  cargarVentas() {
    this.cargando = true;
    this.error = '';
    this.service.listarVentas({
      ...this.filtro,
      page: this.page,
      pageSize: this.pageSize
    }).subscribe({
      next: (res: PagedResponse<VentaConsultaResumenResponse>) => {
        this.ventas = res.items;
        this.total = res.totalCount;
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar las ventas. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  buscar() {
    this.page = 1;
    this.cargarVentas();
  }

  limpiarFiltros() {
    this.filtro = {
      idVenta: null,
      fechaDesde: null,
      fechaHasta: null,
      idSucursal: null,
      idUsuario: null
    };
    this.buscar();
  }

  cambiarPagina(n: number) {
    if (n > 0) {
      this.page = n;
      this.cargarVentas();
    }
  }
}
