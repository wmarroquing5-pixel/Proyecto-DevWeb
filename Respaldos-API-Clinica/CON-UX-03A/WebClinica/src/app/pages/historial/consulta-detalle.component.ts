import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, Subscription, catchError, defer, expand, finalize, forkJoin, of, reduce, tap } from 'rxjs';
import { HistorialService } from '../../core/services/historial.service';
import {
  ConsultaDetalleDto,
  DiagnosticoResponse, CrearDiagnosticoRequest,
  HistorialMedicoResponseDto, HistorialMedicoCreateDto,
  TratamientoResponseDto,
  ConsumoClinicoResponseDto,
  ExamenResponseDto, ExamenCreateDto, PagedResponse
} from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { TratamientoFormComponent } from './tratamiento-form.component';
import { PacientesService } from '../../core/services/paciente.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PacienteResponse } from '../../core/models/paciente.model';
import { EmpleadoDetalleResponse } from '../../core/models/empleado.model';
import { Clinica, Sucursal } from '../../core/models/catalogos.model';

type ApartadoConsulta = 'evaluacion' | 'examenes' | 'diagnosticos' | 'tratamientos' | 'evoluciones' | 'hospitalizacion';

@Component({
    selector: 'app-consulta-detalle',
    imports: [CommonModule, RouterModule, FormsModule, TratamientoFormComponent],
    template: `
    <div class="container consulta-shell py-4">
      <header class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
        <div>
          <h1 class="h2 mb-1">Consulta médica</h1>
          <p class="text-muted mb-0">Atención clínica y registros asociados.</p>
        </div>
        <a [routerLink]="['/historial', idPaciente]" class="btn btn-secondary">
          <i class="bi bi-arrow-left me-1" aria-hidden="true"></i> Volver
        </a>
      </header>

      @if (cargando) {
        <div class="text-center py-5" role="status"><div class="spinner-border text-primary" aria-hidden="true"></div><span class="visually-hidden">Cargando consulta…</span></div>
      } @else if (error) {
        <div class="alert alert-danger" role="alert">{{ error }}</div>
      } @else if (consulta) {
        <section class="card shadow-sm mb-4 consulta-card" aria-label="Encabezado de atención">
          <div class="card-body">
            <div class="row g-3 align-items-start">
              <div class="col-12 col-lg-6">
                <span class="text-muted small">Paciente</span>
                <h2 class="h4 mb-0">{{ nombrePaciente }}</h2>
              </div>
              <div class="col-12 col-sm-6 col-lg-3"><span class="text-muted small">Fecha de consulta</span><div>{{ consulta.fechaConsulta | date:'dd/MM/yyyy HH:mm' }}</div></div>
              <div class="col-12 col-sm-6 col-lg-3"><span class="text-muted small">Médico responsable</span><div>{{ nombreMedico }}</div></div>
              <div class="col-12 col-sm-6"><span class="text-muted small">Sede de atención</span><div>{{ lugarAtencion }}</div></div>
              @if (consulta.motivoConsulta) {
                <div class="col-12 col-sm-6"><span class="text-muted small">Motivo de consulta</span><div>{{ consulta.motivoConsulta }}</div></div>
              }
            </div>
            @if (cargandoEncabezado) { <p class="text-muted small mt-3 mb-0" role="status">Cargando nombres relacionados…</p> }
            @if (errorEncabezado) { <p class="alert alert-warning mt-3 mb-0" role="alert">{{ errorEncabezado }}</p> }
          </div>
        </section>

        <nav class="nav nav-pills flex-nowrap gap-2 overflow-auto pb-2 consulta-tabs" role="tablist" aria-label="Apartados de la consulta">
          @for (apartado of apartados; track apartado.id) {
            <button type="button" class="nav-link consulta-tab" role="tab"
              [id]="'tab-' + apartado.id" [class.active]="tab === apartado.id"
              [attr.aria-selected]="tab === apartado.id" [attr.aria-controls]="'panel-' + apartado.id"
              [attr.tabindex]="tab === apartado.id ? 0 : -1"
              (click)="seleccionarTab(apartado.id)" (keydown)="navegarTabs($event, apartado.id)">
              <i class="bi me-1" [ngClass]="apartado.icono" aria-hidden="true"></i>{{ apartado.nombre }}
            </button>
          }
        </nav>

        @if (tab === 'evaluacion') {
          <section class="card shadow-sm mt-3 consulta-card" id="panel-evaluacion" role="tabpanel" aria-labelledby="tab-evaluacion" tabindex="0">
            <div class="card-header consulta-section-heading"><h3 class="h5 mb-0">Evaluación</h3></div>
            <div class="card-body">
              @if (!tieneEvaluacion) { <p class="text-muted mb-0">No hay datos de evaluación registrados.</p> }
              @else {
                <dl class="row g-2 mb-0">
                  @if (consulta.motivoConsulta) { <dt class="col-sm-4">Motivo de consulta</dt><dd class="col-sm-8">{{ consulta.motivoConsulta }}</dd> }
                  @if (consulta.sintomas) { <dt class="col-sm-4">Síntomas</dt><dd class="col-sm-8">{{ consulta.sintomas }}</dd> }
                  @if (consulta.observaciones) { <dt class="col-sm-4">Observaciones</dt><dd class="col-sm-8">{{ consulta.observaciones }}</dd> }
                  @if (consulta.pesoLb !== null) { <dt class="col-sm-4">Peso</dt><dd class="col-sm-8">{{ consulta.pesoLb }} lb</dd> }
                  @if (consulta.alturaCm !== null) { <dt class="col-sm-4">Altura</dt><dd class="col-sm-8">{{ consulta.alturaCm }} cm</dd> }
                  @if (consulta.presionSistolica !== null || consulta.presionDiastolica !== null) {
                    <dt class="col-sm-4">Presión arterial</dt><dd class="col-sm-8">{{ consulta.presionSistolica ?? '—' }}/{{ consulta.presionDiastolica ?? '—' }}</dd>
                  }
                </dl>
              }
            </div>
          </section>
        }

        <!-- DIAGNÓSTICOS -->
        @if (tab === 'diagnosticos') {
          <section class="card shadow-sm mt-3 consulta-card" id="panel-diagnosticos" role="tabpanel" aria-labelledby="tab-diagnosticos" tabindex="0">
            <div class="card-header consulta-section-heading"><h3 class="h5 mb-0">Diagnóstico</h3></div>
            <div class="card-body">
            @if (errorDiagnostico) { <div class="alert alert-danger" role="alert">{{ errorDiagnostico }}</div> }
            @if (avisoDiagnostico) { <div class="alert alert-success" role="status">{{ avisoDiagnostico }}</div> }
            @if (permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) {
              <form (ngSubmit)="agregarDiagnostico()" class="row g-2 mb-3">
                <div class="col-md-9">
                  <textarea class="form-control" [(ngModel)]="nuevoDiag.descripcion" name="descripcion" placeholder="Descripción del diagnóstico" required maxlength="300"></textarea>
                </div>
                <div class="col-md-3">
                  <button type="submit" class="btn btn-primary w-100" [disabled]="guardandoDiagnostico">
                    {{ guardandoDiagnostico ? 'Registrando...' : 'Agregar' }}
                  </button>
                </div>
              </form>
            }
            @if (cargandoDiagnosticos) { <div class="text-muted" role="status">Cargando diagnósticos…</div> }
            @else if (errorDiagnosticos) { <div class="alert alert-warning" role="alert">{{ errorDiagnosticos }}</div> }
            @else if (diagnosticos.length === 0) { <div class="text-muted">No hay diagnósticos registrados.</div> }
            @else {
              @for (d of diagnosticos; track d.idDiagnostico) {
                <div class="border-bottom py-2">
                  <strong>{{ d.descripcion }}</strong>
                  <small class="text-muted ms-2">{{ d.fechaRegistro | date:'dd/MM/yyyy HH:mm' }}</small>
                </div>
              }
            }
            </div>
          </section>
        }

        <!-- TRATAMIENTOS -->
        @if (tab === 'tratamientos') {
          <section class="card shadow-sm mt-3 consulta-card" id="panel-tratamientos" role="tabpanel" aria-labelledby="tab-tratamientos" tabindex="0">
            <div class="card-header consulta-section-heading"><h3 class="h5 mb-0">Tratamiento</h3></div>
            <div class="card-body">
            @if (errorTratamientos) {
              <div class="alert alert-warning" role="alert">{{ errorTratamientos }}</div>
            }
            @if (avisoConsumo) {
              <div class="alert alert-success" role="status">{{ avisoConsumo }}</div>
            }
            @if (permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) {
              <app-tratamiento-form [idConsulta]="idConsulta" [idPaciente]="idPaciente"
                [revisionStock]="revisionStock" (registrado)="onTratamientoRegistrado($event)">
              </app-tratamiento-form>
            }
            @if (!errorTratamientos && tratamientos.length === 0) {
              <p class="text-muted">No hay tratamientos registrados.</p>
            }
            @for (t of tratamientos; track t.idTratamiento) {
              <div class="border-bottom py-2">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <strong>{{ t.descripcion }}</strong>
                    <small class="text-muted ms-2">({{ t.fechaInicio }} {{ t.fechaFin ? 'hasta ' + t.fechaFin : '' }})</small>
                    @if (t.idLote) {
                      <div class="small text-muted">Lote #{{ t.idLote }} · Cantidad indicada: {{ t.cantidad ?? 'no especificada' }}</div>
                    }
                  </div>
                  @if (t.idLote && permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO)) {
                    <button type="button" class="btn btn-outline-primary btn-sm"
                            [disabled]="guardandoConsumo" (click)="abrirConsumo(t)">
                      Registrar consumo
                    </button>
                  }
                </div>
                @if (tratamientoConsumo?.idTratamiento === t.idTratamiento) {
                  <form class="row g-2 mt-2 align-items-end" (ngSubmit)="registrarConsumo()">
                    <div class="col-sm-4">
                      <label class="form-label" [for]="'consumo-' + t.idTratamiento">Cantidad consumida *</label>
                      <input class="form-control" type="number" min="1" step="1" required
                             [id]="'consumo-' + t.idTratamiento" name="cantidadConsumo"
                             [(ngModel)]="cantidadConsumo">
                    </div>
                    <div class="col-sm-8 d-flex gap-2">
                      <button type="submit" class="btn btn-primary" [disabled]="guardandoConsumo">
                        {{ guardandoConsumo ? 'Registrando...' : 'Confirmar consumo' }}
                      </button>
                      <button type="button" class="btn btn-secondary" [disabled]="guardandoConsumo"
                              (click)="cerrarConsumo()">Cancelar</button>
                    </div>
                    <div class="col-12 small text-muted">Cada confirmación registra una salida nueva. Se permiten consumos parciales o repetidos; la cantidad indicada no es un saldo pendiente.</div>
                    @if (errorConsumo) {
                      <div class="col-12"><div class="alert alert-danger mb-0" role="alert">{{ errorConsumo }}</div></div>
                    }
                  </form>
                }
              </div>
            }
            </div>
          </section>
        }

        <!-- EXÁMENES -->
        @if (tab === 'examenes') {
          <section class="card shadow-sm mt-3 consulta-card" id="panel-examenes" role="tabpanel" aria-labelledby="tab-examenes" tabindex="0">
            <div class="card-header consulta-section-heading"><h3 class="h5 mb-0">Exámenes</h3></div>
            <div class="card-body">
            @if (permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) {
              <form (ngSubmit)="agregarExamen()" class="row g-2 mb-3">
                <div class="col-md-6"><input type="text" class="form-control" [(ngModel)]="nuevoExamen.nombreExamen" name="nombreExamen" placeholder="Nombre del examen" required></div>
                <div class="col-md-3"><input type="datetime-local" class="form-control" [(ngModel)]="nuevoExamen.fechaExamen" name="fechaExamen" required></div>
                <div class="col-md-3"><button type="submit" class="btn btn-primary w-100">Agregar</button></div>
              </form>
            }
            @if (cargandoExamenes) { <p class="text-muted" role="status">Cargando exámenes…</p> }
            @else if (errorExamenes) { <div class="alert alert-warning" role="alert">{{ errorExamenes }}</div> }
            @else if (examenes.length === 0) { <p class="text-muted">No hay exámenes registrados.</p> }
            @for (e of examenes; track e.idExamen) {
              <div class="border-bottom py-2">
                <strong>{{ e.nombreExamen }}</strong>
                <small class="text-muted ms-2">{{ e.fechaExamen | date:'dd/MM/yyyy HH:mm' }}</small>
                @if (e.prioridad) { <span class="badge ms-2" [class.bg-danger]="e.prioridad==='Alta'" [class.bg-warning]="e.prioridad==='Media'" [class.bg-success]="e.prioridad==='Baja'">{{ e.prioridad }}</span> }
              </div>
            }
            </div>
          </section>
        }

        <!-- EVOLUCIONES -->
        @if (tab === 'evoluciones') {
          <section class="card shadow-sm mt-3 consulta-card" id="panel-evoluciones" role="tabpanel" aria-labelledby="tab-evoluciones" tabindex="0">
            <div class="card-header consulta-section-heading"><h3 class="h5 mb-0">Evolución</h3></div>
            <div class="card-body">
            @if (cargandoEvoluciones) { <div class="text-muted" role="status">Cargando evoluciones…</div> }
            @if (errorEvoluciones) { <div class="alert alert-warning" role="alert">{{ errorEvoluciones }}</div> }
            @if (permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) {
              @if (diagnosticos.length === 0) {
                <div class="alert alert-warning">Debes crear al menos un diagnóstico antes de agregar evoluciones.</div>
              } @else {
                <form (ngSubmit)="agregarEvolucion()" class="row g-2 mb-3">
                  <div class="col-md-4">
                    <select class="form-select" [(ngModel)]="nuevaEvol.idDiagnostico" name="idDiagnostico" required>
                      <option [ngValue]="null">Seleccione diagnóstico...</option>
                      @for (d of diagnosticos; track d.idDiagnostico) {
                        <option [ngValue]="d.idDiagnostico">#{{ d.idDiagnostico }} - {{ d.descripcion | slice:0:50 }}</option>
                      }
                    </select>
                  </div>
                  <div class="col-md-6"><textarea class="form-control" [(ngModel)]="nuevaEvol.descripcion" name="descripcion" placeholder="Descripción de la evolución" required></textarea></div>
                  <div class="col-md-2"><button type="submit" class="btn btn-primary w-100">Agregar</button></div>
                </form>
              }
            }
            @if (!cargandoEvoluciones && !errorEvoluciones && evoluciones.length === 0) {
              <p class="text-muted">No hay evoluciones registradas.</p>
            }
            @for (h of evoluciones; track h.idHistorial) {
              <div class="border-bottom py-2">
                <strong>{{ h.descripcion }}</strong>
                <small class="text-muted ms-2">{{ h.fechaHistorial | date:'dd/MM/yyyy HH:mm' }}</small>
              </div>
            }
            </div>
          </section>
        }

        @if (tab === 'hospitalizacion') {
          <section class="card shadow-sm mt-3 consulta-card" id="panel-hospitalizacion" role="tabpanel" aria-labelledby="tab-hospitalizacion" tabindex="0">
            <div class="card-header consulta-section-heading"><h3 class="h5 mb-0">Hospitalización <span class="badge text-bg-secondary ms-2">Opcional</span></h3></div>
            <div class="card-body">
              <p class="text-muted mb-0">No hay información de hospitalización vinculada a esta consulta. Las asignaciones de habitación se registran por paciente y no identifican una consulta concreta.</p>
            </div>
          </section>
        }
      }
    </div>
  `,
    styles: [`
      .consulta-shell { color: #102746; }
      .consulta-card { border: 1px solid #d8e4ef; border-radius: .6rem; }
      .consulta-section-heading { background: #edf4f9; border-bottom-color: #d8e4ef; color: #0e2749; }
      .consulta-tab { white-space: nowrap; border: 1px solid #cbd9e7; color: #173b64; }
      .consulta-tab.active { background: #0d6efd; border-color: #0d6efd; color: #fff; }
      .consulta-tab:focus-visible { outline: 3px solid #174d9b; outline-offset: 2px; }
    `]
})
export class ConsultaDetalleComponent implements OnInit {
  private service = inject(HistorialService);
  private pacientesService = inject(PacientesService);
  private empleadosService = inject(EmpleadosService);
  private catalogosService = inject(CatalogosService);
  private route = inject(ActivatedRoute);
  private session = inject(AuthSessionService);
  private apiErrors = inject(ApiErrorService);
  private destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;

