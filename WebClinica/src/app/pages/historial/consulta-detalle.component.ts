import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EMPTY, Observable, Subscription, defer, expand, finalize, reduce, tap } from 'rxjs';
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

@Component({
    selector: 'app-consulta-detalle',
    imports: [CommonModule, RouterModule, FormsModule, TratamientoFormComponent],
    template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h2>Detalle de Consulta #{{ idConsulta }}</h2>
        <a [routerLink]="['/historial', idPaciente]" class="btn btn-secondary">
          <i class="fa fa-arrow-left"></i> Volver
        </a>
      </div>

      @if (cargando) {
        <div class="text-center py-5"><div class="spinner-border text-primary"></div></div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (consulta) {
        <!-- Info general -->
        <div class="card mb-4">
          <div class="card-body">
            <div class="row">
              <div class="col-md-3"><strong>Fecha:</strong><br>{{ consulta.fechaConsulta | date:'dd/MM/yyyy HH:mm' }}</div>
              <div class="col-md-3"><strong>Médico:</strong><br>{{ consulta.idMedico }}</div>
              <div class="col-md-3"><strong>Sucursal:</strong><br>{{ consulta.idSucursal }}</div>
              <div class="col-md-3"><strong>Paciente:</strong><br>{{ idPaciente }}</div>
            </div>
            @if (consulta.motivoConsulta) { <p class="mt-3"><strong>Motivo:</strong> {{ consulta.motivoConsulta }}</p> }
            @if (consulta.sintomas) { <p><strong>Síntomas:</strong> {{ consulta.sintomas }}</p> }
            @if (consulta.observaciones) { <p><strong>Observaciones:</strong> {{ consulta.observaciones }}</p> }
            <div class="row mt-3">
              @if (consulta.pesoLb) { <div class="col"><strong>Peso:</strong> {{ consulta.pesoLb }} lb</div> }
              @if (consulta.alturaCm) { <div class="col"><strong>Altura:</strong> {{ consulta.alturaCm }} cm</div> }
              @if (consulta.presionSistolica) { <div class="col"><strong>PA:</strong> {{ consulta.presionSistolica }}/{{ consulta.presionDiastolica }}</div> }
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <ul class="nav nav-tabs">
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='diagnosticos'" (click)="tab='diagnosticos'">Diagnósticos</button></li>
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='tratamientos'" (click)="tab='tratamientos'">Tratamientos</button></li>
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='examenes'" (click)="tab='examenes'">Exámenes</button></li>
          <li class="nav-item"><button class="nav-link" [class.active]="tab==='evoluciones'" (click)="tab='evoluciones'">Evoluciones</button></li>
        </ul>

        <!-- DIAGNÓSTICOS -->
        @if (tab === 'diagnosticos') {
          <div class="card p-3 mt-3">
            <h4>Diagnósticos</h4>
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
                  <strong>#{{ d.idDiagnostico }}</strong> - {{ d.descripcion }}
                  <small class="text-muted ms-2">{{ d.fechaRegistro | date:'dd/MM/yyyy HH:mm' }}</small>
                </div>
              }
            }
          </div>
        }

        <!-- TRATAMIENTOS -->
        @if (tab === 'tratamientos') {
          <div class="card p-3 mt-3">
            <h4>Tratamientos</h4>
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
            @for (t of tratamientos; track t.idTratamiento) {
              <div class="border-bottom py-2">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                  <div>
                    <strong>#{{ t.idTratamiento }}</strong> - {{ t.descripcion }}
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
        }

        <!-- EXÁMENES -->
        @if (tab === 'examenes') {
          <div class="card p-3 mt-3">
            <h4>Exámenes</h4>
            @if (permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) {
              <form (ngSubmit)="agregarExamen()" class="row g-2 mb-3">
                <div class="col-md-6"><input type="text" class="form-control" [(ngModel)]="nuevoExamen.nombreExamen" name="nombreExamen" placeholder="Nombre del examen" required></div>
                <div class="col-md-3"><input type="datetime-local" class="form-control" [(ngModel)]="nuevoExamen.fechaExamen" name="fechaExamen" required></div>
                <div class="col-md-3"><button type="submit" class="btn btn-primary w-100">Agregar</button></div>
              </form>
            }
            @for (e of examenes; track e.idExamen) {
              <div class="border-bottom py-2">
                <strong>#{{ e.idExamen }}</strong> - {{ e.nombreExamen }}
                <small class="text-muted ms-2">{{ e.fechaExamen | date:'dd/MM/yyyy HH:mm' }}</small>
                @if (e.prioridad) { <span class="badge ms-2" [class.bg-danger]="e.prioridad==='Alta'" [class.bg-warning]="e.prioridad==='Media'" [class.bg-success]="e.prioridad==='Baja'">{{ e.prioridad }}</span> }
              </div>
            }
          </div>
        }

        <!-- EVOLUCIONES -->
        @if (tab === 'evoluciones') {
          <div class="card p-3 mt-3">
            <h4>Evoluciones</h4>
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
            @for (h of evoluciones; track h.idHistorial) {
              <div class="border-bottom py-2">
                <strong>#{{ h.idHistorial }}</strong> - {{ h.descripcion }}
                <small class="text-muted ms-2">{{ h.fechaHistorial | date:'dd/MM/yyyy HH:mm' }}</small>
              </div>
            }
          </div>
        }
      }
    </div>
  `
})
export class ConsultaDetalleComponent implements OnInit {
  private service = inject(HistorialService);
  private route = inject(ActivatedRoute);
  private session = inject(AuthSessionService);
  private apiErrors = inject(ApiErrorService);
  private destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;

  idPaciente!: number;
  idConsulta!: number;
  consulta: ConsultaDetalleDto | null = null;
  cargando = false;
  error = '';
  tab: 'diagnosticos' | 'tratamientos' | 'examenes' | 'evoluciones' = 'diagnosticos';

  diagnosticos: DiagnosticoResponse[] = [];
  tratamientos: TratamientoResponseDto[] = [];
  examenes: ExamenResponseDto[] = [];
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
  private lecturaDiagnosticos?: Subscription;
  private lecturaEvoluciones?: Subscription;
  private solicitudDiagnostico?: Subscription;
  private revisionConsulta = 0;
  private revisionDiagnosticos = 0;
  private revisionEvoluciones = 0;
  private revisionDiagnostico = 0;
  private contextoLecturaObservado: string | null | undefined;
  private crearDiagnosticoObservado: boolean | undefined;

  nuevoDiag: CrearDiagnosticoRequest = { idConsulta: 0, idMedico: null, descripcion: '' };
  nuevoExamen: ExamenCreateDto = { idConsulta: null, idDiagnostico: null, idTurno: null, nombreExamen: '', fechaExamen: '', fechaResultado: null, prioridad: null };
  nuevaEvol: HistorialMedicoCreateDto = { idPaciente: 0, idConsulta: 0, idDiagnostico: null, descripcion: '' };

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const contextoLectura = this.contextoLecturaActual();
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
    const revision = ++this.revisionConsulta;
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    if (!contexto || !this.idValido(consulta) || !this.idValido(paciente)) {
      this.consulta = null; this.error = 'No se puede leer la consulta con la sesión, permisos e identificadores actuales.'; return;
    }
    this.cargando = true;
    this.error = '';
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
    this.service.listarExamenes({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => this.examenes = r.items);
    this.cargarEvoluciones();
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
        this.evoluciones = items; this.cargandoEvoluciones = false;
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
