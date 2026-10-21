import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject } from '@angular/core';
import { CatalogoAdminColumn, CatalogoAdminRow } from '../../core/models/catalogo-admin.model';
import { PermisosService } from '../../core/services/permisos.service';
import { correlativoPaginado } from '../utils/correlativo';
import { ConfirmDialogComponent } from './confirm-dialog.component';
import { UiStateComponent } from './ui-state.component';

@Component({
  selector: 'app-catalogo-admin-shell',
  standalone: true,
  imports: [UiStateComponent, ConfirmDialogComponent],
  template: `
    <section class="container-fluid py-3" [attr.aria-busy]="loading || processing">
      <header class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-3">
        <div>
          <h1 class="h3 mb-1">{{ title }}</h1>
          <p class="text-muted mb-0">{{ description }}</p>
        </div>
        @if (permissions.puedeCrear(module)) {
          <button type="button" class="btn btn-primary" [disabled]="loading || processing"
                  (click)="createRequested.emit()">
            <i class="bi bi-plus-lg" aria-hidden="true"></i> Nuevo
          </button>
        }
      </header>

      @if (successMessage) {
        <div class="alert alert-success" role="status">{{ successMessage }}</div>
      }
      @if (operationError && !formOpen) {
        <div class="alert alert-danger" role="alert">{{ operationError }}</div>
      }

      <ng-content select="[catalogo-filters]" />

      @if (loading) {
        <app-ui-state kind="loading" title="Cargando catálogo…" />
      } @else if (errorMessage) {
        <app-ui-state kind="error" title="No fue posible cargar el catálogo"
                      [description]="errorMessage" [retryable]="true"
                      (retry)="retry.emit()" />
      } @else if (rows.length === 0) {
        <app-ui-state kind="empty" title="No hay registros"
                      description="El catálogo no contiene elementos para mostrar." />
      } @else {
        <div class="table-responsive">
          <table class="table table-hover align-middle">
            <thead>
              <tr>
                <th scope="col" class="ui-col-index">No.</th>
                @for (column of columns; track column.key) {
                  <th scope="col">{{ column.label }}</th>
                }
                <th scope="col">Estado</th>
                @if (showActions) { <th scope="col" class="text-end">Acciones</th> }
              </tr>
            </thead>
            <tbody>
              @for (row of rows; track row.id; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  @for (column of columns; track column.key) {
                    <td>{{ row.values[column.key] }}</td>
                  }
                  <td>
                    <span class="badge" [class.text-bg-success]="row.activa"
                          [class.text-bg-secondary]="!row.activa">
                      {{ row.activa ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  @if (showActions) {
                    <td class="text-end">
                      <div class="d-inline-flex gap-1">
                        @if (permissions.puedeModificar(module)) {
                          <button type="button" class="btn btn-sm btn-outline-primary"
                                  [disabled]="processing" (click)="editRequested.emit(row.id)"
                                  [attr.aria-label]="'Editar ' + row.label">
                            <i class="bi bi-pencil" aria-hidden="true"></i>
                          </button>
                        }
                        @if (row.activa && permissions.puedeEliminar(module)) {
                          <button type="button" class="btn btn-sm btn-outline-danger"
                                  [disabled]="processing" (click)="requestDeactivation(row)"
                                  [attr.aria-label]="'Desactivar ' + row.label">
                            <i class="bi bi-trash" aria-hidden="true"></i>
                          </button>
                        }
                        @if (!row.activa && allowReactivation && permissions.puedeModificar(module)) {
                          <button type="button" class="btn btn-sm btn-outline-success"
                                  [disabled]="processing" (click)="reactivateRequested.emit(row.id)"
                                  [attr.aria-label]="'Reactivar ' + row.label">
                            <i class="bi bi-arrow-counterclockwise" aria-hidden="true"></i>
                          </button>
                        }
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>

        <nav class="d-flex justify-content-between align-items-center gap-3" aria-label="Paginación del catálogo">
          <span class="text-muted small">{{ totalCount }} registro(s)</span>
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-outline-secondary btn-sm"
                    [disabled]="page <= 1 || processing" (click)="pageChange.emit(page - 1)">
              Anterior
            </button>
            <span>Página {{ page }} de {{ totalPages || 1 }}</span>
            <button type="button" class="btn btn-outline-secondary btn-sm"
                    [disabled]="page >= totalPages || processing" (click)="pageChange.emit(page + 1)">
              Siguiente
            </button>
          </div>
        </nav>
      }
    </section>

    @if (formOpen) {
      <div class="ui-dialog-backdrop" aria-hidden="true"></div>
      <section class="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-form-title">
        <form (submit)="submitForm($event)">
          <div class="ui-dialog__content">
            <h2 id="catalog-form-title" class="h5 mb-3">{{ formTitle }}</h2>
            @if (operationError) { <div class="alert alert-danger" role="alert">{{ operationError }}</div> }
            <ng-content select="[catalogo-form]" />
          </div>
          <div class="ui-dialog__actions">
            <button type="button" class="btn btn-secondary" [disabled]="formSubmitting"
                    (click)="cancelForm()">Cancelar</button>
            <button type="submit" class="btn btn-primary"
                    [disabled]="formSubmitting || !formValid || submissionRequested">
              @if (formSubmitting) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> }
              {{ formSubmitting ? 'Guardando…' : 'Guardar' }}
            </button>
          </div>
        </form>
      </section>
    }

    @if (pendingDeactivation) {
      <app-confirm-dialog title="Desactivar registro"
                          [description]="'Se desactivará ' + pendingDeactivation.label + '.'"
                          consequence="Las relaciones históricas se conservarán."
                          confirmLabel="Desactivar" [busy]="processing"
                          (confirmed)="confirmDeactivation()"
                          (cancelled)="pendingDeactivation = null" />
    }
  `,
})
export class CatalogoAdminShellComponent implements OnChanges {
  readonly permissions = inject(PermisosService);
  readonly correlativo = correlativoPaginado;