  idPaciente!: number;
  idConsulta!: number;
  consulta: ConsultaDetalleDto | null = null;
  paciente: PacienteResponse | null = null;
  medico: EmpleadoDetalleResponse | null = null;
  sucursal: Sucursal | null = null;
  clinica: Clinica | null = null;
  cargandoEncabezado = false;
  errorEncabezado = '';
  cargando = false;
  error = '';
  readonly apartados: ReadonlyArray<{ id: ApartadoConsulta; nombre: string; icono: string }> = [
    { id: 'evaluacion', nombre: 'Evaluación', icono: 'bi-clipboard2-pulse' },
    { id: 'examenes', nombre: 'Exámenes', icono: 'bi-file-medical' },
    { id: 'diagnosticos', nombre: 'Diagnóstico', icono: 'bi-heart-pulse' },
    { id: 'tratamientos', nombre: 'Tratamiento', icono: 'bi-capsule' },
    { id: 'evoluciones', nombre: 'Evolución', icono: 'bi-graph-up' },
    { id: 'hospitalizacion', nombre: 'Hospitalización', icono: 'bi-hospital' },
  ];
  tab: ApartadoConsulta = 'evaluacion';

  diagnosticos: DiagnosticoResponse[] = [];
  tratamientos: TratamientoResponseDto[] = [];
  examenes: ExamenResponseDto[] = [];
  cargandoExamenes = false;
  errorExamenes = '';
  evoluciones: HistorialMedicoResponseDto[] = [];
  tratamientoConsumo: TratamientoResponseDto | null = null;
  cantidadConsumo = 1;
  guardandoConsumo = false;
  errorConsumo = '';
  avisoConsumo = '';
  errorTratamientos = '';
  revisionStock = 0;
  private lecturaTratamientos?: Subscription;
  private revisionTratamientos = 0;
  private solicitudConsumo?: Subscription;
  private revisionConsumo = 0;
  private identidadConsumoObservada: string | null | undefined;
  guardandoDiagnostico = false;
  errorDiagnostico = '';
  avisoDiagnostico = '';
  cargandoDiagnosticos = false;
  errorDiagnosticos = '';
  cargandoEvoluciones = false;
  errorEvoluciones = '';
  private lecturaConsulta?: Subscription;
  private lecturaEncabezado?: Subscription;
  private lecturaExamenes?: Subscription;
  private lecturaDiagnosticos?: Subscription;
  private lecturaEvoluciones?: Subscription;
  private solicitudDiagnostico?: Subscription;
  private revisionConsulta = 0;
  private revisionEncabezado = 0;
  private revisionExamenes = 0;
  private revisionDiagnosticos = 0;
  private revisionEvoluciones = 0;
  private revisionDiagnostico = 0;
  private contextoLecturaObservado: string | null | undefined;
  private permisosEncabezadoObservados: string | undefined;
  private crearDiagnosticoObservado: boolean | undefined;

