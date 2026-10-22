import { Component, effect, inject, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { EMPTY, Subscription, concatMap, defer, expand, finalize, last } from 'rxjs';

import { HabitacionesService } from '../../core/services/habitaciones.service';
import { AsignacionHabitacionResponse, HabitacionResponse, PagedResponse } from '../../core/models/habitacion.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermisosService } from '../../core/services/permisos.service';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';

@Component({
    selector: 'app-registrar-egreso-modal',
    imports: [],
    template: `
    <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="egreso-title"
         (keydown.escape)="cancelar()" style="background: rgba(0,0,0,0.5);">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="egreso-title">Registrar Egreso - Habitación {{ habitacion.numeroHabitacion }}</h5>
            <button type="button" class="btn-close" aria-label="Cerrar egreso" (click)="cancelar()"></button>
          </div>
          <div class="modal-body">
            @if (error) { <div class="alert alert-danger" role="alert">{{ error }}</div> }

            <p>¿Está seguro de registrar el egreso del paciente de la habitación <strong>{{ habitacion.numeroHabitacion }}</strong>?</p>
            <p class="text-muted">La habitación pasará al estado "En limpieza".</p>

            <div class="d-flex justify-content-end gap-2 mt-4">
              <button class="btn btn-secondary" (click)="cancelar()">Cancelar</button>
              <button class="btn btn-warning" (click)="registrarEgreso()" [disabled]="cargando">
                {{ cargando ? 'Registrando...' : 'Confirmar Egreso' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `
})
export class RegistrarEgresoModalComponent implements OnDestroy {
  private service = inject(HabitacionesService);
  private session = inject(AuthSessionService);
  private permisos = inject(PermisosService);
  private apiErrors = inject(ApiErrorService);
  private seleccion!: HabitacionResponse;
  private solicitud?: Subscription;
  private revision = 0;
  private cerrado = false;
  private identidadObservada: string | null | undefined;
  // El listado no admite filtro por habitación: revisar todas sus páginas permite
  // rechazar duplicados incluso si están separados. Nunca usar un resultado parcial.
  private readonly pageSize = 100;
  private readonly maxPages = 100;

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      if (this.identidadObservada !== undefined && identidad !== this.identidadObservada) {
        this.invalidar();
        this.error = 'La sesión o los permisos cambiaron. Vuelve a abrir el egreso.';
      }
      this.identidadObservada = identidad;
    });
  }

  @Input() set habitacion(value: HabitacionResponse) {
    this.invalidar();
    this.seleccion = value;
    this.cerrado = false;
    this.error = '';
  }
  get habitacion(): HabitacionResponse { return this.seleccion; }
  @Output() cerrar = new EventEmitter<void>();
  @Output() egresado = new EventEmitter<void>();

  cargando = false;
  error = '';

  registrarEgreso(): void {
    if (this.cargando || this.cerrado) return;
    const identidad = this.identidadActual();
    const idHabitacion = this.habitacion?.idHabitacion;
    if (!identidad || !Number.isSafeInteger(idHabitacion) || idHabitacion <= 0) {
      this.error = 'No hay una sesión y permisos vigentes para registrar el egreso.';
      return;
    }
    const revision = ++this.revision;
    const vigente = () => !this.cerrado && revision === this.revision
      && idHabitacion === this.habitacion.idHabitacion && identidad === this.identidadActual();
    const ids = new Set<number>();
    let candidata: AsignacionHabitacionResponse | undefined;
    let total: number | undefined;
    let paginaEsperada = 1;
    this.cargando = true;
    this.error = '';
    const leerPagina = (page: number) => defer(() => {
      if (!vigente()) return EMPTY;
      return this.service.listarAsignaciones(page, this.pageSize);
    });
    this.solicitud = leerPagina(1).pipe(
      expand((res: PagedResponse<AsignacionHabitacionResponse>) => {
        if (!vigente()) return EMPTY;
        if (!res || !Array.isArray(res.items) || res.page !== paginaEsperada || res.pageSize !== this.pageSize
          || !Number.isSafeInteger(res.totalCount) || res.totalCount < 0
          || res.totalPages !== Math.ceil(res.totalCount / this.pageSize)
          || (total !== undefined && res.totalCount !== total)
          || res.items.length !== Math.min(this.pageSize, Math.max(0, res.totalCount - (res.page - 1) * this.pageSize))) {
          throw new Error('El listado de asignaciones cambió o es contradictorio. Reintenta la consulta.');
        }
        if (res.totalPages > this.maxPages) {
          throw new Error('El listado supera el límite seguro de 100 páginas. No se realizó el egreso.');
        }
        total = res.totalCount;
        for (const item of res.items) {
          if (!item || !Number.isSafeInteger(item.idAsignacion) || item.idAsignacion <= 0
            || !Number.isSafeInteger(item.idHabitacion) || item.idHabitacion <= 0
            || !Number.isSafeInteger(item.idPaciente) || item.idPaciente <= 0
            || !Number.isFinite(Date.parse(item.fechaIngreso))
            || (item.fechaEgreso !== null && !Number.isFinite(Date.parse(item.fechaEgreso)))
            || ids.has(item.idAsignacion)) {
            throw new Error('Se recibieron asignaciones inválidas o repetidas. No se realizó el egreso.');
          }
          ids.add(item.idAsignacion);
          if (item.idHabitacion === idHabitacion && item.fechaEgreso === null) {
            if (candidata) throw new Error('Existen varias asignaciones activas para esta habitación. No se realizó el egreso.');
            candidata = item;
          }
        }
        paginaEsperada++;
        return res.page < res.totalPages ? leerPagina(paginaEsperada) : EMPTY;
      }, 1),
      last(),
      concatMap(() => {
        if (!vigente()) return EMPTY;
        if (!candidata) throw new Error('No se encontró una asignación activa para esta habitación.');
        return this.service.registrarEgreso(candidata.idAsignacion);
      }),
      finalize(() => { if (revision === this.revision) this.cargando = false; }),
    ).subscribe({
      next: response => {
        if (!vigente()) return;
        if (!candidata || !response || response.idAsignacion !== candidata.idAsignacion
          || response.idHabitacion !== idHabitacion || response.idPaciente !== candidata.idPaciente
          || !response.fechaEgreso || !Number.isFinite(Date.parse(response.fechaEgreso))) {
          this.error = 'La respuesta del egreso es contradictoria. Verifica el estado antes de reintentar.';
          return;
        }
        this.cerrado = true;
        this.egresado.emit();
      },
      error: (err: unknown) => {
        if (!vigente()) return;
        this.error = err instanceof HttpErrorResponse
          ? this.apiErrors.messageFor(err, err.status === 401
            ? 'La sesión expiró. Inicia sesión nuevamente.' : 'No fue posible consultar o registrar el egreso.')
          : err instanceof Error ? err.message : 'No fue posible registrar el egreso.';
      },
    });
  }

  cancelar(): void {
    this.cerrado = true;
    this.invalidar();
    this.cerrar.emit();
  }

  ngOnDestroy(): void { this.cerrado = true; this.invalidar(); }

  private invalidar(): void {
    this.revision++;
    this.solicitud?.unsubscribe();
    this.cargando = false;
  }

  private identidadActual(): string | null {
    const id = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && id && token
      && this.permisos.puedeConsultar(MODULOS_PERMISO.ASIGNACIONES_HABITACION)
      && this.permisos.puedeModificar(MODULOS_PERMISO.ASIGNACIONES_HABITACION)
      ? `${id}:${token}` : null;
  }
}
