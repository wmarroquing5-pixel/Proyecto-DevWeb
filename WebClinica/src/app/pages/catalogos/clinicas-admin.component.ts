import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { CatalogoAdminColumn, CatalogoAdminRow } from '../../core/models/catalogo-admin.model';
import { Clinica, GuardarClinicaRequest, Sucursal } from '../../core/models/catalogos.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { CatalogoAdminShellComponent } from '../../shared/components/catalogo-admin-shell.component';

@Component({
  selector: 'app-clinicas-admin',
  standalone: true,
  imports: [ReactiveFormsModule, CatalogoAdminShellComponent],
  template: `
    <app-catalogo-admin-shell
      title="Clínicas"
      description="Administra las clínicas vinculadas a las sucursales disponibles."
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
        <div class="col-12">
          <label class="form-label required" for="clinic-name">Nombre</label>
          <input id="clinic-name" type="text" class="form-control"
                 formControlName="nombreClinica" maxlength="100" autocomplete="off">
          @if (form.controls.nombreClinica.touched && form.controls.nombreClinica.invalid) {
            <div class="text-danger small">El nombre es obligatorio y admite hasta 100 caracteres.</div>
          }
        </div>
        <div class="col-md-6">
          <label class="form-label" for="clinic-specialty">Especialidad</label>
          <input id="clinic-specialty" type="text" class="form-control"
                 formControlName="especialidad" maxlength="100" autocomplete="off">
          @if (form.controls.especialidad.touched && form.controls.especialidad.invalid) {
            <div class="text-danger small">La especialidad admite hasta 100 caracteres.</div>
          }
        </div>
        <div class="col-md-6">
          <label class="form-label required" for="clinic-branch">Sucursal</label>
          <select id="clinic-branch" class="form-select" formControlName="idSucursal">
            <option [ngValue]="0">Seleccione una sucursal</option>
            @for (sucursal of sucursalesActivas; track sucursal.idSucursal) {
              <option [ngValue]="sucursal.idSucursal">{{ sucursal.nombre }}</option>
            }
          </select>
          @if (form.controls.idSucursal.touched && form.controls.idSucursal.invalid) {
            <div class="text-danger small">Seleccione una sucursal válida.</div>
          }
        </div>
      </div>
    </app-catalogo-admin-shell>
  `,
})
export class ClinicasAdminComponent implements OnInit {
  private readonly service = inject(CatalogosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly module = MODULOS_PERMISO.CLINICAS;
  readonly columns: readonly CatalogoAdminColumn[] = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'especialidad', label: 'Especialidad' },
    { key: 'sucursal', label: 'Sucursal' },
  ];
  readonly form = new FormGroup({
    nombreClinica: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    especialidad: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(100)],
    }),
    idSucursal: new FormControl(0, {
      nonNullable: true,
      validators: [Validators.required, Validators.min(1)],
    }),
  });

  items: readonly Clinica[] = [];
  rows: readonly CatalogoAdminRow[] = [];
  sucursales: readonly Sucursal[] = [];
  page = 1;
  readonly pageSize = 20;
  totalPages = 0;
  totalCount = 0;
  loading = false;
  loadingBranches = false;
  processing = false;
  formOpen = false;
  formSubmitting = false;
  editingId: number | null = null;
  originalBranchId: number | null = null;
  errorMessage = '';
  operationError = '';
  successMessage = '';

  get formTitle(): string { return this.editingId === null ? 'Nueva clínica' : 'Editar clínica'; }
  get sucursalesActivas(): readonly Sucursal[] {
    return this.sucursales.filter(item => item.activa
      || (this.editingId !== null && item.idSucursal === this.originalBranchId));
  }

  ngOnInit(): void { this.load(1); }

  load(page: number): void {
    if (this.loading || page < 1) return;
    this.loading = true;
    this.errorMessage = '';
    this.service.listarClinicas(page, this.pageSize).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false),
    ).subscribe({
      next: response => {
        this.items = response.items;
        this.updateRows();
        this.page = response.page;
        this.totalPages = response.totalPages;
        this.totalCount = response.totalCount;
      },
      error: error => this.errorMessage = this.errorText(error, 'No se pudieron cargar las clínicas.'),
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.originalBranchId = null;
    this.form.reset({ nombreClinica: '', especialidad: '', idSucursal: 0 });
    this.openFormWithBranches();
  }

  openEdit(id: number): void {
    const item = this.items.find(value => value.idClinica === id);
    if (!item) return;
    this.editingId = id;
    this.originalBranchId = item.idSucursal;
    this.form.reset({
      nombreClinica: item.nombreClinica,
      especialidad: item.especialidad ?? '',
      idSucursal: item.idSucursal,
    });
    this.openFormWithBranches();
  }

  closeForm(): void {
    if (this.formSubmitting) return;
    this.formOpen = false;
    this.operationError = '';
  }

  save(): void {
    const branchIsAvailable = this.sucursalesActivas.some(
      item => item.idSucursal === this.form.controls.idSucursal.value,
    );
    if (this.formSubmitting || this.form.invalid || !branchIsAvailable) {
      this.form.markAllAsTouched();
      if (!branchIsAvailable) this.operationError = 'Seleccione una sucursal disponible.';
      return;
    }
    const request: GuardarClinicaRequest = {
      nombreClinica: this.form.controls.nombreClinica.value.trim(),
      especialidad: this.form.controls.especialidad.value.trim() || null,
      idSucursal: this.form.controls.idSucursal.value,
    };
    const request$ = this.editingId === null
      ? this.service.crearClinica(request)
      : this.service.actualizarClinica(this.editingId, request);
    this.formSubmitting = true;
    this.operationError = '';
    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.formSubmitting = false),
    ).subscribe({
      next: () => {
        this.formOpen = false;
        this.successMessage = this.editingId === null ? 'Clínica creada.' : 'Clínica actualizada.';
        this.load(this.page);
      },
      error: error => this.operationError = this.errorText(error, 'No se pudo guardar la clínica.'),
    });
  }

  deactivate(id: number): void {
    this.runAction(this.service.desactivarClinica(id), 'Clínica desactivada.');
  }

  private openFormWithBranches(): void {
    this.operationError = '';
    this.successMessage = '';
    if (this.sucursales.length > 0) {
      this.formOpen = true;
      return;
    }
    if (this.loadingBranches) return;
    this.loadingBranches = true;
    this.service.getSucursales().pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loadingBranches = false),
    ).subscribe({
      next: sucursales => {
        this.sucursales = sucursales;
        this.updateRows();
        this.formOpen = true;
      },
      error: error => this.operationError = this.errorText(
        error,
        'No se pudieron cargar las sucursales necesarias para la clínica.',
      ),
    });
  }

  private branchLabel(idSucursal: number): string {
    return this.sucursales.find(item => item.idSucursal === idSucursal)?.nombre ?? `Sucursal ${idSucursal}`;
  }

  private updateRows(): void {
    this.rows = this.items.map(item => ({
      id: item.idClinica,
      label: item.nombreClinica,
      activa: item.activa,
      values: {
        nombre: item.nombreClinica,
        especialidad: item.especialidad ?? '—',
        sucursal: this.branchLabel(item.idSucursal),
      },
    }));
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
