import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit, effect } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule, formatDate } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { AbstractControl, FormControl, FormGroup, FormsModule, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { EMPTY, Observable, Subscription, catchError, defer, expand, finalize, forkJoin, from, map, mergeMap, of, reduce, tap } from 'rxjs';
import { HistorialService } from '../../core/services/historial.service';
import {
  ConsultaDetalleDto,
  RegistrarEvaluacionConsultaRequest,
  DiagnosticoResponse, CrearDiagnosticoRequest, CrearDiagnosticoConExamenRequest,
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
import { ExamResultsComponent, ExamResultsMode } from './exam-results.component';
import { correlativoLista } from '../../shared/utils/correlativo';

type ApartadoConsulta = 'evaluacion' | 'examenes' | 'diagnosticos' | 'tratamientos' | 'evoluciones' | 'hospitalizacion';

const numeroFinito: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value == null || (typeof control.value === 'number' && Number.isFinite(control.value))
    ? null : { numeroInvalido: true };

const enteroEnRango = (min: number, max: number): ValidatorFn => (control: AbstractControl): ValidationErrors | null =>
  control.value == null || (typeof control.value === 'number' && Number.isInteger(control.value)
    && control.value >= min && control.value <= max) ? null : { enteroInvalido: true };

const temperaturaValida: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  control.value == null || (typeof control.value === 'number' && Number.isFinite(control.value)
    && control.value >= -999.9 && control.value <= 999.9
    && Math.round(control.value * 10) === control.value * 10) ? null : { temperaturaInvalida: true };

const contenidoClinico: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const values = control.value as Record<string, string | number | null>;
  return Object.values(values).some(value => typeof value === 'string' ? value.trim().length > 0 : value != null)
    ? null : { sinContenido: true };
};

@Component({
    selector: 'app-consulta-detalle',
    imports: [CommonModule, RouterModule, FormsModule, ReactiveFormsModule, TratamientoFormComponent, ExamResultsComponent],
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
              <p class="text-muted small mb-3">Estado: {{ consulta.estadoConsulta?.trim() || 'Sin estado registrado' }}</p>
              @if (puedeAgregarEvaluacion && !mostrarFormularioEvaluacion) {
                <button type="button" class="btn btn-primary mb-3" (click)="abrirFormularioEvaluacion()">Agregar evaluación</button>
              }
              @if (errorEvaluacion) {
                <div class="alert alert-danger mb-3" role="alert">{{ errorEvaluacion }}
                  @if (conflictoEvaluacion) {
                    <button type="button" class="btn btn-outline-danger btn-sm ms-2" (click)="recargarEvaluacion()" [disabled]="guardandoEvaluacion">Recargar consulta</button>
                  }
                </div>
              }
              @if (avisoEvaluacion) { <p class="alert alert-success mb-3" role="status">{{ avisoEvaluacion }}</p> }
              @if (mostrarFormularioEvaluacion && puedeAgregarEvaluacion) {
                <form class="card consulta-card mb-3" [formGroup]="formularioEvaluacion" (ngSubmit)="guardarEvaluacion()" novalidate>
                  <div class="card-body">
                    <h4 class="h6">Registrar evaluación clínica</h4>
                    <p class="small mb-3"><strong>Motivo de consulta:</strong> {{ consulta.motivoConsulta?.trim() || 'Sin registrar' }}</p>
                    <div class="row g-3">
                      <div class="col-12 col-md-6"><label class="form-label" for="eval-sintomas">Síntomas</label><textarea id="eval-sintomas" class="form-control" formControlName="sintomas" maxlength="300" rows="3"></textarea></div>
                      <div class="col-12 col-md-6"><label class="form-label" for="eval-observaciones">Observaciones</label><textarea id="eval-observaciones" class="form-control" formControlName="observaciones" maxlength="300" rows="3"></textarea></div>
                      <div class="col-12 col-sm-6 col-lg-4"><label class="form-label" for="eval-peso">Peso (lb)</label><input id="eval-peso" class="form-control" type="number" step="any" formControlName="pesoLb"></div>
                      <div class="col-12 col-sm-6 col-lg-4"><label class="form-label" for="eval-altura">Altura (cm)</label><input id="eval-altura" class="form-control" type="number" step="1" formControlName="alturaCm"></div>
                      <div class="col-12 col-sm-6 col-lg-4"><label class="form-label" for="eval-sistolica">Presión sistólica (mmHg)</label><input id="eval-sistolica" class="form-control" type="number" step="any" formControlName="presionSistolica"></div>
                      <div class="col-12 col-sm-6 col-lg-4"><label class="form-label" for="eval-diastolica">Presión diastólica (mmHg)</label><input id="eval-diastolica" class="form-control" type="number" step="any" formControlName="presionDiastolica"></div>
                      <div class="col-12 col-sm-6 col-lg-4"><label class="form-label" for="eval-temperatura">Temperatura (°C)</label><input id="eval-temperatura" class="form-control" type="number" step="0.1" formControlName="temperaturaC"></div>
                      <div class="col-12 col-sm-6 col-lg-4"><label class="form-label" for="eval-frecuencia">Frecuencia cardíaca (lpm)</label><input id="eval-frecuencia" class="form-control" type="number" min="0" max="32767" step="1" formControlName="frecuenciaCardiaca"></div>
                    </div>
                    @if (formularioEvaluacion.touched && formularioEvaluacion.hasError('sinContenido')) {
                      <p class="text-danger small mt-3 mb-0" role="alert">Registre al menos un dato clínico.</p>
                    }
                    @if (formularioEvaluacion.touched && formularioEvaluacion.invalid && !formularioEvaluacion.hasError('sinContenido')) {
                      <p class="text-danger small mt-3 mb-0" role="alert">Revise los valores: textos de hasta 300 caracteres, temperatura con un decimal y signos dentro de sus tipos permitidos.</p>
                    }
                    <div class="d-flex flex-wrap gap-2 mt-3">
                      <button type="submit" class="btn btn-primary" [disabled]="guardandoEvaluacion || conflictoEvaluacion">{{ guardandoEvaluacion ? 'Guardando…' : 'Guardar evaluación' }}</button>
                      <button type="button" class="btn btn-outline-secondary" (click)="cancelarFormularioEvaluacion()" [disabled]="guardandoEvaluacion">Cancelar</button>
                    </div>
                  </div>
                </form>
              }
              @if (!tieneEvaluacion) { <p class="text-muted">No hay datos de evaluación registrados.</p> }
              <div class="row g-3">
                <div class="col-12">
                  <section class="card consulta-card h-100" aria-labelledby="evaluacion-informacion">
                    <div class="card-header consulta-section-heading"><h4 class="h6 mb-0" id="evaluacion-informacion">Información de la evaluación</h4></div>
                    <div class="card-body">
                      <dl class="row g-3 mb-0">
                        <div class="col-12 consulta-eval-field"><dt>Motivo de consulta</dt><dd>{{ consulta.motivoConsulta?.trim() || 'Sin registrar' }}</dd></div>
                        <div class="col-12 consulta-eval-field"><dt>Síntomas</dt><dd>{{ consulta.sintomas?.trim() || 'Sin registrar' }}</dd></div>
                        <div class="col-12 consulta-eval-field"><dt>Observaciones</dt><dd>{{ consulta.observaciones?.trim() || 'Sin registrar' }}</dd></div>
                      </dl>
                    </div>
                  </section>
                </div>
                <div class="col-12">
                  <section class="card consulta-card h-100" aria-labelledby="evaluacion-signos">
                    <div class="card-header consulta-section-heading"><h4 class="h6 mb-0" id="evaluacion-signos">Signos vitales</h4></div>
                    <div class="card-body">
                      <dl class="row g-3 mb-0">
                        <div class="col-12 col-md-6 col-xl-4 consulta-eval-field"><dt>Peso (lb)</dt><dd>{{ consulta.pesoLb != null ? consulta.pesoLb + ' lb' : 'Sin registrar' }}</dd></div>
                        <div class="col-12 col-md-6 col-xl-4 consulta-eval-field"><dt>Altura (cm)</dt><dd>{{ consulta.alturaCm != null ? consulta.alturaCm + ' cm' : 'Sin registrar' }}</dd></div>
                        <div class="col-12 col-md-6 col-xl-4 consulta-eval-field"><dt>Presión sistólica (mmHg)</dt><dd>{{ consulta.presionSistolica != null ? consulta.presionSistolica + ' mmHg' : 'Sin registrar' }}</dd></div>
                        <div class="col-12 col-md-6 col-xl-4 consulta-eval-field"><dt>Presión diastólica (mmHg)</dt><dd>{{ consulta.presionDiastolica != null ? consulta.presionDiastolica + ' mmHg' : 'Sin registrar' }}</dd></div>
                        <div class="col-12 col-md-6 col-xl-4 consulta-eval-field"><dt>Temperatura (°C)</dt><dd>{{ consulta.temperaturaC != null ? consulta.temperaturaC + ' °C' : 'Sin registrar' }}</dd></div>
                        <div class="col-12 col-md-6 col-xl-4 consulta-eval-field"><dt>Frecuencia cardíaca (lpm)</dt><dd>{{ consulta.frecuenciaCardiaca != null ? consulta.frecuenciaCardiaca + ' lpm' : 'Sin registrar' }}</dd></div>
                      </dl>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </section>
        }

        <!-- DIAGNÓSTICOS -->
        @if (tab === 'diagnosticos') {
          <section class="card shadow-sm mt-3 consulta-card" id="panel-diagnosticos" role="tabpanel" aria-labelledby="tab-diagnosticos" tabindex="0">
            <div class="card-header consulta-section-heading"><h3 class="h5 mb-0">Diagnóstico</h3></div>
            <div class="card-body">
              <section aria-labelledby="diag-resultados" class="mb-4">
                <h4 class="h6" id="diag-resultados">Resultados de exámenes</h4>
                @if (cargandoExamenes) { <p class="text-muted" role="status">Cargando exámenes…</p> }
                @else if (errorExamenes) { <div class="alert alert-warning" role="alert">{{ errorExamenes }}</div> }
                @else if (examenes.length === 0) { <p class="text-muted">No hay exámenes asociados a esta consulta.</p> }
                @else {
                  <div class="table-responsive">
                    <table class="table table-striped align-middle mb-0">
                      <thead><tr><th scope="col">Examen</th><th scope="col">Fecha</th><th scope="col">Prioridad</th><th scope="col">Fecha de resultado</th><th scope="col">Documentos</th><th scope="col">Acciones</th></tr></thead>
                      <tbody>
                        @for (e of examenes; track e.idExamen) {
                          <tr>
                            <td>{{ e.nombreExamen }}</td>
                            <td>{{ e.fechaExamen | date:'dd/MM/yyyy HH:mm' }}</td>
                            <td>{{ e.prioridad || 'Sin prioridad' }}</td>
                            <td>{{ fechaCargaResultado(e.idExamen) }}</td>
                            <td>@if (cantidadArchivosExamen[e.idExamen] != null) {
                              <span class="badge text-bg-secondary">{{ cantidadArchivosExamen[e.idExamen] }} archivo(s)</span>
                            } @else { <span class="text-muted">Por consultar</span> }</td>
                            <td><button type="button" class="btn btn-outline-primary btn-sm" (click)="verResultadosDiagnostico(e)">Ver resultados</button></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
                @if (examenDiagnosticoSeleccionado) {
                  <div class="border rounded p-3 mt-3">
                    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2">
                      <h5 class="h6 mb-0">Documentos de {{ examenDiagnosticoSeleccionado.nombreExamen }}</h5>
                      <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cerrarResultadosDiagnostico()">Cerrar resultados</button>
                    </div>
                    <app-exam-results [exam]="examenDiagnosticoSeleccionado" [consultationId]="idConsulta" [patientId]="idPaciente" mode="archivos" (filesChanged)="actualizarCantidadArchivos($event)" />
                  </div>
                }
              </section>
              <section aria-labelledby="diag-registro" class="mb-4">
                <h4 class="h6" id="diag-registro">Registro de diagnóstico</h4>
                @if (errorDiagnostico) { <div class="alert alert-danger" role="alert">{{ errorDiagnostico }}</div> }
                @if (avisoDiagnostico) { <div class="alert alert-success" role="status">{{ avisoDiagnostico }}</div> }
                @if (consulta.estadoConsulta === 'Cerrada') {
                  <p class="text-muted small">La consulta está cerrada; no se pueden registrar nuevos diagnósticos desde esta vista.</p>
                }
                @if (puedeRegistrarDiagnostico) {
                  <form (ngSubmit)="agregarDiagnostico()" class="row g-2 align-items-end">
                    <div class="col-12">
                      <label class="form-label" for="examen-diagnostico">Examen relacionado (opcional)</label>
                      <select id="examen-diagnostico" class="form-select" [(ngModel)]="idExamenDiagnostico"
                        name="idExamenDiagnostico" [disabled]="guardandoDiagnostico || cargandoExamenes || !!errorExamenes || !permisos.puedeModificar(MODULOS_PERMISO.HISTORIAL)">
                        <option [ngValue]="null">Sin examen relacionado</option>
                        @for (e of examenes; track e.idExamen) {
                          <option [ngValue]="e.idExamen" [disabled]="e.idDiagnostico !== null">
                            {{ e.nombreExamen }} · {{ e.fechaExamen | date:'dd/MM/yyyy HH:mm' }}{{ e.idDiagnostico !== null ? ' · Ya relacionado' : '' }}
                          </option>
                        }
                      </select>
                    </div>
                    <div class="col-md-9">
                      <label class="form-label" for="descripcion-diagnostico">Descripción del diagnóstico *</label>
                      <textarea id="descripcion-diagnostico" class="form-control" [(ngModel)]="nuevoDiag.descripcion" name="descripcion" required maxlength="300" rows="2"></textarea>
                    </div>
                    <div class="col-md-3">
                      <button type="submit" class="btn btn-primary w-100" [disabled]="guardandoDiagnostico">
                        {{ guardandoDiagnostico ? 'Registrando...' : 'Agregar' }}
                      </button>
                    </div>
                  </form>
                }
              </section>
              <section aria-labelledby="diag-registrados">
                <h4 class="h6" id="diag-registrados">Diagnósticos registrados</h4>
                @if (cargandoDiagnosticos) { <div class="text-muted" role="status">Cargando diagnósticos…</div> }
                @else if (errorDiagnosticos) { <div class="alert alert-warning" role="alert">{{ errorDiagnosticos }}</div> }
                @else if (diagnosticos.length === 0) { <div class="text-muted">No hay diagnósticos registrados.</div> }
                @else {
                  <div class="table-responsive">
                    <table class="table table-striped align-middle mb-0">
                      <thead><tr><th scope="col">No.</th><th scope="col">Diagnóstico</th><th scope="col">Examen relacionado</th><th scope="col">Fecha</th><th scope="col">Acciones</th></tr></thead>
                      <tbody>
                        @for (d of diagnosticos; track d.idDiagnostico; let index = $index) {
                          <tr>
                            <td>{{ correlativoLista(index) }}</td>
                            <td>{{ d.descripcion }}</td>
                            <td>
                              @if (cargandoExamenes || errorExamenes) { <span class="text-muted">No disponible</span> }
                              @else {
                                @for (e of examenesDeDiagnostico(d.idDiagnostico); track e.idExamen; let last = $last) {
                                  {{ e.nombreExamen }}{{ last ? '' : ', ' }}
                                } @empty { <span class="text-muted">Sin examen relacionado</span> }
                              }
                            </td>
                            <td>{{ d.fechaRegistro | date:'dd/MM/yyyy' }}</td>
                            <td><button type="button" class="btn btn-outline-primary btn-sm" (click)="verDetalleDiagnostico(d)">{{ diagnosticoDetalleId === d.idDiagnostico ? 'Cerrar detalle' : 'Ver detalle' }}</button></td>
                          </tr>
                          @if (diagnosticoDetalleId === d.idDiagnostico) {
                            <tr><td colspan="5">
                              <div class="border rounded p-3">
                                <div><strong>Diagnóstico:</strong> {{ d.descripcion }}</div>
                                <div><strong>Registrado:</strong> {{ d.fechaRegistro | date:'dd/MM/yyyy HH:mm' }}</div>
                              </div>
                            </td></tr>
                          }
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </section>
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
                <form (ngSubmit)="agregarExamen()" class="row g-3 mb-3">
                  <div class="col-12 col-md-5"><label class="form-label" for="nombre-examen">Nombre del examen *</label>
                    <input id="nombre-examen" type="text" class="form-control" [(ngModel)]="nuevoExamen.nombreExamen" name="nombreExamen" maxlength="200" required></div>
                  <div class="col-12 col-sm-6 col-md-3"><label class="form-label" for="fecha-examen">Fecha del examen *</label>
                    <input id="fecha-examen" type="datetime-local" class="form-control" [(ngModel)]="nuevoExamen.fechaExamen" name="fechaExamen" required></div>
                  <div class="col-12 col-sm-6 col-md-2"><label class="form-label" for="prioridad-examen">Prioridad</label>
                    <select id="prioridad-examen" class="form-select" [(ngModel)]="nuevoExamen.prioridad" name="prioridad">
                      <option [ngValue]="null">Sin prioridad</option><option value="Baja">Baja</option><option value="Media">Media</option><option value="Alta">Alta</option>
                    </select></div>
                  <div class="col-12 col-md-2 d-flex align-items-end"><button type="submit" class="btn btn-primary w-100" [disabled]="guardandoExamen">{{ guardandoExamen ? 'Agregando…' : 'Agregar' }}</button></div>
                </form>
              }
              @if (errorCrearExamen) { <p class="alert alert-danger" role="alert">{{ errorCrearExamen }}</p> }
              @if (avisoCrearExamen) { <p class="alert alert-success" role="status">{{ avisoCrearExamen }}</p> }
              @if (cargandoExamenes) { <p class="text-muted" role="status">Cargando exámenes…</p> }
              @else if (errorExamenes) { <div class="alert alert-warning" role="alert">{{ errorExamenes }}</div> }
              @else if (examenes.length === 0) { <p class="text-muted">No hay exámenes registrados.</p> }
              @else {
                <div class="table-responsive">
                  <table class="table table-striped align-middle mb-0">
                    <thead><tr><th scope="col">No.</th><th scope="col">Examen</th><th scope="col">Fecha</th><th scope="col">Prioridad</th><th scope="col">Fecha de resultado</th><th scope="col">Adjuntos</th><th scope="col">Acciones</th></tr></thead>
                    <tbody>
                      @for (e of examenes; track e.idExamen; let index = $index) {
                        <tr>
                          <td>{{ index + 1 }}</td><td>{{ e.nombreExamen }}</td>
                          <td>{{ e.fechaExamen | date:'dd/MM/yyyy HH:mm' }}</td>
                          <td>{{ e.prioridad || 'Sin prioridad' }}</td>
                          <td>{{ fechaCargaResultado(e.idExamen) }}</td>
                          <td>@if (cantidadArchivosExamen[e.idExamen] != null) {
                            <span class="badge text-bg-secondary">{{ cantidadArchivosExamen[e.idExamen] }} · {{ cantidadArchivosExamen[e.idExamen] ? 'Con resultados' : 'Pendiente' }}</span>
                          } @else if (errorArchivosExamen.has(e.idExamen)) {
                            <span class="text-danger">No se pudieron consultar los resultados</span>
                          } @else { <span class="text-muted">Consultando</span> }</td>
                          <td><div class="d-flex flex-wrap gap-1">
                            <button type="button" class="btn btn-outline-primary btn-sm" (click)="seleccionarExamen(e, 'detalle')">Ver detalle</button>
                            @if (cantidadArchivosExamen[e.idExamen] === 0 && permisos.puedeModificar(MODULOS_PERMISO.HISTORIAL)) {
                              <button type="button" class="btn btn-outline-primary btn-sm" (click)="seleccionarExamen(e, 'adjuntar')">Adjuntar resultados</button>
                            }
                            @if ((cantidadArchivosExamen[e.idExamen] ?? 0) > 0) {
                              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="seleccionarExamen(e, 'archivos')">Ver archivos</button>
                            }
                            @if (errorArchivosExamen.has(e.idExamen)) {
                              <button type="button" class="btn btn-outline-secondary btn-sm" (click)="reintentarArchivosExamen(e)">Reintentar</button>
                            }
                          </div></td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </div>
              }
              @if (examenSeleccionado && modoExamen !== 'cerrado') {
                <div class="border rounded p-3 mt-3">
                  <div class="d-flex justify-content-between align-items-start gap-2">
                    <div>
                      <h4 class="h6">{{ modoExamen === 'detalle' ? 'Detalle' : modoExamen === 'archivos' ? 'Archivos' : 'Adjuntar resultados' }}: {{ examenSeleccionado.nombreExamen }}</h4>
                      @if (modoExamen === 'detalle') {
                        <p class="small mb-1">Fecha del examen: {{ examenSeleccionado.fechaExamen | date:'dd/MM/yyyy HH:mm' }} · Prioridad: {{ examenSeleccionado.prioridad || 'Sin prioridad' }} · Fecha de resultado: {{ fechaCargaResultado(examenSeleccionado.idExamen) }}</p>
                        <p class="small mb-0">Cantidad de archivos adjuntos: {{ cantidadArchivosExamen[examenSeleccionado.idExamen] ?? 'Por consultar' }}</p>
                      }
                    </div>
                    <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cerrarExamen()">{{ modoExamen === 'adjuntar' ? 'Cancelar' : 'Cerrar' }}</button>
                  </div>
                  <app-exam-results [exam]="examenSeleccionado" [consultationId]="idConsulta" [patientId]="idPaciente" [mode]="modoExamen" (filesChanged)="actualizarCantidadArchivos($event)" />
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
      .consulta-eval-field dt { color: #173b64; font-size: .875rem; margin-bottom: .35rem; }
      .consulta-eval-field dd { background: #f8fbfe; border: 1px solid #e0eaf2; border-radius: .4rem; margin: 0; min-height: 2.5rem; overflow-wrap: anywhere; padding: .55rem .75rem; white-space: pre-wrap; }
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
  readonly formularioEvaluacion = new FormGroup({
    sintomas: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    observaciones: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(300)] }),
    pesoLb: new FormControl<number | null>(null, { validators: [numeroFinito] }),
    alturaCm: new FormControl<number | null>(null, { validators: [enteroEnRango(-2_147_483_648, 2_147_483_647)] }),
    presionSistolica: new FormControl<number | null>(null, { validators: [numeroFinito] }),
    presionDiastolica: new FormControl<number | null>(null, { validators: [numeroFinito] }),
    temperaturaC: new FormControl<number | null>(null, { validators: [temperaturaValida] }),
    frecuenciaCardiaca: new FormControl<number | null>(null, { validators: [enteroEnRango(0, 32_767)] }),
  }, { validators: [contenidoClinico] });
  mostrarFormularioEvaluacion = false;
  guardandoEvaluacion = false;
  conflictoEvaluacion = false;
  errorEvaluacion = '';
  avisoEvaluacion = '';
  private solicitudEvaluacion?: Subscription;
  private lecturaEvaluacion?: Subscription;
  private revisionEvaluacion = 0;

  diagnosticos: DiagnosticoResponse[] = [];
  readonly correlativoLista = correlativoLista;
  diagnosticoDetalleId: number | null = null;
  tratamientos: TratamientoResponseDto[] = [];
  examenes: ExamenResponseDto[] = [];
  cargandoExamenes = false;
  errorExamenes = '';
  examenSeleccionado: ExamenResponseDto | null = null;
  examenDiagnosticoSeleccionado: ExamenResponseDto | null = null;
  modoExamen: ExamResultsMode = 'cerrado';
  cantidadArchivosExamen: Partial<Record<number, number>> = {};
  fechaPrimeraCargaExamen: Partial<Record<number, string | null>> = {};
  errorArchivosExamen = new Set<number>();
  private lecturaMetadatosExamenes?: Subscription;
  guardandoExamen = false;
  errorCrearExamen = '';
  avisoCrearExamen = '';
  private solicitudCrearExamen?: Subscription;
  private revisionCrearExamen = 0;
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
  idExamenDiagnostico: number | null = null;
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
      if (!identidad || cambioIdentidad || !this.permisos.puedeModificar(MODULOS_PERMISO.CONSULTAS)) {
        this.cancelarEvaluacionProtegida();
      }
      if (this.modoExamen === 'adjuntar' && !this.permisos.puedeModificar(MODULOS_PERMISO.HISTORIAL)) {
        this.cerrarExamen();
      }
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
    this.cancelarEvaluacionProtegida();
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
    return this.consulta !== null && this.contieneDatosEvaluacion(this.consulta);
  }

  get puedeRegistrarDiagnostico(): boolean {
    return !!this.contextoLecturaActual()
      && this.consulta?.idConsulta === this.idConsulta
      && this.consulta.idPaciente === this.idPaciente
      && this.consulta.estadoConsulta !== 'Cerrada'
      && this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL);
  }

  get puedeAgregarEvaluacion(): boolean {
    return this.consulta?.idConsulta === this.idConsulta
      && this.consulta.idPaciente === this.idPaciente
      && this.consulta.estadoConsulta === 'Abierta'
      && !this.tieneEvaluacion
      && !!this.contextoLecturaActual()
      && this.permisos.puedeModificar(MODULOS_PERMISO.CONSULTAS);
  }

  abrirFormularioEvaluacion(): void {
    if (!this.puedeAgregarEvaluacion || this.guardandoEvaluacion) return;
    this.formularioEvaluacion.reset();
    this.mostrarFormularioEvaluacion = true;
    this.errorEvaluacion = this.avisoEvaluacion = '';
    this.conflictoEvaluacion = false;
  }

  cancelarFormularioEvaluacion(): void {
    if (this.guardandoEvaluacion) return;
    this.mostrarFormularioEvaluacion = false;
    this.formularioEvaluacion.reset();
    this.errorEvaluacion = '';
    this.conflictoEvaluacion = false;
  }

  guardarEvaluacion(): void {
    if (this.guardandoEvaluacion || this.conflictoEvaluacion || !this.mostrarFormularioEvaluacion || !this.puedeAgregarEvaluacion) return;
    this.formularioEvaluacion.markAllAsTouched();
    if (this.formularioEvaluacion.invalid) return;
    const value = this.formularioEvaluacion.getRawValue();
    const request: RegistrarEvaluacionConsultaRequest = {
      sintomas: value.sintomas.trim() || null,
      observaciones: value.observaciones.trim() || null,
      pesoLb: value.pesoLb,
      alturaCm: value.alturaCm,
      presionSistolica: value.presionSistolica,
      presionDiastolica: value.presionDiastolica,
      temperaturaC: value.temperaturaC,
      frecuenciaCardiaca: value.frecuenciaCardiaca,
    };
    const identidad = this.contextoLecturaActual();
    if (!identidad) return;
    const id = this.idConsulta;
    const paciente = this.idPaciente;
    const revision = ++this.revisionEvaluacion;
    this.guardandoEvaluacion = true;
    this.errorEvaluacion = this.avisoEvaluacion = '';
    this.conflictoEvaluacion = false;
    this.solicitudEvaluacion = this.service.registrarEvaluacion(id, request)
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          if (!this.respuestaEvaluacionVigente(revision, identidad, id, paciente)) return;
          if (response?.idConsulta !== id || response.idPaciente !== paciente) {
            this.guardandoEvaluacion = false;
            this.conflictoEvaluacion = true;
            this.errorEvaluacion = 'La API devolvió una evaluación para otra consulta. Recargue los datos.';
            return;
          }
          this.recargarDetalleEvaluacion(revision, identidad, id, paciente, true);
        },
        error: (err: HttpErrorResponse) => {
          if (!this.respuestaEvaluacionVigente(revision, identidad, id, paciente)) return;
          this.guardandoEvaluacion = false;
          this.conflictoEvaluacion = err.status === 409;
          this.errorEvaluacion = this.conflictoEvaluacion
            ? 'La evaluación ya fue registrada o la consulta cambió. Recargue los datos antes de continuar.'
            : this.apiErrors.messageFor(err, 'No se pudo guardar la evaluación. Sus datos siguen en el formulario.');
        },
      });
  }

  recargarEvaluacion(): void {
    if (!this.conflictoEvaluacion || this.guardandoEvaluacion) return;
    const identidad = this.contextoLecturaActual();
    if (!identidad) return;
    this.guardandoEvaluacion = true;
    this.recargarDetalleEvaluacion(++this.revisionEvaluacion, identidad, this.idConsulta, this.idPaciente, false);
  }

  private recargarDetalleEvaluacion(revision: number, identidad: string, id: number,
    paciente: number, despuesDeGuardar: boolean): void {
    this.lecturaEvaluacion = this.service.obtenerConsulta(id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: detail => {
        if (!this.respuestaEvaluacionVigente(revision, identidad, id, paciente)) return;
        this.guardandoEvaluacion = false;
        if (detail.idConsulta !== id || detail.idPaciente !== paciente) {
          this.conflictoEvaluacion = true;
          this.errorEvaluacion = 'La API devolvió una consulta diferente. No se actualizaron los datos visibles.';
          return;
        }
        if (despuesDeGuardar && (detail.estadoConsulta !== 'En seguimiento'
          || !this.contieneDatosEvaluacion(detail))) {
          this.conflictoEvaluacion = true;
          this.errorEvaluacion = 'El guardado fue aceptado, pero la lectura aún no confirma la evaluación. Recargue la consulta.';
          return;
        }
        this.consulta = detail;
        this.conflictoEvaluacion = false;
        this.errorEvaluacion = '';
        if (this.tieneEvaluacion || detail.estadoConsulta !== 'Abierta') {
          this.mostrarFormularioEvaluacion = false;
          this.formularioEvaluacion.reset();
        }
        if (despuesDeGuardar) {
          this.avisoEvaluacion = 'La evaluación se guardó. Se recargaron los datos de la consulta.';
        }
      },
      error: (err: HttpErrorResponse) => {
        if (!this.respuestaEvaluacionVigente(revision, identidad, id, paciente)) return;
        this.guardandoEvaluacion = false;
        this.errorEvaluacion = this.apiErrors.messageFor(err,
          'No se pudo verificar la evaluación guardada. Recargue la consulta antes de continuar.');
        this.conflictoEvaluacion = true;
      },
    });
  }

  private respuestaEvaluacionVigente(revision: number, identidad: string, id: number, paciente: number): boolean {
    return revision === this.revisionEvaluacion && identidad === this.contextoLecturaActual()
      && id === this.idConsulta && paciente === this.idPaciente
      && this.permisos.puedeModificar(MODULOS_PERMISO.CONSULTAS);
  }

  private contieneDatosEvaluacion(c: ConsultaDetalleDto): boolean {
    return !!(c.sintomas?.trim() || c.observaciones?.trim()
      || c.pesoLb != null || c.alturaCm != null
      || c.presionSistolica != null || c.presionDiastolica != null
      || c.temperaturaC != null || c.frecuenciaCardiaca != null);
  }

  private cancelarEvaluacionProtegida(): void {
    this.revisionEvaluacion++;
    this.solicitudEvaluacion?.unsubscribe();
    this.lecturaEvaluacion?.unsubscribe();
    this.solicitudEvaluacion = this.lecturaEvaluacion = undefined;
    this.guardandoEvaluacion = false;
    this.mostrarFormularioEvaluacion = false;
    this.formularioEvaluacion.reset();
    this.errorEvaluacion = this.avisoEvaluacion = '';
    this.conflictoEvaluacion = false;
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
    const seleccionadoId = this.examenSeleccionado?.idExamen;
    const diagnosticoSeleccionadoId = this.examenDiagnosticoSeleccionado?.idExamen;
    const modoSeleccionado = this.modoExamen;
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
        if (this.idExamenDiagnostico !== null && !items.some(item =>
          item.idExamen === this.idExamenDiagnostico && item.idDiagnostico === null))
          this.idExamenDiagnostico = null;
        this.examenSeleccionado = items.find(item => item.idExamen === seleccionadoId) ?? null;
        this.examenDiagnosticoSeleccionado = items.find(item => item.idExamen === diagnosticoSeleccionadoId) ?? null;
        this.modoExamen = this.examenSeleccionado ? modoSeleccionado : 'cerrado';
        this.cargarMetadatosExamenes(items, revision, contexto, consulta, paciente);
      },
      error: (err: HttpErrorResponse | Error) => {
        if (!this.lecturaVigente(revision, this.revisionExamenes, contexto, consulta, paciente)) return;
        this.examenes = []; this.idExamenDiagnostico = null; this.cargandoExamenes = false;
        this.errorExamenes = err instanceof HttpErrorResponse
          ? this.apiErrors.messageFor(err, 'No fue posible leer todos los exámenes.') : err.message;
      },
    });
  }

  private cancelarExamenes(): void {
    this.revisionExamenes++;
    this.lecturaExamenes?.unsubscribe();
    this.lecturaMetadatosExamenes?.unsubscribe();
    this.lecturaExamenes = undefined;
    this.lecturaMetadatosExamenes = undefined;
    this.examenes = []; this.cargandoExamenes = false; this.errorExamenes = '';
    this.examenSeleccionado = null;
    this.examenDiagnosticoSeleccionado = null;
    this.modoExamen = 'cerrado';
    this.cantidadArchivosExamen = {};
    this.fechaPrimeraCargaExamen = {};
    this.errorArchivosExamen = new Set<number>();
  }

  private cargarMetadatosExamenes(items: ExamenResponseDto[], revision: number,
    contexto: string, consulta: number, paciente: number): void {
    this.lecturaMetadatosExamenes = from(items).pipe(
      mergeMap(examen => this.service.listarArchivosExamen(examen.idExamen).pipe(
        map(files => ({ id: examen.idExamen, files })),
        catchError(() => of({ id: examen.idExamen, files: null })),
      ), 4),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ id, files }) => {
      if (!this.lecturaVigente(revision, this.revisionExamenes, contexto, consulta, paciente)) return;
      if (!Array.isArray(files) || files.some(file => !/^[a-f0-9]{32}$/.test(file.archivoId))) {
        this.errorArchivosExamen.add(id);
        delete this.cantidadArchivosExamen[id];
        delete this.fechaPrimeraCargaExamen[id];
        if (this.examenSeleccionado?.idExamen === id && this.modoExamen === 'adjuntar') this.cerrarExamen();
        return;
      }
      const dates = files.map(file => Date.parse(file.fechaCargaUtc)).filter(Number.isFinite);
      this.cantidadArchivosExamen[id] = files.length;
      this.fechaPrimeraCargaExamen[id] = dates.length ? new Date(Math.min(...dates)).toISOString() : null;
      this.errorArchivosExamen.delete(id);
      if (files.length > 0 && this.examenSeleccionado?.idExamen === id && this.modoExamen === 'adjuntar')
        this.cerrarExamen();
    });
  }

  reintentarArchivosExamen(exam: ExamenResponseDto): void {
    const contexto = this.contextoLecturaActual();
    if (!contexto || exam.idConsulta !== this.idConsulta
      || !this.examenes.some(item => item.idExamen === exam.idExamen)
      || !this.errorArchivosExamen.has(exam.idExamen)) return;
    this.errorArchivosExamen.delete(exam.idExamen);
    this.cargarMetadatosExamenes([exam], this.revisionExamenes,
      contexto, this.idConsulta, this.idPaciente);
  }

  agregarDiagnostico() {
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    const descripcion = this.nuevoDiag.descripcion?.trim() ?? '';
    if (this.guardandoDiagnostico) return;
    if (!contexto || !this.puedeRegistrarDiagnostico
      || !this.consulta || this.consulta.idConsulta !== consulta || this.consulta.idPaciente !== paciente) {
      this.errorDiagnostico = 'Verifique la consulta, la sesión y el permiso Historial/Crear antes de registrar.'; return;
    }
    if (!descripcion || descripcion.length > 300) {
      this.errorDiagnostico = 'La descripción del diagnóstico debe contener entre 1 y 300 caracteres.'; return;
    }
    const idExamen = this.idExamenDiagnostico;
    if (idExamen !== null && (!this.idValido(idExamen)
      || !this.permisos.puedeModificar(MODULOS_PERMISO.HISTORIAL)
      || this.cargandoExamenes || !!this.errorExamenes
      || !this.examenes.some(e => e.idExamen === idExamen && e.idConsulta === consulta
        && e.idPaciente === paciente && e.idDiagnostico === null))) {
      this.errorDiagnostico = 'Seleccione un examen disponible de esta consulta o deje la opción sin examen.';
      return;
    }
    const request: CrearDiagnosticoRequest = { idConsulta: consulta, idMedico: null, descripcion };
    const operation = idExamen === null ? this.service.crearDiagnostico(request)
      : this.service.crearDiagnosticoConExamen({ ...request, idExamen } satisfies CrearDiagnosticoConExamenRequest);
    const revision = ++this.revisionDiagnostico;
    this.guardandoDiagnostico = true;
    this.errorDiagnostico = '';
    this.avisoDiagnostico = '';
    this.solicitudDiagnostico = operation.pipe(
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
        this.idExamenDiagnostico = null;
        this.avisoDiagnostico = `Diagnóstico #${diagnostico.idDiagnostico} confirmado.`;
        this.cargarDiagnosticos();
        if (idExamen !== null) this.cargarExamenes();
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
        this.diagnosticos = [...items].sort((a, b) => a.idDiagnostico - b.idDiagnostico);
        if (!this.diagnosticos.some(d => d.idDiagnostico === this.diagnosticoDetalleId)) this.diagnosticoDetalleId = null;
        this.cargandoDiagnosticos = false;
      },
      error: (err: HttpErrorResponse | Error) => {
        if (!this.lecturaVigente(revision, this.revisionDiagnosticos, contexto, consulta, paciente)) return;
        this.diagnosticos = []; this.diagnosticoDetalleId = null; this.cargandoDiagnosticos = false;
        this.errorDiagnosticos = err instanceof HttpErrorResponse
          ? this.apiErrors.messageFor(err, 'No fue posible leer todos los diagnósticos.')
          : err.message;
      },
    });
  }

  examenesDeDiagnostico(idDiagnostico: number): ExamenResponseDto[] {
    return this.examenes.filter(examen => examen.idDiagnostico === idDiagnostico
      && examen.idConsulta === this.idConsulta && examen.idPaciente === this.idPaciente);
  }

  verDetalleDiagnostico(diagnostico: DiagnosticoResponse): void {
    if (!this.contextoLecturaActual() || diagnostico.idConsulta !== this.idConsulta
      || !this.diagnosticos.some(item => item.idDiagnostico === diagnostico.idDiagnostico)) return;
    this.diagnosticoDetalleId = this.diagnosticoDetalleId === diagnostico.idDiagnostico
      ? null : diagnostico.idDiagnostico;
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

  agregarExamen(): void {
    if (this.guardandoExamen) return;
    const contexto = this.contextoLecturaActual();
    const consulta = this.idConsulta;
    const paciente = this.idPaciente;
    const nombre = this.nuevoExamen.nombreExamen.trim();
    const fecha = this.nuevoExamen.fechaExamen;
    this.errorCrearExamen = this.avisoCrearExamen = '';
    if (!contexto || !this.permisos.puedeCrear(MODULOS_PERMISO.HISTORIAL)
      || this.consulta?.idConsulta !== consulta || this.consulta.idPaciente !== paciente) {
      this.errorCrearExamen = 'No tiene acceso vigente para registrar este examen.';
      return;
    }
    if (!nombre || nombre.length > 200 || !fecha || !Number.isFinite(Date.parse(fecha))
      || (this.nuevoExamen.prioridad !== null && !['Baja', 'Media', 'Alta'].includes(this.nuevoExamen.prioridad))) {
      this.errorCrearExamen = 'Indique un nombre, una fecha válida y una prioridad permitida.';
      return;
    }
    const revision = ++this.revisionCrearExamen;
    this.guardandoExamen = true;
    this.solicitudCrearExamen = this.service.crearExamen({
      idConsulta: consulta, idDiagnostico: null, idTurno: null,
      nombreExamen: nombre, fechaExamen: fecha, fechaResultado: null,
      prioridad: this.nuevoExamen.prioridad,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: exam => {
        if (revision !== this.revisionCrearExamen || contexto !== this.contextoLecturaActual()
          || consulta !== this.idConsulta || paciente !== this.idPaciente) return;
        this.guardandoExamen = false;
        if (exam.idConsulta !== consulta || exam.idPaciente !== paciente) {
          this.errorCrearExamen = 'La API devolvió un examen que no corresponde a esta consulta. Actualice el listado.';
          return;
        }
        this.nuevoExamen.nombreExamen = '';
        this.nuevoExamen.fechaExamen = '';
        this.nuevoExamen.prioridad = null;
        this.avisoCrearExamen = 'Examen registrado. Selecciónelo para adjuntar resultados.';
        this.cargarExamenes();
      },
      error: (err: HttpErrorResponse) => {
        if (revision !== this.revisionCrearExamen || contexto !== this.contextoLecturaActual()) return;
        this.guardandoExamen = false;
        this.errorCrearExamen = this.apiErrors.messageFor(err, 'No se pudo registrar el examen.');
      },
    });
  }

  seleccionarExamen(exam: ExamenResponseDto, mode: Exclude<ExamResultsMode, 'cerrado'>): void {
    if (!this.contextoLecturaActual() || exam.idConsulta !== this.idConsulta
      || exam.idPaciente !== this.idPaciente || !this.examenes.some(item => item.idExamen === exam.idExamen)) return;
    if (mode === 'adjuntar' && (this.cantidadArchivosExamen[exam.idExamen] !== 0
      || !this.permisos.puedeModificar(MODULOS_PERMISO.HISTORIAL))) return;
    if (mode === 'archivos' && !(this.cantidadArchivosExamen[exam.idExamen]! > 0)) return;
    this.examenSeleccionado = exam;
    this.modoExamen = mode;
  }

  verResultadosDiagnostico(exam: ExamenResponseDto): void {
    if (!this.contextoLecturaActual() || exam.idConsulta !== this.idConsulta
      || exam.idPaciente !== this.idPaciente || !this.examenes.some(item => item.idExamen === exam.idExamen)) return;
    this.examenDiagnosticoSeleccionado = exam;
  }

  cerrarResultadosDiagnostico(): void {
    this.examenDiagnosticoSeleccionado = null;
  }

  cerrarExamen(): void {
    this.examenSeleccionado = null;
    this.modoExamen = 'cerrado';
  }

  actualizarCantidadArchivos(event: { examId: number; count: number | null; firstUploadedAt?: string | null }): void {
    if (!this.examenes.some(exam => exam.idExamen === event.examId)) return;
    if (event.count === null) {
      delete this.cantidadArchivosExamen[event.examId];
      delete this.fechaPrimeraCargaExamen[event.examId];
      this.errorArchivosExamen.add(event.examId);
      if (this.examenSeleccionado?.idExamen === event.examId && this.modoExamen === 'adjuntar') this.cerrarExamen();
      return;
    }
    if (Number.isSafeInteger(event.count) && event.count >= 0) {
      this.cantidadArchivosExamen[event.examId] = event.count;
      this.fechaPrimeraCargaExamen[event.examId] = event.firstUploadedAt ?? null;
      this.errorArchivosExamen.delete(event.examId);
      if (event.count > 0 && this.examenSeleccionado?.idExamen === event.examId && this.modoExamen === 'adjuntar')
        this.cerrarExamen();
    }
  }

  fechaCargaResultado(examId: number): string {
    const date = this.fechaPrimeraCargaExamen[examId];
    if (date) return formatDate(date, 'dd/MM/yyyy HH:mm', 'en-US');
    if (this.errorArchivosExamen.has(examId)) return 'No se pudieron consultar los resultados';
    if (this.cantidadArchivosExamen[examId] === 0) return 'Pendiente';
    return this.cantidadArchivosExamen[examId] == null ? 'Consultando' : 'Fecha no disponible';
  }

  formatearFechaResultado(value: string | null): string {
    if (!value) return 'No registrada';
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(dateOnly ? `${value}T00:00:00` : value);
    return Number.isNaN(parsed.getTime()) ? 'Fecha no disponible'
      : new Intl.DateTimeFormat('es-GT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(parsed);
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
    this.idExamenDiagnostico = null;
    this.diagnosticoDetalleId = null;
    this.revisionCrearExamen++;
    this.solicitudCrearExamen?.unsubscribe();
    this.solicitudCrearExamen = undefined;
    this.guardandoExamen = false;
    this.errorCrearExamen = this.avisoCrearExamen = '';
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
    this.idExamenDiagnostico = null;
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
