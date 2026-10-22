import { Component, inject, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { InventarioService } from '../../core/services/inventario.service';
import {
  GuardarLoteMedicamentoRequest,
  ActualizarLoteMedicamentoRequest,
  LoteMedicamentoResponse,
  MedicamentoResponse
} from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermisosService } from '../../core/services/permisos.service';
import { Sucursal } from '../../core/models/catalogos.model';
import { CatalogosService } from '../../core/services/catalogos.service';
import { Subscription } from 'rxjs';
import { cargarCatalogoInventario, ContextoInventario, fechaInventarioValida, idInventarioValido } from './inventario-ui';

@Component({
    selector: 'app-lote-form',
    imports: [RouterModule, FormsModule],
    template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Lote' : 'Nuevo Lote' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }
      @if (errorMedicamentos) { <div class="alert alert-danger" role="alert">{{ errorMedicamentos }}</div> }
      @if (cargandoMedicamentos) { <p role="status">Cargando el catálogo completo de medicamentos...</p> }
      @if (!cargandoMedicamentos && !errorMedicamentos && medicamentos.length === 0) {
        <p class="alert alert-info">No hay medicamentos disponibles.</p>
      }
      <button type="button" class="btn btn-link" [disabled]="cargando || cargandoMedicamentos" (click)="cargarMedicamentos()">Recargar medicamentos</button>

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <fieldset [disabled]="cargando || cargandoMedicamentos || !puedeGuardar">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Medicamento *</label>
            <select class="form-select" [(ngModel)]="form.idMedicamento"
                    name="idMedicamento" required>
              <option [ngValue]="0">Seleccione...</option>
              @for (m of medicamentosDisponibles; track m.idMedicamento) {
                <option [ngValue]="m.idMedicamento">{{ m.codigo }} - {{ m.nombre }} · #{{ m.idMedicamento }}{{ m.activo ? '' : ' (inactivo, relación histórica)' }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Número de Lote *</label>
            <input type="text" class="form-control" [(ngModel)]="form.numeroLote"
                   name="numeroLote" required maxlength="50">
          </div>
          <div class="col-md-4">
            <label class="form-label">Fecha de Ingreso *</label>
            <input type="date" class="form-control" [(ngModel)]="form.fechaIngreso"
                   name="fechaIngreso" required>
          </div>
          <div class="col-md-4">
            <label class="form-label">Fecha de Vencimiento *</label>
            <input type="date" class="form-control" [(ngModel)]="form.fechaVencimiento"
                   name="fechaVencimiento" required>
          </div>
          <div class="col-md-4">
            <label class="form-label">Cantidad Disponible *</label>
            <input type="number" class="form-control" [(ngModel)]="form.cantidadDisponible"
                   name="cantidadDisponible" required min="0" (ngModelChange)="alCambiarCantidad()">
          </div>
          @if (requiereTrazabilidad) {
            <div class="col-md-4">
              <label class="form-label">Sucursal *</label>
              <select class="form-select" [(ngModel)]="form.idSucursal"
                      name="idSucursal" required>
                <option [ngValue]="null">Seleccione una sucursal activa</option>
                @for (sucursal of sucursales; track sucursal.idSucursal) {
                  <option [ngValue]="sucursal.idSucursal">{{ sucursal.nombre }}</option>
                }
              </select>
            </div>
            <div class="col-md-8">
              <label class="form-label">Justificación del ajuste *</label>
              <input type="text" class="form-control" [(ngModel)]="form.observaciones"
                     name="observaciones" required maxlength="300">
            </div>
          }
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando || cargandoMedicamentos || !!errorMedicamentos || !puedeGuardar || !registroCargado">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/inventario/lotes" class="btn btn-secondary">Cancelar</a>
        </div>
        </fieldset>
      </form>
    </div>
  `
})
export class LoteFormComponent implements OnInit {
  private service = inject(InventarioService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private apiErrors = inject(ApiErrorService);
  private permisos = inject(PermisosService);
  private catalogos = inject(CatalogosService);
  private contexto = new ContextoInventario(['LotesMedicamento', 'Medicamentos', 'Sucursales']);
  private medicamentosSolicitud?: Subscription;
  private revisionMedicamentos = 0;
  cargandoMedicamentos = false;
  errorMedicamentos = '';
  registroCargado = false;

  esEdicion = false;
  cargando = false;
  error = '';
  medicamentos: MedicamentoResponse[] = [];
  sucursales: Sucursal[] = [];
  cantidadEsperada: number | null = null;
  idMedicamentoOriginal: number | null = null;
  private cargandoSucursales = false;
  private sucursalesCargadas = false;

  form: GuardarLoteMedicamentoRequest = {
    idMedicamento: 0,
    numeroLote: '',
    fechaIngreso: '',
    fechaVencimiento: '',
    cantidadDisponible: 0,
    idSucursal: null,
    observaciones: null
  };

  get requiereTrazabilidad(): boolean {
    return this.esEdicion
      ? this.cantidadEsperada !== null && this.form.cantidadDisponible !== this.cantidadEsperada
      : this.form.cantidadDisponible > 0;
  }

  get puedeGuardar(): boolean {
    return this.esEdicion
      ? this.permisos.puedeModificar(MODULOS_PERMISO.LOTES_MEDICAMENTO)
      : this.permisos.puedeCrear(MODULOS_PERMISO.LOTES_MEDICAMENTO);
  }

  get medicamentosDisponibles(): MedicamentoResponse[] {
    return this.medicamentos.filter(item =>
      item.activo || (this.esEdicion && item.idMedicamento === this.idMedicamentoOriginal),
    );
  }

  constructor() {
    this.contexto.observar(() => {
      this.medicamentosSolicitud?.unsubscribe();
      this.cargando = false; this.medicamentos = []; this.sucursales = [];
      this.cargandoSucursales = this.sucursalesCargadas = false;
      this.cantidadEsperada = this.idMedicamentoOriginal = null;
      this.form = { idMedicamento: 0, numeroLote: '', fechaIngreso: '', fechaVencimiento: '', cantidadDisponible: 0, idSucursal: null, observaciones: null };
      this.ngOnInit();
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.esEdicion = id !== null;
    this.registroCargado = !this.esEdicion;
    this.error = '';
    this.cargarMedicamentos();
    if (id) {
      const clave = this.contexto.clave();
      if (!idInventarioValido(+id) || !this.contexto.vigente(clave) || !this.permisos.puedeConsultar('LotesMedicamento')) {
        this.error = 'No se puede consultar el lote con el identificador y permisos actuales.'; return;
      }
      this.cargando = true;
      this.contexto.agregar(this.service.obtenerLote(+id).subscribe({
        next: (lote: LoteMedicamentoResponse) => {
          if (!this.contexto.vigente(clave)) return;
          if (lote.idLote !== +id || !Number.isInteger(lote.cantidadDisponible) || lote.cantidadDisponible < 0) {
            this.error = 'El lote devuelto no permite verificar su existencia original.'; this.cargando = false; return;
          }
          this.form = {
            idMedicamento: lote.idMedicamento,
            numeroLote: lote.numeroLote,
            fechaIngreso: lote.fechaIngreso,
            fechaVencimiento: lote.fechaVencimiento,
            cantidadDisponible: lote.cantidadDisponible,
            idSucursal: null,
            observaciones: null
          };
          this.idMedicamentoOriginal = lote.idMedicamento;
          this.cantidadEsperada = lote.cantidadDisponible;
          this.cargando = false;
          this.registroCargado = true;
        },
        error: err => {
          if (!this.contexto.vigente(clave)) return;
          this.error = this.apiErrors.messageFor(err, 'Lote no encontrado o sesión expirada');
          this.cargando = false;
        }
      }));
    }
  }

  cargarMedicamentos() {
    this.medicamentosSolicitud?.unsubscribe();
    const revision = ++this.revisionMedicamentos, clave = this.contexto.clave();
    this.medicamentos = []; this.errorMedicamentos = ''; this.cargandoMedicamentos = false;
    if (!this.contexto.vigente(clave) || !this.permisos.puedeConsultar('Medicamentos')) {
      this.errorMedicamentos = 'Se requiere permiso Medicamentos/Consultar vigente.'; return;
    }
    this.cargandoMedicamentos = true;
    this.medicamentosSolicitud = cargarCatalogoInventario((p, t) => this.service.listarMedicamentos(p, t), m => m.idMedicamento).subscribe({
      next: items => {
        if (!this.contexto.vigente(clave) || revision !== this.revisionMedicamentos) return;
        this.medicamentos = items; this.cargandoMedicamentos = false;
      },
      error: err => {
        if (!this.contexto.vigente(clave) || revision !== this.revisionMedicamentos) return;
        this.errorMedicamentos = this.apiErrors.messageFor(err, 'No se pudo cargar el catálogo completo de medicamentos. Recargue el catálogo.');
        this.cargandoMedicamentos = false;
      },
    });
    this.contexto.agregar(this.medicamentosSolicitud);
  }

  alCambiarCantidad() {
    if (this.requiereTrazabilidad) this.cargarSucursales();
  }

  cargarSucursales() {
    if (this.sucursalesCargadas || this.cargandoSucursales) return;
    const clave = this.contexto.clave();
    if (!this.contexto.vigente(clave) || !this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)) {
      this.error = 'No tiene permiso para consultar las sucursales disponibles.';
      return;
    }

    this.cargandoSucursales = true;
    this.contexto.agregar(this.catalogos.getSucursales().subscribe({
      next: items => {
        if (!this.contexto.vigente(clave)) return;
        this.sucursales = items.filter(item => item.activa);
        this.sucursalesCargadas = true;
        this.cargandoSucursales = false;
      },
      error: err => {
        if (!this.contexto.vigente(clave)) return;
        this.error = this.apiErrors.messageFor(err, 'No fue posible cargar las sucursales.');
        this.cargandoSucursales = false;
      },
    }));
  }

  guardar() {
    this.error = '';

    if (this.cargando || !this.puedeGuardar) return;
    const clave = this.contexto.clave();
    if (!this.contexto.vigente(clave) || !this.registroCargado || this.cargandoMedicamentos || this.errorMedicamentos) {
      this.error = 'Verifique la sesión, el lote y el catálogo antes de guardar.'; return;
    }

    if (!this.medicamentosDisponibles.some(
      item => item.idMedicamento === this.form.idMedicamento,
    )) {
      this.error = 'Seleccione un medicamento disponible.';
      return;
    }
    if (!idInventarioValido(this.form.idMedicamento) || !this.form.numeroLote?.trim() || this.form.numeroLote.trim().length > 50 ||
      !Number.isInteger(this.form.cantidadDisponible) || this.form.cantidadDisponible < 0 || this.form.cantidadDisponible > 2_147_483_647 ||
      !fechaInventarioValida(this.form.fechaIngreso) || !fechaInventarioValida(this.form.fechaVencimiento) ||
      this.form.fechaVencimiento <= this.form.fechaIngreso ||
      (!this.esEdicion && this.form.cantidadDisponible > 0 && this.form.fechaVencimiento <= new Date().toISOString().slice(0, 10))) {
      this.error = 'Indique número de lote, cantidad entera no negativa y fechas válidas; vencimiento posterior al ingreso y futuro para existencia inicial.'; return;
    }
    const observaciones = this.form.observaciones?.trim() ?? '';
    if (observaciones.length > 300 || (!this.esEdicion && this.form.cantidadDisponible > 0 &&
      ('Existencia inicial | ' + observaciones).length > 300)) {
      this.error = 'La justificación excede el límite permitido por el registro de inventario.'; return;
    }

    if (this.requiereTrazabilidad &&
        (!this.form.idSucursal
          || !this.permisos.puedeConsultar('Sucursales')
          || !this.sucursales.some(item => item.idSucursal === this.form.idSucursal && item.activa)
          || !this.form.observaciones?.trim())) {
      this.error = 'La sucursal y la justificación son obligatorias cuando cambia la existencia.';
      return;
    }

    if (this.requiereTrazabilidad
      && !confirm('¿Confirmas el cambio de existencia de este lote?')) return;
    if (!this.contexto.vigente(clave)) return;

    this.cargando = true;

    if (this.esEdicion) {
      if (this.cantidadEsperada === null) {
        this.error = 'No se pudo determinar la existencia original del lote.';
        this.cargando = false;
        return;
      }
      const id = +this.route.snapshot.paramMap.get('id')!;
      const request: ActualizarLoteMedicamentoRequest = {
        ...this.form,
        cantidadEsperada: this.cantidadEsperada
      };
      this.contexto.agregar(this.service.actualizarLote(id, request).subscribe({
        next: () => { if (this.contexto.vigente(clave)) this.router.navigate(['/inventario/lotes']); },
        error: (err: HttpErrorResponse) => {
          if (!this.contexto.vigente(clave)) return;
          this.error = this.apiErrors.messageFor(err, 'No fue posible actualizar el lote.');
          this.cargando = false;
        }
      }));
    } else {
      this.contexto.agregar(this.service.crearLote({ ...this.form }).subscribe({
        next: () => { if (this.contexto.vigente(clave)) this.router.navigate(['/inventario/lotes']); },
        error: (err: HttpErrorResponse) => {
          if (!this.contexto.vigente(clave)) return;
          this.error = this.apiErrors.messageFor(err, 'No fue posible crear el lote.');
          this.cargando = false;
        }
      }));
    }
  }
}
