import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, EventEmitter, InjectionToken, Input, OnChanges, OnDestroy, Output, SimpleChanges, inject } from '@angular/core';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { EMPTY, Subscription, expand, reduce } from 'rxjs';
import {
  CrearRecetaClinicaRequest, DiagnosticoResponse, ExamenResponseDto,
  RecetaClinicaDetalleDto, RecetaClinicaResumenDto, RecetaLineaCrearRequest,
  TratamientoCreateDto, TratamientoResponseDto
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
}>;

// La confirmación de recetas requiere autorización operativa en Angular y API.
export const RECETA_SIMPLE_WRITE_ENABLED = new InjectionToken<boolean>(
  'RECETA_SIMPLE_WRITE_ENABLED', { providedIn: 'root', factory: () => false });

@Component({
  selector: 'app-receta-form',
  imports: [CommonModule, ReactiveFormsModule, ConfirmDialogComponent, UiStateComponent],
  styleUrl: './receta-form.component.css',
  template: `
    <form [formGroup]="form" (ngSubmit)="solicitarConfirmacion()" class="receta-form" [attr.aria-busy]="guardando">
      <section class="card shadow-sm mb-3 consulta-card">
        <div class="card-header consulta-section-heading"><h4 class="h6 mb-0">Diagnóstico para la receta</h4></div>
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
            <div class="col-12"><p class="text-muted mb-0" role="status">{{ duracionCalculada === null ? 'Indique las fechas del tratamiento.' : duracionCalculada + (duracionCalculada === 1 ? ' día de tratamiento' : ' días de tratamiento') }}</p></div>
            <div class="col-12"><label class="form-label" for="receta-indicaciones">Indicaciones generales</label>
              <textarea id="receta-indicaciones" class="form-control" formControlName="indicacionesGenerales" rows="3" maxlength="300"></textarea></div>
            </div>
            <p class="small text-muted mt-2 mb-2">Guardar solo tratamiento lo relaciona con esta consulta. El contrato independiente no vincula un diagnóstico ni registra medicamentos.</p>
            @if (errorTratamiento) { <p class="alert alert-danger" role="alert">{{ errorTratamiento }}</p> }
            @if (avisoTratamiento) { <p class="alert alert-success" role="status">{{ avisoTratamiento }}</p> }
            <button type="button" class="btn btn-outline-primary" (click)="guardarSoloTratamiento()"
              [disabled]="guardando || resultadoIncierto || tratamientoIncierto || lineas.length > 0">
              {{ guardando && guardandoSoloTratamiento ? 'Guardando tratamiento…' : 'Guardar tratamiento' }}
            </button>
            @if (lineas.length) { <p class="small text-muted mt-2 mb-0">Retire los medicamentos para guardar solo el tratamiento.</p> }
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
                    <div class="col-12 col-md-6 col-xl-5"><label class="form-label" [for]="'receta-medicamento-' + i">Medicamento *</label>
                      <select class="form-select" [id]="'receta-medicamento-' + i" formControlName="idMedicamento" [attr.aria-describedby]="error ? 'receta-error' : null">
                        <option [ngValue]="null">Seleccionar medicamento</option>
                        @for (medicamento of medicamentos; track medicamento.idMedicamento) {
                          <option [ngValue]="medicamento.idMedicamento">{{ medicamento.nombre }}</option>
                        }
                      </select>
                      @if (linea.controls.idMedicamento.touched && linea.controls.idMedicamento.invalid) { <small class="text-danger">Seleccione un medicamento.</small> }
                    </div>
                    <div class="col-12 col-md-6 col-xl-4"><label class="form-label" [for]="'receta-presentacion-' + i">Presentación</label>
                      <input class="form-control" [id]="'receta-presentacion-' + i" [value]="presentacion(linea.controls.idMedicamento.value)" readonly></div>
                    <div class="col-12 col-md-12 col-xl-3"><label class="form-label" [for]="'receta-cantidad-' + i">Cantidad *</label>
                      <input class="form-control" type="number" min="1" step="1" [id]="'receta-cantidad-' + i" formControlName="cantidadPrescritaUnidades" [attr.aria-describedby]="error ? 'receta-error' : null">
                      @if (linea.controls.cantidadPrescritaUnidades.touched && linea.controls.cantidadPrescritaUnidades.invalid) { <small class="text-danger">La cantidad debe ser mayor que cero.</small> }</div>
                  </div>
                  <div class="receta-acciones-linea">
                    @if (lineaAceptada(linea)) {
                      <span class="badge text-bg-success" role="status">Aceptado</span>
                      <button type="button" class="btn btn-outline-primary btn-sm" [attr.aria-label]="'Editar medicamento ' + (i + 1)"
                        (click)="editarMedicamento(i)" [disabled]="guardando || resultadoIncierto || tratamientoIncierto">Editar</button>
                    } @else {
                      <button type="button" class="btn btn-outline-success btn-sm" [attr.aria-label]="'Aceptar medicamento ' + (i + 1)"
                        (click)="aceptarMedicamento(i)" [disabled]="guardando || resultadoIncierto || tratamientoIncierto">Aceptar</button>
                    }
                    <button type="button" class="btn btn-outline-danger btn-sm" title="Eliminar medicamento"
                      [attr.aria-label]="'Eliminar medicamento ' + (i + 1)" (click)="quitarMedicamento(i)"
                      [disabled]="guardando || resultadoIncierto"><i class="bi bi-trash me-1" aria-hidden="true"></i> Eliminar medicamento</button>
                  </div>
                  @if (errorAceptacion(linea)) { <p class="text-danger small mb-0" role="alert">{{ errorAceptacion(linea) }}</p> }
                </fieldset>
              }
            </div>
            <div class="receta-confirmacion mt-3 pt-3">
            <p class="receta-aviso mb-2"><i class="bi bi-info-circle" aria-hidden="true"></i> Indique la cantidad directamente. La presentación es solo informativa; confirmar la receta no descuenta inventario.</p>
            @if (!escrituraAisladaHabilitada) {
              <p class="alert alert-warning" role="status">La confirmación de recetas permanece pendiente de autorización operativa. Puede preparar el formulario, pero no enviarlo.</p>
            }
            @if (estadoConsulta !== 'Abierta' && estadoConsulta !== 'En seguimiento') {
              <p class="alert alert-warning">La consulta no está en un estado autorizado para prescribir.</p>
            }
            @if (error) { <p class="alert alert-danger" id="receta-error" role="alert">{{ error }}</p> }
            @if (guardando) { <p class="text-primary small mb-2" role="status"><span class="spinner-border spinner-border-sm me-1" aria-hidden="true"></span> Procesando tratamiento y receta…</p> }
            <div class="d-flex flex-wrap gap-2 justify-content-end">
              <button type="button" class="btn btn-secondary" (click)="cancelar()" [disabled]="guardando || resultadoIncierto">Cancelar</button>
               <button type="submit" class="btn btn-primary" [disabled]="!escrituraAisladaHabilitada || guardando || tratamientoIncierto || (estadoConsulta !== 'Abierta' && estadoConsulta !== 'En seguimiento')">
                {{ guardando ? 'Procesando…' : resultadoIncierto ? 'Reintentar la misma solicitud' : 'Guardar' }}</button>
            </div>
            </div>
          </div>
           } @else {
            <div class="card-body py-2">
               <p class="text-muted mb-0">Puede guardar el tratamiento sin medicamentos desde la sección anterior. La receta se confirma por separado cuando se autorice su escritura.</p>
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
               <li>{{ linea.nombreMedicamento }} — Presentación: {{ linea.presentacion || 'No registrada' }} · Cantidad: {{ linea.cantidadPrescritaUnidades }}</li>
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
  readonly escrituraAisladaHabilitada = inject(RECETA_SIMPLE_WRITE_ENABLED);

  @Input({ required: true }) idConsulta = 0;
  @Input({ required: true }) idPaciente = 0;
  @Input() estadoConsulta: string | null | undefined;
  @Input() diagnosticos: DiagnosticoResponse[] = [];
  @Input() examenes: ExamenResponseDto[] = [];
  @Input() fechaPrimeraCargaExamen: Partial<Record<number, string | null>> = {};
  @Input() cargandoDiagnosticos = false;
  @Input() errorDiagnosticos = '';
  @Output() readonly registrada = new EventEmitter<RecetaClinicaDetalleDto>();
  @Output() readonly tratamientoRegistrado = new EventEmitter<TratamientoResponseDto>();

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
  guardandoSoloTratamiento = false;
  tratamientoIncierto = false;
  resultadoIncierto = false;
  confirmacionAbierta = false;
  medicamentoPendienteEliminar: number | null = null;
  cancelacionPendiente = false;
  error = '';
  aviso = '';
  errorTratamiento = '';
  avisoTratamiento = '';
  errorMedicamentos = '';
  errorRecetas = '';
  private claveOperacion: string | null = null;
  private ultimoEnvio: CrearRecetaClinicaRequest | null = null;
  private revision = 0;
  private readonly lecturas = new Subscription();
  private escritura?: Subscription;
  private readonly aceptaciones = new Map<LineaForm, { idMedicamento: number; cantidadPrescritaUnidades: number }>();
  private readonly erroresAceptacion = new Map<LineaForm, string>();
  private readonly cambiosLinea = new Map<LineaForm, Subscription>();

  constructor() {
    this.lecturas.add(this.form.valueChanges.subscribe(() => {
      if (!this.guardando && !this.resultadoIncierto) {
        this.claveOperacion = null;
        this.ultimoEnvio = null;
        this.confirmacionAbierta = false;
      }
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

  lineaAceptada(linea: LineaForm): boolean {
    const aceptada = this.aceptaciones.get(linea);
    const actual = linea.getRawValue();
    return !!aceptada && aceptada.idMedicamento === actual.idMedicamento &&
      aceptada.cantidadPrescritaUnidades === actual.cantidadPrescritaUnidades;
  }

  errorAceptacion(linea: LineaForm): string {
    return this.erroresAceptacion.get(linea) ?? '';
  }

  aceptarMedicamento(index: number): void {
    const linea = this.lineas.at(index);
    if (!linea || this.guardando || this.resultadoIncierto || this.tratamientoIncierto) return;
    linea.markAllAsTouched();
    this.erroresAceptacion.delete(linea);
    const { idMedicamento, cantidadPrescritaUnidades } = linea.getRawValue();
    if (!this.medicamentos.some(m => m.idMedicamento === idMedicamento && m.activo)) {
      this.erroresAceptacion.set(linea, 'Seleccione un medicamento activo del catálogo.'); return;
    }
    if (cantidadPrescritaUnidades === null || !Number.isSafeInteger(cantidadPrescritaUnidades) || cantidadPrescritaUnidades <= 0) {
      this.erroresAceptacion.set(linea, 'Indique una cantidad entera mayor que cero.'); return;
    }
    if (this.lineas.controls.some(otra => otra !== linea && otra.getRawValue().idMedicamento === idMedicamento)) {
      this.erroresAceptacion.set(linea, 'Cada medicamento debe aparecer una sola vez en la receta.'); return;
    }
    this.aceptaciones.set(linea, { idMedicamento: idMedicamento!, cantidadPrescritaUnidades });
    linea.disable({ emitEvent: false });
    this.error = '';
  }

  editarMedicamento(index: number): void {
    const linea = this.lineas.at(index);
    if (!linea || !this.lineaAceptada(linea) || this.guardando || this.resultadoIncierto || this.tratamientoIncierto) return;
    this.aceptaciones.delete(linea);
    linea.enable({ emitEvent: false });
    this.claveOperacion = null; this.ultimoEnvio = null; this.confirmacionAbierta = false;
    this.error = '';
  }

  agregarMedicamento(): void {
    if (this.guardando || this.resultadoIncierto || this.tratamientoIncierto) return;
    this.aviso = '';
    const linea: LineaForm = new FormGroup({
      idMedicamento: new FormControl<number | null>(null, Validators.required),
      cantidadPrescritaUnidades: new FormControl<number | null>(null, [Validators.required, Validators.pattern(/^[1-9]\d*$/)]),
    });
    this.cambiosLinea.set(linea, linea.valueChanges.subscribe(() => {
      if (this.aceptaciones.has(linea) && !this.lineaAceptada(linea)) {
        this.aceptaciones.delete(linea);
        linea.enable({ emitEvent: false });
      }
      this.erroresAceptacion.delete(linea);
    }));
    this.lineas.push(linea);
  }

  quitarMedicamento(index: number): void {
    if (this.guardando || this.resultadoIncierto || !this.lineas.at(index)) return;
    if (this.tieneDatos(this.lineas.at(index))) {
      this.medicamentoPendienteEliminar = index;
      return;
    }
    this.eliminarLinea(index);
  }

  confirmarEliminacion(): void {
    const index = this.medicamentoPendienteEliminar;
    this.medicamentoPendienteEliminar = null;
    if (index !== null && !this.guardando && !this.resultadoIncierto && this.lineas.at(index))
      this.eliminarLinea(index);
  }

  private eliminarLinea(index: number): void {
    const linea = this.lineas.at(index);
    if (!linea) return;
    this.cambiosLinea.get(linea)?.unsubscribe();
    this.cambiosLinea.delete(linea);
    this.aceptaciones.delete(linea);
    this.erroresAceptacion.delete(linea);
    this.lineas.removeAt(index);
  }

  private limpiarLineas(): void {
    this.cambiosLinea.forEach(subscription => subscription.unsubscribe());
    this.cambiosLinea.clear();
    this.aceptaciones.clear();
    this.erroresAceptacion.clear();
    this.lineas.clear({ emitEvent: false });
  }

  private tieneDatos(linea: LineaForm): boolean {
    return Object.values(linea.getRawValue()).some(value => value !== null);
  }

  guardarSoloTratamiento(): void {
    const identidad = this.identidadActual();
    if (this.guardando || this.resultadoIncierto || this.tratamientoIncierto || !identidad ||
      !this.puedeCrear || !Number.isSafeInteger(this.idConsulta) || this.idConsulta <= 0 ||
      !Number.isSafeInteger(this.idPaciente) || this.idPaciente <= 0) return;
    this.errorTratamiento = ''; this.avisoTratamiento = '';
    if (this.lineas.length) {
      this.errorTratamiento = 'Retire los medicamentos para guardar solo el tratamiento.'; return;
    }
    const datos = this.form.getRawValue();
    const descripcion = datos.descripcionTratamiento.trim().replace(/\s+/g, ' ');
    const indicaciones = datos.indicacionesGenerales.trim().replace(/\s+/g, ' ');
    const fechaValida = (fecha: string) => /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
      !Number.isNaN(Date.parse(fecha)) && new Date(fecha).toISOString().slice(0, 10) === fecha;
    if (!descripcion || descripcion.length > 300 || indicaciones.length > 300 ||
      !fechaValida(datos.fechaInicio) || (datos.fechaFin &&
        (!fechaValida(datos.fechaFin) || datos.fechaFin < datos.fechaInicio))) {
      this.form.controls.descripcionTratamiento.markAsTouched();
      this.form.controls.fechaInicio.markAsTouched();
      this.form.controls.fechaFin.markAsTouched();
      this.errorTratamiento = 'Revise la descripción, las indicaciones y las fechas del tratamiento.';
      return;
    }
    const request: TratamientoCreateDto = {
      idConsulta: this.idConsulta, descripcion, indicaciones: indicaciones || null,
      fechaInicio: datos.fechaInicio, fechaFin: datos.fechaFin || null,
      idLote: null, cantidad: null,
    };
    const paciente = this.idPaciente;
    const revision = ++this.revision;
    this.guardando = true; this.guardandoSoloTratamiento = true;
    this.escritura = this.historial.crearTratamiento(request).subscribe({
      next: tratamiento => {
        if (revision !== this.revision || identidad !== this.identidadActual() ||
          request.idConsulta !== this.idConsulta || paciente !== this.idPaciente) return;
        this.guardando = false; this.guardandoSoloTratamiento = false;
        if (!Number.isSafeInteger(tratamiento.idTratamiento) || tratamiento.idTratamiento <= 0 ||
          tratamiento.idConsulta !== request.idConsulta || tratamiento.idPaciente !== paciente ||
          tratamiento.descripcion !== descripcion || tratamiento.indicaciones !== request.indicaciones ||
          tratamiento.fechaInicio !== request.fechaInicio || tratamiento.fechaFin !== request.fechaFin ||
          tratamiento.idLote !== null || tratamiento.cantidad !== null) {
          this.tratamientoIncierto = true;
          this.errorTratamiento = 'La respuesta es inconsistente. Revise el listado antes de registrar otro tratamiento.';
          return;
        }
        this.form.controls.descripcionTratamiento.reset('');
        this.form.controls.indicacionesGenerales.reset('');
        this.form.controls.fechaInicio.reset('');
        this.form.controls.fechaFin.reset('');
        this.avisoTratamiento = 'Tratamiento guardado. No se creó una receta ni se descontó inventario.';
        this.tratamientoRegistrado.emit(tratamiento);
      },
      error: (err: unknown) => {
        if (revision !== this.revision || identidad !== this.identidadActual()) return;
        this.guardando = false; this.guardandoSoloTratamiento = false;
        if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500)) {
          this.tratamientoIncierto = true;
          this.errorTratamiento = 'Resultado incierto. Revise el listado antes de intentar otro registro; no se reintentó automáticamente.';
        } else {
          this.errorTratamiento = err instanceof HttpErrorResponse
            ? this.errores.messageFor(err, 'No fue posible guardar el tratamiento.')
            : 'No fue posible guardar el tratamiento.';
        }
      },
    });
  }

  solicitarConfirmacion(): void {
    this.error = '';
    if (this.guardando || this.tratamientoIncierto) return;
    if (!this.escrituraAisladaHabilitada) {
      this.error = 'La confirmación de recetas permanece pendiente de autorización operativa.'; return;
    }
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
      this.error = 'Agregue al menos un medicamento para confirmar una receta. Puede guardar solo el tratamiento con la acción independiente.'; return;
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
        !Number.isInteger(item.cantidadPrescritaUnidades) || item.cantidadPrescritaUnidades <= 0) {
        this.error = 'Verifique el medicamento y la cantidad indicada.'; return;
      }
      lineas.push({ idMedicamento: medicamento.idMedicamento, cantidadPrescritaUnidades: item.cantidadPrescritaUnidades });
    }
    if (new Set(lineas.map(l => l.idMedicamento)).size !== lineas.length) {
      this.error = 'Cada medicamento debe aparecer una sola vez en la receta.'; return;
    }
    if (this.lineas.controls.some(linea => !this.lineaAceptada(linea))) {
      this.error = 'Pulse Aceptar en cada medicamento antes de guardar.'; return;
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
    if (!this.escrituraAisladaHabilitada || !request || !identidad || this.guardando ||
      this.tratamientoIncierto || !this.puedeCrear || request.idConsulta !== this.idConsulta ||
      this.lineas.controls.some(linea => !this.lineaAceptada(linea))) return;
    this.guardando = true; this.error = ''; this.aviso = '';
    const revision = ++this.revision;
    this.escritura = this.historial.crearReceta(request).subscribe({
      next: receta => {
        if (revision !== this.revision || identidad !== this.identidadActual()) return;
        this.guardando = false; this.confirmacionAbierta = false;
        if (receta.idConsulta !== this.idConsulta || receta.idDiagnostico !== request.idDiagnostico ||
          receta.lineas.length !== request.lineas.length || receta.estado !== 'Vigente' ||
          receta.lineas.some((linea, i) => linea.idMedicamento !== request.lineas[i].idMedicamento ||
            linea.cantidadPrescritaUnidades !== request.lineas[i].cantidadPrescritaUnidades)) {
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
        if (err instanceof HttpErrorResponse && err.status === 503 &&
          err.error?.title === 'Confirmación de recetas no disponible') {
          this.error = 'La confirmación de recetas permanece bloqueada en el servidor. Los datos siguen en el formulario.';
        } else if (err instanceof HttpErrorResponse && (err.status === 0 || err.status >= 500)) {
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
    if (err.status === 400) return 'La receta contiene un dato inválido. Revise los campos indicados.';
    if (err.status === 409) return this.errores.messageFor(err,
      'La clave de operación está en conflicto. Revise el historial antes de continuar.');
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
    this.limpiarLineas();
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
    this.limpiarLineas();
    this.claveOperacion = null; this.ultimoEnvio = null; this.resultadoIncierto = false;
    this.confirmacionAbierta = false; this.medicamentoPendienteEliminar = null;
    this.cancelacionPendiente = false; this.guardando = false; this.guardandoSoloTratamiento = false;
    this.tratamientoIncierto = false; this.errorTratamiento = ''; this.avisoTratamiento = '';
    this.error = '';
  }

  private identidadActual(): string | null {
    const id = this.sesion.currentUser()?.idUsuario;
    return this.sesion.isAuthenticated() && id && this.sesion.token
      ? `${id}:${this.sesion.token}` : null;
  }

  ngOnDestroy(): void {
    this.revision++; this.escritura?.unsubscribe(); this.lecturas.unsubscribe();
    this.cambiosLinea.forEach(subscription => subscription.unsubscribe());
  }
}
