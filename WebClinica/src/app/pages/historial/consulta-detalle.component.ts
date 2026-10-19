import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subscription, finalize } from 'rxjs';
import { HistorialService } from '../../core/services/historial.service';
import {
  ConsultaDetalleDto,
  DiagnosticoResponse, CrearDiagnosticoRequest,
  HistorialMedicoResponseDto, HistorialMedicoCreateDto,
  TratamientoResponseDto, TratamientoCreateDto,
  ConsumoClinicoResponseDto,
  ExamenResponseDto, ExamenCreateDto
} from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';

@Component({
  selector: 'app-consulta-detalle',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
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
            @if (permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) {
              <form (ngSubmit)="agregarDiagnostico()" class="row g-2 mb-3">
                <div class="col-md-9">
                  <textarea class="form-control" [(ngModel)]="nuevoDiag.descripcion" name="descripcion" placeholder="Descripción del diagnóstico" required></textarea>
                </div>
                <div class="col-md-3">
                  <button type="submit" class="btn btn-primary w-100" [disabled]="!nuevoDiag.descripcion">Agregar</button>
                </div>
              </form>
            }
            @for (d of diagnosticos; track d.idDiagnostico) {
              <div class="border-bottom py-2">
                <strong>#{{ d.idDiagnostico }}</strong> - {{ d.descripcion }}
                <small class="text-muted ms-2">{{ d.fechaRegistro | date:'dd/MM/yyyy HH:mm' }}</small>
              </div>
            }
          </div>
        }

        <!-- TRATAMIENTOS -->
        @if (tab === 'tratamientos') {
          <div class="card p-3 mt-3">
            <h4>Tratamientos</h4>
            @if (avisoConsumo) {
              <div class="alert alert-success" role="status">{{ avisoConsumo }}</div>
            }
            @if (permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)) {
              <form (ngSubmit)="agregarTratamiento()" class="row g-2 mb-3">
                <div class="col-md-6"><textarea class="form-control" [(ngModel)]="nuevoTrat.descripcion" name="descripcion" placeholder="Descripción" required></textarea></div>
                <div class="col-md-3"><input type="date" class="form-control" [(ngModel)]="nuevoTrat.fechaInicio" name="fechaInicio" required></div>
                <div class="col-md-3"><button type="submit" class="btn btn-primary w-100">Agregar</button></div>
              </form>
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
  private solicitudConsumo?: Subscription;
  private revisionConsumo = 0;
  private identidadConsumoObservada: string | null | undefined;

  nuevoDiag: CrearDiagnosticoRequest = { idConsulta: 0, idMedico: null, descripcion: '' };
  nuevoTrat: TratamientoCreateDto = { idConsulta: 0, descripcion: '', indicaciones: null, fechaInicio: '', fechaFin: null, idLote: null, cantidad: null };
  nuevoExamen: ExamenCreateDto = { idConsulta: null, idDiagnostico: null, idTurno: null, nombreExamen: '', fechaExamen: '', fechaResultado: null, prioridad: null };
  nuevaEvol: HistorialMedicoCreateDto = { idPaciente: 0, idConsulta: 0, idDiagnostico: null, descripcion: '' };

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const cambioIdentidad = this.identidadConsumoObservada !== undefined
        && this.identidadConsumoObservada !== identidad;
      this.identidadConsumoObservada = identidad;
      if (!identidad || cambioIdentidad
        || !this.permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO)) {
        this.cancelarConsumoProtegido();
      }
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    this.idPaciente = +this.route.snapshot.paramMap.get('id')!;
    this.idConsulta = +this.route.snapshot.paramMap.get('idConsulta')!;
    this.nuevoDiag.idConsulta = this.idConsulta;
    this.nuevoTrat.idConsulta = this.idConsulta;
    this.nuevoExamen.idConsulta = this.idConsulta;
    this.nuevaEvol.idPaciente = this.idPaciente;
    this.nuevaEvol.idConsulta = this.idConsulta;
    this.cargarTodo();
  }

  cargarTodo() {
    this.cargando = true;
    this.service.obtenerConsulta(this.idConsulta).subscribe({
      next: (c) => {
        this.consulta = c;
        this.cargarSecciones();
      },
      error: () => { this.error = 'No se pudo cargar la consulta'; this.cargando = false; }
    });
  }

  cargarSecciones() {
    this.service.listarDiagnosticos({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => this.diagnosticos = r.items);
    this.service.listarTratamientos({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => this.tratamientos = r.items);
    this.service.listarExamenes({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => this.examenes = r.items);
    this.service.listarHistorial({ idConsulta: this.idConsulta, page: 1, pageSize: 100 }).subscribe(r => {
      this.evoluciones = r.items;
      this.cargando = false;
    });
  }

  agregarDiagnostico() {
    this.service.crearDiagnostico(this.nuevoDiag).subscribe({
      next: () => { this.nuevoDiag.descripcion = ''; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear diagnóstico')
    });
  }

  agregarTratamiento() {
    this.service.crearTratamiento(this.nuevoTrat).subscribe({
      next: () => { this.nuevoTrat.descripcion = ''; this.nuevoTrat.fechaInicio = ''; this.cargarSecciones(); },
      error: (e) => alert(e.error?.message || 'Error al crear tratamiento')
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
    if (!tratamiento.idLote || !this.identidadActual() || this.guardandoConsumo
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
    if (!tratamiento || !tratamiento.idLote || !identidad || this.guardandoConsumo
      || !this.permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO)) return;
    if (!Number.isInteger(Number(this.cantidadConsumo)) || Number(this.cantidadConsumo) <= 0) {
      this.errorConsumo = 'La cantidad consumida debe ser un entero mayor que cero.';
      return;
    }
    if (!confirm(`¿Registrar el consumo de ${this.cantidadConsumo} unidades del lote #${tratamiento.idLote}?`)) {
      return;
    }

    const revision = ++this.revisionConsumo;
    this.guardandoConsumo = true;
    this.errorConsumo = '';
    this.solicitudConsumo = this.service.registrarConsumoClinico(
      tratamiento.idTratamiento,
      { cantidad: Number(this.cantidadConsumo) },
    ).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionConsumo) this.guardandoConsumo = false;
      }),
    ).subscribe({
      next: (response: ConsumoClinicoResponseDto) => {
        if (!this.respuestaConsumoVigente(revision, identidad, tratamiento.idTratamiento)) return;
        this.avisoConsumo = `Salida clínica #${response.idMovimiento} confirmada: ${response.cantidad} unidades del lote #${response.idLote}, sucursal #${response.idSucursal}, ${this.formatearFecha(response.fechaMovimiento)}.`;
        this.tratamientoConsumo = null;
        this.cantidadConsumo = 1;
      },
      error: (error: HttpErrorResponse) => {
        if (!this.respuestaConsumoVigente(revision, identidad, tratamiento.idTratamiento)) return;
        this.errorConsumo = this.apiErrors.messageFor(
          error,
          'No fue posible registrar el consumo clínico.',
        );
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
      && this.permisos.puedeCrear(MODULOS_PERMISO.CONSUMO_CLINICO);
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
