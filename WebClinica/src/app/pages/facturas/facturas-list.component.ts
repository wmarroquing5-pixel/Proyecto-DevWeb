import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { FacturaConsultaFiltro, FacturaResumen } from '../../core/models/factura.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { FacturaService } from '../../core/services/factura.service';
import { PermisosService } from '../../core/services/permisos.service';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { correlativoPaginado } from '../../shared/utils/correlativo';

@Component({
  selector: 'app-facturas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, UiStateComponent],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h2><i class="fa fa-file-invoice-dollar"></i> Facturación</h2>
          <p class="page-header__subtitle">Facturas clínicas y farmacéuticas registradas.</p>
        </div>
        @if (permisos.puedeCrear(MODULOS_PERMISO.FACTURAS)) {
          <a routerLink="/facturas/nueva" class="btn btn-primary">
            <i class="fa fa-plus"></i> Nueva factura
          </a>
        }
      </header>

      <section class="ui-card ui-form mb-4" aria-label="Filtros de facturas">
        <div class="row g-3">
          <div class="col-sm-6 col-lg-2">
            <label for="factura-id" class="form-label">Factura</label>
            <input id="factura-id" type="number" min="1" class="form-control"
                   [(ngModel)]="filtro.idFactura">
          </div>
          <div class="col-sm-6 col-lg-2">
            <label for="factura-paciente" class="form-label">Paciente</label>
            <input id="factura-paciente" type="number" min="1" class="form-control"
                   [(ngModel)]="filtro.idPaciente">
          </div>
          <div class="col-sm-6 col-lg-3">
            <label for="factura-desde" class="form-label">Desde</label>
            <input id="factura-desde" type="date" class="form-control" [(ngModel)]="filtro.fechaDesde">
          </div>
          <div class="col-sm-6 col-lg-3">
            <label for="factura-hasta" class="form-label">Hasta</label>
            <input id="factura-hasta" type="date" class="form-control" [(ngModel)]="filtro.fechaHasta">
          </div>
          <div class="col-lg-2 d-flex align-items-end gap-2">
            <button type="button" class="btn btn-primary flex-fill" (click)="buscar()">Buscar</button>
            <button type="button" class="btn btn-outline-secondary" (click)="limpiar()" aria-label="Limpiar filtros">
              <i class="fa fa-times"></i>
            </button>
          </div>
        </div>
      </section>

      @if (cargando) {
        <app-ui-state kind="loading" title="Cargando facturas"></app-ui-state>
      } @else if (error) {
        <app-ui-state kind="error" title="No se pudieron cargar las facturas"
                      [description]="error" [retryable]="true" (retry)="cargar()"></app-ui-state>
      } @else if (facturas.length === 0) {
        <app-ui-state kind="empty" title="No hay facturas"
                      description="No se encontraron registros con los filtros seleccionados."></app-ui-state>
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-hover ui-table">
            <thead><tr>
              <th class="ui-col-index">No.</th><th class="ui-col-date">Fecha</th>
              <th>Facturación</th><th>Paciente</th><th>Sucursal</th>
              <th class="ui-col-number">Total</th><th class="ui-col-actions">Acciones</th>
            </tr></thead>
            <tbody>
              @for (factura of facturas; track factura.idFactura; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  <td class="ui-col-date">{{ factura.fechaFactura | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>
                    <strong>{{ factura.nombreFacturacion || 'Consumidor final' }}</strong>
                    @if (factura.nit) { <br><small class="text-muted">NIT {{ factura.nit }}</small> }
                  </td>
                  <td>{{ factura.idPaciente ?? 'Sin asociación' }}</td>
                  <td>{{ factura.idSucursal }}</td>
                  <td class="ui-col-number fw-bold">{{ factura.total | currency:'GTQ':'symbol-narrow':'1.2-2' }}</td>
                  <td class="ui-actions ui-col-actions">
                    <a [routerLink]="['/facturas', factura.idFactura]" class="btn btn-sm btn-outline-info"
                       aria-label="Ver detalle de factura" title="Ver detalle">
                      <i class="fa fa-eye"></i> Ver
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <span>Total: {{ total }} facturas</span>
          <div class="d-flex align-items-center gap-2">
            <button class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">Anterior</button>
            <span>Página {{ page }} de {{ totalPages }}</span>
            <button class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page + 1)" [disabled]="page >= totalPages">Siguiente</button>
          </div>
        </div>
      }
    </div>
  `,
})
export class FacturasListComponent implements OnInit {
  private readonly facturasService = inject(FacturaService);
  private readonly apiErrors = inject(ApiErrorService);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  facturas: FacturaResumen[] = [];
  filtro: FacturaConsultaFiltro = {};
  page = 1;
  pageSize = 20;
  total = 0;
  totalPages = 0;
  cargando = false;
  error = '';

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    this.cargando = true;
    this.error = '';
    this.facturasService.listar({ ...this.filtro, page: this.page, pageSize: this.pageSize }).subscribe({
      next: response => {
        this.facturas = response.items;
        this.total = response.totalCount;
        this.totalPages = response.totalPages;
        this.cargando = false;
      },
      error: (error: HttpErrorResponse) => {
        this.facturas = [];
        this.error = this.apiErrors.messageFor(error, 'No fue posible consultar las facturas.');
        this.cargando = false;
      },
    });
  }

  buscar(): void { this.page = 1; this.cargar(); }

  limpiar(): void { this.filtro = {}; this.buscar(); }

  cambiarPagina(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.page = page;
    this.cargar();
  }
}
