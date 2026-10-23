import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Subscription, expand, reduce } from 'rxjs';
import {
  CrearRecetaClinicaRequest, DiagnosticoResponse, ExamenResponseDto,
  RecetaClinicaDetalleDto, RecetaClinicaResumenDto, RecetaLineaCrearRequest
} from '../../core/models/historial.model';
import { MedicamentoResponse } from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { UiStateComponent } from '../../shared/components/ui-state.component';

type LineaForm = FormGroup<{
  idMedicamento: FormControl<number | null>;
  cantidadPrescritaUnidades: FormControl<number | null>;
  unidadInventario: FormControl<string>;
  destinoMedicamento: FormControl<'' | 'Clinica' | 'CompraExterna'>;
}>;

@Component({
  selector: 'app-receta-form',
  imports: [CommonModule, ReactiveFormsModule, ConfirmDialogComponent, UiStateComponent],
  styleUrl: './receta-form.component.css',
  template: `
    <form [formGroup]="form" (ngSubmit)="solicitarConfirmacion()" class="receta-form" [attr.aria-busy]="guardando">
      <section class="card shadow-sm mb-3 consulta-card">
        <div class="card-header consulta-section-heading"><h4 class="h6 mb-0">Diagnóstico para el tratamiento</h4></div>
        <div class="card-body py-2">
          @if (cargandoDiagnosticos) { <app-ui-state kind="loading" title="Cargando diagnósticos…" [compact]="true" /> }
          @else if (errorDiagnosticos) { <app-ui-state kind="error" title="No fue posible cargar diagnósticos" [description]="errorDiagnosticos" [compact]="true" /> }
          @else if (!diagnosticos.length) {
            <app-ui-state kind="empty" title="Sin diagnósticos registrados" description="Registra primero un diagnóstico en la pestaña Diagnóstico." [compact]="true" />
          } @else {
            <div class="ui-table-wrap receta-table-wrap">
              <table class="table table-sm align-middle ui-table receta-table">
                <thead><tr><th scope="col">Seleccionar</th><th scope="col">No.</th><th scope="col">Diagnóstico</th><th scope="col">Examen relacionado</th><th scope="col">Fecha de resultado</th></tr></thead>
                <tbody>
                  @for (diagnostico of diagnosticos; track diagnostico.idDiagnostico; let i = $index) {
                    <tr [class.receta-row-selected]="form.controls.idDiagnostico.value === diagnostico.idDiagnostico">
                      <td><input class="form-check-input" type="radio" name="diagnosticoReceta" [id]="'receta-diag-' + diagnostico.idDiagnostico"
                        [checked]="form.controls.idDiagnostico.value === diagnostico.idDiagnostico"
                        [disabled]="guardando || resultadoIncierto || !puedeCrear"
                        (change)="form.controls.idDiagnostico.setValue(diagnostico.idDiagnostico)"></td>
                      <td>{{ i + 1 }}</td>
                      <td><label [for]="'receta-diag-' + diagnostico.idDiagnostico">{{ diagnostico.descripcion }}</label></td>
                      <td>{{ nombresExamenes(diagnostico.idDiagnostico) }}</td>
                      <td>{{ fechaResultado(diagnostico.idDiagnostico) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
            @if (diagnosticoSeleccionado) {
              <p class="receta-seleccion mb-0 mt-2"><strong>Diagnóstico seleccionado:</strong> {{ diagnosticoSeleccionado.descripcion }}</p>
            }
          }
        </div>
      </section>

      @if (puedeCrear) {
        <section class="card shadow-sm mb-3 consulta-card">
          <div class="card-header consulta-section-heading"><h4 class="h6 mb-0">Información del tratamiento</h4></div>
          <div class="card-body">
            <div class="row g-2">
            <div class="col-12 col-lg-6"><label class="form-label" for="receta-descripcion">Descripción del tratamiento *</label>
              <textarea id="receta-descripcion" class="form-control" formControlName="descripcionTratamiento" rows="3" maxlength="300" [attr.aria-describedby]="error ? 'receta-error' : null"></textarea>
              @if (form.controls.descripcionTratamiento.touched && form.controls.descripcionTratamiento.invalid) { <small class="text-danger">Ingrese la descripción del tratamiento.</small> }</div>
            <div class="col-12 col-sm-6 col-lg-3"><label class="form-label" for="receta-inicio">Fecha de inicio *</label>
              <input id="receta-inicio" class="form-control" type="date" formControlName="fechaInicio" [attr.aria-describedby]="error ? 'receta-error' : null">
              @if (form.controls.fechaInicio.touched && form.controls.fechaInicio.invalid) { <small class="text-danger">Seleccione la fecha de inicio.</small> }</div>
            <div class="col-12 col-sm-6 col-lg-3"><label class="form-label" for="receta-fin">Fecha de finalización</label>
              <input id="receta-fin" class="form-control" type="date" formControlName="fechaFin" [attr.aria-describedby]="error ? 'receta-error' : null">
              @if (form.controls.fechaFin.touched && lineas.length && !form.controls.fechaFin.value) { <small class="text-danger">Seleccione la fecha de finalización.</small> }</div>
            <div class="col-12"><p class="text-muted mb-0" role="status">{{ duracionCalculada === null ? 'Seleccione las fechas para calcular los días de consumo.' : duracionCalculada + ' días de consumo' }}</p></div>
            <div class="col-12"><label class="form-label" for="receta-indicaciones">Indicaciones generales</label>
              <textarea id="receta-indicaciones" class="form-control" formControlName="indicacionesGenerales" rows="3" maxlength="300"></textarea></div>
            </div>
          </div>
        </section>

        @if (aviso) { <p class="alert alert-success" role="status">{{ aviso }}</p> }
        <section class="card shadow-sm mb-3 consulta-card">
          <div class="card-header consulta-section-heading d-flex justify-content-between align-items-center gap-2">
            <h4 class="h6 mb-0">Receta médica</h4>
            <button type="button" class="btn btn-outline-primary btn-sm" (click)="agregarMedicamento()"
              [disabled]="guardando || resultadoIncierto || !medicamentos.length"><i class="bi bi-plus-lg" aria-hidden="true"></i> Agregar medicamento</button>
          </div>
          @if (lineas.length) {
          <div class="card-body py-2">
            @if (cargandoMedicamentos) { <p role="status">Cargando medicamentos…</p> }
            @if (errorMedicamentos) { <p class="alert alert-warning" role="alert">{{ errorMedicamentos }}</p> }
            <div formArrayName="lineas" class="d-grid gap-2">
              @for (linea of lineas.controls; track linea; let i = $index) {
                <fieldset class="receta-medicamento" [formGroupName]="i">
                  <legend class="h6 mb-2">Medicamento {{ i + 1 }}</legend>
                  <div class="row g-2 mb-2">
                    <div class="col-12 col-md-6 col-xl-4"><label class="form-label" [for]="'receta-medicamento-' + i">Medicamento *</label>
                      <select class="form-select" [id]="'receta-medicamento-' + i" formControlName="idMedicamento" [attr.aria-describedby]="error ? 'receta-error' : null">
                        <option [ngValue]="null">Seleccionar medicamento</option>
                        @for (medicamento of medicamentos; track medicamento.idMedicamento) {
                          <option [ngValue]="medicamento.idMedicamento">{{ medicamento.nombre }}</option>
                        }
                      </select>
                      @if (linea.controls.idMedicamento.touched && linea.controls.idMedicamento.invalid) { <small class="text-danger">Seleccione un medicamento.</small> }
                    </div>
                    <div class="col-12 col-md-6 col-xl-3"><label class="form-label" [for]="'receta-presentacion-' + i">Presentación</label>
                      <input class="form-control" [id]="'receta-presentacion-' + i" [value]="presentacion(linea.controls.idMedicamento.value)" readonly></div>
                    <div class="col-12 col-sm-6 col-xl-2"><label class="form-label" [for]="'receta-cantidad-' + i">Cantidad *</label>
                      <input class="form-control" type="number" min="1" step="1" [id]="'receta-cantidad-' + i" formControlName="cantidadPrescritaUnidades" [attr.aria-describedby]="error ? 'receta-error' : null">
                      @if (linea.controls.cantidadPrescritaUnidades.touched && linea.controls.cantidadPrescritaUnidades.invalid) { <small class="text-danger">La cantidad debe ser mayor que cero.</small> }</div>
                    <div class="col-12 col-sm-6 col-xl-3"><label class="form-label" [for]="'receta-entrega-' + i">Unidad de entrega *</label>
                      <input class="form-control" [id]="'receta-entrega-' + i" formControlName="unidadInventario" maxlength="30" placeholder="Ej. tableta" [attr.aria-describedby]="error ? 'receta-error' : null">
                      @if (linea.controls.unidadInventario.touched && linea.controls.unidadInventario.invalid) { <small class="text-danger">Indique una unidad de entrega, por ejemplo, tableta o frasco; no solo una cantidad.</small> }</div>
                  </div>
                  <div class="indicaciones-heading">
                    <label class="form-label" [for]="'receta-destino-' + i">Destino *</label>
                    <button type="button" class="btn btn-outline-danger btn-sm" title="Eliminar medicamento"
                      [attr.aria-label]="'Eliminar medicamento ' + (i + 1)" (click)="quitarMedicamento(i)"
                      [disabled]="guardando || resultadoIncierto"><i class="bi bi-trash me-1" aria-hidden="true"></i> Eliminar medicamento</button>
                  </div>
                  <select class="form-select" [id]="'receta-destino-' + i" formControlName="destinoMedicamento">
                    <option value="">Seleccione el destino</option>
                    <option value="Clinica">Administración dentro de la clínica</option>
                    <option value="CompraExterna">Receta para compra externa</option>
                  </select>
                  @if (linea.controls.destinoMedicamento.touched && linea.controls.destinoMedicamento.invalid || errorDestinoIndice === i) { <small class="text-danger">Seleccione un destino válido: administración dentro de la clínica o compra externa.</small> }
                </fieldset>
              }
            </div>
            <div class="receta-confirmacion mt-3 pt-3">
            <p class="receta-aviso mb-2"><i class="bi bi-info-circle" aria-hidden="true"></i> La cantidad y la unidad de entrega deben indicarse directamente. Confirmar la receta no descuenta inventario.</p>
            @if (estadoConsulta !== 'Abierta' && estadoConsulta !== 'En seguimiento') {
              <p class="alert alert-warning">La consulta no está en un estado autorizado para prescribir.</p>
            }
            @if (error) { <p class="alert alert-danger" id="receta-error" role="alert">{{ error }}</p> }
            @if (guardando) { <p class="text-primary small mb-2" role="status"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Procesando tratamiento y receta…</p> }
            <div class="d-flex flex-wrap gap-2 justify-content-end">
              <button type="button" class="btn btn-secondary" (click)="cancelar()" [disabled]="guardando || resultadoIncierto">Cancelar</button>
               <button type="submit" class="btn btn-primary" [disabled]="guardando || (estadoConsulta !== 'Abierta' && estadoConsulta !== 'En seguimiento')">
                {{ guardando ? 'Procesando…' : resultadoIncierto ? 'Reintentar la misma solicitud' : 'Guardar tratamiento y receta' }}</button>
            </div>
            </div>
          </div>
           } @else {
            <div class="card-body py-2">
               <p class="text-muted mb-0">El registro de tratamientos sin medicamentos requiere una relación e idempotencia persistentes aún no aprobadas.</p>
              @if (cargandoMedicamentos) { <p class="text-muted mb-0" role="status">Cargando medicamentos…</p> }
              @if (errorMedicamentos) { <p class="alert alert-warning mb-0" role="alert">{{ errorMedicamentos }}</p> }
            </div>
          }
        </section>
      }
    </form>

    <section class="card shadow-sm consulta-card">
      <div class="card-header consulta-section-heading"><h4 class="h6 mb-0">Recetas de la consulta</h4></div>
      <div class="card-body py-2">
        @if (cargandoRecetas) { <p role="status">Cargando recetas…</p> }
        @if (errorRecetas) { <p class="alert alert-warning" role="alert">{{ errorRecetas }}</p> }
        @if (!cargandoRecetas && !errorRecetas && !recetas.length) { <p class="text-muted">No hay recetas registradas para esta consulta.</p> }
        @if (recetas.length) {
          <div class="ui-table-wrap receta-table-wrap"><table class="table table-sm align-middle ui-table receta-table">
            <thead><tr><th>No.</th><th>Versión</th><th>Fecha de emisión</th><th>Diagnóstico</th><th>Medicamentos</th><th>Estado</th><th>Despacho</th><th>Acciones</th></tr></thead>
            <tbody>@for (receta of recetas; track receta.idReceta; let i = $index) {
              <tr><td class="ui-col-index">{{ i + 1 }}</td><td class="ui-col-number">{{ receta.numeroVersion }}</td><td class="ui-col-date">{{ receta.fechaPrescripcionUtc | date: 'dd/MM/yyyy HH:mm' }}</td>
                <td>{{ receta.descripcionDiagnostico }}</td><td class="ui-col-number">{{ receta.cantidadLineas }}</td><td><span class="badge text-bg-secondary">{{ receta.estado }}</span></td><td>Sin despacho</td>
                <td class="ui-col-actions"><button type="button" class="btn btn-outline-primary btn-sm" (click)="verDetalle(receta.idReceta)"><i class="bi bi-eye me-1" aria-hidden="true"></i> Ver detalle</button></td></tr>
            }</tbody>
          </table></div>
        }
        @if (detalle) {
          <div class="border rounded p-3 mt-3" role="region" aria-label="Detalle de receta">
            <div class="d-flex justify-content-between gap-2"><h5 class="h6">{{ detalle.descripcionTratamiento }}</h5>
              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="detalle = null">Cerrar</button></div>
            <p class="mb-2">{{ detalle.descripcionDiagnostico }} · {{ detalle.estado }} · {{ detalle.fechaPrescripcionUtc | date: 'dd/MM/yyyy HH:mm' }}</p>
            <p class="mb-2">Tratamiento: {{ detalle.fechaInicio }} – {{ detalle.fechaFin }}. Indicaciones: {{ detalle.indicacionesGenerales || 'Sin indicaciones generales' }}.</p>
            <ul class="mb-0">@for (linea of detalle.lineas; track linea.idRecetaLinea) {
               <li>{{ linea.nombreMedicamento }} — {{ linea.cantidadPrescritaUnidades }} {{ linea.unidadInventario }} · {{ linea.duracionDias }} días · {{ linea.destinoMedicamento === 'Clinica' ? 'Uso en clínica' : 'Compra externa' }}</li>
            }</ul>
          </div>
        }
      </div>
    </section>

    @if (confirmacionAbierta) {
      <app-confirm-dialog title="Confirmar tratamiento y receta"
        description="La receta quedará vigente y disponible para farmacia."
        consequence="Esta confirmación no selecciona lotes ni descuenta inventario."
        confirmLabel="Confirmar receta" busyLabel="Confirmando…" intent="primary"
        [busy]="guardando" (confirmed)="confirmar()" (cancelled)="confirmacionAbierta = false" />
    }
    @if (medicamentoPendienteEliminar !== null) {
      <app-confirm-dialog title="Eliminar medicamento"
        description="Se eliminarán los datos ingresados para este medicamento."
        cancelLabel="Conservar" confirmLabel="Eliminar medicamento"
        (confirmed)="confirmarEliminacion()" (cancelled)="medicamentoPendienteEliminar = null" />
    }
    @if (cancelacionPendiente) {
      <app-confirm-dialog title="Cancelar receta"
        description="Se eliminarán los datos ingresados para los medicamentos de esta receta."
        cancelLabel="Conservar" confirmLabel="Descartar receta"
        (confirmed)="confirmarCancelacion()" (cancelled)="cancelacionPendiente = false" />
    }
  `,
})
export class RecetaFormComponent implements OnChanges, OnDestroy {
  private readonly historial = inject(HistorialService);
  private readonly inventario = inject(InventarioService);
  private readonly permisos = inject(PermisosService);
  private readonly sesion = inject(AuthSessionService);
  private readonly errores = inject(ApiErrorService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  @Input({ required: true }) idConsulta = 0;
  @Input({ required: true }) idPaciente = 0;
  @Input() estadoConsulta: string | null | undefined;
  @Input() diagnosticos: DiagnosticoResponse[] = [];
  @Input() examenes: ExamenResponseDto[] = [];
  @Input() fechaPrimeraCargaExamen: Partial<Record<number, string | null>> = {};
  @Input() cargandoDiagnosticos = false;
  @Input() errorDiagnosticos = '';
  @Output() readonly registrada = new EventEmitter<RecetaClinicaDetalleDto>();

  readonly form = new FormGroup({
    idDiagnostico: new FormControl<number | null>(null, Validators.required),
    descripcionTratamiento: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\S/), Validators.maxLength(300)] }),
    indicacionesGenerales: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    fechaInicio: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    fechaFin: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    lineas: new FormArray<LineaForm>([]),
  });
  medicamentos: MedicamentoResponse[] = [];
  recetas: RecetaClinicaResumenDto[] = [];
  detalle: RecetaClinicaDetalleDto | null = null;
  cargandoMedicamentos = false;
  cargandoRecetas = false;
  guardando = false;
  resultadoIncierto = false;
  confirmacionAbierta = false;
  medicamentoPendienteEliminar: number | null = null;
  cancelacionPendiente = false;
  errorDestinoIndice: number | null = null;
  error = '';
  aviso = '';
  errorMedicamentos = '';
  errorRecetas = '';
  private claveOperacion: string | null = null;
  private ultimoEnvio: CrearRecetaClinicaRequest | null = null;
  private revision = 0;
  private readonly lecturas = new Subscription();
  private escritura?: Subscription;

  constructor() {
    this.lecturas.add(this.form.valueChanges.subscribe(() => {
      if (!this.guardando && !this.resultadoIncierto) this.claveOperacion = null;
    }));
  }

  get lineas(): FormArray<LineaForm> { return this.form.controls.lineas; }
  get duracionCalculada(): number | null {
    const { fechaInicio, fechaFin } = this.form.getRawValue();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaInicio) || !/^\d{4}-\d{2}-\d{2}$/.test(fechaFin)) return null;
    const dias = Math.round((Date.parse(fechaFin + 'T00:00:00Z') - Date.parse(fechaInicio + 'T00:00:00Z')) / 86400000) + 1;
    return Number.isFinite(dias) && dias > 0 && dias <= 32767 ? dias : null;
  }
  get puedeCrear(): boolean { return this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL); }
  get diagnosticoSeleccionado(): DiagnosticoResponse | undefined {
    return this.diagnosticos.find(d => d.idDiagnostico === this.form.controls.idDiagnostico.value);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['idConsulta'] || changes['idPaciente']) {
      this.revision++;
      this.escritura?.unsubscribe();
      this.reiniciarFormulario();
      this.recetas = []; this.detalle = null;
      if (this.idConsulta > 0 && this.idPaciente > 0) {
        this.cargarMedicamentos(); this.cargarRecetas();
      }
    }
    if (changes['diagnosticos'] && !this.diagnosticoSeleccionado)
      this.form.controls.idDiagnostico.setValue(this.diagnosticos.length === 1 ? this.diagnosticos[0].idDiagnostico : null);
  }

  nombresExamenes(idDiagnostico: number): string {
    const nombres = this.examenes.filter(e => e.idDiagnostico === idDiagnostico).map(e => e.nombreExamen);
    return nombres.length ? nombres.join(', ') : 'Sin examen asociado';
  }

  fechaResultado(idDiagnostico: number): string {
    const fechas = this.examenes.filter(e => e.idDiagnostico === idDiagnostico)
      .map(e => this.fechaPrimeraCargaExamen[e.idExamen]).filter((v): v is string => !!v);
    if (!fechas.length) return 'Pendiente';
    const primera = fechas.sort()[0];
    return new Intl.DateTimeFormat('es-GT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(primera));
  }

  presentacion(id: number | null): string {
    return this.medicamentos.find(m => m.idMedicamento === id)?.presentacion?.trim() || 'No registrada';
  }

  agregarMedicamento(): void {
    if (this.guardando || this.resultadoIncierto) return;
    this.aviso = '';
    this.lineas.push(new FormGroup({
      idMedicamento: new FormControl<number | null>(null, Validators.required),
      cantidadPrescritaUnidades: new FormControl<number | null>(null, [Validators.required, Validators.pattern(/^[1-9]\d*$/)]),
      unidadInventario: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.pattern(/\p{L}/u), Validators.maxLength(30)] }),
      destinoMedicamento: new FormControl<'' | 'Clinica' | 'CompraExterna'>('', { nonNullable: true, validators: [Validators.required] }),
    }));
  }

  quitarMedicamento(index: number): void {
    if (this.guardando || this.resultadoIncierto || !this.lineas.at(index)) return;
    if (this.tieneDatos(this.lineas.at(index))) {
      this.medicamentoPendienteEliminar = index;
      return;
    }
    this.lineas.removeAt(index);
  }

  confirmarEliminacion(): void {
    const index = this.medicamentoPendienteEliminar;
    this.medicamentoPendienteEliminar = null;
    if (index !== null && !this.guardando && !this.resultadoIncierto && this.lineas.at(index))
      this.lineas.removeAt(index);
  }

  private tieneDatos(linea: LineaForm): boolean {
    return Object.values(linea.getRawValue()).some(value =>
      value !== null && (typeof value !== 'string' || value.trim().length > 0));
  }

  solicitarConfirmacion(): void {
    this.error = '';
    this.errorDestinoIndice = null;
    if (this.guardando) return;
    if (!this.puedeCrear || !this.identidadActual() ||
      this.estadoConsulta !== 'Abierta' && this.estadoConsulta !== 'En seguimiento') {
      this.error = 'No es posible prescribir con el acceso o estado actual de la consulta.'; return;
    }
    if (this.resultadoIncierto && this.ultimoEnvio) {
      this.confirmacionAbierta = true; return;
    }
    if (!this.diagnosticoSeleccionado) {
      this.form.markAllAsTouched(); this.error = 'Seleccione un diagnóstico de esta consulta.';
      this.host.nativeElement.querySelector<HTMLElement>('input[name="diagnosticoReceta"]')?.focus(); return;
    }
    if (!this.medicamentos.length) {
      this.error = 'No hay medicamentos disponibles para prescribir.'; return;
    }
    if (!this.lineas.length) {
      this.error = 'El tratamiento sin medicamentos requiere una relación e idempotencia persistentes aún no aprobadas.'; return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched(); this.error = 'Revise los campos indicados antes de guardar.';
      this.enfocarPrimerInvalido(); return;
    }
    const datos = this.form.getRawValue();
    if (datos.fechaFin && datos.fechaFin < datos.fechaInicio) {
      this.form.markAllAsTouched();
      this.error = 'La fecha de finalización no puede ser anterior a la fecha de inicio.';
      this.host.nativeElement.querySelector<HTMLElement>('#receta-fin')?.focus(); return;
    }
    if (!datos.fechaFin || this.duracionCalculada === null) {
      this.form.markAllAsTouched();
      this.error = 'Seleccione la fecha de finalización.';
      this.host.nativeElement.querySelector<HTMLElement>('#receta-fin')?.focus(); return;
    }
    const lineas: RecetaLineaCrearRequest[] = [];
    for (const item of datos.lineas) {
      const medicamento = this.medicamentos.find(m => m.idMedicamento === item.idMedicamento);
      if (!medicamento || !medicamento.activo || item.cantidadPrescritaUnidades === null ||
        !Number.isInteger(item.cantidadPrescritaUnidades) || item.cantidadPrescritaUnidades <= 0 ||
        !/\p{L}/u.test(item.unidadInventario) || !['Clinica', 'CompraExterna'].includes(item.destinoMedicamento)) {
        this.error = 'Verifique el medicamento, la cantidad, la unidad y el destino.'; return;
      }
      lineas.push({ idMedicamento: medicamento.idMedicamento, cantidadPrescritaUnidades: item.cantidadPrescritaUnidades,
        unidadInventario: item.unidadInventario.trim(), destinoMedicamento: item.destinoMedicamento as 'Clinica' | 'CompraExterna' });
    }
    if (new Set(lineas.map(l => l.idMedicamento)).size !== lineas.length) {
      this.error = 'Cada medicamento debe aparecer una sola vez en la receta.'; return;
    }
    this.claveOperacion ??= crypto.randomUUID();
    this.ultimoEnvio = { idConsulta: this.idConsulta, idDiagnostico: this.diagnosticoSeleccionado.idDiagnostico,
      claveOperacion: this.claveOperacion, descripcionTratamiento: datos.descripcionTratamiento.trim(),
      indicacionesGenerales: datos.indicacionesGenerales.trim() || null,
      fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin || null, lineas };
    this.confirmacionAbierta = true;
  }

  private enfocarPrimerInvalido(): void {
    this.host.nativeElement.querySelector<HTMLElement>('input.ng-invalid, select.ng-invalid, textarea.ng-invalid')?.focus();
  }

  confirmar(): void {
    const request = this.ultimoEnvio;
    const identidad = this.identidadActual();
    if (!request || !identidad || this.guardando || !this.puedeCrear || request.idConsulta !== this.idConsulta) return;
    this.guardando = true; this.error = ''; this.aviso = '';
    const revision = ++this.revision;
    this.escritura = this.historial.crearReceta(request).subscribe({
      next: receta => {
        if (revision !== this.revision || identidad !== this.identidadActual()) return;
        this.guardando = false; this.confirmacionAbierta = false;
        if (receta.idConsulta !== this.idConsulta || receta.idDiagnostico !== request.idDiagnostico ||
          receta.lineas.length !== request.lineas.length || receta.estado !== 'Vigente' ||
          receta.lineas.some((linea, i) => linea.idMedicamento !== request.lineas[i].idMedicamento ||
            linea.cantidadPrescritaUnidades !== request.lineas[i].cantidadPrescritaUnidades ||
            linea.unidadInventario !== request.lineas[i].unidadInventario ||
            linea.destinoMedicamento !== request.lineas[i].destinoMedicamento)) {
          this.resultadoIncierto = true;
          this.form.disable({ emitEvent: false });
          this.error = 'La confirmación es inconsistente. Revisa el historial antes de repetir.'; return;
        }
        this.resultadoIncierto = false; this.claveOperacion = null; this.ultimoEnvio = null;
        this.reiniciarFormulario();
        this.aviso = 'Tratamiento y receta confirmados. La receta está vigente y disponible para farmacia.';
        this.cargarRecetas(); this.registrada.emit(receta);
      },
      error: (err: unknown) => {
        if (revision !== this.revision || identidad !== this.identidadActual()) return;
        this.guardando = false; this.confirmacionAbierta = false;
        if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500)) {
          this.resultadoIncierto = true; this.form.disable({ emitEvent: false });
          this.error = 'Resultado incierto. Reintenta la misma solicitud; se conservará su clave de operación.';
          this.cargarRecetas();
        } else {
          this.error = err instanceof HttpErrorResponse
            ? this.mensajeErrorConfirmacion(err)
            : 'No fue posible confirmar la receta.';
        }
      }
    });
  }

  private mensajeErrorConfirmacion(err: HttpErrorResponse): string {
    const errors = err.error && typeof err.error === 'object' && !Array.isArray(err.error)
      ? (err.error as { errors?: unknown }).errors : null;
    if (errors && typeof errors === 'object' && !Array.isArray(errors)) {
      const keys = Object.keys(errors);
      const destino = keys.find(key => /(?:^|\.)destinoMedicamento$/i.test(key));
      if (destino) {
        const indice = /\$\.lineas\[(\d+)\]/i.exec(destino);
        const linea = indice ? Number(indice[1]) : this.lineas.length === 1 ? 0 : -1;
        this.errorDestinoIndice = linea >= 0 && linea < this.lineas.length ? linea : null;
        return 'El destino del medicamento no es válido. Seleccione administración dentro de la clínica o compra externa.';
      }
      if (keys.some(key => key.toLowerCase() !== 'request'))
        return 'La receta contiene un dato inválido. Revise los campos indicados.';
    }
    return this.errores.messageFor(err, 'No fue posible confirmar la receta.');
  }

  cancelar(): void {
    if (this.guardando || this.resultadoIncierto) return;
    if (this.lineas.controls.some(linea => this.tieneDatos(linea))) {
      this.cancelacionPendiente = true;
      return;
    }
    this.confirmarCancelacion();
  }

  confirmarCancelacion(): void {
    this.cancelacionPendiente = false;
    if (this.guardando || this.resultadoIncierto) return;
    this.lineas.clear();
    this.claveOperacion = null; this.ultimoEnvio = null;
    this.confirmacionAbierta = false; this.error = '';
  }

  verDetalle(idReceta: number): void {
    const revision = this.revision;
    const identidad = this.identidadActual();
    this.lecturas.add(this.historial.obtenerReceta(idReceta).subscribe({
      next: detalle => {
        if (revision === this.revision && identidad === this.identidadActual() &&
          detalle.idConsulta === this.idConsulta && detalle.idReceta === idReceta) this.detalle = detalle;
      },
      error: (err: HttpErrorResponse) => {
        if (revision === this.revision && identidad === this.identidadActual())
          this.errorRecetas = this.errores.messageFor(err, 'No fue posible abrir el detalle de la receta.');
      }
    }));
  }

  private cargarMedicamentos(): void {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.MEDICAMENTOS)) {
      this.errorMedicamentos = 'Se requiere permiso para consultar medicamentos.'; return;
    }
    const revision = this.revision;
    this.cargandoMedicamentos = true; this.errorMedicamentos = '';
    this.lecturas.add(this.inventario.listarMedicamentos(1, 100).pipe(
      expand(page => page.page < page.totalPages ? this.inventario.listarMedicamentos(page.page + 1, 100) : EMPTY),
      reduce((all, page) => [...all, ...page.items], [] as MedicamentoResponse[])
    ).subscribe({
      next: items => {
        if (revision !== this.revision) return;
        this.medicamentos = items.filter(m => m.activo); this.cargandoMedicamentos = false;
      },
      error: (err: unknown) => {
        if (revision !== this.revision) return;
        this.medicamentos = []; this.cargandoMedicamentos = false;
        this.errorMedicamentos = err instanceof HttpErrorResponse
          ? this.errores.messageFor(err, 'No fue posible consultar medicamentos.')
          : 'No fue posible consultar medicamentos.';
      }
    }));
  }

  private cargarRecetas(): void {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL)) return;
    const consulta = this.idConsulta;
    const revision = this.revision;
    this.cargandoRecetas = true; this.errorRecetas = '';
    this.lecturas.add(this.historial.listarRecetas(consulta, 1, 100).pipe(
      expand(page => page.page < page.totalPages ? this.historial.listarRecetas(consulta, page.page + 1, 100) : EMPTY),
      reduce((all, page) => [...all, ...page.items], [] as RecetaClinicaResumenDto[])
    ).subscribe({
      next: items => {
        if (revision !== this.revision || consulta !== this.idConsulta) return;
        this.recetas = items.filter(r => r.idConsulta === consulta)
          .sort((a, b) => a.fechaPrescripcionUtc.localeCompare(b.fechaPrescripcionUtc) || a.idReceta - b.idReceta);
        this.cargandoRecetas = false;
      },
      error: (err: unknown) => {
        if (revision !== this.revision || consulta !== this.idConsulta) return;
        this.recetas = []; this.cargandoRecetas = false;
        this.errorRecetas = err instanceof HttpErrorResponse
          ? this.errores.messageFor(err, 'No fue posible consultar las recetas.')
          : 'No fue posible consultar las recetas.';
      }
    }));
  }

  private reiniciarFormulario(): void {
    this.form.enable({ emitEvent: false });
    this.form.reset({ idDiagnostico: this.diagnosticos.length === 1 ? this.diagnosticos[0].idDiagnostico : null,
      descripcionTratamiento: '', indicacionesGenerales: '',
      fechaInicio: '', fechaFin: '' }, { emitEvent: false });
    this.lineas.clear({ emitEvent: false });
    this.claveOperacion = null; this.ultimoEnvio = null; this.resultadoIncierto = false;
    this.confirmacionAbierta = false; this.medicamentoPendienteEliminar = null;
    this.cancelacionPendiente = false; this.guardando = false; this.error = '';
  }

  private identidadActual(): string | null {
    const id = this.sesion.currentUser()?.idUsuario;
    return this.sesion.isAuthenticated() && id && this.sesion.token
      ? `${id}:${this.sesion.token}` : null;
  }

  ngOnDestroy(): void {
    this.revision++; this.escritura?.unsubscribe(); this.lecturas.unsubscribe();
  }
}
