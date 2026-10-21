import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { CatalogoAdminColumn, CatalogoAdminRow } from '../../core/models/catalogo-admin.model';
import {
  GuardarServicioRequest,
  Servicio,
  TIPOS_SERVICIO,
  TipoServicio,
} from '../../core/models/catalogos.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { CatalogoAdminShellComponent } from '../../shared/components/catalogo-admin-shell.component';

@Component({
  selector: 'app-servicios-admin',
  standalone: true,
  imports: [ReactiveFormsModule, CatalogoAdminShellComponent],
  template: `
    <app-catalogo-admin-shell
      title="Servicios"
      description="Administra los servicios clínicos disponibles y su precio base."
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
      [allowReactivation]="false"
      [formOpen]="formOpen"
      [formTitle]="formTitle"
      [formValid]="form.valid"
      [formSubmitting]="formSubmitting"
      (retry)="load(page)"
      (pageChange)="load($event)"
      (createRequested)="openCreate()"
      (editRequested)="openEdit($event)"
      (deactivateRequested)="deactivate($event)"
      (formSubmitted)="save()"
      (formCancelled)="closeForm()">

      <div catalogo-form [formGroup]="form" class="row g-3">
        <div class="col-md-4">
          <label class="form-label required" for="service-code">Código</label>
          <input id="service-code" type="text" class="form-control"
                 formControlName="codigo" maxlength="50" autocomplete="off">
          @if (form.controls.codigo.touched && form.controls.codigo.invalid) {
            <div class="text-danger small">El código es obligatorio y admite hasta 50 caracteres.</div>
          }
        </div>
        <div class="col-md-8">
          <label class="form-label required" for="service-name">Nombre</label>
          <input id="service-name" type="text" class="form-control"
                 formControlName="nombre" maxlength="150" autocomplete="off">
          @if (form.controls.nombre.touched && form.controls.nombre.invalid) {
            <div class="text-danger small">El nombre es obligatorio y admite hasta 150 caracteres.</div>
          }
        </div>
        <div class="col-12">
          <label class="form-label" for="service-description">Descripción</label>
          <textarea id="service-description" class="form-control" rows="3"
                    formControlName="descripcion" maxlength="300"></textarea>
          @if (form.controls.descripcion.touched && form.controls.descripcion.invalid) {
            <div class="text-danger small">La descripción admite hasta 300 caracteres.</div>
          }
        </div>
        <div class="col-md-6">
          <label class="form-label required" for="service-price">Precio base</label>
          <input id="service-price" type="number" class="form-control"
                 formControlName="precioBase" min="0" max="9999999999999999.99" step="0.01">
          @if (form.controls.precioBase.touched && form.controls.precioBase.invalid) {
            <div class="text-danger small">Ingrese un precio no negativo con máximo dos decimales.</div>
          }
        </div>
        <div class="col-md-6">
          <label class="form-label required" for="service-type">Tipo de servicio</label>
          <select id="service-type" class="form-select" formControlName="tipoServicio">
            @for (tipo of tipos; track tipo) {
              <option [value]="tipo">{{ tipo }}</option>
            }
          </select>
        </div>
      </div>
    </app-catalogo-admin-shell>
  `,
})
export class ServiciosAdminComponent implements OnInit {
  private readonly service = inject(CatalogosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly module = MODULOS_PERMISO.SERVICIOS;
  readonly tipos = TIPOS_SERVICIO;
  readonly columns: readonly CatalogoAdminColumn[] = [
    { key: 'codigo', label: 'Código' },
    { key: 'nombre', label: 'Nombre' },
    { key: 'tipo', label: 'Tipo' },
    { key: 'precio', label: 'Precio base' },
  ];
  readonly form = new FormGroup({
    codigo: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(50)],
    }),
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(150)],
    }),
    descripcion: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(300)],
    }),
    precioBase: new FormControl<number | null>(null, {
      validators: [
        Validators.required,
        Validators.min(0),
        Validators.max(9999999999999999.99),
        Validators.pattern(/^\d+(\.\d{1,2})?$/),
      ],
    }),
    tipoServicio: new FormControl<TipoServicio>('Consulta', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  items: readonly Servicio[] = [];
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

  get formTitle(): string { return this.editingId === null ? 'Nuevo servicio' : 'Editar servicio'; }

  ngOnInit(): void { this.load(1); }

  load(page: number): void {
    if (this.loading || page < 1) return;
    this.loading = true;
    this.errorMessage = '';
    this.service.listarServicios(page, this.pageSize).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false),
    ).subscribe({
      next: response => {
        this.items = response.items;
        this.rows = response.items.map(item => ({
          id: item.idServicio,
          label: item.nombre,
          activa: item.activo,
          values: {
            codigo: item.codigo,
            nombre: item.nombre,
            tipo: item.tipoServicio,
            precio: this.formatPrice(item.precioBase),
          },
        }));
        this.page = response.page;
        this.totalPages = response.totalPages;
        this.totalCount = response.totalCount;
      },
      error: error => this.errorMessage = this.errorText(error, 'No se pudieron cargar los servicios.'),
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({
      codigo: '', nombre: '', descripcion: '', precioBase: null, tipoServicio: 'Consulta',
    });
    this.openForm();
  }

  openEdit(id: number): void {
    const item = this.items.find(value => value.idServicio === id);
    if (!item) return;
    this.editingId = id;
    this.form.reset({
      codigo: item.codigo,
      nombre: item.nombre,
      descripcion: item.descripcion ?? '',
      precioBase: item.precioBase,
      tipoServicio: item.tipoServicio,
    });
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
    const price = this.form.controls.precioBase.value;
    if (price === null) return;
    const request: GuardarServicioRequest = {
      codigo: this.form.controls.codigo.value.trim(),
      nombre: this.form.controls.nombre.value.trim(),
      descripcion: this.form.controls.descripcion.value.trim() || null,
      precioBase: price,
      tipoServicio: this.form.controls.tipoServicio.value,
    };
    const request$ = this.editingId === null
      ? this.service.crearServicio(request)
      : this.service.actualizarServicio(this.editingId, request);
    this.formSubmitting = true;
    this.operationError = '';
    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.formSubmitting = false),
    ).subscribe({
      next: () => {
        this.formOpen = false;
        this.successMessage = this.editingId === null ? 'Servicio creado.' : 'Servicio actualizado.';
        this.load(this.page);
      },
      error: error => this.operationError = this.errorText(error, 'No se pudo guardar el servicio.'),
    });
  }

  deactivate(id: number): void {
    this.runAction(this.service.desactivarServicio(id), 'Servicio desactivado.');
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

  private formatPrice(value: number): string {
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(value);
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse
      ? this.apiErrors.messageFor(error, fallback)
      : error instanceof Error ? error.message : fallback;
  }
}
