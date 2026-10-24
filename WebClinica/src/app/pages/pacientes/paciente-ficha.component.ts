import { HttpErrorResponse } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { catchError, forkJoin, map, of, Subscription, switchMap } from 'rxjs';
import { ContactoEmergenciaResponse } from '../../core/models/contacto-emergencia.model';
import { ConsultaDetalleDto, ConsultaListadoDto, DiagnosticoResponse, ExamenResponseDto, HistorialMedicoResponseDto, TratamientoResponseDto } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PacienteResponse } from '../../core/models/paciente.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ContactosEmergenciaService } from '../../core/services/contacto-emergencia.service';
import { HistorialService } from '../../core/services/historial.service';
import { PacientesService } from '../../core/services/paciente.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PermisosService } from '../../core/services/permisos.service';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { ExamResultsComponent } from '../historial/exam-results.component';
import { cargarCatalogoInventario, ContextoInventario, fechaInventarioValida, idInventarioValido } from '../inventario/inventario-ui';

interface ResumenClinico {
  consulta: ConsultaDetalleDto;
  diagnosticos: DiagnosticoResponse[];
  tratamientos: TratamientoResponseDto[];
  examenes: ExamenResponseDto[];
  idsDiagnosticos: number[];
  evoluciones: HistorialMedicoResponseDto[];
}

