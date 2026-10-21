import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { CatalogoAdminColumn, CatalogoAdminRow } from '../../core/models/catalogo-admin.model';
import { GuardarSucursalRequest, Sucursal } from '../../core/models/catalogos.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { CatalogoAdminShellComponent } from '../../shared/components/catalogo-admin-shell.component';

type FiltroEstado = 'todos' | 'activos' | 'inactivos';

@Component({
  selector: 'app-sucursales-admin',
  standalone: true,
  imports: [ReactiveFormsModule, CatalogoAdminShellComponent],
  template: `
    <app-catalogo-admin-shell
      title="Sucursales"
      description="Administra las sedes disponibles para la atención clínica."
      [module]="module"
      [columns]="columns"
      [rows]="rows"
      [page]="page"
      [pageSize]="pageSize"
      [totalPages]="totalPages"
      [totalCount]="totalCount"
      [loading]="loading"
      [processing]="processing"
      [errorMessage]="errorMessage"
      [operationError]="operationError"
      [successMessage]="successMessage"
      [allowReactivation]="true"
      [formOpen]="formOpen"
      [formTitle]="formTitle"
      [formValid]="form.valid"
      [formSubmitting]="formSubmitting"
      (retry)="load(page)"
      (pageChange)="load($event)"
      (createRequested)="openCreate()"
      (editRequested)="openEdit($event)"
      (deactivateRequested)="deactivate($event)"
      (reactivateRequested)="reactivate($event)"
      (formSubmitted)="save()"
      (formCancelled)="closeForm()">

      <div catalogo-filters class="ui-card ui-form mb-3" aria-label="Filtros de sucursales">
        <p class="text-muted small mb-2">Los filtros se aplican a la página cargada por la API.</p>
        <div class="row g-3">
          <div class="col-md-8">
            <label class="form-label" for="sucursal-search">Buscar</label>
            <input id="sucursal-search" type="search" class="form-control"
                   [formControl]="searchControl" maxlength="100"
                   placeholder="Nombre o dirección">
          </div>
          <div class="col-md-4">
            <label class="form-label" for="sucursal-status">Estado</label>
            <select id="sucursal-status" class="form-select" [formControl]="statusControl">
              <option value="todos">Todos</option>
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
            </select>
          </div>
        </div>
      </div>

      <div catalogo-form [formGroup]="form" class="row g-3">
        <div class="col-12">
          <label class="form-label required" for="sucursal-name">Nombre</label>
          <input id="sucursal-name" type="text" class="form-control"
                 formControlName="nombre" maxlength="100" autocomplete="off">
          @if (form.controls.nombre.touched && form.controls.nombre.invalid) {
            <div class="text-danger small">El nombre es obligatorio y admite hasta 100 caracteres.</div>
          }
        </div>
        <div class="col-12">
          <label class="form-label" for="sucursal-address">Dirección</label>
          <textarea id="sucursal-address" class="form-control" rows="3"
                    formControlName="direccion" maxlength="255"></textarea>
          @if (form.controls.direccion.touched && form.controls.direccion.invalid) {
            <div class="text-danger small">La dirección admite hasta 255 caracteres.</div>
          }
        </div>
      </div>
    </app-catalogo-admin-shell>
  `,
})
export class SucursalesAdminComponent implements OnInit {
  private readonly service = inject(CatalogosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly module = MODULOS_PERMISO.SUCURSALES;
  readonly columns: readonly CatalogoAdminColumn[] = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'direccion', label: 'Dirección' },
  ];
  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(100)] }),
    direccion: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(255)] }),
  });
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly statusControl = new FormControl<FiltroEstado>('todos', { nonNullable: true });

  items: readonly Sucursal[] = [];
  page = 1;
  readonly pageSize = 20;
  totalPages = 0;
  totalCount = 0;
  loading = false;
  processing = false;
  formOpen = false;
  formSubmitting = false;
  editingId: number | null = null;
  errorMessage = '';
  operationError = '';
  successMessage = '';

  get formTitle(): string { return this.editingId === null ? 'Nueva sucursal' : 'Editar sucursal'; }

  get rows(): readonly CatalogoAdminRow[] {
    const term = this.searchControl.value.trim().toLocaleLowerCase('es');
    const status = this.statusControl.value;
    return this.items
      .filter(item => !term
        || item.nombre.toLocaleLowerCase('es').includes(term)
        || (item.direccion ?? '').toLocaleLowerCase('es').includes(term))
      .filter(item => status === 'todos'
        || (status === 'activos' ? item.activa : !item.activa))
      .map(item => ({
        id: item.idSucursal,
        label: item.nombre,
        activa: item.activa,
        values: { nombre: item.nombre, direccion: item.direccion ?? '—' },
      }));
  }

  ngOnInit(): void { this.load(1); }

  load(page: number): void {
    if (this.loading || page < 1) return;
    this.loading = true;
    this.errorMessage = '';
    this.service.listarSucursales(page, this.pageSize).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false),
    ).subscribe({
      next: response => {
        this.items = response.items;
        this.page = response.page;
        this.totalPages = response.totalPages;
        this.totalCount = response.totalCount;
      },
      error: error => this.errorMessage = this.errorText(error, 'No se pudieron cargar las sucursales.'),
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({ nombre: '', direccion: '' });
    this.openForm();
  }

  openEdit(id: number): void {
    const item = this.items.find(value => value.idSucursal === id);
    if (!item) return;
    this.editingId = id;
    this.form.reset({ nombre: item.nombre, direccion: item.direccion ?? '' });
    this.openForm();
  }

  closeForm(): void {
    if (this.formSubmitting) return;
    this.formOpen = false;
    this.operationError = '';
  }

  save(): void {
    if (this.formSubmitting || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const current = this.editingId === null
      ? undefined
      : this.items.find(value => value.idSucursal === this.editingId);
    const request: GuardarSucursalRequest = {
      nombre: this.form.controls.nombre.value.trim(),
      direccion: this.form.controls.direccion.value.trim() || null,
      ...(current ? { activa: current.activa } : {}),
    };
    const request$ = this.editingId === null
      ? this.service.crearSucursal(request)
      : this.service.actualizarSucursal(this.editingId, request);
    this.formSubmitting = true;
    this.operationError = '';
    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.formSubmitting = false),
    ).subscribe({
      next: () => {
        this.formOpen = false;
        this.successMessage = this.editingId === null ? 'Sucursal creada.' : 'Sucursal actualizada.';
        this.load(this.page);
      },
      error: error => this.operationError = this.errorText(error, 'No se pudo guardar la sucursal.'),
    });
  }

  deactivate(id: number): void {
    this.runAction(this.service.desactivarSucursal(id), 'Sucursal desactivada.');
  }

  reactivate(id: number): void {
    const item = this.items.find(value => value.idSucursal === id);
    if (!item) return;
    this.runAction(this.service.actualizarSucursal(id, {
      nombre: item.nombre,
      direccion: item.direccion,
      activa: true,
    }), 'Sucursal reactivada.');
  }

  private openForm(): void {
    this.formOpen = true;
    this.operationError = '';
    this.successMessage = '';
  }

  private runAction(request$: Observable<unknown>, message: string): void {
    if (this.processing) return;
    this.processing = true;
    this.operationError = '';
    this.successMessage = '';
    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.processing = false),
    ).subscribe({
      next: () => { this.successMessage = message; this.load(this.page); },
      error: error => this.operationError = this.errorText(error, 'No se pudo completar la operación.'),
    });
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse
      ? this.apiErrors.messageFor(error, fallback)
      : error instanceof Error ? error.message : fallback;
  }
}
