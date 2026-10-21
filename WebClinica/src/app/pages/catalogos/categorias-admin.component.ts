import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { CatalogoAdminColumn, CatalogoAdminRow } from '../../core/models/catalogo-admin.model';
import { CategoriaResponse, GuardarCatalogoFarmaciaRequest } from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { InventarioService } from '../../core/services/inventario.service';
import { CatalogoAdminShellComponent } from '../../shared/components/catalogo-admin-shell.component';

@Component({
    selector: 'app-categorias-admin',
    imports: [ReactiveFormsModule, CatalogoAdminShellComponent],
    template: `
    <app-catalogo-admin-shell
      title="Categorías"
      description="Administra la clasificación utilizada por el catálogo de medicamentos."
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

      <div catalogo-form [formGroup]="form">
        <label class="form-label required" for="category-name">Nombre</label>
        <input id="category-name" type="text" class="form-control"
               formControlName="nombre" maxlength="100" autocomplete="off">
        @if (form.controls.nombre.touched && form.controls.nombre.invalid) {
          <div class="text-danger small">El nombre es obligatorio y admite hasta 100 caracteres.</div>
        }
      </div>
    </app-catalogo-admin-shell>
  `
})
export class CategoriasAdminComponent implements OnInit {
  private readonly service = inject(InventarioService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly module = MODULOS_PERMISO.CATEGORIAS;
  readonly columns: readonly CatalogoAdminColumn[] = [{ key: 'nombre', label: 'Nombre' }];
  readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
  });

  items: readonly CategoriaResponse[] = [];
  rows: readonly CatalogoAdminRow[] = [];
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

  get formTitle(): string { return this.editingId === null ? 'Nueva categoría' : 'Editar categoría'; }

  ngOnInit(): void { this.load(1); }

  load(page: number): void {
    if (this.loading || page < 1) return;
    this.loading = true;
    this.errorMessage = '';
    this.service.listarCategorias(page, this.pageSize).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false),
    ).subscribe({
      next: response => {
        this.items = response.items;
        this.rows = response.items.map(item => ({
          id: item.idCategoria,
          label: item.nombre,
          activa: item.activa,
          values: { nombre: item.nombre },
        }));
        this.page = response.page;
        this.totalPages = response.totalPages;
        this.totalCount = response.totalCount;
      },
      error: error => this.errorMessage = this.errorText(error, 'No se pudieron cargar las categorías.'),
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({ nombre: '' });
    this.openForm();
  }

  openEdit(id: number): void {
    const item = this.items.find(value => value.idCategoria === id);
    if (!item) return;
    this.editingId = id;
    this.form.reset({ nombre: item.nombre });
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
    const current = this.currentItem();
    const request: GuardarCatalogoFarmaciaRequest = {
      nombre: this.form.controls.nombre.value.trim(),
      ...(current ? { activa: current.activa } : {}),
    };
    const request$ = this.editingId === null
      ? this.service.crearCategoria(request)
      : this.service.actualizarCategoria(this.editingId, request);
    this.formSubmitting = true;
    this.operationError = '';
    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.formSubmitting = false),
    ).subscribe({
      next: () => {
        this.formOpen = false;
        this.successMessage = this.editingId === null ? 'Categoría creada.' : 'Categoría actualizada.';
        this.load(this.page);
      },
      error: error => this.operationError = this.errorText(error, 'No se pudo guardar la categoría.'),
    });
  }

  deactivate(id: number): void {
    this.runAction(this.service.desactivarCategoria(id), 'Categoría desactivada.');
  }

  reactivate(id: number): void {
    const item = this.items.find(value => value.idCategoria === id);
    if (!item) return;
    this.runAction(this.service.actualizarCategoria(id, {
      nombre: item.nombre,
      activa: true,
    }), 'Categoría reactivada.');
  }

  private currentItem(): CategoriaResponse | undefined {
    return this.editingId === null
      ? undefined
      : this.items.find(value => value.idCategoria === this.editingId);
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
      error: error => this.operationError = this.errorText(
        error,
        'No se pudo completar la operación. Comprueba si existen medicamentos activos relacionados.',
      ),
    });
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse
      ? this.apiErrors.messageFor(error, fallback)
      : error instanceof Error ? error.message : fallback;
  }
}
