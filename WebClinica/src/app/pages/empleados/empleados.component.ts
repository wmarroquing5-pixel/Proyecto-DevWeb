import { Component, inject, OnInit } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EmpleadosService } from '../../core/services/empleado.service';
import { EmpleadoListadoResponse, PagedResponse } from '../../core/models/empleado.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { correlativoPaginado } from '../../shared/utils/correlativo';

@Component({
    selector: 'app-empleados',
    imports: [RouterModule, FormsModule, ConfirmDialogComponent, UiStateComponent],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <div><h1>Gestión de Empleados</h1><p class="page-header__subtitle">Administra el personal activo de la clínica.</p></div>
        @if (permisos.puedeCrear(MODULOS_PERMISO.EMPLEADOS)) {
          <a routerLink="/admin/empleados/nuevo" class="btn btn-primary" title="Crear empleado">
            <i class="bi bi-plus-lg" aria-hidden="true"></i> Nuevo Empleado
          </a>
        }
      </header>

      <!-- Filtros -->
      <div class="ui-card mb-4" aria-label="Filtros de empleados">
        <div class="row g-3 align-items-end empleados-filtros">
          <div class="col-md-4">
            <label for="empleado-nombre" class="form-label">Nombre</label><input id="empleado-nombre" type="text" class="form-control" placeholder="Buscar por nombre..." [(ngModel)]="filtroNombre" (input)="buscar()">
          </div>
          <div class="col-md-3">
            <label for="empleado-tipo" class="form-label">Tipo</label><select id="empleado-tipo" class="form-select" [(ngModel)]="filtroTipo" (change)="buscar()">
              <option value="">Todos los tipos</option>
              <option value="Medico">Médico</option>
              <option value="Enfermera">Enfermera</option>
              <option value="Administrativo">Administrativo</option>

            </select>
          </div>
          <div class="col-md-3">
            <label for="empleado-estado" class="form-label">Estado</label><select id="empleado-estado" class="form-select" [(ngModel)]="filtroActivo" (change)="buscar()">
              <option [ngValue]="undefined">Todos</option>
              <option [ngValue]="true">Activos</option>
              <option [ngValue]="false">Inactivos</option>
            </select>
          </div>
          <div class="col-md-2 d-flex align-items-end">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()" title="Limpiar filtros"><i class="bi bi-x-lg" aria-hidden="true"></i> Limpiar</button>
          </div>
        </div>
      </div>

      @if (cargando) {
        <app-ui-state kind="loading" title="Cargando empleados…" />
      } @else if (error) {
        <app-ui-state kind="error" title="No fue posible cargar los empleados" [description]="error" [retryable]="true" (retry)="cargarEmpleados()" />
      } @else if (empleados.length === 0) {
        <app-ui-state kind="empty" title="No se encontraron empleados" description="Ajusta los filtros o registra un nuevo empleado." />
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-hover table-striped ui-table empleados-table">
            <thead>
              <tr>
                <th scope="col" class="ui-col-index">No.</th>
                <th scope="col">Nombre Completo</th>
                <th scope="col">Sucursal</th>
                <th scope="col">Tipo</th>
                <th scope="col">Estado</th>
                <th scope="col" class="ui-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (emp of empleados; track emp.idEmpleado; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  <td>{{ emp.nombres }} {{ emp.apellidos }}</td>
                  <td>{{ emp.idSucursal }}</td>
                  <td>
                    <span class="badge bg-info">{{ emp.tipoEmpleado }}</span>
                  </td>
                  <td>
                    <span class="badge" [class.bg-success]="emp.activo" [class.bg-secondary]="!emp.activo">
                      {{ emp.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="ui-col-actions">
                    <div class="empleados-actions">
                      @if (permisos.puedeModificar(MODULOS_PERMISO.EMPLEADOS)) {
                        <a [routerLink]="['/admin/empleados/editar', emp.idEmpleado]" class="btn btn-sm btn-outline-primary" aria-label="Editar empleado" title="Editar empleado">
                          <i class="bi bi-pencil" aria-hidden="true"></i> Modificar
                        </a>
                      }
                      @if (permisos.puedeEliminar(MODULOS_PERMISO.EMPLEADOS)) {
                        <button type="button" (click)="solicitarEliminacion(emp)" class="btn btn-sm btn-outline-danger" [disabled]="!emp.activo || eliminandoId === emp.idEmpleado" aria-label="Eliminar empleado" title="Eliminar empleado">
                          <i class="bi bi-trash" aria-hidden="true"></i> Eliminar
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <nav aria-label="Páginas de empleados" class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <span>Total: {{ total }} empleados</span>
          <div class="d-flex flex-wrap align-items-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">
              Anterior
            </button>
            <span>Página {{ page }}</span>
            <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page + 1)" [disabled]="page >= totalPages">
              Siguiente
            </button>
          </div>
        </nav>
      }

      @if (empleadoPendiente) {
        <app-confirm-dialog title="Eliminar empleado"
          [description]="'¿Deseas eliminar a ' + empleadoPendiente.nombres + ' ' + empleadoPendiente.apellidos + '?'"
          consequence="La API aplicará la eliminación definida para este empleado."
          [busy]="eliminandoId === empleadoPendiente.idEmpleado"
          (confirmed)="confirmarEliminacion()" (cancelled)="cancelarEliminacion()" />
      }
    </div>
  `,
    styles: [`
      .empleados-filtros .form-label { color: var(--ui-heading); font-weight: 600; }
      .empleados-table td.ui-col-actions { white-space: normal; }
      .empleados-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
      .empleados-actions .btn { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; min-height: 2.25rem; white-space: nowrap; }
      @media (max-width: 767.98px) { .empleados-actions { justify-content: flex-start; } }
    `]
})
export class EmpleadosComponent implements OnInit {
  private service = inject(EmpleadosService);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  empleados: EmpleadoListadoResponse[] = [];
  total = 0;
  totalPages = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';
  empleadoPendiente: EmpleadoListadoResponse | null = null;
  eliminandoId: number | null = null;

  filtroNombre = '';
  filtroTipo = '';
  filtroActivo: boolean | undefined = undefined;

  ngOnInit() {
    this.cargarEmpleados();
  }

  cargarEmpleados() {
    this.cargando = true;
    this.error = '';
    this.service.listar(
      this.filtroNombre || undefined,
      this.filtroTipo || undefined,
      undefined,
      this.filtroActivo,
      this.page,
      this.pageSize
    ).subscribe({
      next: (res: PagedResponse<EmpleadoListadoResponse>) => {
        this.empleados = res.items;
        this.total = res.totalCount;
        this.totalPages = res.totalPages;
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar los empleados. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  buscar() {
    this.page = 1;
    this.cargarEmpleados();
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroTipo = '';
    this.filtroActivo = undefined;
    this.buscar();
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina > 0 && nuevaPagina <= Math.max(this.totalPages, 1)) {
      this.page = nuevaPagina;
      this.cargarEmpleados();
    }
  }

  solicitarEliminacion(empleado: EmpleadoListadoResponse): void {
    if (!empleado.activo || !this.permisos.puedeEliminar(MODULOS_PERMISO.EMPLEADOS)) return;
    this.empleadoPendiente = empleado;
  }

  cancelarEliminacion(): void {
    if (this.eliminandoId === null) this.empleadoPendiente = null;
  }

  confirmarEliminacion(): void {
    const empleado = this.empleadoPendiente;
    if (!empleado || this.eliminandoId !== null) return;
    this.eliminandoId = empleado.idEmpleado;
    this.service.eliminar(empleado.idEmpleado).subscribe({
      next: () => {
        this.eliminandoId = null;
        this.empleadoPendiente = null;
        this.cargarEmpleados();
      },
      error: () => {
        this.eliminandoId = null;
        this.empleadoPendiente = null;
        this.error = 'No se pudo eliminar el empleado.';
      },
    });
  }
}
