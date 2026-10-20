import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import {
  EntradaInventarioResponse,
  LoteMedicamentoResponse,
  PagedResponse,
  RegistrarEntradaInventarioRequest,
} from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { correlativoPaginado } from '../../shared/utils/correlativo';

const entradaVacia = (): RegistrarEntradaInventarioRequest => ({
  idSucursal: 0,
  cantidad: 0,
  observaciones: null,
});

@Component({
  selector: 'app-lotes-medicamento',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h2 class="mb-1"><i class="fa fa-boxes"></i> Gestión de Lotes</h2>
          <p class="text-muted mb-0">Consulta existencias por lote y registra entradas confirmadas por la API.</p>
        </div>
        <div class="page-header__actions">
          <a routerLink="/inventario" class="btn btn-secondary">
            <i class="fa fa-arrow-left"></i> Volver a Medicamentos
          </a>
          @if (permisos.puedeCrear(MODULOS_PERMISO.LOTES_MEDICAMENTO)) {
            <a routerLink="/inventario/lotes/nuevo" class="btn btn-primary">
              <i class="fa fa-plus"></i> Nuevo Lote
            </a>
          }
        </div>
      </header>

      @if (aviso) {
        <div class="alert alert-success alert-dismissible" role="status">
          {{ aviso }}
          <button type="button" class="btn-close" aria-label="Cerrar" (click)="aviso = ''"></button>
        </div>
      }

      @if (cargando) {
        <div class="text-center py-5" role="status">
          <div class="spinner-border text-primary"></div>
          <span class="visually-hidden">Cargando lotes</span>
        </div>
      } @else if (error) {
        <div class="alert alert-danger" role="alert">
          {{ error }}
          <button type="button" class="btn btn-outline-danger btn-sm ms-2" (click)="cargarLotes()">
            Reintentar
          </button>
        </div>
      } @else if (lotes.length === 0) {
        <div class="alert alert-info text-center">No hay lotes registrados.</div>
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-striped table-hover ui-table">
            <thead>
              <tr>
                <th scope="col" class="ui-col-index">No.</th>
                <th>Número de lote</th>
                <th>Medicamento</th>
                <th class="ui-col-date">Fecha de ingreso</th>
                <th class="ui-col-date">Fecha de vencimiento</th>
                <th class="ui-col-number">Existencia</th>
                <th class="ui-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (lote of lotes; track lote.idLote; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  <td><code>{{ lote.numeroLote }}</code></td>
                  <td>#{{ lote.idMedicamento }}</td>
                  <td class="ui-col-date">{{ lote.fechaIngreso | date:'dd/MM/yyyy' }}</td>
                  <td class="ui-col-date">
                    <span [class.text-danger]="isVencido(lote.fechaVencimiento)">
                      {{ lote.fechaVencimiento | date:'dd/MM/yyyy' }}
                    </span>
                  </td>
                  <td class="ui-col-number">
                    <span class="badge"
                          [class.bg-success]="lote.cantidadDisponible > 10"
                          [class.bg-warning]="lote.cantidadDisponible > 0 && lote.cantidadDisponible <= 10"
                          [class.bg-danger]="lote.cantidadDisponible === 0">
                      {{ lote.cantidadDisponible }}
                    </span>
                  </td>
                  <td class="ui-actions ui-col-actions">
                    @if (permisos.puedeModificar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) {
                      <button type="button" (click)="abrirEntrada(lote)" class="btn btn-sm btn-success" aria-label="Registrar entrada de lote" title="Registrar entrada">
                        <i class="fa fa-plus"></i> Entrada
                      </button>
                      <a [routerLink]="['/inventario/lotes/editar', lote.idLote]"
                         class="btn btn-sm btn-outline-primary ui-icon-button" aria-label="Editar lote" title="Editar lote">
                        <i class="fa fa-edit"></i>
                      </a>
                    }
                    @if (permisos.puedeEliminar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) {
                      <button type="button" (click)="eliminar(lote.idLote)" class="btn btn-sm btn-outline-danger ui-icon-button"
                              aria-label="Eliminar lote" title="Eliminar lote">
                        <i class="fa fa-trash"></i>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} lotes</span>
          <div>
            <button type="button" class="btn btn-outline-secondary btn-sm me-2"
                    (click)="cambiarPagina(page - 1)" [disabled]="page <= 1 || cargando">
              Anterior
            </button>
            <span class="mx-2">Página {{ page }} de {{ totalPages }}</span>
            <button type="button" class="btn btn-outline-secondary btn-sm"
                    (click)="cambiarPagina(page + 1)" [disabled]="page >= totalPages || cargando">
              Siguiente
            </button>
          </div>
        </div>
      }

      @if (loteSeleccionado) {
        <div class="modal d-block" tabindex="-1" role="dialog" aria-modal="true"
             aria-labelledby="entrada-title" style="background: rgba(0,0,0,0.5);">
          <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title" id="entrada-title">
                  Registrar entrada · lote {{ loteSeleccionado.numeroLote }}
                </h5>
                <button type="button" class="btn-close" aria-label="Cerrar"
                        [disabled]="cargandoEntrada" (click)="cerrarEntrada()"></button>
              </div>
              <form #entrada="ngForm" (ngSubmit)="registrarEntrada(entrada.valid)">
                <div class="modal-body">
                  <p class="small text-muted">
                    Existencia actual: <strong>{{ loteSeleccionado.cantidadDisponible }}</strong> unidades.
                    La existencia se actualizará únicamente después de la confirmación del servidor.
                  </p>
                  @if (errorEntrada) {
                    <div class="alert alert-danger" role="alert">{{ errorEntrada }}</div>
                  }
                  <div class="mb-3">
                    <label class="form-label" for="entrada-sucursal">ID de sucursal *</label>
                    <input id="entrada-sucursal" type="number" class="form-control"
                           [(ngModel)]="entradaForm.idSucursal" name="idSucursal"
                           required min="1" step="1">
                  </div>
                  <div class="mb-3">
                    <label class="form-label" for="entrada-cantidad">Cantidad *</label>
                    <input id="entrada-cantidad" type="number" class="form-control"
                           [(ngModel)]="entradaForm.cantidad" name="cantidad"
                           required min="1" step="1">
                  </div>
                  <div class="mb-3">
                    <label class="form-label" for="entrada-observaciones">Observaciones</label>
                    <textarea id="entrada-observaciones" class="form-control" rows="2"
                              [(ngModel)]="entradaForm.observaciones" name="observaciones"
                              maxlength="300"></textarea>
                  </div>
                </div>
                <div class="modal-footer">
                  <button type="button" class="btn btn-secondary" [disabled]="cargandoEntrada"
                          (click)="cerrarEntrada()">Cancelar</button>
                  <button type="submit" class="btn btn-success"
                          [disabled]="cargandoEntrada || entrada.invalid">
                    @if (cargandoEntrada) {
                      <span class="spinner-border spinner-border-sm me-1"></span>
                    }
                    {{ cargandoEntrada ? 'Registrando...' : 'Confirmar entrada' }}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class LotesMedicamentoComponent implements OnInit {
  private readonly service = inject(InventarioService);
  private readonly session = inject(AuthSessionService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  lotes: LoteMedicamentoResponse[] = [];
  total = 0;
  totalPages = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';
  aviso = '';

  loteSeleccionado: LoteMedicamentoResponse | null = null;
  entradaForm = entradaVacia();
  cargandoEntrada = false;
  errorEntrada = '';

  private solicitudListado?: Subscription;
  private solicitudEntrada?: Subscription;
  private revisionListado = 0;
  private revisionEntrada = 0;
  private identidadObservada: string | null | undefined;
  private autorizadoObservado: boolean | undefined;
  private inicializado = false;

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const autorizado = this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO);
      const puedeModificar = this.permisos.puedeModificar(MODULOS_PERMISO.LOTES_MEDICAMENTO);
      const cambioIdentidad = this.identidadObservada !== undefined
        && this.identidadObservada !== identidad;
      const concesionConsulta = this.autorizadoObservado === false && autorizado;

      this.identidadObservada = identidad;
      this.autorizadoObservado = autorizado;

      if (!identidad || !autorizado) {
        this.limpiarDatosProtegidos();
        return;
      }

      if (!puedeModificar) this.cancelarEntradaProtegida();
      if (this.inicializado && (cambioIdentidad || concesionConsulta)) {
        this.limpiarDatosProtegidos();
        this.cargarLotes();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit(): void {
    this.inicializado = true;
    this.cargarLotes();
  }

  cargarLotes(): void {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) {
      this.limpiarDatosProtegidos();
      return;
    }

    const revision = ++this.revisionListado;
    this.solicitudListado?.unsubscribe();
    this.cargando = true;
    this.error = '';

    this.solicitudListado = this.service.listarLotes(this.page, this.pageSize).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionListado) this.cargando = false;
      }),
    ).subscribe({
      next: (response: PagedResponse<LoteMedicamentoResponse>) => {
        if (!this.respuestaListadoVigente(revision, identidad)) return;
        this.lotes = response.items;
        this.page = response.page;
        this.pageSize = response.pageSize;
        this.total = response.totalCount;
        this.totalPages = response.totalPages;
      },
      error: (error: HttpErrorResponse) => {
        if (!this.respuestaListadoVigente(revision, identidad)) return;
        this.lotes = [];
        this.total = 0;
        this.totalPages = 0;
        this.error = this.apiErrors.messageFor(error, 'No fue posible cargar los lotes.');
      },
    });
  }

  abrirEntrada(lote: LoteMedicamentoResponse): void {
    if (this.cargandoEntrada
      || !this.permisos.puedeModificar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) return;
    this.loteSeleccionado = lote;
    this.entradaForm = entradaVacia();
    this.errorEntrada = '';
  }

  cerrarEntrada(): void {
    if (this.cargandoEntrada) return;
    this.loteSeleccionado = null;
    this.entradaForm = entradaVacia();
    this.errorEntrada = '';
  }

  registrarEntrada(formularioValido: boolean | null): void {
    const lote = this.loteSeleccionado;
    const identidad = this.identidadActual();
    if (this.cargandoEntrada || !lote || !identidad
      || !this.permisos.puedeModificar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) return;

    if (!formularioValido
      || !Number.isInteger(Number(this.entradaForm.idSucursal))
      || Number(this.entradaForm.idSucursal) <= 0
      || !Number.isInteger(Number(this.entradaForm.cantidad))
      || Number(this.entradaForm.cantidad) <= 0) {
      this.errorEntrada = 'La sucursal y la cantidad deben ser enteros mayores que cero.';
      return;
    }

    const observaciones = this.entradaForm.observaciones?.trim() || null;
    if (observaciones && observaciones.length > 300) {
      this.errorEntrada = 'Las observaciones no pueden exceder 300 caracteres.';
      return;
    }

    if (!confirm(`¿Registrar ${this.entradaForm.cantidad} unidades en el lote ${lote.numeroLote}?`)) {
      return;
    }

    const revision = ++this.revisionEntrada;
    const request: RegistrarEntradaInventarioRequest = {
      idSucursal: Number(this.entradaForm.idSucursal),
      cantidad: Number(this.entradaForm.cantidad),
      observaciones,
    };
    this.errorEntrada = '';
    this.cargandoEntrada = true;

    this.solicitudEntrada = this.service.registrarEntrada(lote.idLote, request).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionEntrada) this.cargandoEntrada = false;
      }),
    ).subscribe({
      next: (response: EntradaInventarioResponse) => {
        if (!this.respuestaEntradaVigente(revision, identidad, lote.idLote)) return;
        this.aviso = `Entrada #${response.idMovimiento} confirmada: ${response.cantidad} unidades en el lote #${response.idLote}, sucursal #${response.idSucursal}, ${this.formatearFecha(response.fechaMovimiento)}. Existencia resultante: ${response.cantidadDisponible}.`;
        this.loteSeleccionado = null;
        this.entradaForm = entradaVacia();
        this.cargarLotes();
      },
      error: (error: HttpErrorResponse) => {
        if (!this.respuestaEntradaVigente(revision, identidad, lote.idLote)) return;
        this.errorEntrada = this.apiErrors.messageFor(
          error,
          'No fue posible registrar la entrada. Verifica el estado del lote.',
        );
      },
    });
  }

  eliminar(id: number): void {
    if (!this.permisos.puedeEliminar(MODULOS_PERMISO.LOTES_MEDICAMENTO)
      || !confirm('¿Estás seguro de eliminar este lote?')) return;

    this.service.eliminarLote(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => this.cargarLotes(),
      error: (error: HttpErrorResponse) => {
        this.error = this.apiErrors.messageFor(error, 'No se pudo eliminar el lote.');
      },
    });
  }

  cambiarPagina(nuevaPagina: number): void {
    if (nuevaPagina < 1 || nuevaPagina > this.totalPages
      || nuevaPagina === this.page || this.cargando) return;
    this.page = nuevaPagina;
    this.cargarLotes();
  }

  isVencido(fechaVencimiento: string): boolean {
    return fechaVencimiento <= new Date().toISOString().slice(0, 10);
  }

  private respuestaListadoVigente(revision: number, identidad: string): boolean {
    return revision === this.revisionListado
      && identidad === this.identidadActual()
      && this.permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO);
  }

  private respuestaEntradaVigente(revision: number, identidad: string, idLote: number): boolean {
    return revision === this.revisionEntrada
      && identidad === this.identidadActual()
      && this.loteSeleccionado?.idLote === idLote
      && this.permisos.puedeModificar(MODULOS_PERMISO.LOTES_MEDICAMENTO);
  }

  private identidadActual(): string | null {
    const userId = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && userId && token ? `${userId}:${token}` : null;
  }

  private formatearFecha(value: string): string {
    const fecha = new Date(value);
    return Number.isNaN(fecha.getTime()) ? value : fecha.toLocaleString('es-GT');
  }

  private cancelarEntradaProtegida(): void {
    this.revisionEntrada++;
    this.solicitudEntrada?.unsubscribe();
    this.solicitudEntrada = undefined;
    this.loteSeleccionado = null;
    this.entradaForm = entradaVacia();
    this.cargandoEntrada = false;
    this.errorEntrada = '';
  }

  private limpiarDatosProtegidos(): void {
    this.revisionListado++;
    this.solicitudListado?.unsubscribe();
    this.solicitudListado = undefined;
    this.cancelarEntradaProtegida();
    this.lotes = [];
    this.total = 0;
    this.totalPages = 0;
    this.cargando = false;
    this.error = '';
    this.aviso = '';
  }
}
