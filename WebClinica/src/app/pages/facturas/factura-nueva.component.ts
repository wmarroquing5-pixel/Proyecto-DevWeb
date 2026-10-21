import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { Servicio, Sucursal } from '../../core/models/catalogos.model';
import { CrearFacturaRequest } from '../../core/models/factura.model';
import { CatalogoMedicamentoResponse } from '../../core/models/inventario.model';
import { PacienteListadoResponse } from '../../core/models/paciente.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { FacturaService } from '../../core/services/factura.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PacientesService } from '../../core/services/paciente.service';
import { UiStateComponent } from '../../shared/components/ui-state.component';

interface LineaServicio {
  idServicio: number;
  codigo: string;
  nombre: string;
  cantidad: number;
  precioReferencia: number;
}

interface LineaMedicamento {
  idMedicamento: number;
  codigo: string;
  nombre: string;
  cantidad: number;
  existenciaTotal: number;
  precioReferencia: number;
}

@Component({
    selector: 'app-factura-nueva',
    imports: [CommonModule, FormsModule, RouterModule, UiStateComponent],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h2><i class="fa fa-file-circle-plus"></i> Nueva factura</h2>
          <p class="page-header__subtitle">Los precios y el total definitivos se calculan en el servidor.</p>
        </div>
        <a routerLink="/facturas" class="btn btn-secondary"><i class="fa fa-arrow-left"></i> Volver</a>
      </header>

      @if (cargandoCatalogos) {
        <app-ui-state kind="loading" title="Cargando catálogos"></app-ui-state>
      } @else if (errorCatalogos) {
        <app-ui-state kind="error" title="No se pudieron cargar los catálogos"
                      [description]="errorCatalogos" [retryable]="true" (retry)="cargarCatalogos()"></app-ui-state>
      } @else {
        @if (error) { <div class="alert alert-danger" role="alert">{{ error }}</div> }
        <form class="ui-form" (ngSubmit)="guardar()" #formulario="ngForm">
          <section class="ui-card mb-4">
            <h5>Datos generales</h5>
            <div class="row g-3">
              <div class="col-md-6">
                <label for="factura-sucursal" class="form-label required">Sucursal</label>
                <select id="factura-sucursal" name="idSucursal" class="form-select" required
                        [(ngModel)]="idSucursal">
                  <option [ngValue]="null">Seleccione una sucursal</option>
                  @for (sucursal of sucursales; track sucursal.idSucursal) {
                    <option [ngValue]="sucursal.idSucursal">{{ sucursal.nombre }}</option>
                  }
                </select>
              </div>
              <div class="col-md-6">
                <label for="factura-paciente-busqueda" class="form-label">Buscar paciente</label>
                <div class="input-group">
                  <input id="factura-paciente-busqueda" name="busquedaPaciente" class="form-control"
                         [(ngModel)]="busquedaPaciente" placeholder="Nombre o apellido">
                  <button type="button" class="btn btn-outline-secondary" (click)="buscarPacientes()"
                          [disabled]="cargandoPacientes">Buscar</button>
                </div>
              </div>
              <div class="col-md-6">
                <label for="factura-paciente" class="form-label required">Paciente</label>
                <select id="factura-paciente" name="idPaciente" class="form-select" required
                        [(ngModel)]="idPaciente" (ngModelChange)="seleccionarPaciente()">
                  <option [ngValue]="null">Seleccione un paciente activo</option>
                  @for (paciente of pacientes; track paciente.idPaciente) {
                    <option [ngValue]="paciente.idPaciente">{{ paciente.nombres }} {{ paciente.apellidos }}</option>
                  }
                </select>
              </div>
              <div class="col-md-3">
                <label for="factura-nit" class="form-label">NIT</label>
                <input id="factura-nit" name="nit" class="form-control" maxlength="50" [(ngModel)]="nit">
              </div>
              <div class="col-md-3">
                <label for="factura-nombre" class="form-label">Nombre de facturación</label>
                <input id="factura-nombre" name="nombreFacturacion" class="form-control" maxlength="150"
                       [(ngModel)]="nombreFacturacion">
              </div>
            </div>
          </section>

          <div class="row g-4 mb-4">
            <div class="col-lg-6">
              <section class="ui-card h-100">
                <h5>Servicios</h5>
                <div class="input-group mb-3">
                  <select name="servicioSeleccionado" class="form-select" [(ngModel)]="servicioSeleccionado">
                    <option [ngValue]="null">Seleccione un servicio</option>
                    @for (servicio of servicios; track servicio.idServicio) {
                      <option [ngValue]="servicio.idServicio">{{ servicio.codigo }} · {{ servicio.nombre }}</option>
                    }
                  </select>
                  <button type="button" class="btn btn-outline-primary" (click)="agregarServicio()">Agregar</button>
                </div>
                @if (lineasServicio.length === 0) {
                  <p class="text-muted">No hay servicios agregados.</p>
                } @else {
                  <div class="ui-table-wrap"><table class="table table-sm ui-table">
                    <thead><tr><th>Servicio</th><th class="ui-col-number">Cantidad</th><th class="ui-col-number">Referencia</th><th></th></tr></thead>
                    <tbody>
                      @for (linea of lineasServicio; track linea.idServicio) {
                        <tr><td><strong>{{ linea.nombre }}</strong><br><small>{{ linea.codigo }}</small></td>
                          <td class="ui-col-number"><input type="number" min="1" class="form-control form-control-sm"
                            [name]="'servicio-' + linea.idServicio" [(ngModel)]="linea.cantidad" (change)="normalizarServicio(linea)"></td>
                          <td class="ui-col-number">{{ linea.precioReferencia | currency:'GTQ':'symbol-narrow':'1.2-2' }}</td>
                          <td class="ui-col-actions"><button type="button" class="btn btn-sm btn-outline-danger"
                            (click)="quitarServicio(linea.idServicio)" [attr.aria-label]="'Quitar ' + linea.nombre"><i class="fa fa-trash"></i></button></td></tr>
                      }
                    </tbody>
                  </table></div>
                }
              </section>
            </div>

            <div class="col-lg-6">
              <section class="ui-card h-100">
                <h5>Medicamentos</h5>
                <div class="input-group mb-3">
                  <select name="medicamentoSeleccionado" class="form-select" [(ngModel)]="medicamentoSeleccionado">
                    <option [ngValue]="null">Seleccione un medicamento con existencia</option>
                    @for (medicamento of medicamentos; track medicamento.idMedicamento) {
                      <option [ngValue]="medicamento.idMedicamento">
                        {{ medicamento.codigo }} · {{ medicamento.nombre }} ({{ medicamento.existenciaTotal }})
                      </option>
                    }
                  </select>
                  <button type="button" class="btn btn-outline-primary" (click)="agregarMedicamento()">Agregar</button>
                </div>
                @if (lineasMedicamento.length === 0) {
                  <p class="text-muted">No hay medicamentos agregados.</p>
                } @else {
                  <div class="ui-table-wrap"><table class="table table-sm ui-table">
                    <thead><tr><th>Medicamento</th><th class="ui-col-number">Cantidad</th><th class="ui-col-number">Referencia</th><th></th></tr></thead>
                    <tbody>
                      @for (linea of lineasMedicamento; track linea.idMedicamento) {
                        <tr><td><strong>{{ linea.nombre }}</strong><br><small>{{ linea.codigo }} · Stock {{ linea.existenciaTotal }}</small></td>
                          <td class="ui-col-number"><input type="number" min="1" [max]="linea.existenciaTotal"
                            class="form-control form-control-sm" [name]="'medicamento-' + linea.idMedicamento"
                            [(ngModel)]="linea.cantidad" (change)="normalizarMedicamento(linea)"></td>
                          <td class="ui-col-number">{{ linea.precioReferencia | currency:'GTQ':'symbol-narrow':'1.2-2' }}</td>
                          <td class="ui-col-actions"><button type="button" class="btn btn-sm btn-outline-danger"
                            (click)="quitarMedicamento(linea.idMedicamento)" [attr.aria-label]="'Quitar ' + linea.nombre"><i class="fa fa-trash"></i></button></td></tr>
                      }
                    </tbody>
                  </table></div>
                }
              </section>
            </div>
          </div>

          <section class="ui-card">
            <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div><strong>Total estimado:</strong>
                <span class="fs-4 ms-2">{{ totalReferencia | currency:'GTQ':'symbol-narrow':'1.2-2' }}</span>
                <div class="text-muted small">El servidor confirmará precios, lotes FEFO, stock y total.</div>
              </div>
              <div class="ui-form__actions mt-0">
                <a routerLink="/facturas" class="btn btn-outline-secondary">Cancelar</a>
                <button type="submit" class="btn btn-success"
                        [disabled]="guardando || formulario.invalid || !tieneLineas">
                  {{ guardando ? 'Guardando…' : 'Confirmar factura' }}
                </button>
              </div>
            </div>
          </section>
        </form>
      }
    </div>
  `
})
export class FacturaNuevaComponent implements OnInit {
  private readonly facturasService = inject(FacturaService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly pacientesService = inject(PacientesService);
  private readonly inventarioService = inject(InventarioService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly router = inject(Router);

  sucursales: Sucursal[] = [];
  pacientes: PacienteListadoResponse[] = [];
  servicios: Servicio[] = [];
  medicamentos: CatalogoMedicamentoResponse[] = [];
  lineasServicio: LineaServicio[] = [];
  lineasMedicamento: LineaMedicamento[] = [];
  idSucursal: number | null = null;
  idPaciente: number | null = null;
  servicioSeleccionado: number | null = null;
  medicamentoSeleccionado: number | null = null;
  busquedaPaciente = '';
  nit = '';
  nombreFacturacion = '';
  cargandoCatalogos = false;
  cargandoPacientes = false;
  guardando = false;
  errorCatalogos = '';
  error = '';

  ngOnInit(): void { this.cargarCatalogos(); }

  cargarCatalogos(): void {
    this.cargandoCatalogos = true;
    this.errorCatalogos = '';
    forkJoin({
      sucursales: this.catalogosService.getSucursales(),
      servicios: this.catalogosService.getServicios(),
      pacientes: this.pacientesService.listar(undefined, true, 1, 50),
      medicamentos: this.inventarioService.listarCatalogo({ page: 1, pageSize: 50 }),
    }).subscribe({
      next: result => {
        this.sucursales = result.sucursales.filter(item => item.activa);
        this.servicios = result.servicios.filter(item => item.activo && item.precioBase > 0);
        this.pacientes = result.pacientes.items.filter(item => item.activo);
        this.medicamentos = result.medicamentos.items.filter(item => item.existenciaTotal > 0);
        this.cargandoCatalogos = false;
      },
      error: (error: HttpErrorResponse) => {
        this.errorCatalogos = this.apiErrors.messageFor(error, 'No fue posible cargar los datos requeridos.');
        this.cargandoCatalogos = false;
      },
    });
  }

  buscarPacientes(): void {
    this.cargandoPacientes = true;
    this.pacientesService.listar(this.busquedaPaciente.trim() || undefined, true, 1, 50).subscribe({
      next: response => { this.pacientes = response.items.filter(item => item.activo); this.cargandoPacientes = false; },
      error: (error: HttpErrorResponse) => {
        this.error = this.apiErrors.messageFor(error, 'No fue posible buscar pacientes.');
        this.cargandoPacientes = false;
      },
    });
  }

  seleccionarPaciente(): void {
    if (!this.idPaciente) return;
    this.pacientesService.obtener(this.idPaciente).subscribe({
      next: paciente => {
        this.nit = paciente.nit ?? '';
        this.nombreFacturacion = paciente.nombreFacturacion
          ?? `${paciente.nombres} ${paciente.apellidos}`.trim();
      },
      error: () => undefined,
    });
  }

  agregarServicio(): void {
    const servicio = this.servicios.find(item => item.idServicio === this.servicioSeleccionado);
    if (!servicio) return;
    const existente = this.lineasServicio.find(item => item.idServicio === servicio.idServicio);
    if (existente) existente.cantidad += 1;
    else this.lineasServicio.push({
      idServicio: servicio.idServicio, codigo: servicio.codigo, nombre: servicio.nombre,
      cantidad: 1, precioReferencia: servicio.precioBase,
    });
    this.servicioSeleccionado = null;
  }

  agregarMedicamento(): void {
    const medicamento = this.medicamentos.find(item => item.idMedicamento === this.medicamentoSeleccionado);
    if (!medicamento) return;
    const existente = this.lineasMedicamento.find(item => item.idMedicamento === medicamento.idMedicamento);
    if (existente) existente.cantidad = Math.min(existente.cantidad + 1, existente.existenciaTotal);
    else this.lineasMedicamento.push({
      idMedicamento: medicamento.idMedicamento, codigo: medicamento.codigo, nombre: medicamento.nombre,
      cantidad: 1, existenciaTotal: medicamento.existenciaTotal, precioReferencia: medicamento.precioVenta,
    });
    this.medicamentoSeleccionado = null;
  }

  normalizarServicio(linea: LineaServicio): void {
    linea.cantidad = this.cantidadValida(linea.cantidad, Number.MAX_SAFE_INTEGER);
  }

  normalizarMedicamento(linea: LineaMedicamento): void {
    linea.cantidad = this.cantidadValida(linea.cantidad, linea.existenciaTotal);
  }

  quitarServicio(idServicio: number): void {
    this.lineasServicio = this.lineasServicio.filter(item => item.idServicio !== idServicio);
  }

  quitarMedicamento(idMedicamento: number): void {
    this.lineasMedicamento = this.lineasMedicamento.filter(item => item.idMedicamento !== idMedicamento);
  }

  get tieneLineas(): boolean { return this.lineasServicio.length + this.lineasMedicamento.length > 0; }

  get totalReferencia(): number {
    return this.lineasServicio.reduce((total, item) => total + item.cantidad * item.precioReferencia, 0)
      + this.lineasMedicamento.reduce((total, item) => total + item.cantidad * item.precioReferencia, 0);
  }

  guardar(): void {
    if (this.guardando || !this.idSucursal || !this.idPaciente || !this.tieneLineas) return;
    this.lineasServicio.forEach(linea => this.normalizarServicio(linea));
    this.lineasMedicamento.forEach(linea => this.normalizarMedicamento(linea));
    const request: CrearFacturaRequest = {
      idSucursal: this.idSucursal,
      idPaciente: this.idPaciente,
      nit: this.limpiarOpcional(this.nit),
      nombreFacturacion: this.limpiarOpcional(this.nombreFacturacion),
      servicios: this.lineasServicio.map(item => ({ idServicio: item.idServicio, cantidad: item.cantidad })),
      medicamentos: this.lineasMedicamento.map(item => ({ idMedicamento: item.idMedicamento, cantidad: item.cantidad })),
    };
    this.guardando = true;
    this.error = '';
    this.facturasService.crear(request).subscribe({
      next: factura => { void this.router.navigate(['/facturas', factura.idFactura]); },
      error: (error: HttpErrorResponse) => {
        this.error = this.apiErrors.messageFor(error, 'No fue posible crear la factura. Verifique existencias y datos.');
        this.guardando = false;
      },
    });
  }

  private cantidadValida(cantidad: number, maximo: number): number {
    if (!Number.isFinite(cantidad)) return 1;
    return Math.min(Math.max(Math.trunc(cantidad), 1), maximo);
  }

  private limpiarOpcional(value: string): string | null {
    const result = value.trim();
    return result || null;
  }
}