  nuevoDiag: CrearDiagnosticoRequest = { idConsulta: 0, idMedico: null, descripcion: '' };
  nuevoExamen: ExamenCreateDto = { idConsulta: null, idDiagnostico: null, idTurno: null, nombreExamen: '', fechaExamen: '', fechaResultado: null, prioridad: null };
  nuevaEvol: HistorialMedicoCreateDto = { idPaciente: 0, idConsulta: 0, idDiagnostico: null, descripcion: '' };

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const contextoLectura = this.contextoLecturaActual();
      const permisosEncabezado = this.permisosEncabezado();
      const cambioPermisosEncabezado = this.permisosEncabezadoObservados !== undefined
        && this.permisosEncabezadoObservados !== permisosEncabezado;
      this.permisosEncabezadoObservados = permisosEncabezado;
      const cambioLectura = this.contextoLecturaObservado !== undefined
        && this.contextoLecturaObservado !== contextoLectura;
      this.contextoLecturaObservado = contextoLectura;
      const crearDiagnostico = this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL);
      const revocoDiagnostico = this.crearDiagnosticoObservado !== undefined
        && this.crearDiagnosticoObservado && !crearDiagnostico;
      this.crearDiagnosticoObservado = crearDiagnostico;
      const cambioIdentidad = this.identidadConsumoObservada !== undefined
        && this.identidadConsumoObservada !== identidad;
      this.identidadConsumoObservada = identidad;
      if (!identidad || cambioIdentidad
        || !this.permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO)) {
        this.cancelarConsumoProtegido();
      }
      if (!identidad || cambioIdentidad) {
        this.revisionTratamientos++;
        this.lecturaTratamientos?.unsubscribe();
        this.tratamientos = [];
      }
      if (!contextoLectura || cambioLectura) {
        this.cancelarLecturasClinicas();
      } else if (cambioPermisosEncabezado && this.consulta) {
        this.cargarEncabezado(this.consulta);
      }
      if (!identidad || cambioIdentidad || revocoDiagnostico) this.cancelarDiagnosticoProtegido();
    });
  }

  ngOnInit() {
    this.idPaciente = +this.route.snapshot.paramMap.get('id')!;
    this.idConsulta = +this.route.snapshot.paramMap.get('idConsulta')!;
    this.nuevoDiag.idConsulta = this.idConsulta;
    this.nuevoExamen.idConsulta = this.idConsulta;
    this.nuevaEvol.idPaciente = this.idPaciente;
    this.nuevaEvol.idConsulta = this.idConsulta;
    this.cargarTodo();
  }

  cargarTodo() {
    this.lecturaConsulta?.unsubscribe();
    this.cancelarEncabezado();
    this.cancelarExamenes();
    const revision = ++this.revisionConsulta;
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    if (!contexto || !this.idValido(consulta) || !this.idValido(paciente)) {
      this.consulta = null; this.error = 'No se puede leer la consulta con la sesión, permisos e identificadores actuales.'; return;
    }
    this.cargando = true;
    this.error = '';
    this.consulta = null;
    this.lecturaConsulta = this.service.obtenerConsulta(consulta).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (c) => {
        if (revision !== this.revisionConsulta || contexto !== this.contextoLecturaActual()
          || consulta !== this.idConsulta || paciente !== this.idPaciente) return;
        if (c.idConsulta !== consulta || c.idPaciente !== paciente) {
          this.consulta = null; this.cargando = false;
          this.error = 'La API devolvió una consulta que no corresponde al paciente solicitado.'; return;
        }
        this.consulta = c;
        this.cargando = false;
        this.cargarEncabezado(c);
        this.cargarSecciones();
      },
      error: (err: HttpErrorResponse) => {
        if (revision !== this.revisionConsulta || contexto !== this.contextoLecturaActual()) return;
        this.error = this.apiErrors.messageFor(err, 'No se pudo cargar la consulta'); this.cargando = false;
      }
    });
  }

  cargarSecciones() {
    this.cargarDiagnosticos();
    this.recargarTratamientos();
    this.cargarExamenes();
    this.cargarEvoluciones();
  }

  seleccionarTab(apartado: ApartadoConsulta): void {
    this.tab = apartado;
  }

  navegarTabs(event: KeyboardEvent, apartado: ApartadoConsulta): void {
    const indice = this.apartados.findIndex(item => item.id === apartado);
    const ultimo = this.apartados.length - 1;
    let destino = indice;
    if (event.key === 'ArrowRight') destino = (indice + 1) % this.apartados.length;
    else if (event.key === 'ArrowLeft') destino = (indice + ultimo) % this.apartados.length;
    else if (event.key === 'Home') destino = 0;
    else if (event.key === 'End') destino = ultimo;
    else return;
    event.preventDefault();
    this.seleccionarTab(this.apartados[destino].id);
    const tablist = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
    tablist?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[destino]?.focus();
  }

  get nombrePaciente(): string {
    return this.paciente ? `${this.paciente.nombres.trim()} ${this.paciente.apellidos.trim()}` : 'Paciente no disponible';
  }

  get nombreMedico(): string {
    return this.medico ? `${this.medico.nombres.trim()} ${this.medico.apellidos.trim()}` : 'Médico no disponible';
  }

  get lugarAtencion(): string {
    return this.clinica?.nombreClinica?.trim() || this.sucursal?.nombre?.trim() || 'Sede no disponible';
  }

  get tieneEvaluacion(): boolean {
    const c = this.consulta;
    return !!(c && (c.motivoConsulta || c.sintomas || c.observaciones
      || c.pesoLb !== null || c.alturaCm !== null
      || c.presionSistolica !== null || c.presionDiastolica !== null));
  }

  private permisosEncabezado(): string {
    return [MODULOS_PERMISO.PACIENTES, MODULOS_PERMISO.EMPLEADOS,
      MODULOS_PERMISO.SUCURSALES, MODULOS_PERMISO.CLINICAS]
      .map(modulo => this.permisos.puedeConsultar(modulo) ? '1' : '0').join('');
  }

  private cargarEncabezado(consulta: ConsultaDetalleDto): void {
    this.cancelarEncabezado();
    const revision = this.revisionEncabezado;
    const contexto = this.contextoLecturaActual();
    const paciente = this.idPaciente;
    const idConsulta = this.idConsulta;
    if (!contexto || consulta.idConsulta !== idConsulta || consulta.idPaciente !== paciente) return;
    const fallos: string[] = [];
    const leer = <T>(source: Observable<T>, nombre: string): Observable<T | null> => source.pipe(
      catchError(() => { fallos.push(nombre); return of(null); }),
    );
    this.cargandoEncabezado = true;
    this.lecturaEncabezado = forkJoin({
      paciente: this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)
        ? leer(this.pacientesService.obtener(paciente), 'paciente') : of(null),
      medico: this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)
        ? leer(this.empleadosService.obtener(consulta.idMedico), 'médico') : of(null),
      sucursal: this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)
        ? leer(this.catalogosService.obtenerSucursal(consulta.idSucursal), 'sucursal') : of(null),
      clinica: consulta.idClinica && this.permisos.puedeConsultar(MODULOS_PERMISO.CLINICAS)
        ? leer(this.catalogosService.obtenerClinica(consulta.idClinica), 'clínica') : of(null),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(datos => {
      if (revision !== this.revisionEncabezado || contexto !== this.contextoLecturaActual()
        || idConsulta !== this.idConsulta || paciente !== this.idPaciente) return;
      this.paciente = this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)
        && datos.paciente?.idPaciente === paciente && datos.paciente.nombres?.trim()
        && datos.paciente.apellidos?.trim() ? datos.paciente : null;
      this.medico = this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)
        && datos.medico?.idEmpleado === consulta.idMedico && datos.medico.nombres?.trim()
        && datos.medico.apellidos?.trim() ? datos.medico : null;
      this.sucursal = this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)
        && datos.sucursal?.idSucursal === consulta.idSucursal && datos.sucursal.nombre?.trim()
        ? datos.sucursal : null;
      this.clinica = this.permisos.puedeConsultar(MODULOS_PERMISO.CLINICAS)
        && datos.clinica?.idClinica === consulta.idClinica
        && datos.clinica.idSucursal === consulta.idSucursal && datos.clinica.nombreClinica?.trim()
        ? datos.clinica : null;
      this.cargandoEncabezado = false;
      if (fallos.length) this.errorEncabezado = `No se pudieron cargar los nombres de: ${fallos.join(', ')}.`;
      else if ((datos.paciente && !this.paciente) || (datos.medico && !this.medico)
        || (datos.sucursal && !this.sucursal) || (datos.clinica && !this.clinica))
        this.errorEncabezado = 'La API devolvió datos descriptivos contradictorios.';
    });
  }

  private cancelarEncabezado(): void {
    this.revisionEncabezado++;
    this.lecturaEncabezado?.unsubscribe();
    this.lecturaEncabezado = undefined;
    this.paciente = null; this.medico = null; this.sucursal = null; this.clinica = null;
    this.cargandoEncabezado = false; this.errorEncabezado = '';
  }

  private cargarExamenes(): void {
    this.cancelarExamenes();
    const revision = this.revisionExamenes;
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    if (!contexto || this.consulta?.idConsulta !== consulta || this.consulta.idPaciente !== paciente) return;
    this.cargandoExamenes = true;
    this.lecturaExamenes = this.cargarPaginasClinicas(
      page => this.service.listarExamenes({ idConsulta: consulta, page, pageSize: 100 }),
      item => item.idExamen,
      item => item.idConsulta === consulta && item.idPaciente === paciente,
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        if (!this.lecturaVigente(revision, this.revisionExamenes, contexto, consulta, paciente)) return;
        this.examenes = items; this.cargandoExamenes = false;
      },
      error: (err: HttpErrorResponse | Error) => {
        if (!this.lecturaVigente(revision, this.revisionExamenes, contexto, consulta, paciente)) return;
        this.examenes = []; this.cargandoExamenes = false;
        this.errorExamenes = err instanceof HttpErrorResponse
          ? this.apiErrors.messageFor(err, 'No fue posible leer todos los exámenes.') : err.message;
      },
    });
  }

  private cancelarExamenes(): void {
    this.revisionExamenes++;
    this.lecturaExamenes?.unsubscribe();
    this.lecturaExamenes = undefined;
    this.examenes = []; this.cargandoExamenes = false; this.errorExamenes = '';
  }

  agregarDiagnostico() {
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    const descripcion = this.nuevoDiag.descripcion?.trim() ?? '';
    if (this.guardandoDiagnostico) return;
    if (!contexto || !this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)
      || !this.consulta || this.consulta.idConsulta !== consulta || this.consulta.idPaciente !== paciente) {
      this.errorDiagnostico = 'Verifique la consulta, la sesión y el permiso Historial/Crear antes de registrar.'; return;
    }
    if (!descripcion || descripcion.length > 300) {
      this.errorDiagnostico = 'La descripción del diagnóstico debe contener entre 1 y 300 caracteres.'; return;
    }
    const request: CrearDiagnosticoRequest = { idConsulta: consulta, idMedico: null, descripcion };
    const revision = ++this.revisionDiagnostico;
    this.guardandoDiagnostico = true;
    this.errorDiagnostico = '';
    this.avisoDiagnostico = '';
    this.solicitudDiagnostico = this.service.crearDiagnostico(request).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionDiagnostico) this.guardandoDiagnostico = false;
      }),
    ).subscribe({
      next: diagnostico => {
        if (!this.respuestaDiagnosticoVigente(revision, contexto, consulta, paciente)) return;
        if (!diagnostico || !this.idValido(diagnostico.idDiagnostico) || diagnostico.idConsulta !== consulta
          || !this.idValido(diagnostico.idMedico) || !diagnostico.descripcion?.trim()
          || !Number.isFinite(Date.parse(diagnostico.fechaRegistro))) {
          this.errorDiagnostico = 'Resultado incierto: la confirmación del diagnóstico es inconsistente. Verifique el historial antes de repetir.'; return;
        }
        this.nuevoDiag.descripcion = '';
        this.avisoDiagnostico = `Diagnóstico #${diagnostico.idDiagnostico} confirmado.`;
        this.cargarDiagnosticos();
      },
      error: (err: HttpErrorResponse) => {
        if (!this.respuestaDiagnosticoVigente(revision, contexto, consulta, paciente)) return;
        this.errorDiagnostico = this.apiErrors.messageFor(err, 'No fue posible registrar el diagnóstico.');
        if (err.status === 401) this.errorDiagnostico = 'La sesión expiró. Inicie sesión nuevamente.';
        if (err.status === 0 || err.status >= 500) this.errorDiagnostico =
          'Resultado incierto: verifique el historial antes de registrar otra vez. No se reintentó automáticamente.';
      },
    });
  }

  private cargarDiagnosticos(): void {
    this.lecturaDiagnosticos?.unsubscribe();
    const revision = ++this.revisionDiagnosticos;
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    this.diagnosticos = [];
    this.errorDiagnosticos = '';
    if (!contexto || !this.consulta || this.consulta.idConsulta !== consulta || this.consulta.idPaciente !== paciente) {
      this.cargandoDiagnosticos = false; return;
    }
    this.cargandoDiagnosticos = true;
    this.lecturaDiagnosticos = this.cargarPaginasClinicas(
      page => this.service.listarDiagnosticos({ idConsulta: consulta, page, pageSize: 100 }),
      item => item.idDiagnostico,
      item => item.idConsulta === consulta,
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        if (!this.lecturaVigente(revision, this.revisionDiagnosticos, contexto, consulta, paciente)) return;
        this.diagnosticos = items; this.cargandoDiagnosticos = false;
      },
      error: (err: HttpErrorResponse | Error) => {
        if (!this.lecturaVigente(revision, this.revisionDiagnosticos, contexto, consulta, paciente)) return;
        this.diagnosticos = []; this.cargandoDiagnosticos = false;
        this.errorDiagnosticos = err instanceof HttpErrorResponse
          ? this.apiErrors.messageFor(err, 'No fue posible leer todos los diagnósticos.')
          : err.message;
      },
    });
  }

  private cargarEvoluciones(): void {
    this.lecturaEvoluciones?.unsubscribe();
    const revision = ++this.revisionEvoluciones;
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    this.evoluciones = [];
    this.errorEvoluciones = '';
    if (!contexto || !this.consulta || this.consulta.idConsulta !== consulta || this.consulta.idPaciente !== paciente) {
      this.cargandoEvoluciones = false; return;
    }
    this.cargandoEvoluciones = true;
    this.lecturaEvoluciones = this.cargarPaginasClinicas(
      page => this.service.listarHistorial({ idConsulta: consulta, page, pageSize: 100 }),
      item => item.idHistorial ?? 0,
      item => item.idConsulta === consulta && item.idPaciente === paciente,
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: items => {
        if (!this.lecturaVigente(revision, this.revisionEvoluciones, contexto, consulta, paciente)) return;
        this.evoluciones = [...items].sort((a, b) =>
          Date.parse(a.fechaHistorial) - Date.parse(b.fechaHistorial)
          || (a.idHistorial ?? 0) - (b.idHistorial ?? 0));
        this.cargandoEvoluciones = false;
      },
      error: (err: HttpErrorResponse | Error) => {
        if (!this.lecturaVigente(revision, this.revisionEvoluciones, contexto, consulta, paciente)) return;
        this.evoluciones = []; this.cargandoEvoluciones = false;
        this.errorEvoluciones = err instanceof HttpErrorResponse
          ? this.apiErrors.messageFor(err, 'No fue posible leer todas las evoluciones.')
          : err.message;
      },
    });
  }

  private cargarPaginasClinicas<T>(
    solicitar: (page: number) => Observable<PagedResponse<T>>,
    obtenerId: (item: T) => number,
    pertenece: (item: T) => boolean,
  ): Observable<T[]> {
    return defer(() => {
      const ids = new Set<number>();
      let total: number | undefined;
      let totalPages: number | undefined;
      const leer = (page: number) => defer(() => solicitar(page)).pipe(tap(res => {
        const paginas = Math.ceil(res.totalCount / 100);
        const esperados = Math.min(100, Math.max(0, res.totalCount - (page - 1) * 100));
        if (!Array.isArray(res.items) || res.page !== page || res.pageSize !== 100
          || !Number.isSafeInteger(res.totalCount) || res.totalCount < 0 || res.totalPages !== paginas
          || res.items.length !== esperados || (total !== undefined && total !== res.totalCount)
          || (totalPages !== undefined && totalPages !== res.totalPages)) {
          throw new Error('La API devolvió paginación clínica contradictoria. Recargue la consulta.');
        }
        total = res.totalCount; totalPages = res.totalPages;
        for (const item of res.items) {
          const id = obtenerId(item);
          if (!this.idValido(id) || ids.has(id) || !pertenece(item)) {
            throw new Error('La API devolvió registros clínicos duplicados o de otra consulta.');
          }
          ids.add(id);
        }
      }));
      return leer(1).pipe(
        expand(res => res.page < res.totalPages ? leer(res.page + 1) : EMPTY),
        reduce((items, res) => items.concat(res.items), [] as T[]),
      );
    });
  }

  private lecturaVigente(revision: number, actual: number, contexto: string,
    consulta: number, paciente: number): boolean {
    return revision === actual && contexto === this.contextoLecturaActual()
      && consulta === this.idConsulta && paciente === this.idPaciente;
  }

  private respuestaDiagnosticoVigente(revision: number, contexto: string,
    consulta: number, paciente: number): boolean {
    return revision === this.revisionDiagnostico && contexto === this.contextoLecturaActual()
      && consulta === this.idConsulta && paciente === this.idPaciente
      && this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL);
  }

  onTratamientoRegistrado(tratamiento: TratamientoResponseDto): void {
    if (tratamiento.idConsulta !== this.idConsulta || tratamiento.idPaciente !== this.idPaciente) return;
    this.tratamientos = [...this.tratamientos.filter(t => t.idTratamiento !== tratamiento.idTratamiento), tratamiento];
    this.releerTratamiento(tratamiento.idTratamiento);
  }

  private releerTratamiento(id: number): void {
    const identidad = this.identidadActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    const revision = ++this.revisionTratamientos;
    this.lecturaTratamientos?.unsubscribe();
    this.errorTratamientos = '';
    this.lecturaTratamientos = this.service.obtenerTratamiento(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: tratamiento => {
        if (revision !== this.revisionTratamientos || identidad !== this.identidadActual()
          || consulta !== this.idConsulta || paciente !== this.idPaciente) return;
        if (tratamiento.idTratamiento !== id || tratamiento.idConsulta !== consulta || tratamiento.idPaciente !== paciente) {
          this.errorTratamientos = 'La relectura del tratamiento es inconsistente.'; return;
        }
        this.tratamientos = this.tratamientos.map(t => t.idTratamiento === id ? tratamiento : t);
      },
      error: (e: HttpErrorResponse) => {
        if (revision === this.revisionTratamientos && identidad === this.identidadActual())
          this.errorTratamientos = this.apiErrors.messageFor(e, 'La operación fue confirmada, pero no fue posible releer el tratamiento.');
      },
    });
  }

  private recargarTratamientos(): void {
    const identidad = this.identidadActual();
    const consulta = this.idConsulta;
    const revision = ++this.revisionTratamientos;
    this.lecturaTratamientos?.unsubscribe();
    this.errorTratamientos = '';
    this.lecturaTratamientos = this.service.listarTratamientos({ idConsulta: consulta, page: 1, pageSize: 100 }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: r => {
        if (revision === this.revisionTratamientos && identidad === this.identidadActual() && consulta === this.idConsulta) this.tratamientos = r.items;
      },
      error: (e: HttpErrorResponse) => {
        if (revision === this.revisionTratamientos && identidad === this.identidadActual())
          this.errorTratamientos = this.apiErrors.messageFor(e, 'No fue posible releer los tratamientos.');
      },
    });
  }

  agregarExamen() {
    this.service.crearExamen(this.nuevoExamen).subscribe({
      next: () => { this.nuevoExamen.nombreExamen = ''; this.nuevoExamen.fechaExamen = ''; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear examen')
    });
  }

  agregarEvolucion() {
    this.service.crearEvolucion(this.nuevaEvol).subscribe({
      next: () => { this.nuevaEvol.descripcion = ''; this.nuevaEvol.idDiagnostico = null; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear evolución')
    });
  }

  abrirConsumo(tratamiento: TratamientoResponseDto): void {
    if (!Number.isSafeInteger(tratamiento.idTratamiento) || tratamiento.idTratamiento <= 0
      || !Number.isSafeInteger(tratamiento.idLote) || !tratamiento.idLote || tratamiento.idLote <= 0 || tratamiento.idConsulta !== this.idConsulta
      || tratamiento.idPaciente !== this.idPaciente || !this.identidadActual() || this.guardandoConsumo
      || !this.permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO)) return;
    this.tratamientoConsumo = tratamiento;
    this.cantidadConsumo = tratamiento.cantidad && tratamiento.cantidad > 0
      ? tratamiento.cantidad : 1;
    this.errorConsumo = '';
    this.avisoConsumo = '';
  }

  cerrarConsumo(): void {
    if (this.guardandoConsumo) return;
    this.tratamientoConsumo = null;
    this.cantidadConsumo = 1;
    this.errorConsumo = '';
  }

  registrarConsumo(): void {
    const tratamiento = this.tratamientoConsumo;
    const identidad = this.identidadActual();
    if (!tratamiento || !Number.isSafeInteger(tratamiento.idTratamiento) || tratamiento.idTratamiento <= 0
      || !Number.isSafeInteger(tratamiento.idLote) || !tratamiento.idLote || tratamiento.idLote <= 0 || tratamiento.idConsulta !== this.idConsulta
      || tratamiento.idPaciente !== this.idPaciente || !identidad || this.guardandoConsumo
      || !this.permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO)) return;
    if (!Number.isInteger(Number(this.cantidadConsumo)) || Number(this.cantidadConsumo) <= 0 || Number(this.cantidadConsumo) > 2147483647) {
      this.errorConsumo = 'La cantidad consumida debe ser un entero mayor que cero.';
      return;
    }
    if (!confirm(`¿Registrar el consumo de ${this.cantidadConsumo} unidades del lote #${tratamiento.idLote}?`)) {
      return;
    }

    const revision = ++this.revisionConsumo;
    const cantidad = Number(this.cantidadConsumo);
    this.guardandoConsumo = true;
    this.errorConsumo = '';
    this.solicitudConsumo = this.service.registrarConsumoClinico(
      tratamiento.idTratamiento,
      { cantidad },
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionConsumo) this.guardandoConsumo = false;
      }),
    ).subscribe({
      next: (response: ConsumoClinicoResponseDto) => {
        if (!this.respuestaConsumoVigente(revision, identidad, tratamiento.idTratamiento)) return;
        if (!response || !Number.isSafeInteger(response.idMovimiento) || response.idMovimiento <= 0
          || response.idTratamiento !== tratamiento.idTratamiento || response.idLote !== tratamiento.idLote
          || response.cantidad !== cantidad || response.idSucursal !== this.consulta?.idSucursal
          || !Number.isFinite(Date.parse(response.fechaMovimiento))) {
          this.errorConsumo = 'Resultado incierto: la confirmación es inconsistente. Verifica los movimientos antes de repetir el consumo.';
          return;
        }
        this.avisoConsumo = `Salida clínica #${response.idMovimiento} confirmada: ${response.cantidad} unidades del lote #${response.idLote}, sucursal #${response.idSucursal}, ${this.formatearFecha(response.fechaMovimiento)}.`;
        this.tratamientoConsumo = null;
        this.cantidadConsumo = 1;
        this.revisionStock++;
        this.releerTratamiento(tratamiento.idTratamiento);
      },
      error: (error: HttpErrorResponse) => {
        if (!this.respuestaConsumoVigente(revision, identidad, tratamiento.idTratamiento)) return;
        this.errorConsumo = this.apiErrors.messageFor(
          error,
          'No fue posible registrar el consumo clínico.',
        );
        if (error.status === 401) this.errorConsumo = 'La sesión expiró. Inicia sesión nuevamente.';
        if (error.status === 0 || error.status >= 500) this.errorConsumo =
          'Resultado incierto: verifica los movimientos antes de repetir el consumo. No se reintentó automáticamente.';
      },
    });
  }

  private respuestaConsumoVigente(
    revision: number,
    identidad: string,
    idTratamiento: number,
  ): boolean {
    return revision === this.revisionConsumo
      && identidad === this.identidadActual()
      && this.tratamientoConsumo?.idTratamiento === idTratamiento
      && this.tratamientoConsumo?.idConsulta === this.idConsulta
      && this.tratamientoConsumo?.idPaciente === this.idPaciente
      && this.permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO);
  }

  private identidadActual(): string | null {
    const usuario = this.session.currentUser();
    const token = this.session.token;
    return this.session.isAuthenticated() && usuario && token
      ? `${usuario.idUsuario}:${usuario.idRol}:${token}` : null;
  }

  private contextoLecturaActual(): string | null {
    const identidad = this.identidadActual();
    return identidad && this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)
      && this.permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL) ? identidad : null;
  }

  private idValido(id: number): boolean {
    return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;
  }

  private cancelarLecturasClinicas(): void {
    this.cancelarEncabezado();
    this.cancelarExamenes();
    this.revisionConsulta++;
    this.revisionDiagnosticos++;
    this.revisionEvoluciones++;
    this.lecturaConsulta?.unsubscribe();
    this.lecturaDiagnosticos?.unsubscribe();
    this.lecturaEvoluciones?.unsubscribe();
    this.lecturaConsulta = this.lecturaDiagnosticos = this.lecturaEvoluciones = undefined;
    this.consulta = null;
    this.diagnosticos = [];
    this.evoluciones = [];
    this.cargando = this.cargandoDiagnosticos = this.cargandoEvoluciones = false;
    if (!this.contextoLecturaActual()) this.error = 'No tiene sesión y permisos de lectura clínica vigentes.';
  }

  private cancelarDiagnosticoProtegido(): void {
    this.revisionDiagnostico++;
    this.solicitudDiagnostico?.unsubscribe();
    this.solicitudDiagnostico = undefined;
    this.guardandoDiagnostico = false;
    this.nuevoDiag.descripcion = '';
    this.errorDiagnostico = '';
    this.avisoDiagnostico = '';
  }

  private formatearFecha(value: string): string {
    const fecha = new Date(value);
    return Number.isNaN(fecha.getTime()) ? value : fecha.toLocaleString('es-GT');
  }

  private cancelarConsumoProtegido(): void {
    this.revisionConsumo++;
    this.solicitudConsumo?.unsubscribe();
    this.solicitudConsumo = undefined;
    this.tratamientoConsumo = null;
    this.cantidadConsumo = 1;
    this.guardandoConsumo = false;
    this.errorConsumo = '';
  }
}
