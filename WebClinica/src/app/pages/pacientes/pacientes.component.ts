import { Component, DestroyRef, inject, OnInit } from '@angular/core';

import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
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
        <div class="row g-3 align-items-end pacientes-filtros">
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
          <div class="col-md-3 d-flex align-items-end">
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
          <table class="table table-hover table-striped ui-table pacientes-table">
            <thead>
              <tr>
                <th scope="col" class="ui-col-index">No.</th>
                <th scope="col">Paciente</th>
                <th scope="col">Estado</th>
                <th scope="col" class="ui-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (paciente of pacientes; track paciente.idPaciente; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  <td>
                    <div class="pacientes-identidad">
                      @if (fotoUrl(paciente.idPaciente); as foto) {
                        <img class="pacientes-avatar" [src]="foto" alt="" width="44" height="44">
                      } @else {
                        <span class="pacientes-avatar pacientes-avatar--empty" aria-hidden="true"><i class="bi bi-person-fill"></i></span>
                      }
                      <span>{{ paciente.nombres }} {{ paciente.apellidos }}</span>
                    </div>
                  </td>
                  <td>
                    <span class="badge" [class.bg-success]="paciente.activo" [class.bg-secondary]="!paciente.activo">
                      {{ paciente.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="ui-col-actions">
                    <div class="pacientes-actions">
                      @if (permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
                        <a [routerLink]="['/pacientes', paciente.idPaciente, 'ficha']" class="btn btn-sm btn-outline-info" aria-label="Ver ficha médica del paciente" title="Ver ficha médica">
                          <i class="bi bi-eye" aria-hidden="true"></i> Ficha médica
                        </a>
                      }
                      @if (permisos.puedeModificar(MODULOS_PERMISO.PACIENTES)) {
                        <a [routerLink]="['/pacientes/editar', paciente.idPaciente]" class="btn btn-sm btn-outline-primary" aria-label="Modificar paciente" title="Editar paciente">
                          <i class="bi bi-pencil" aria-hidden="true"></i> Modificar
                        </a>
                      }
                      @if (permisos.puedeEliminar(MODULOS_PERMISO.PACIENTES)) {
                        <button type="button" (click)="solicitarDesactivacion(paciente)" class="btn btn-sm btn-outline-danger" [disabled]="!paciente.activo || eliminandoId !== null" aria-label="Desactivar paciente" title="Desactivar paciente">
                          <i class="bi bi-trash" aria-hidden="true"></i> Desactivar
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
  `,
    styles: [`
      .pacientes-filtros .form-label { color: var(--ui-heading); font-weight: 600; }
      .pacientes-identidad { display: flex; align-items: center; gap: .75rem; min-width: 11rem; }
      .pacientes-avatar { width: 2.75rem; height: 2.75rem; flex: 0 0 2.75rem; border-radius: 50%; object-fit: cover; }
      .pacientes-avatar--empty { display: inline-flex; align-items: center; justify-content: center; background: #e8eef4; color: #627589; font-size: 1.25rem; }
      .pacientes-table td.ui-col-actions { white-space: normal; }
      .pacientes-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: .5rem; }
      .pacientes-actions .btn { display: inline-flex; align-items: center; justify-content: center; gap: .35rem; min-height: 2.25rem; white-space: nowrap; }
      @media (max-width: 767.98px) { .pacientes-actions { justify-content: flex-start; } }
    `]
})
export class PacientesComponent implements OnInit {
  private service = inject(PacientesService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;
  private readonly apiErrors = inject(ApiErrorService);
  private readonly contexto = new ContextoInventario(['Pacientes']);
  private readonly fotos = new Map<number, string | null>();
  private readonly fotosPendientes = new Map<number, Subscription>();
  private readonly pacientesSinFoto = new Set<number>();
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
    this.destroyRef.onDestroy(() => this.limpiarFotos());
    this.contexto.observar(() => {
      this.limpiarFotos();
      this.contextoListado = this.contexto.clave();
      this.contextoConfirmacion = null; this.pacientePendiente = null; this.eliminandoId = null;
      this.pacientes = []; this.errorOperacion = ''; this.total = this.totalPages = 0;
      this.limpiarFiltros();
    });
  }

  ngOnInit() {
    this.cargarPacientes();
  }

  fotoUrl(id: number): string | null { return this.fotos.get(id) ?? null; }

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
        this.sincronizarFotos(res.items, clave);
        this.cargando = false;
      },
      error: err => {
        if (!this.contexto.vigente(clave) || revision !== this.revisionListado) return;
        this.limpiarFotos();
        this.error = this.apiErrors.messageFor(err, 'Error al cargar los pacientes. Verifica tus permisos.');
        this.cargando = false;
      }
    });
    this.contexto.agregar(this.listado);
  }

  private sincronizarFotos(items: PacienteListadoResponse[], clave: string): void {
    const visibles = new Set(items.map(item => item.idPaciente));
    for (const [id, foto] of this.fotos) {
      if (visibles.has(id)) continue;
      if (foto) URL.revokeObjectURL(foto);
      this.fotos.delete(id);
    }
    for (const [id, solicitud] of this.fotosPendientes) {
      if (visibles.has(id)) continue;
      solicitud.unsubscribe();
      this.fotosPendientes.delete(id);
    }
    for (const item of items) {
      const id = item.idPaciente;
      if (!idInventarioValido(id) || this.fotos.has(id) || this.fotosPendientes.has(id)) continue;
      if (this.pacientesSinFoto.has(id)) { this.fotos.set(id, null); continue; }
      const solicitud = new Subscription();
      this.fotosPendientes.set(id, solicitud);
      this.contexto.agregar(solicitud);
      solicitud.add(this.service.obtenerFoto(id).subscribe({
        next: blob => {
          this.fotosPendientes.delete(id);
          if (!this.contexto.vigente(clave) || !this.pacientes.some(p => p.idPaciente === id)) return;
          this.fotos.set(id, blob instanceof Blob && blob.size > 0 &&
            ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) ? URL.createObjectURL(blob) : null);
        },
        error: (error: unknown) => {
          this.fotosPendientes.delete(id);
          if (this.contexto.vigente(clave) && this.pacientes.some(p => p.idPaciente === id)) {
            if (error instanceof HttpErrorResponse && error.status === 404) this.pacientesSinFoto.add(id);
            this.fotos.set(id, null);
          }
        },
      }));
    }
  }

  private limpiarFotos(): void {
    for (const solicitud of this.fotosPendientes.values()) solicitud.unsubscribe();
    this.fotosPendientes.clear();
    for (const foto of this.fotos.values()) if (foto) URL.revokeObjectURL(foto);
    this.fotos.clear();
    this.pacientesSinFoto.clear();
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
