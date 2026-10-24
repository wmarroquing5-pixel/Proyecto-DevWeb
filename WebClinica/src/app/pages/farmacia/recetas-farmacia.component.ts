import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RecetaFarmaciaDto } from '../../core/models/receta-farmacia.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { RecetaFarmaciaService } from '../../core/services/receta-farmacia.service';

@Component({
  selector: 'app-recetas-farmacia',
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h2>Recetas para Farmacia</h2>
          <p class="text-muted mb-0">Consulta de recetas registradas de tu sucursal.</p>
        </div>
      </header>

      <form class="ui-card ui-form mb-4" (ngSubmit)="buscar()">
        <div class="row g-3 align-items-end">
          <div class="col-sm-6 col-lg-4">
            <label class="form-label" for="receta-consulta">Consulta</label>
            <input id="receta-consulta" class="form-control" type="number" min="1" step="1"
                   name="consulta" [(ngModel)]="consultaFiltro" placeholder="Todas las consultas">
          </div>
          <div class="col-sm-6 col-lg-auto d-flex gap-2">
            <button class="btn btn-primary" type="submit">Buscar</button>
            <button class="btn btn-outline-secondary" type="button" (click)="limpiar()">Limpiar</button>
          </div>
        </div>
      </form>

      @if (cargando) {
        <p class="text-muted" role="status">Cargando recetas…</p>
      } @else if (error) {
        <div class="alert alert-danger" role="alert">{{ error }}</div>
      } @else if (recetas.length === 0) {
        <div class="alert alert-info" role="status">No hay recetas registradas para este filtro.</div>
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-striped table-hover ui-table">
            <thead><tr>
              <th scope="col">Receta</th><th scope="col">Paciente</th><th scope="col">Consulta</th>
              <th scope="col">Médico prescriptor</th><th scope="col">Fecha</th>
              <th scope="col">Estado</th><th scope="col">Medicamentos</th><th scope="col">Acciones</th>
            </tr></thead>
            <tbody>
              @for (receta of recetas; track receta.idReceta) {
                <tr>
                  <td>{{ receta.idReceta }}</td>
                  <td>{{ receta.nombrePaciente }}</td>
                  <td>{{ receta.idConsulta }}</td>
                  <td>{{ receta.nombreMedicoPrescriptor || 'No disponible' }}</td>
                  <td>{{ receta.fechaPrescripcionUtc | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td><span class="badge text-bg-light border">{{ receta.estado }}</span></td>
                  <td>
                    <ul class="list-unstyled mb-0">
                      @for (linea of receta.medicamentos; track $index) {
                        <li>{{ linea.nombreMedicamento }} · {{ linea.presentacion || 'No registrada' }} · {{ linea.cantidadPrescritaUnidades }}</li>
                      }
                    </ul>
                  </td>
                  <td><button type="button" class="btn btn-sm btn-outline-primary"
                              (click)="verDetalle(receta.idReceta)"
                              [attr.aria-label]="'Ver detalle de receta ' + receta.idReceta">Ver detalle</button></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
          <span>Total: {{ total }} recetas</span>
          <div class="d-flex align-items-center gap-2">
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cambiarPagina(page - 1)"
                    [disabled]="page <= 1">Anterior</button>
            <span>Página {{ page }} de {{ totalPages }}</span>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cambiarPagina(page + 1)"
                    [disabled]="page >= totalPages">Siguiente</button>
          </div>
        </div>
      }

      @if (detalleCargando) { <p class="mt-4" role="status">Cargando detalle…</p> }
      @if (errorDetalle) { <div class="alert alert-danger mt-4" role="alert">{{ errorDetalle }}</div> }
      @if (detalle) {
        <section class="ui-card mt-4" aria-label="Detalle de receta">
          <div class="d-flex justify-content-between align-items-center gap-2 mb-3">
            <h3 class="h5 mb-0">Receta {{ detalle.idReceta }}</h3>
            <button type="button" class="btn btn-sm btn-outline-secondary" (click)="cerrarDetalle()">Cerrar</button>
          </div>
          <p class="mb-2"><strong>Paciente:</strong> {{ detalle.nombrePaciente }} ·
            <strong>Consulta:</strong> {{ detalle.idConsulta }} ·
            <strong>Médico:</strong> {{ detalle.nombreMedicoPrescriptor || 'No disponible' }}</p>
          <p class="mb-3"><strong>Estado:</strong> {{ detalle.estado }} ·
            <strong>Fecha:</strong> {{ detalle.fechaPrescripcionUtc | date:'dd/MM/yyyy HH:mm' }}</p>
          <div class="ui-table-wrap">
            <table class="table ui-table">
              <thead><tr><th scope="col">Medicamento</th><th scope="col">Presentación</th><th scope="col">Cantidad prescrita</th></tr></thead>
              <tbody>@for (linea of detalle.medicamentos; track $index) {
                <tr><td>{{ linea.nombreMedicamento }}</td><td>{{ linea.presentacion || 'No registrada' }}</td><td>{{ linea.cantidadPrescritaUnidades }}</td></tr>
              }</tbody>
            </table>
          </div>
        </section>
      }
    </div>
  `,
})
export class RecetasFarmaciaComponent implements OnInit {
  private readonly service = inject(RecetaFarmaciaService);
  private readonly errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private revisionListado = 0;
  private revisionDetalle = 0;

  consultaFiltro: number | null = null;
  private consultaAplicada: number | null = null;
  recetas: RecetaFarmaciaDto[] = [];
  detalle: RecetaFarmaciaDto | null = null;
  page = 1;
  readonly pageSize = 10;
  total = 0;
  totalPages = 0;
  cargando = false;
  detalleCargando = false;
  error = '';
  errorDetalle = '';

  ngOnInit(): void { this.cargar(); }

  buscar(): void {
    if (this.consultaFiltro !== null &&
        (!Number.isSafeInteger(this.consultaFiltro) || this.consultaFiltro <= 0)) {
      this.error = 'La consulta debe ser un número entero positivo.';
      return;
    }
    this.consultaAplicada = this.consultaFiltro;
    this.page = 1;
    this.cerrarDetalle();
    this.cargar();
  }

  limpiar(): void {
    this.consultaFiltro = null;
    this.buscar();
  }

  cambiarPagina(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) return;
    this.page = page;
    this.cerrarDetalle();
    this.cargar();
  }

  verDetalle(idReceta: number): void {
    const revision = ++this.revisionDetalle;
    this.detalle = null;
    this.errorDetalle = '';
    this.detalleCargando = true;
    this.service.obtener(idReceta).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detalle => {
        if (revision !== this.revisionDetalle) return;
        this.detalle = detalle;
        this.detalleCargando = false;
      },
      error: (error: HttpErrorResponse) => {
        if (revision !== this.revisionDetalle) return;
        this.errorDetalle = this.errores.messageFor(error, 'No fue posible consultar la receta.');
        this.detalleCargando = false;
      },
    });
  }

  cerrarDetalle(): void {
    this.revisionDetalle++;
    this.detalle = null;
    this.detalleCargando = false;
    this.errorDetalle = '';
  }

  private cargar(): void {
    const revision = ++this.revisionListado;
    this.cargando = true;
    this.error = '';
    this.service.listar(this.page, this.pageSize, this.consultaAplicada)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          if (revision !== this.revisionListado) return;
          this.recetas = response.items;
          this.total = response.totalCount;
          this.totalPages = response.totalPages;
          this.cargando = false;
        },
        error: (error: HttpErrorResponse) => {
          if (revision !== this.revisionListado) return;
          this.recetas = [];
          this.error = this.errores.messageFor(error, 'No fue posible consultar las recetas.');
          this.cargando = false;
        },
      });
  }
}