@Component({
  selector: 'app-paciente-ficha',
  imports: [CommonModule, RouterModule, UiStateComponent, ExamResultsComponent],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div><h1>Ficha Médica del Paciente</h1><p class="page-header__subtitle">Consulta de información guardada, sin cambios de datos.</p></div>
        <a routerLink="/pacientes" class="btn btn-secondary">Volver al listado</a>
      </header>

      @if (cargandoPaciente) { <app-ui-state kind="loading" title="Cargando ficha del paciente…" /> }
      @else if (errorPaciente) { <app-ui-state kind="error" title="No fue posible mostrar la ficha" [description]="errorPaciente" /> }
      @else if (paciente) {
        <section class="ui-card mb-4" aria-labelledby="ficha-encabezado">
          <div class="d-flex flex-wrap gap-4 align-items-center">
            @if (fotoUrl) { <img [src]="fotoUrl" [alt]="'Fotografía de ' + paciente.nombres + ' ' + paciente.apellidos" class="img-thumbnail" style="max-width: 160px; max-height: 160px; object-fit: contain"> }
            <div><h2 id="ficha-encabezado" class="h4">{{ paciente.nombres }} {{ paciente.apellidos }}</h2>
              <p class="mb-1">Identificador interno: {{ paciente.idPaciente }}</p>
              <span class="badge" [class.bg-success]="paciente.activo" [class.bg-secondary]="!paciente.activo">{{ paciente.activo ? 'Activo' : 'Inactivo' }}</span>
              @if (cargandoFoto) { <p role="status" class="mb-0">Cargando fotografía…</p> }
              @if (errorFoto) { <p role="status" class="text-muted mb-0">{{ errorFoto }}</p> }
            </div>
          </div>
        </section>

        <section class="ui-card mb-4" aria-labelledby="ficha-generales">
          <h2 id="ficha-generales" class="h5">Datos generales</h2>
          <div class="ficha-datos">
            <dl class="ficha-datos__col mb-0">
              <dt>Nombres</dt><dd>{{ paciente.nombres }}</dd>
              <dt>Apellidos</dt><dd>{{ paciente.apellidos }}</dd>
              <dt>DPI</dt><dd>{{ dato(paciente.dpi) }}</dd>
              <dt>Fecha de nacimiento</dt><dd>{{ dato(paciente.fechaNacimiento) }}</dd>
              <dt>Edad</dt><dd>{{ edad === null ? 'No disponible' : edad + ' años' }}</dd>
              <dt>Género</dt><dd>{{ dato(paciente.genero) }}</dd>
            </dl>
            <dl class="ficha-datos__col mb-0">
              <dt>Tipo de sangre</dt><dd>{{ dato(paciente.tipoSangre) }}</dd>
              <dt>Teléfono</dt><dd>{{ dato(paciente.telefono) }}</dd>
              <dt>Correo electrónico</dt><dd>{{ dato(paciente.correo) }}</dd>
              <dt>NIT</dt><dd>{{ dato(paciente.nit) }}</dd>
              <dt>Nombre de facturación</dt><dd>{{ dato(paciente.nombreFacturacion) }}</dd>
              <dt>Dirección</dt><dd>{{ dato(paciente.direccion) }}</dd>
            </dl>
          </div>
        </section>

        <section class="ui-card mb-4" aria-labelledby="ficha-contactos">
          <h2 id="ficha-contactos" class="h5">Contactos de emergencia</h2>
          @if (!permisos.puedeConsultar(MODULOS_PERMISO.CONTACTOS_EMERGENCIA)) { <p>Sin permiso ContactosEmergencia/Consultar.</p> }
          @else if (cargandoContactos) { <app-ui-state kind="loading" title="Cargando contactos…" [compact]="true" /> }
          @else if (errorContactos) { <app-ui-state kind="error" title="No fue posible cargar los contactos" [description]="errorContactos" [compact]="true" [retryable]="true" (retry)="cargarContactos()" /> }
          @else if (contactos.length === 0) { <app-ui-state kind="empty" title="Sin contactos de emergencia registrados" [compact]="true" /> }
          @else {
            <div class="table-responsive"><table class="table table-striped align-middle">
              <thead><tr><th scope="col">Nombre</th><th scope="col">Parentesco</th><th scope="col">Teléfono</th><th scope="col">Dirección</th><th scope="col">Estado</th></tr></thead>
              <tbody>@for (contacto of contactos; track contacto.idContacto) {
                <tr><td>{{ contacto.nombres }} {{ contacto.apellidos }}</td><td>{{ dato(contacto.parentesco) }}</td>
                  <td>{{ contacto.telefono }}</td><td>{{ contacto.direccion }}</td><td><span class="badge" [class.bg-success]="contacto.activo" [class.bg-secondary]="!contacto.activo">{{ contacto.activo ? 'Activo' : 'Retirado' }}</span></td></tr>
              }</tbody>
            </table></div>
          }
        </section>

        <section class="ui-card mb-4" aria-labelledby="ficha-historial">
          <h2 id="ficha-historial" class="h5">Historial clínico</h2>
          @if (!permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) { <p>Sin permiso Consultas/Consultar. No se muestra información clínica.</p> }
          @else if (cargandoConsultas) { <app-ui-state kind="loading" title="Cargando consultas…" [compact]="true" /> }
          @else if (errorConsultas) { <app-ui-state kind="error" title="No fue posible cargar las consultas" [description]="errorConsultas" [compact]="true" /> }
          @else if (consultas.length === 0) { <app-ui-state kind="empty" title="Sin consultas registradas" [compact]="true" /> }
          @else {
            <div class="table-responsive"><table class="table table-striped align-middle">
              <thead><tr><th scope="col">Fecha</th><th scope="col">Consulta</th><th scope="col">Médico</th><th scope="col">Acciones</th></tr></thead>
              <tbody>@for (consulta of consultas; track consulta.idConsulta) {
                <tr><td>{{ consulta.fechaConsulta | date:'dd/MM/yyyy HH:mm' }}</td><td>{{ nombreConsulta(consulta) }}</td><td>{{ nombreMedico(consulta) }}</td>
                  <td class="d-flex gap-2 flex-wrap">
                    @if (permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL)) {
                      <button #abrirResumen type="button" class="btn btn-outline-info btn-sm" (click)="verResumen(consulta, abrirResumen)"><i class="bi bi-eye" aria-hidden="true"></i> Ver resumen clínico</button>
                    } @else { <span>Sin permiso Historial/Consultar</span> }
                  </td></tr>
              }</tbody>
            </table></div>
            <nav aria-label="Páginas de consultas" class="d-flex justify-content-between align-items-center">
              <span>Total: {{ totalConsultas }} · Página {{ paginaConsultas }} de {{ paginasConsultas }}</span>
              <div class="d-flex gap-2"><button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPaginaConsultas(paginaConsultas - 1)" [disabled]="paginaConsultas <= 1">Anterior</button>
                <button type="button" class="btn btn-outline-secondary btn-sm" (click)="cambiarPaginaConsultas(paginaConsultas + 1)" [disabled]="paginaConsultas >= paginasConsultas">Siguiente</button></div>
            </nav>
          }
        </section>
        @if (consultaResumen && permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS) && permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL)) {
          <section #panelResumen id="ficha-resumen" class="ui-card resumen-panel mb-4" tabindex="-1" aria-labelledby="resumen-titulo">
            <header class="page-header resumen-header">
              <div>
                <h2 id="resumen-titulo">Resumen clínico de {{ paciente.nombres }} {{ paciente.apellidos }}</h2>
                <p class="page-header__subtitle">{{ nombreConsulta(consultaResumen) }} · {{ consultaResumen.fechaConsulta | date:'dd/MM/yyyy HH:mm' }} · {{ nombreMedico(consultaResumen) }}</p>
              </div>
              <div class="page-header__actions" aria-label="Navegación de resúmenes clínicos">
                <button type="button" class="btn btn-outline-secondary" (click)="navegarResumen(-1)" [disabled]="!puedeIrAnterior || cargandoResumen || cargandoConsultas">
                  <i class="bi bi-arrow-left" aria-hidden="true"></i> Anterior
                </button>
                <button type="button" class="btn btn-outline-secondary" (click)="navegarResumen(1)" [disabled]="!puedeIrSiguiente || cargandoResumen || cargandoConsultas">
                  Siguiente <i class="bi bi-arrow-right" aria-hidden="true"></i>
                </button>
                <button type="button" class="btn btn-primary" (click)="cerrarResumen()"><i class="bi bi-x-lg" aria-hidden="true"></i> Cerrar</button>
              </div>
            </header>
            @if (cargandoResumen || cargandoConsultas) { <app-ui-state kind="loading" title="Cargando resumen clínico…" [compact]="true" /> }
            @else if (errorResumen) { <app-ui-state kind="error" title="No fue posible cargar el resumen clínico" [description]="errorResumen" [compact]="true" /> }
            @else if (resumen) {
              <div class="resumen-contenido">
                <section class="resumen-seccion" aria-labelledby="resumen-evaluacion">
                  <h3 id="resumen-evaluacion"><i class="bi bi-clipboard2-pulse" aria-hidden="true"></i> Evaluación</h3>
                  @if (tieneEvaluacionResumen(resumen.consulta)) {
                    <div class="resumen-datos">
                      @if (resumen.consulta.sintomas?.trim()) { <p><strong>Síntomas:</strong> {{ resumen.consulta.sintomas }}</p> }
                      @if (resumen.consulta.observaciones?.trim()) { <p><strong>Observaciones:</strong> {{ resumen.consulta.observaciones }}</p> }
                      @if (resumen.consulta.pesoLb != null) { <p><strong>Peso:</strong> {{ resumen.consulta.pesoLb }} lb</p> }
                      @if (resumen.consulta.alturaCm != null) { <p><strong>Altura:</strong> {{ resumen.consulta.alturaCm }} cm</p> }
                      @if (resumen.consulta.presionSistolica != null && resumen.consulta.presionDiastolica != null) {
                        <p><strong>Presión arterial:</strong> {{ resumen.consulta.presionSistolica }}/{{ resumen.consulta.presionDiastolica }} mmHg</p>
                      } @else {
                        @if (resumen.consulta.presionSistolica != null) { <p><strong>Presión sistólica:</strong> {{ resumen.consulta.presionSistolica }} mmHg</p> }
                        @if (resumen.consulta.presionDiastolica != null) { <p><strong>Presión diastólica:</strong> {{ resumen.consulta.presionDiastolica }} mmHg</p> }
                      }
                      @if (resumen.consulta.temperaturaC != null) { <p><strong>Temperatura:</strong> {{ resumen.consulta.temperaturaC }} °C</p> }
                      @if (resumen.consulta.frecuenciaCardiaca != null) { <p><strong>Frecuencia cardíaca:</strong> {{ resumen.consulta.frecuenciaCardiaca }} lpm</p> }
                    </div>
                  } @else { <p class="resumen-vacio">No hay datos de evaluación registrados.</p> }
                </section>
                <section class="resumen-seccion" aria-labelledby="resumen-examenes">
                  <h3 id="resumen-examenes"><i class="bi bi-file-earmark-medical" aria-hidden="true"></i> Exámenes</h3>
                  @if (resumen.examenes.length === 0) {
                    <p class="resumen-vacio">No hay exámenes registrados para esta consulta.</p>
                  } @else {
                    <div class="resumen-examenes">
                      @for (item of resumen.examenes; track item.idExamen) {
                        <article class="resumen-examen">
                          <h4>{{ item.nombreExamen }}</h4>
                          <p><strong>Fecha del examen:</strong> {{ item.fechaExamen | date:'dd/MM/yyyy' }}
                            @if (item.prioridad) { · <strong>Prioridad:</strong> {{ item.prioridad }} }
                            @if (item.fechaResultado) { · <strong>Fecha de resultado:</strong> {{ item.fechaResultado | date:'dd/MM/yyyy' }} }
                          </p>
                          <app-exam-results [exam]="item" [consultationId]="resumen.consulta.idConsulta"
                            [patientId]="paciente.idPaciente" [allowedDiagnosisIds]="resumen.idsDiagnosticos" mode="detalle" />
                        </article>
                      }
                    </div>
                  }
                </section>
                <section class="resumen-seccion" aria-labelledby="resumen-diagnosticos">
                  <h3 id="resumen-diagnosticos"><i class="bi bi-heart-pulse" aria-hidden="true"></i> Diagnóstico</h3>
                  <ul>@for (item of resumen.diagnosticos; track item.idDiagnostico) { <li>{{ item.descripcion }}</li> } @empty { <li>Sin diagnósticos registrados.</li> }</ul>
                </section>
                <section class="resumen-seccion" aria-labelledby="resumen-tratamientos">
                  <h3 id="resumen-tratamientos"><i class="bi bi-capsule" aria-hidden="true"></i> Tratamiento</h3>
                  <ul>@for (item of resumen.tratamientos; track item.idTratamiento) { <li>{{ item.descripcion }} @if (item.indicaciones) { — {{ item.indicaciones }} } · Inicio: {{ item.fechaInicio | date:'dd/MM/yyyy' }} @if (item.fechaFin) { · Fin: {{ item.fechaFin | date:'dd/MM/yyyy' }} }</li> } @empty { <li>Sin tratamientos registrados.</li> }</ul>
                </section>
                <section class="resumen-seccion" aria-labelledby="resumen-evolucion">
                  <h3 id="resumen-evolucion"><i class="bi bi-graph-up" aria-hidden="true"></i> Evolución</h3>
                  <ul>@for (item of resumen.evoluciones; track item.idHistorial) { <li>{{ item.descripcion }} · {{ item.fechaHistorial | date:'dd/MM/yyyy HH:mm' }}</li> } @empty { <li>Sin evoluciones registradas.</li> }</ul>
                </section>
                <section class="resumen-seccion" aria-labelledby="resumen-hospitalizacion">
                  <h3 id="resumen-hospitalizacion"><i class="bi bi-hospital" aria-hidden="true"></i> Hospitalización</h3>
                  <p class="resumen-vacio">La consulta de hospitalizaciones requiere autorización específica.</p>
                </section>
              </div>
            }
          </section>
        }
      }
    </div>
  `,
  styles: [`
    .ficha-datos { display: grid; gap: 1.25rem 2rem; }
    .ficha-datos__col { display: grid; grid-template-columns: minmax(8rem, 42%) minmax(0, 1fr); gap: .5rem .75rem; }
    .ficha-datos__col dt, .ficha-datos__col dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
    @media (min-width: 992px) { .ficha-datos { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
    .resumen-panel { scroll-margin-top: 1rem; }
    .resumen-header h2 { font-size: clamp(1.6rem, 2.5vw, 2.25rem); font-weight: 700; }
    .resumen-contenido { display: grid; gap: 1.25rem; }
    .resumen-seccion { border: 1px solid var(--ui-border); border-radius: .5rem; overflow: hidden; min-width: 0; }
    .resumen-seccion h3 { display: flex; align-items: center; gap: .75rem; margin: 0; padding: .85rem 1rem; background: #edf3f8; color: var(--ui-heading); font-size: 1.15rem; font-weight: 650; }
    .resumen-seccion h3 i { color: #0d6efd; }
    .resumen-seccion ul { margin: 0; padding: 1rem 1.5rem 1rem 2.5rem; }
    .resumen-seccion li + li { margin-top: .35rem; }
    .resumen-datos, .resumen-vacio { margin: 0; padding: 1rem 1.5rem; }
    .resumen-datos p { margin: 0; overflow-wrap: anywhere; }
    .resumen-datos p + p { margin-top: .35rem; }
    .resumen-examenes { display: grid; gap: 1rem; padding: 1rem; min-width: 0; }
    .resumen-examen { min-width: 0; padding: 1rem; border: 1px solid var(--ui-border); border-radius: .5rem; }
    .resumen-examen h4 { color: var(--ui-heading); font-size: 1rem; font-weight: 650; overflow-wrap: anywhere; }
    .resumen-examen p { margin: 0; overflow-wrap: anywhere; }
    .resumen-examen app-exam-results { display: block; min-width: 0; }
  `],
})
export class PacienteFichaComponent implements OnInit {
  @ViewChild('panelResumen') private panelResumen?: ElementRef<HTMLElement>;
  private readonly route = inject(ActivatedRoute);
  private readonly pacientesService = inject(PacientesService);
  private readonly contactosService = inject(ContactosEmergenciaService);
  private readonly historialService = inject(HistorialService);
  private readonly empleadosService = inject(EmpleadosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  private readonly contexto = new ContextoInventario(['Pacientes', 'ContactosEmergencia', 'Consultas', 'Historial', 'Empleados']);
  private solicitudes = new Subscription();
  private solicitudResumen?: Subscription;
  private botonOrigenResumen: HTMLButtonElement | null = null;
  private revision = 0;
  private revisionResumen = 0;
  private rutaId: string | null = null;
  private urlObjeto: string | null = null;

  paciente: PacienteResponse | null = null;
  cargandoPaciente = false; errorPaciente = '';
  fotoUrl: string | null = null; cargandoFoto = false; errorFoto = '';
  contactos: ContactoEmergenciaResponse[] = [];
  cargandoContactos = false; errorContactos = '';
  consultas: ConsultaListadoDto[] = [];
  private nombresConsultas = new Map<number, string>();
  private detallesConsultas = new Map<number, ConsultaDetalleDto>();
  private nombresMedicos = new Map<number, string>();
  paginaConsultas = 1; paginasConsultas = 0; totalConsultas = 0; cargandoConsultas = false; errorConsultas = '';
  consultaResumen: ConsultaListadoDto | null = null;
  private indiceDestinoResumen: number | null = null;
  resumen: ResumenClinico | null = null; cargandoResumen = false; errorResumen = '';

  constructor() {
    this.contexto.observar(() => this.cargarFicha());
    this.destroyRef.onDestroy(() => { this.solicitudes.unsubscribe(); this.revocarFoto(); });
  }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      this.rutaId = params.get('id'); this.cargarFicha();
    });
  }

  get edad(): number | null {
    const valor = this.paciente?.fechaNacimiento;
    if (!valor || !fechaInventarioValida(valor)) return null;
    const hoy = new Date(); const [anio, mes, dia] = valor.split('-').map(Number);
    let edad = hoy.getFullYear() - anio;
    if (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)) edad--;
    return edad >= 0 && edad <= 130 ? edad : null;
  }

  dato(valor?: string | null): string { return valor?.trim() || 'No registrado'; }
  tieneEvaluacionResumen(c: ConsultaDetalleDto): boolean {
    return !!(c.sintomas?.trim() || c.observaciones?.trim()
      || c.pesoLb != null || c.alturaCm != null
      || c.presionSistolica != null || c.presionDiastolica != null
      || c.temperaturaC != null || c.frecuenciaCardiaca != null);
  }
  nombreConsulta(consulta: ConsultaListadoDto): string { return this.nombresConsultas.get(consulta.idConsulta) || 'Consulta sin motivo registrado'; }
  nombreMedico(consulta: ConsultaListadoDto): string { return this.nombresMedicos.get(consulta.idMedico) || 'Médico no disponible'; }
  get puedeIrAnterior(): boolean { return this.indiceActualResumen > 0; }
  get puedeIrSiguiente(): boolean { const indice = this.indiceActualResumen; return indice >= 0 && indice < this.totalConsultas - 1; }
  private get indiceActualResumen(): number {
    const indice = this.consultas.findIndex(c => c.idConsulta === this.consultaResumen?.idConsulta);
    return indice < 0 ? -1 : (this.paginaConsultas - 1) * 10 + indice;
  }

  cargarFicha(): void {
    this.solicitudResumen?.unsubscribe(); this.solicitudResumen = undefined;
    this.solicitudes.unsubscribe(); this.solicitudes = new Subscription();
    const revision = ++this.revision; ++this.revisionResumen;
    this.paciente = null; this.cargandoPaciente = false; this.errorPaciente = '';
    this.revocarFoto(); this.cargandoFoto = false; this.errorFoto = '';
    this.contactos = []; this.cargandoContactos = false; this.errorContactos = '';
    this.consultas = []; this.paginaConsultas = 1; this.paginasConsultas = this.totalConsultas = 0; this.cargandoConsultas = false; this.errorConsultas = '';
    this.nombresConsultas.clear(); this.detallesConsultas.clear(); this.nombresMedicos.clear();
    this.consultaResumen = null; this.indiceDestinoResumen = null;
    this.botonOrigenResumen = null;
    this.resumen = null; this.cargandoResumen = false; this.errorResumen = '';
    const ruta = this.rutaId;
    if (!ruta || !/^[1-9]\d*$/.test(ruta) || !idInventarioValido(Number(ruta))) {
      this.errorPaciente = 'Identificador de paciente inválido.'; return;
    }
    const id = Number(ruta); const clave = this.contexto.clave();
    if (!this.contexto.vigente(clave) || !this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
      this.errorPaciente = 'No tiene sesión y permiso Pacientes/Consultar vigentes.'; return;
    }
    this.cargandoPaciente = true;
    this.agregar(this.pacientesService.obtener(id).subscribe({
      next: paciente => {
        if (!this.vigente(revision, clave, id)) return;
        if (!paciente || paciente.idPaciente !== id || !paciente.nombres?.trim() || !paciente.apellidos?.trim()) {
          this.errorPaciente = 'La API devolvió un paciente contradictorio.'; this.cargandoPaciente = false; return;
        }
        this.paciente = paciente; this.cargandoPaciente = false;
        if (paciente.urlFoto) this.cargarFoto(id, revision, clave);
        if (this.permisos.puedeConsultar(MODULOS_PERMISO.CONTACTOS_EMERGENCIA)) this.cargarContactos();
        if (this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) this.cargarConsultas();
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(revision, clave, id)) return;
        this.cargandoPaciente = false;
        this.errorPaciente = err.status === 404 ? 'Paciente no encontrado.' :
          this.apiErrors.messageFor(err, 'No fue posible consultar el paciente.');
      },
    }));
  }

  private cargarFoto(id: number, revision: number, clave: string): void {
    this.cargandoFoto = true;
    this.agregar(this.pacientesService.obtenerFoto(id).subscribe({
      next: blob => {
        if (!this.vigente(revision, clave, id)) return;
        this.cargandoFoto = false;
        if (!blob || blob.size <= 0 || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
          this.errorFoto = 'La fotografía protegida no tiene un formato válido.'; return;
        }
        this.revocarFoto(); this.urlObjeto = URL.createObjectURL(blob); this.fotoUrl = this.urlObjeto;
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(revision, clave, id)) return;
        this.cargandoFoto = false;
        this.errorFoto = err.status === 404 ? 'Sin fotografía registrada.' : this.apiErrors.messageFor(err, 'No fue posible cargar la fotografía protegida.');
      },
    }));
  }

  cargarContactos(): void {
    const id = this.paciente?.idPaciente; const revision = this.revision; const clave = this.contexto.clave();
    if (!id || !this.vigente(revision, clave, id) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONTACTOS_EMERGENCIA)) return;
    this.cargandoContactos = true; this.errorContactos = '';
    this.agregar(cargarCatalogoInventario(
      (pagina, tamano) => this.contactosService.listar(id, pagina, tamano), c => c.idContacto,
    ).subscribe({
      next: items => {
        if (!this.vigente(revision, clave, id) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONTACTOS_EMERGENCIA)) return;
        if (items.some(c => c.idPaciente !== id)) {
          this.contactos = []; this.errorContactos = 'La API devolvió contactos contradictorios.';
        } else { this.contactos = items; }
        this.cargandoContactos = false;
      },
      error: (err: unknown) => {
        if (!this.vigente(revision, clave, id)) return;
        this.contactos = []; this.cargandoContactos = false;
        this.errorContactos = err instanceof HttpErrorResponse ?
          this.apiErrors.messageFor(err, 'No fue posible cargar los contactos.') :
          'La API devolvió paginación de contactos contradictoria.';
      },
    }));
  }

  cargarConsultas(): void {
    const id = this.paciente?.idPaciente; const revision = this.revision; const clave = this.contexto.clave();
    const pagina = this.paginaConsultas;
    if (!id || !this.vigente(revision, clave, id) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) return;
    this.solicitudResumen?.unsubscribe(); this.solicitudResumen = undefined;
    this.cargandoConsultas = true; this.errorConsultas = ''; this.resumen = null;
    this.cargandoResumen = this.indiceDestinoResumen !== null; this.errorResumen = ''; ++this.revisionResumen;
    this.agregar(this.historialService.listarConsultas({ idPaciente: id, idMedico: null, idSucursal: null, idClinica: null,
      desde: null, hasta: null, page: pagina, pageSize: 10 }).subscribe({
      next: res => {
        if (!this.vigente(revision, clave, id) || pagina !== this.paginaConsultas) return;
        const paginas = Math.ceil(res.totalCount / 10);
        const esperados = Math.min(10, Math.max(0, res.totalCount - (pagina - 1) * 10));
        if (!Array.isArray(res.items) || res.page !== pagina || res.pageSize !== 10 ||
          !Number.isSafeInteger(res.totalCount) || res.totalCount < 0 || res.totalPages !== paginas || res.items.length !== esperados ||
          res.items.some(c => !idInventarioValido(c.idConsulta) || c.idPaciente !== id)) {
          this.consultas = []; this.errorConsultas = 'La API devolvió consultas o paginación contradictorias.';
        } else { this.consultas = res.items; this.totalConsultas = res.totalCount; this.paginasConsultas = paginas; this.cargarNombresConsultas(res.items, revision, clave, id); }
        this.cargandoConsultas = false;
        if (this.indiceDestinoResumen !== null) {
          const destino = this.consultas[this.indiceDestinoResumen];
          this.indiceDestinoResumen = null;
          if (destino) this.verResumen(destino);
          else { this.cargandoResumen = false; this.errorResumen = this.errorConsultas || 'No fue posible abrir el siguiente resumen clínico.'; }
        }
      },
      error: (err: HttpErrorResponse) => {
        if (!this.vigente(revision, clave, id) || pagina !== this.paginaConsultas) return;
        this.consultas = []; this.cargandoConsultas = false;
        this.errorConsultas = this.apiErrors.messageFor(err, 'No fue posible cargar las consultas.');
        if (this.indiceDestinoResumen !== null) {
          this.indiceDestinoResumen = null; this.cargandoResumen = false; this.errorResumen = this.errorConsultas;
        }
      },
    }));
  }

  private cargarNombresConsultas(consultas: ConsultaListadoDto[], revision: number, clave: string, idPaciente: number): void {
    for (const consulta of consultas) {
      if (this.nombresConsultas.has(consulta.idConsulta)) continue;
      this.agregar(this.historialService.obtenerConsulta(consulta.idConsulta).pipe(
        catchError(() => of(null)),
      ).subscribe(detalle => {
        if (!this.vigente(revision, clave, idPaciente) ||
          !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS) ||
          !this.consultas.some(c => c.idConsulta === consulta.idConsulta)) return;
        if (detalle && detalle.idConsulta === consulta.idConsulta && detalle.idPaciente === idPaciente
          && detalle.idMedico === consulta.idMedico) {
          this.detallesConsultas.set(consulta.idConsulta, detalle);
          this.nombresConsultas.set(consulta.idConsulta, detalle.motivoConsulta?.trim() || 'Consulta sin motivo registrado');
        }
      }));
    }
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) return;
    for (const idMedico of new Set(consultas.map(c => c.idMedico).filter(idInventarioValido))) {
      if (this.nombresMedicos.has(idMedico)) continue;
      this.agregar(this.empleadosService.obtener(idMedico).pipe(
        catchError(() => of(null)),
      ).subscribe(medico => {
        if (!this.vigente(revision, clave, idPaciente) ||
          !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS) ||
          !this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS) ||
          !this.consultas.some(c => c.idMedico === idMedico)) return;
        if (medico && medico.idEmpleado === idMedico && medico.nombres?.trim() && medico.apellidos?.trim()) {
          this.nombresMedicos.set(idMedico, `${medico.nombres.trim()} ${medico.apellidos.trim()}`);
        }
      }));
    }
  }

  cambiarPaginaConsultas(pagina: number): void {
    if (Number.isInteger(pagina) && pagina > 0 && pagina <= this.paginasConsultas && !this.cargandoConsultas) {
      if (this.consultaResumen && this.indiceDestinoResumen === null) this.cerrarResumen();
      this.paginaConsultas = pagina; this.cargarConsultas();
    }
  }

  navegarResumen(direccion: -1 | 1): void {
    if (this.cargandoResumen || this.cargandoConsultas || !this.consultaResumen) return;
    const actual = this.indiceActualResumen;
    const destino = actual + direccion;
    if (actual < 0 || destino < 0 || destino >= this.totalConsultas) return;
    const pagina = Math.floor(destino / 10) + 1;
    const indice = destino % 10;
    if (pagina === this.paginaConsultas) {
      const consulta = this.consultas[indice];
      if (consulta) this.verResumen(consulta);
    } else {
      this.indiceDestinoResumen = indice;
      this.cambiarPaginaConsultas(pagina);
    }
  }

  cerrarResumen(): void {
    const origen = this.botonOrigenResumen;
    this.solicitudResumen?.unsubscribe(); this.solicitudResumen = undefined;
    ++this.revisionResumen;
    this.consultaResumen = null; this.indiceDestinoResumen = null;
    this.resumen = null; this.cargandoResumen = false; this.errorResumen = '';
    this.botonOrigenResumen = null;
    if (origen?.isConnected) origen.focus({ preventScroll: true });
  }

  verResumen(consulta: ConsultaListadoDto, botonOrigen?: HTMLButtonElement): void {
    const id = this.paciente?.idPaciente; const revision = this.revision; const clave = this.contexto.clave();
    if (!id || !this.vigente(revision, clave, id) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS) ||
      !this.permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL) ||
      !idInventarioValido(consulta.idConsulta) || consulta.idPaciente !== id) return;
    const consultaActual = this.consultas.find(c => c.idConsulta === consulta.idConsulta && c.idPaciente === id);
    if (!consultaActual) return;
    this.solicitudResumen?.unsubscribe();
    const idConsulta = consultaActual.idConsulta; const revisionResumen = ++this.revisionResumen;
    this.consultaResumen = consultaActual; this.indiceDestinoResumen = null;
    if (botonOrigen) { this.botonOrigenResumen = botonOrigen; this.enfocarResumen(idConsulta); }
    this.resumen = null; this.errorResumen = ''; this.cargandoResumen = true;
    const diagnosticos$ = cargarCatalogoInventario(
      (page, pageSize) => this.historialService.listarDiagnosticos({ idConsulta, page, pageSize }), d => d.idDiagnostico);
    const tratamientos$ = cargarCatalogoInventario(
      (page, pageSize) => this.historialService.listarTratamientos({ idConsulta, page, pageSize }), t => t.idTratamiento);
    const evoluciones$ = cargarCatalogoInventario(
      (page, pageSize) => this.historialService.listarHistorial({ idConsulta, page, pageSize }), e => e.idHistorial ?? 0);
    const detalle = this.detallesConsultas.get(idConsulta);
    const consulta$ = detalle ? of(detalle) : this.historialService.obtenerConsulta(idConsulta);
    const examenesDe = (filtro: { idConsulta?: number; idDiagnostico?: number }) => cargarCatalogoInventario(
      (page: number, pageSize: number) => this.historialService.listarExamenes({ ...filtro, page, pageSize }), e => e.idExamen);
    const lectura = forkJoin({ consulta: consulta$, diagnosticos: diagnosticos$, tratamientos: tratamientos$, evoluciones: evoluciones$ }).pipe(
      switchMap(datos => forkJoin([examenesDe({ idConsulta }),
        ...datos.diagnosticos.map(d => examenesDe({ idDiagnostico: d.idDiagnostico }))]).pipe(
          map(paginas => ({ ...datos, examenes: [...new Map(paginas.flat().map(e => [e.idExamen, e])).values()] })))),
    );
    this.solicitudResumen = lectura.subscribe({
      next: datos => {
        if (!this.vigente(revision, clave, id) || revisionResumen !== this.revisionResumen ||
          !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS) ||
          !this.permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL) ||
          !this.consultas.some(c => c.idConsulta === idConsulta && c.idPaciente === id)) return;
        const idsDiagnosticos = new Set(datos.diagnosticos.map(d => d.idDiagnostico));
        if (datos.consulta.idConsulta !== idConsulta || datos.consulta.idPaciente !== id
          || datos.consulta.idMedico !== consultaActual.idMedico ||
          datos.diagnosticos.some(d => d.idConsulta !== idConsulta) ||
          datos.tratamientos.some(t => t.idConsulta !== idConsulta || t.idPaciente !== id) ||
          datos.evoluciones.some(e => e.idConsulta !== idConsulta || e.idPaciente !== id) ||
          datos.examenes.some(e => e.idPaciente !== id ||
            (e.idConsulta !== null && e.idConsulta !== idConsulta) ||
            (e.idDiagnostico !== null && !idsDiagnosticos.has(e.idDiagnostico)) ||
            (e.idConsulta === null && e.idDiagnostico === null))) {
          this.errorResumen = 'La API devolvió información clínica ajena o contradictoria.';
        } else {
          this.detallesConsultas.set(idConsulta, datos.consulta);
          this.nombresConsultas.set(idConsulta, datos.consulta.motivoConsulta?.trim() || 'Consulta sin motivo registrado');
          this.resumen = { ...datos, idsDiagnosticos: [...idsDiagnosticos], evoluciones: [...datos.evoluciones].sort((a, b) =>
            Date.parse(a.fechaHistorial) - Date.parse(b.fechaHistorial)
            || (a.idHistorial ?? 0) - (b.idHistorial ?? 0)) };
        }
        this.cargandoResumen = false;
      },
      error: (err: unknown) => {
        if (!this.vigente(revision, clave, id) || revisionResumen !== this.revisionResumen ||
          !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS) ||
          !this.permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL)) return;
        this.cargandoResumen = false;
        this.errorResumen = err instanceof HttpErrorResponse ?
          this.apiErrors.messageFor(err, 'No fue posible cargar el resumen clínico.') :
          'La API devolvió paginación clínica contradictoria.';
      },
    });
    this.agregar(this.solicitudResumen);
  }

  private enfocarResumen(idConsulta: number): void {
    setTimeout(() => {
      if (this.destroyRef.destroyed || this.consultaResumen?.idConsulta !== idConsulta) return;
      const panel = this.panelResumen?.nativeElement;
      if (!panel?.isConnected) return;
      panel.focus({ preventScroll: true });
      panel.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }, 0);
  }

  private agregar(solicitud: Subscription): void { this.solicitudes.add(solicitud); this.contexto.agregar(solicitud); }
  private vigente(revision: number, clave: string, id: number): boolean {
    return revision === this.revision && this.contexto.vigente(clave) &&
      this.rutaId === String(id) && this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES);
  }
  private revocarFoto(): void { if (this.urlObjeto) URL.revokeObjectURL(this.urlObjeto); this.urlObjeto = this.fotoUrl = null; }
}
