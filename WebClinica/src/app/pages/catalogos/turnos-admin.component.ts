import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, finalize } from 'rxjs';
import { CatalogoAdminColumn, CatalogoAdminRow } from '../../core/models/catalogo-admin.model';
import { GuardarTurnoRequest, JORNADAS_TURNO, JornadaTurno, Turno } from '../../core/models/catalogos.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { CatalogoAdminShellComponent } from '../../shared/components/catalogo-admin-shell.component';

@Component({
  selector: 'app-turnos-admin',
  standalone: true,
  imports: [ReactiveFormsModule, CatalogoAdminShellComponent],
  template: `
    <app-catalogo-admin-shell
      title="Turnos"
      description="Administra los horarios laborales y su jornada."
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
        <div class="col-md-8">
          <label class="form-label required" for="shift-name">Nombre</label>
          <input id="shift-name" type="text" class="form-control"
                 formControlName="nombre" maxlength="50" autocomplete="off">
          @if (form.controls.nombre.touched && form.controls.nombre.invalid) {
            <div class="text-danger small">El nombre es obligatorio y admite hasta 50 caracteres.</div>
          }
        </div>
        <div class="col-md-4">
          <label class="form-label required" for="shift-code">Código</label>
          <input id="shift-code" type="text" class="form-control"
                 formControlName="codigo" maxlength="20" autocomplete="off">
          @if (form.controls.codigo.touched && form.controls.codigo.invalid) {
            <div class="text-danger small">El código es obligatorio y admite hasta 20 caracteres.</div>
          }
        </div>
        <div class="col-md-6">
          <label class="form-label required" for="shift-start">Hora de entrada</label>
          <input id="shift-start" type="time" class="form-control" formControlName="horaEntrada">
        </div>
        <div class="col-md-6">
          <label class="form-label required" for="shift-end">Hora de salida</label>
          <input id="shift-end" type="time" class="form-control" formControlName="horaSalida">
        </div>
        <div class="col-12">
          <label class="form-label required" for="shift-session">Jornada</label>
          <select id="shift-session" class="form-select" formControlName="jornada">
            @for (jornada of jornadas; track jornada) {
              <option [value]="jornada">{{ jornada }}</option>
            }
          </select>
        </div>
      </div>
    </app-catalogo-admin-shell>
  `,
})
export class TurnosAdminComponent implements OnInit {
  private readonly service = inject(CatalogosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);

  readonly module = MODULOS_PERMISO.TURNOS;
  readonly jornadas = JORNADAS_TURNO;
  readonly columns: readonly CatalogoAdminColumn[] = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'codigo', label: 'Código' },
    { key: 'horario', label: 'Horario' },
    { key: 'jornada', label: 'Jornada' },
  ];
  readonly form = new FormGroup({
    nombre: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(50)] }),
    codigo: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    horaEntrada: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    horaSalida: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    jornada: new FormControl<JornadaTurno>('Diurna', { nonNullable: true, validators: [Validators.required] }),
  });

  items: readonly Turno[] = [];
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

  get formTitle(): string { return this.editingId === null ? 'Nuevo turno' : 'Editar turno'; }

  ngOnInit(): void { this.load(1); }

  load(page: number): void {
    if (this.loading || page < 1) return;
    this.loading = true;
    this.errorMessage = '';
    this.service.listarTurnos(page, this.pageSize).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading = false),
    ).subscribe({
      next: response => {
        this.items = response.items;
        this.rows = response.items.map(item => ({
          id: item.idTurno,
          label: item.nombre,
          activa: item.activo,
          values: {
            nombre: item.nombre,
            codigo: item.codigo,
            horario: `${this.displayTime(item.horaEntrada)}–${this.displayTime(item.horaSalida)}`,
            jornada: item.jornada,
          },
        }));
        this.page = response.page;
        this.totalPages = response.totalPages;
        this.totalCount = response.totalCount;
      },
      error: error => this.errorMessage = this.errorText(error, 'No se pudieron cargar los turnos.'),
    });
  }

  openCreate(): void {
    this.editingId = null;
    this.form.reset({ nombre: '', codigo: '', horaEntrada: '', horaSalida: '', jornada: 'Diurna' });
    this.openForm();
  }

  openEdit(id: number): void {
    const item = this.items.find(value => value.idTurno === id);
    if (!item) return;
    this.editingId = id;
    this.form.reset({
      nombre: item.nombre,
      codigo: item.codigo,
      horaEntrada: this.inputTime(item.horaEntrada),
      horaSalida: this.inputTime(item.horaSalida),
      jornada: item.jornada,
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
    const request: GuardarTurnoRequest = {
      nombre: this.form.controls.nombre.value.trim(),
      codigo: this.form.controls.codigo.value.trim(),
      horaEntrada: this.apiTime(this.form.controls.horaEntrada.value),
      horaSalida: this.apiTime(this.form.controls.horaSalida.value),
      jornada: this.form.controls.jornada.value,
    };
    const request$ = this.editingId === null
      ? this.service.crearTurno(request)
      : this.service.actualizarTurno(this.editingId, request);
    this.formSubmitting = true;
    this.operationError = '';
    request$.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.formSubmitting = false),
    ).subscribe({
      next: () => {
        this.formOpen = false;
        this.successMessage = this.editingId === null ? 'Turno creado.' : 'Turno actualizado.';
        this.load(this.page);
      },
      error: error => this.operationError = this.errorText(error, 'No se pudo guardar el turno.'),
    });
  }

  deactivate(id: number): void {
    this.runAction(this.service.desactivarTurno(id), 'Turno desactivado.');
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

  private inputTime(value: string): string { return value.slice(0, 5); }
  private displayTime(value: string): string { return this.inputTime(value); }
  private apiTime(value: string): string { return value.length === 5 ? `${value}:00` : value; }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof HttpErrorResponse
      ? this.apiErrors.messageFor(error, fallback)
      : error instanceof Error ? error.message : fallback;
  }
}
