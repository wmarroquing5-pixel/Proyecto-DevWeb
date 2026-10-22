import { Component, inject, OnInit } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PacientesService } from '../../core/services/paciente.service';
import { PacienteListadoResponse, PagedResponse } from '../../core/models/paciente.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { correlativoPaginado } from '../../shared/utils/correlativo';
import { Subscription } from 'rxjs';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ContextoInventario, idInventarioValido } from '../inventario/inventario-ui';

@Component({
    selector: 'app-pacientes',
    imports: [RouterModule, FormsModule, ConfirmDialogComponent, UiStateComponent],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h1>Gestión de Pacientes</h1>
          <p class="page-header__subtitle">Consulta pacientes y accede a su historial clínico.</p>
        </div>
        @if (permisos.puedeCrear(MODULOS_PERMISO.PACIENTES)) {
          <a routerLink="/pacientes/nuevo" class="btn btn-primary" title="Crear paciente">
            <i class="bi bi-plus-lg" aria-hidden="true"></i> Nuevo Paciente
          </a>
        }
      </header>

      <!-- Filtros -->
      <div class="ui-card mb-4" aria-label="Filtros de pacientes">
        <div class="row g-3">
          <div class="col-md-6">
            <label for="paciente-nombre" class="form-label">Nombre</label>
            <input id="paciente-nombre" type="text" class="form-control" placeholder="Buscar por nombre o apellido..." [(ngModel)]="filtroNombre" (input)="buscar()">
          </div>
          <div class="col-md-3">
            <label for="paciente-estado" class="form-label">Estado</label>
            <select id="paciente-estado" class="form-select" [(ngModel)]="filtroActivo" (change)="buscar()">
              <option [ngValue]="undefined">Todos</option>
              <option [ngValue]="true">Activos</option>
              <option [ngValue]="false">Inactivos</option>
            </select>
          </div>
          <div class="col-md-3">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()" title="Limpiar filtros"><i class="bi bi-x-lg" aria-hidden="true"></i> Limpiar</button>
          </div>
        </div>
      </div>

      @if (errorOperacion) { <div class="alert alert-danger" role="alert">{{ errorOperacion }}</div> }
      @if (cargando) {
        <app-ui-state kind="loading" title="Cargando pacientes…" />
      } @else if (error) {
        <app-ui-state kind="error" title="No fue posible cargar los pacientes" [description]="error" [retryable]="true" (retry)="cargarPacientes()" />
      } @else if (pacientes.length === 0) {
        <app-ui-state kind="empty" title="No se encontraron pacientes" description="Ajusta los filtros o registra un nuevo paciente." />
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-hover ui-table">
            <thead>
              <tr>
                <th scope="col" class="ui-col-index">No.</th>
                <th>Nombre Completo</th>
                <th>Estado</th>
                <th scope="col" class="ui-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (paciente of pacientes; track paciente.idPaciente; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  <td>{{ paciente.nombres }} {{ paciente.apellidos }}</td>
                  <td>
                    <span class="badge" [class.bg-success]="paciente.activo" [class.bg-secondary]="!paciente.activo">
                      {{ paciente.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="ui-actions ui-col-actions">
                    @if (permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
                      <a [routerLink]="['/pacientes', paciente.idPaciente, 'ficha']" class="btn btn-sm btn-outline-info" aria-label="Ver ficha médica del paciente" title="Ver ficha médica">
                        <i class="bi bi-eye" aria-hidden="true"></i><span class="visually-hidden"> Ver ficha médica</span>
                      </a>
                    }
                    @if (permisos.puedeModificar(MODULOS_PERMISO.PACIENTES)) {
                      <a [routerLink]="['/pacientes/editar', paciente.idPaciente]" class="btn btn-sm btn-outline-primary ui-icon-button" aria-label="Editar paciente" title="Editar paciente">
                        <i class="bi bi-pencil" aria-hidden="true"></i>
                      </a>
                    }
                    @if (permisos.puedeEliminar(MODULOS_PERMISO.PACIENTES)) {
                      <button type="button" (click)="solicitarDesactivacion(paciente)" class="btn btn-sm btn-outline-danger ui-icon-button" [disabled]="!paciente.activo || eliminandoId !== null" aria-label="Eliminar paciente" title="Desactivar paciente">
                        <i class="bi bi-trash" aria-hidden="true"></i>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} pacientes</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">
              Anterior
            </button>
            <span class="mx-2">Página {{ page }}</span>
            <button class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page + 1)" [disabled]="page >= totalPages">
              Siguiente
            </button>
          </div>
        </div>
      }

      @if (pacientePendiente) {
        <app-confirm-dialog title="Desactivar paciente"
          [description]="'¿Deseas desactivar a ' + pacientePendiente.nombres + ' ' + pacientePendiente.apellidos + '?'"
          consequence="El paciente quedará inactivo, pero su historial clínico se conservará."
          confirmLabel="Desactivar" [busy]="eliminandoId === pacientePendiente.idPaciente"
          (confirmed)="confirmarDesactivacion()" (cancelled)="cancelarDesactivacion()" />
      }
    </div>
  `
})
export class PacientesComponent implements OnInit {
  private service = inject(PacientesService);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;
  private readonly apiErrors = inject(ApiErrorService);
  private readonly contexto = new ContextoInventario(['Pacientes']);
  private contextoListado = this.contexto.clave();
  private contextoConfirmacion: string | null = null;
  private listado?: Subscription;
  private revisionListado = 0;
  errorOperacion = '';

  pacientes: PacienteListadoResponse[] = [];
  total = 0;
  totalPages = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';
  pacientePendiente: PacienteListadoResponse | null = null;
  eliminandoId: number | null = null;

  filtroNombre = '';
  filtroActivo: boolean | undefined = undefined;

  constructor() {
    this.contexto.observar(() => {
      this.contextoListado = this.contexto.clave();
      this.contextoConfirmacion = null; this.pacientePendiente = null; this.eliminandoId = null;
      this.pacientes = []; this.errorOperacion = ''; this.total = this.totalPages = 0;
      this.limpiarFiltros();
    });
  }

  ngOnInit() {
    this.cargarPacientes();
  }

  cargarPacientes() {
    this.listado?.unsubscribe();
    const revision = ++this.revisionListado, clave = this.contextoListado;
    if (!this.contexto.vigente(clave) || !this.permisos.puedeConsultar('Pacientes')) {
      this.pacientes = []; this.cargando = false; this.error = 'No tiene sesión y permiso Pacientes/Consultar vigentes.'; return;
    }
    this.cargando = true;
    this.error = '';
    this.listado = this.service.listar(
      this.filtroNombre || undefined,
      this.filtroActivo,
      this.page,
      this.pageSize
    ).subscribe({
      next: (res: PagedResponse<PacienteListadoResponse>) => {
        if (!this.contexto.vigente(clave) || revision !== this.revisionListado) return;
        this.pacientes = res.items;
        this.total = res.totalCount;
        this.totalPages = res.totalPages;
        this.cargando = false;
      },
      error: err => {
        if (!this.contexto.vigente(clave) || revision !== this.revisionListado) return;
        this.error = this.apiErrors.messageFor(err, 'Error al cargar los pacientes. Verifica tus permisos.');
        this.cargando = false;
      }
    });
    this.contexto.agregar(this.listado);
  }

  buscar() {
    this.page = 1;
    this.cargarPacientes();
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroActivo = undefined;
    this.buscar();
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina > 0 && nuevaPagina <= Math.max(this.totalPages, 1)) {
      this.page = nuevaPagina;
      this.cargarPacientes();
    }
  }

  solicitarDesactivacion(paciente: PacienteListadoResponse): void {
    if (this.eliminandoId !== null || !this.contexto.vigente(this.contextoListado) || !idInventarioValido(paciente.idPaciente) ||
      !paciente.activo || !this.pacientes.some(p => p.idPaciente === paciente.idPaciente && p.activo) ||
      !this.permisos.puedeEliminar(MODULOS_PERMISO.PACIENTES)) return;
    this.contextoConfirmacion = this.contextoListado;
    this.errorOperacion = '';
    this.pacientePendiente = paciente;
  }

  cancelarDesactivacion(): void {
    if (this.eliminandoId === null) this.pacientePendiente = null;
  }

  confirmarDesactivacion(): void {
    const paciente = this.pacientePendiente;
    if (!paciente || this.eliminandoId !== null) return;
    if (!this.contextoConfirmacion || !this.contexto.vigente(this.contextoConfirmacion) ||
      !this.permisos.puedeEliminar('Pacientes') || !this.pacientes.some(p => p.idPaciente === paciente.idPaciente && p.activo)) {
      this.pacientePendiente = null; this.errorOperacion = 'La sesión, el permiso o el paciente cambiaron. Revise la operación.'; return;
    }
    const clave = this.contextoConfirmacion;
    this.eliminandoId = paciente.idPaciente;
    this.contexto.agregar(this.service.eliminar(paciente.idPaciente).subscribe({
      next: () => {
        if (!this.contexto.vigente(clave)) return;
        this.eliminandoId = null;
        this.pacientePendiente = null;
        this.cargarPacientes();
      },
      error: err => {
        if (!this.contexto.vigente(clave)) return;
        this.eliminandoId = null;
        this.pacientePendiente = null;
        this.errorOperacion = this.apiErrors.messageFor(err, 'No se pudo desactivar el paciente.');
      },
    }));
  }
}