  @Input({ required: true }) title = '';
  @Input({ required: true }) description = '';
  @Input({ required: true }) module = '';
  @Input({ required: true }) columns: readonly CatalogoAdminColumn[] = [];
  @Input({ required: true }) rows: readonly CatalogoAdminRow[] = [];
  @Input() page = 1;
  @Input() pageSize = 20;
  @Input() totalPages = 0;
  @Input() totalCount = 0;
  @Input() loading = false;
  @Input() processing = false;
  @Input() errorMessage = '';
  @Input() operationError = '';
  @Input() successMessage = '';
  @Input() allowReactivation = false;
  @Input() formOpen = false;
  @Input() formTitle = '';
  @Input() formValid = false;
  @Input() formSubmitting = false;

  @Output() readonly retry = new EventEmitter<void>();
  @Output() readonly pageChange = new EventEmitter<number>();
  @Output() readonly createRequested = new EventEmitter<void>();
  @Output() readonly editRequested = new EventEmitter<number>();
  @Output() readonly deactivateRequested = new EventEmitter<number>();
  @Output() readonly reactivateRequested = new EventEmitter<number>();
  @Output() readonly formSubmitted = new EventEmitter<void>();
  @Output() readonly formCancelled = new EventEmitter<void>();

  pendingDeactivation: CatalogoAdminRow | null = null;
  submissionRequested = false;

  get showActions(): boolean {
    return this.permissions.puedeModificar(this.module)
      || this.permissions.puedeEliminar(this.module);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if ((changes['formOpen'] && !this.formOpen)
      || (changes['formSubmitting'] && !this.formSubmitting)) {
      this.submissionRequested = false;
    }
    if (changes['processing'] && !this.processing) this.pendingDeactivation = null;
  }

  requestDeactivation(row: CatalogoAdminRow): void {
    if (this.processing || !this.permissions.puedeEliminar(this.module)) return;
    this.pendingDeactivation = row;
  }

  confirmDeactivation(): void {
    if (!this.pendingDeactivation || this.processing) return;
    this.deactivateRequested.emit(this.pendingDeactivation.id);
  }

  submitForm(event: Event): void {
    event.preventDefault();
    if (!this.formValid || this.formSubmitting || this.submissionRequested) return;
    this.submissionRequested = true;
    this.formSubmitted.emit();
  }

  cancelForm(): void {
    if (!this.formSubmitting) this.formCancelled.emit();
  }
}
