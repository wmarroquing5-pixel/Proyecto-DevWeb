import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VentasService } from '../../core/services/venta.service';
import { VentaConsultaResumenResponse, PagedResponse } from '../../core/models/venta.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
  selector: 'app-ventas-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container-fluid mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="fa fa-cash-register"></i> Ventas de Farmacia</h2>
        @if (permisos.puedeCrear(MODULOS_PERMISO.VENTAS)) {
          <a routerLink="/ventas/nueva" class="btn btn-primary">
            <i class="fa fa-plus"></i> Nueva Venta
          </a>
        }
      </div>

      <!-- Filtros -->
      <div class="card p-3 mb-4">
        <div class="row g-3">
          <div class="col-md-3">
            <label class="form-label">ID Venta</label>
            <input type="number" class="form-control" [(ngModel)]="filtro.idVenta" (change)="buscar()">
          </div>
          <div class="col-md-3">
            <label class="form-label">Desde</label>
            <input type="date" class="form-control" [(ngModel)]="filtro.fechaDesde" (change)="buscar()">
          </div>
          <div class="col-md-3">
            <label class="form-label">Hasta</label>
            <input type="date" class="form-control" [(ngModel)]="filtro.fechaHasta" (change)="buscar()">
          </div>
          <div class="col-md-3 d-flex align-items-end">
            <button class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()">
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
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead class="table-dark">
              <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Sucursal</th>
                <th>Usuario</th>
                <th>Total</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (v of ventas; track v.idVenta) {
                <tr>
                  <td>{{ v.idVenta }}</td>
                  <td>{{ v.fechaVenta | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ v.idSucursal }}</td>
                  <td>{{ v.idUsuario }}</td>
                  <td class="fw-bold text-success">Q{{ v.total | number:'1.2-2' }}</td>
                  <td>
                    <a [routerLink]="['/ventas', v.idVenta]" class="btn btn-sm btn-info">
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
