import { HttpErrorResponse } from '@angular/common/http';
import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { ConsultaCreateDto, ConsultaDetalleDto } from '../../core/models/historial.model';
import { Clinica, Sucursal } from '../../core/models/catalogos.model';
import { EmpleadoListadoResponse, PagedResponse } from '../../core/models/empleado.model';
import { EmpleadosService } from '../../core/services/empleado.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PacienteListadoResponse } from '../../core/models/paciente.model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-consulta-nueva',
    imports: [RouterModule, FormsModule],
    template: `
    <div class="container mt-4 consulta-nueva-page">
      <header class="page-header consulta-nueva-page__header">
        <div>
          <h1>Nueva Consulta</h1>
          <p class="page-header__subtitle">Registra una nueva consulta para un paciente existente. La evaluación clínica se completa después.</p>
        </div>
        <a routerLink="/consultas" class="btn btn-outline-secondary">Volver al listado</a>
      </header>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <section class="ui-card consulta-nueva-page__card" aria-labelledby="consulta-paciente-title">
        <h2 id="consulta-paciente-title" class="h5 consulta-nueva-page__heading">Paciente</h2>
        <div class="row g-3">
          <div class="col-12">
            <label for="paciente-consulta" class="form-label">Paciente <span class="text-danger" aria-hidden="true">*</span></label>
            <select id="paciente-consulta" class="form-select" name="idPaciente" required
              [ngModel]="idPaciente" (ngModelChange)="elegirPaciente($event)"
              [disabled]="cargando || cargandoPacientes || (!pacientesPagina.length && !pacienteSeleccionado)">
              <option [ngValue]="0">Seleccione...</option>
              @if (paginaPacientes > 1) {
                <option [ngValue]="-1">Ver pacientes anteriores</option>
              }
              @if (pacienteSeleccionado && !seleccionPacienteEnPagina()) {
                <option [ngValue]="pacienteSeleccionado.idPaciente">{{ pacienteSeleccionado.nombres }} {{ pacienteSeleccionado.apellidos }} · ID {{ pacienteSeleccionado.idPaciente }}</option>
              }
              @for (paciente of pacientesPagina; track paciente.idPaciente) {
                <option [ngValue]="paciente.idPaciente">{{ paciente.nombres }} {{ paciente.apellidos }} · ID {{ paciente.idPaciente }}</option>
              }
              @if (paginaPacientes < totalPaginasPacientes) {
                <option [ngValue]="-2">Ver más pacientes</option>
              }
            </select>
          </div>
        </div>
        @if (errorPacientes) { <p class="alert alert-danger mt-2" role="alert">{{ errorPacientes }}</p> }
        @if (cargandoPacientes) { <p role="status">Cargando pacientes...</p> }
        @if (!cargandoPacientes && pacientesPagina.length === 0 && !errorPacientes) {
          <p class="text-muted mt-2 mb-0">No hay pacientes activos en esta página.</p>
        }
        @if (pacienteSeleccionado) {
          <div class="consulta-nueva-page__patient mt-3" role="status">
            @if (fotoPacienteUrl) {
              <img [src]="fotoPacienteUrl" alt="Fotografía del paciente seleccionado" class="consulta-nueva-page__avatar">
            } @else {
              <span class="consulta-nueva-page__avatar consulta-nueva-page__avatar--empty" aria-hidden="true"><i class="bi bi-person-fill"></i></span>
            }
            <div class="consulta-nueva-page__patient-copy">
              <strong>{{ pacienteSeleccionado.nombres }} {{ pacienteSeleccionado.apellidos }}</strong>
              <span>Identificador interno: {{ pacienteSeleccionado.idPaciente }}</span>
              <span class="badge text-bg-success align-self-start">Activo</span>
            </div>
            <button type="button" class="btn btn-outline-primary btn-sm consulta-nueva-page__photo-button"
              (click)="cargarFotoPaciente()" [disabled]="cargando || cargandoFoto || !puedeConsultarPacientes()">
              {{ cargandoFoto ? 'Cargando fotografía...' : 'Ver fotografía' }}
            </button>
          </div>
          @if (avisoFoto) { <p class="text-muted mt-2 mb-0" role="status">{{ avisoFoto }}</p> }
          @if (errorFoto) { <p class="text-danger mt-2 mb-0" role="alert">{{ errorFoto }}</p> }
        }
      </section>

      <form id="consulta-nueva-form" (ngSubmit)="guardar()" class="consulta-nueva-page__form">
        <fieldset [disabled]="cargando || !puedeCrear() || !puedeConsultarPacientes() || !pacienteSeleccionado">
        <section class="ui-card consulta-nueva-page__card" aria-labelledby="consulta-datos-title">
          <h2 id="consulta-datos-title" class="h5 consulta-nueva-page__heading">Datos de la consulta</h2>
          <div class="row g-3">
          @if (modoMedico === 'seleccion' || modoMedico === 'cargando' || errorMedicos) {
          <div class="col-12 col-md-6">
            @if (modoMedico === 'seleccion') {
              <label class="form-label" for="medico">Médico responsable *</label>
              <select id="medico" class="form-select" name="idMedico" required
                [ngModel]="form.idMedico" (ngModelChange)="seleccionarMedico($event)"
                [disabled]="cargandoMedicos">
                <option [ngValue]="null">Seleccione...</option>
                @if (medicoSeleccionado && !seleccionEnPagina()) {
                  <option [ngValue]="medicoSeleccionado.idEmpleado">{{ etiquetaMedico(medicoSeleccionado) }}</option>
                }
                @for (medico of medicos; track medico.idEmpleado) {
                  <option [ngValue]="medico.idEmpleado">{{ etiquetaMedico(medico) }}</option>
                }
              </select>
              <div class="consulta-nueva-page__pager mt-2">
                <button type="button" class="btn btn-outline-secondary btn-sm"
                  [disabled]="cargandoMedicos || paginaMedicos <= 1" (click)="cargarMedicos(paginaMedicos - 1)">Anterior</button>
                <span>Página {{ paginaMedicos }} de {{ totalPaginasMedicos }} · {{ totalMedicos }} médicos</span>
                <button type="button" class="btn btn-outline-secondary btn-sm"
                  [disabled]="cargandoMedicos || paginaMedicos >= totalPaginasMedicos"
                  (click)="cargarMedicos(paginaMedicos + 1)">Siguiente</button>
                <button type="button" class="btn btn-link btn-sm" [disabled]="cargandoMedicos"
                  (click)="cargarMedicos(paginaMedicos)">Recargar médicos</button>
              </div>
              @if (cargandoMedicos) { <p role="status">Cargando médicos...</p> }
              @if (!cargandoMedicos && !errorMedicos && totalMedicos === 0) {
                <p>No hay médicos activos disponibles.</p>
              }
            } @else if (modoMedico === 'cargando') {
              <p role="status">Verificando el empleado vinculado...</p>
            }
            @if (errorMedicos) { <p class="alert alert-danger" role="alert">{{ errorMedicos }}</p> }
          </div>
          }
          <div class="col-12 col-md-6">
            <label for="consulta-sucursal" class="form-label">Sucursal <span class="text-danger" aria-hidden="true">*</span></label>
            <select id="consulta-sucursal" class="form-select" [(ngModel)]="form.idSucursal" name="idSucursal" required>
              <option [ngValue]="null">Seleccione...</option>
              @for (s of sucursales; track s.idSucursal) {
                <option [ngValue]="s.idSucursal">{{ s.nombre }}</option>
              }
            </select>
          </div>
          @if (puedeConsultarClinicas()) {
            <div class="col-12 col-md-6">
              <label for="consulta-clinica" class="form-label">Clínica (opcional)</label>
              <select id="consulta-clinica" class="form-select" [(ngModel)]="form.idClinica" name="idClinica">
                <option [ngValue]="null">Sin clínica</option>
                @for (clinica of clinicasDeSucursal(); track clinica.idClinica) {
                  <option [ngValue]="clinica.idClinica">{{ clinica.nombreClinica }}</option>
                }
              </select>
              @if (errorClinicas) { <p class="text-danger" role="alert">{{ errorClinicas }}</p> }
            </div>
          }
          <div class="col-12 col-md-6">
            <label for="consulta-fecha" class="form-label">Fecha y hora de consulta <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="consulta-fecha" type="datetime-local" class="form-control" [(ngModel)]="form.fechaConsulta" name="fechaConsulta" required>
          </div>
          <div class="col-12">
            <label for="consulta-motivo" class="form-label">Motivo de la consulta (opcional)</label>
            <textarea id="consulta-motivo" class="form-control" name="motivoConsulta" rows="3" maxlength="300"
              [(ngModel)]="motivoConsulta" placeholder="Describa brevemente el motivo de atención"></textarea>
          </div>
          </div>
        </section>

        <section class="ui-card consulta-nueva-page__card" aria-labelledby="consulta-acciones-title">
          <h2 id="consulta-acciones-title" class="h5 consulta-nueva-page__heading">Acciones</h2>
          <div class="consulta-nueva-page__actions">
          <a routerLink="/consultas" class="btn btn-secondary">Cancelar</a>
          <button type="submit" class="btn btn-success" [disabled]="cargando || modoMedico === 'bloqueado' || modoMedico === 'cargando' || cargandoMedicos">
            {{ cargando ? 'Guardando...' : 'Guardar consulta' }}
          </button>
          </div>
        </section>
        </fieldset>
      </form>
    </div>
  `,
  styles: [`
    .consulta-nueva-page__header { align-items: start; gap: 1rem; }
    .consulta-nueva-page__card { padding: 1.4rem; margin-bottom: 1.25rem; }
    .consulta-nueva-page__heading { color: var(--ui-heading); font-weight: 700; margin-bottom: 1rem; }
    .consulta-nueva-page__form fieldset { border: 0; padding: 0; min-width: 0; }
    .consulta-nueva-page .form-control, .consulta-nueva-page .form-select { min-height: 2.5rem; }
    .consulta-nueva-page__pager, .consulta-nueva-page__actions { display: flex; align-items: center; flex-wrap: wrap; gap: .6rem; }
    .consulta-nueva-page__patient { display: flex; align-items: center; flex-wrap: wrap; gap: 1rem; border-top: 1px solid #dce6f0; padding-top: 1rem; }
    .consulta-nueva-page__avatar { width: 4rem; height: 4rem; border-radius: 50%; object-fit: cover; flex: 0 0 auto; }
    .consulta-nueva-page__avatar--empty { display: grid; place-items: center; background: #edf3f8; color: #647b9d; font-size: 1.8rem; }
    .consulta-nueva-page__patient-copy { display: grid; gap: .2rem; min-width: 0; overflow-wrap: anywhere; color: var(--ui-heading); }
    .consulta-nueva-page__patient-copy span:not(.badge) { color: var(--ui-muted); font-size: .9rem; }
    .consulta-nueva-page__photo-button { margin-left: auto; }
    @media (max-width: 575.98px) {
      .consulta-nueva-page__card { padding: 1rem; }
      .consulta-nueva-page__header .btn, .consulta-nueva-page__photo-button { margin-left: 0; }
    }
  `]
})
export class ConsultaNuevaComponent implements OnInit, OnDestroy {
  private service = inject(HistorialService);
  private catalogosService = inject(CatalogosService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private empleados = inject(EmpleadosService);
  private session = inject(AuthSessionService);
  private permisos = inject(PermisosService);
  private errores = inject(ApiErrorService);
  private pacientesService = inject(PacientesService);
  private solicitudes = new Subscription();
  private paginaSolicitud?: Subscription;
  private revisionPagina = 0;
  private contexto = '';
  private iniciado = false;
  private destruido = false;

  idPaciente = 0;
  pacienteSeleccionado: PacienteListadoResponse | null = null;
  pacientesPagina: PacienteListadoResponse[] = [];
  paginaPacientes = 1;
  totalPaginasPacientes = 0;
  totalPacientes = 0;
  cargandoPacientes = false;
  errorPacientes = '';
  private idSugerido = 0;
  private solicitudPacientes?: Subscription;
  private solicitudFoto?: Subscription;
  private revisionPacientes = 0;
  private revisionFoto = 0;
  private revisionSeleccionPaciente = 0;
  readonly tamanoPaginaPacientes = 20;
  fotoPacienteUrl: string | null = null;
  cargandoFoto = false;
  avisoFoto = '';
  errorFoto = '';
  cargando = false;
  error = '';
  sucursales: Sucursal[] = [];
  clinicas: Clinica[] = [];
  errorClinicas = '';
  modoMedico: 'cargando' | 'inferencia' | 'seleccion' | 'bloqueado' = 'bloqueado';
  medicos: EmpleadoListadoResponse[] = [];
  medicoSeleccionado: EmpleadoListadoResponse | null = null;
  cargandoMedicos = false;
  errorMedicos = '';
  paginaMedicos = 1;
  totalPaginasMedicos = 0;
  totalMedicos = 0;
  readonly tamanoPaginaMedicos = 20;

  form: ConsultaCreateDto = {
    idPaciente: 0,
    idMedico: null,
    idSucursal: 0,
    idClinica: null,
    fechaConsulta: ''
  };
  motivoConsulta = '';

  constructor() {
    effect(() => {
      const contexto = this.contextoActual();
      if (this.iniciado && contexto !== this.contexto) this.configurarContexto();
    });
  }

  puedeCrear(): boolean { return this.permisos.puedeCrear('Consultas'); }
  puedeConsultarEmpleados(): boolean { return this.permisos.puedeConsultar('Empleados'); }
  puedeConsultarPacientes(): boolean { return this.permisos.puedeConsultar('Pacientes'); }
  puedeConsultarClinicas(): boolean { return this.permisos.puedeConsultar('Clinicas'); }
  clinicasDeSucursal(): Clinica[] {
    return this.clinicas.filter(item => item.activa && item.idSucursal === this.form.idSucursal);
  }

  seleccionPacienteEnPagina(): boolean {
    return this.pacientesPagina.some(item => item.idPaciente === this.idPaciente);
  }

  seleccionarPaciente(id: number): void {
    if (this.cargando || !this.vigente(this.contexto)) return;
    this.revisionSeleccionPaciente++;
    const paciente = this.pacientesPagina.find(item => item.idPaciente === id && item.activo)
      ?? (this.pacienteSeleccionado?.idPaciente === id ? this.pacienteSeleccionado : null);
    if (paciente?.idPaciente !== this.idPaciente) this.limpiarFoto();
    this.pacienteSeleccionado = paciente;
    this.idPaciente = paciente?.idPaciente ?? 0;
    this.form.idPaciente = this.idPaciente;
  }

  elegirPaciente(id: number): void {
    if (id === -1) {
      this.cargarPacientes(this.paginaPacientes - 1);
    } else if (id === -2) {
      this.cargarPacientes(this.paginaPacientes + 1);
    } else {
      this.seleccionarPaciente(id);
    }
  }

  cargarFotoPaciente(): void {
    const id = this.pacienteSeleccionado?.idPaciente;
    if (!id || id !== this.idPaciente || !this.vigente(this.contexto) || this.cargandoFoto) return;
    const contexto = this.contexto, revision = ++this.revisionFoto;
    this.solicitudFoto?.unsubscribe();
    if (this.fotoPacienteUrl) URL.revokeObjectURL(this.fotoPacienteUrl);
    this.fotoPacienteUrl = null;
    this.cargandoFoto = true;
    this.avisoFoto = this.errorFoto = '';
    this.solicitudFoto = this.pacientesService.obtenerFoto(id).subscribe({
      next: blob => {
        if (!this.vigente(contexto) || revision !== this.revisionFoto || this.idPaciente !== id) return;
        this.cargandoFoto = false;
        if (!(blob instanceof Blob) || blob.size === 0 || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
          this.errorFoto = 'La fotografía recibida no es válida.';
          return;
        }
        if (this.fotoPacienteUrl) URL.revokeObjectURL(this.fotoPacienteUrl);
        this.fotoPacienteUrl = URL.createObjectURL(blob);
      },
      error: err => {
        if (!this.vigente(contexto) || revision !== this.revisionFoto || this.idPaciente !== id) return;
        this.cargandoFoto = false;
        if (err instanceof HttpErrorResponse && err.status === 404) {
          this.avisoFoto = 'El paciente no tiene fotografía.';
        } else {
          this.errorFoto = this.errores.messageFor(err, 'No se pudo cargar la fotografía.');
        }
      },
    });
  }

  private limpiarFoto(): void {
    this.revisionFoto++;
    this.solicitudFoto?.unsubscribe();
    this.solicitudFoto = undefined;
    if (this.fotoPacienteUrl) URL.revokeObjectURL(this.fotoPacienteUrl);
    this.fotoPacienteUrl = null;
    this.cargandoFoto = false;
    this.avisoFoto = this.errorFoto = '';
  }

  cargarPacientes(pagina: number): void {
    if (this.cargando || !this.vigente(this.contexto) || !this.puedeConsultarPacientes() ||
      !this.idValido(pagina) || (pagina > 1 && pagina > this.totalPaginasPacientes)) return;
    const contexto = this.contexto, revision = ++this.revisionPacientes;
    this.solicitudPacientes?.unsubscribe();
    this.cargandoPacientes = true;
    this.errorPacientes = '';
    this.solicitudPacientes = this.pacientesService.listar(
      undefined, true, pagina, this.tamanoPaginaPacientes,
    ).subscribe({
      next: data => {
        if (!this.vigente(contexto) || revision !== this.revisionPacientes) return;
        this.cargandoPacientes = false;
        if (!this.paginaPacientesValida(data, pagina)) {
          this.pacientesPagina = [];
          this.paginaPacientes = 1;
          this.totalPacientes = this.totalPaginasPacientes = 0;
          this.errorPacientes = 'El catálogo de pacientes devolvió una paginación incoherente.';
          return;
        }
        this.pacientesPagina = data.items;
        this.paginaPacientes = pagina;
        this.totalPaginasPacientes = data.totalPages;
        this.totalPacientes = data.totalCount;
        const seleccionado = data.items.find(item => item.idPaciente === this.idPaciente);
        if (seleccionado) this.pacienteSeleccionado = seleccionado;
      },
      error: err => {
        if (!this.vigente(contexto) || revision !== this.revisionPacientes) return;
        this.cargandoPacientes = false;
        this.pacientesPagina = [];
        this.paginaPacientes = 1;
        this.totalPacientes = this.totalPaginasPacientes = 0;
        this.errorPacientes = this.errores.messageFor(err, 'No se pudieron cargar los pacientes.');
      },
    });
  }

  private cargarPacienteSugerido(id: number, contexto: string): void {
    const revision = ++this.revisionSeleccionPaciente;
    this.solicitudes.add(this.pacientesService.obtener(id).subscribe({
      next: paciente => {
        if (!this.vigente(contexto) || revision !== this.revisionSeleccionPaciente) return;
        if (paciente.idPaciente !== id || !paciente.activo) {
          this.errorPacientes = 'El paciente indicado no está disponible para una consulta.';
          return;
        }
        if (this.idPaciente !== id) this.limpiarFoto();
        this.pacienteSeleccionado = paciente;
        this.idPaciente = this.form.idPaciente = id;
      },
      error: err => {
        if (this.vigente(contexto) && revision === this.revisionSeleccionPaciente) {
          this.errorPacientes = this.errores.messageFor(err, 'No se pudo verificar el paciente indicado.');
        }
      },
    }));
  }

  private paginaPacientesValida(data: PagedResponse<PacienteListadoResponse>, pagina: number): boolean {
    return Array.isArray(data.items) && data.page === pagina && data.pageSize === this.tamanoPaginaPacientes &&
      Number.isSafeInteger(data.totalCount) && data.totalCount >= 0 &&
      data.totalPages === Math.ceil(data.totalCount / data.pageSize) &&
      (data.totalPages >= pagina || (pagina === 1 && data.totalCount === 0)) &&
      data.items.length === Math.min(data.pageSize, Math.max(0, data.totalCount - (pagina - 1) * data.pageSize)) &&
      new Set(data.items.map(item => item.idPaciente)).size === data.items.length &&
      data.items.every(item => this.idValido(item.idPaciente) && item.activo === true);
  }

  ngOnInit() {
    const paramId = this.route.snapshot.paramMap.get('id')
      ?? this.route.snapshot.queryParamMap?.get('idPaciente');
    if (paramId !== null && paramId !== undefined) {
      if (!/^\d+$/.test(paramId) || !this.idValido(Number(paramId))) {
        this.error = 'No se especificó un paciente válido';
        return;
      }
      this.idSugerido = Number(paramId);
    }

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.form.fechaConsulta = now.toISOString().slice(0, 16);

    this.iniciado = true;
    this.configurarContexto();
  }

  private fechaConsultaValida(valor: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return false;
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return false;
    const normalizada = `${fecha.getFullYear().toString().padStart(4, '0')}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}T${String(fecha.getHours()).padStart(2, '0')}:${String(fecha.getMinutes()).padStart(2, '0')}`;
    return normalizada === valor;
  }

  guardar() {
    if (this.cargando) return;
    if (!this.vigente(this.contexto) || !this.puedeCrear() || !this.puedeConsultarPacientes()) {
      this.error = 'No tiene una sesión y permisos Consultas/Crear y Pacientes/Consultar vigentes.';
      return;
    }
    if (!this.pacienteSeleccionado || !this.idValido(this.idPaciente) ||
      this.pacienteSeleccionado.idPaciente !== this.idPaciente || !this.pacienteSeleccionado.activo ||
      this.form.idPaciente !== this.idPaciente) {
      this.error = 'Seleccione un paciente activo válido.';
      return;
    }
    if (!this.sucursales.some(
      item => item.idSucursal === this.form.idSucursal && item.activa,
    )) {
      this.error = 'Seleccione una sucursal activa.';
      return;
    }
    if (this.form.idClinica !== null && (!this.puedeConsultarClinicas() ||
      !this.clinicasDeSucursal().some(item => item.idClinica === this.form.idClinica))) {
      this.error = 'Seleccione una clínica activa de la sucursal indicada.';
      return;
    }
    if (!this.fechaConsultaValida(this.form.fechaConsulta)) {
      this.error = 'Indique una fecha y hora de consulta válidas.';
      return;
    }
    const motivo = this.motivoConsulta.trim();
    if (motivo.length > 300) {
      this.error = 'El motivo de la consulta no puede superar 300 caracteres.';
      return;
    }
    if (this.modoMedico === 'bloqueado' || this.modoMedico === 'cargando' || this.cargandoMedicos) {
      this.error = this.errorMedicos || 'Espere a verificar el médico responsable.';
      return;
    }
    if (this.modoMedico === 'inferencia' && this.form.idMedico !== null) {
      this.error = 'El médico vinculado debe ser determinado por el servidor.';
      return;
    }
    const medico = this.medicoSeleccionado;
    if (this.modoMedico === 'seleccion' && (!this.puedeConsultarEmpleados() ||
      !medico || !this.esMedicoElegible(medico) || this.form.idMedico !== medico.idEmpleado)) {
      this.error = 'Seleccione un médico activo válido del catálogo.';
      return;
    }
    this.cargando = true;
    this.error = '';
    const contexto = this.contexto;
    const request: ConsultaCreateDto = {
      idPaciente: this.idPaciente,
      idMedico: this.modoMedico === 'inferencia' ? null : medico!.idEmpleado,
      idSucursal: this.form.idSucursal,
      idClinica: this.form.idClinica,
      fechaConsulta: this.form.fechaConsulta,
      ...(motivo ? { motivoConsulta: motivo } : {}),
    };
    this.solicitudes.add(this.pacientesService.obtener(request.idPaciente).subscribe({
      next: actual => {
        if (!this.vigente(contexto)) return;
        if (actual.idPaciente !== request.idPaciente || !actual.activo) {
          this.limpiarFoto();
          this.pacienteSeleccionado = null;
          this.idPaciente = this.form.idPaciente = 0;
          this.error = 'El paciente seleccionado ya no está disponible para una consulta.';
          this.cargando = false;
          return;
        }
        this.verificarMedicoYEnviar(request, contexto);
      },
      error: err => {
        if (!this.vigente(contexto)) return;
        this.error = this.errores.messageFor(err, 'No se pudo verificar el paciente. La sesión puede haber expirado.');
        this.cargando = false;
      },
    }));
  }

  private verificarMedicoYEnviar(request: ConsultaCreateDto, contexto: string): void {
    if (request.idMedico === null) {
      this.enviarConsulta(request, contexto);
      return;
    }
    this.solicitudes.add(this.empleados.obtener(request.idMedico).subscribe({
      next: actual => {
        if (!this.vigente(contexto)) return;
        if (actual.idEmpleado !== request.idMedico || !this.esMedicoElegible(actual)) {
          this.seleccionarMedico(null);
          this.error = 'El médico seleccionado ya no está disponible como médico activo.';
          this.cargando = false;
          return;
        }
        this.enviarConsulta(request, contexto);
      },
      error: err => {
        if (!this.vigente(contexto)) return;
        this.seleccionarMedico(null);
        this.error = this.errores.messageFor(err, 'No se pudo verificar el médico. La sesión puede haber expirado.');
        this.cargando = false;
      },
    }));
  }

  private enviarConsulta(request: ConsultaCreateDto, contexto: string): void {
    if (!this.vigente(contexto)) return;
    const idMedicoEsperado = request.idMedico ?? this.session.currentUser()?.idEmpleado;
    this.solicitudes.add(this.service.crearConsulta(request).subscribe({
      next: (res: ConsultaDetalleDto) => {
        if (!this.vigente(contexto)) return;
        if (!this.idValido(res.idConsulta) || res.idPaciente !== request.idPaciente ||
          res.idSucursal !== request.idSucursal || res.idMedico !== idMedicoEsperado) {
          this.error = 'La respuesta no confirma la atribución solicitada. Verifique el historial antes de repetir.';
          this.cargando = false;
          return;
        }
        this.router.navigate(['/historial', this.idPaciente, 'consulta', res.idConsulta]);
      },
      error: (err) => {
        if (!this.vigente(contexto)) return;
        this.error = this.errores.messageFor(err, 'Error al crear la consulta. La sesión puede haber expirado.');
        if (err.status === 0 || err.status >= 500) {
          this.error += ' Resultado incierto: verifique el historial antes de repetir.';
        }
        this.cargando = false;
      }
    }));
  }

  private configurarContexto(): void {
    this.solicitudes.unsubscribe();
    this.solicitudes = new Subscription();
    this.paginaSolicitud?.unsubscribe();
    this.revisionPagina++;
    this.solicitudPacientes?.unsubscribe();
    this.revisionPacientes++;
    this.revisionSeleccionPaciente++;
    this.limpiarFoto();
    this.contexto = this.contextoActual();
    this.cargando = false;
    this.cargandoMedicos = false;
    this.medicos = [];
    this.medicoSeleccionado = null;
    this.form.idMedico = null;
    this.sucursales = [];
    this.clinicas = [];
    this.errorClinicas = '';
    this.form.idClinica = null;
    this.motivoConsulta = '';
    this.pacientesPagina = [];
    this.pacienteSeleccionado = null;
    this.idPaciente = this.form.idPaciente = 0;
    this.paginaPacientes = 1;
    this.totalPacientes = this.totalPaginasPacientes = 0;
    this.cargandoPacientes = false;
    this.errorPacientes = '';
    this.totalMedicos = this.totalPaginasMedicos = 0;
    this.paginaMedicos = 1;
    this.error = this.errorMedicos = '';
    this.modoMedico = 'bloqueado';
    if (!this.session.isAuthenticated() || !this.session.token || !this.puedeCrear() || !this.puedeConsultarPacientes()) {
      this.errorMedicos = 'Se requieren sesión y permisos Consultas/Crear y Pacientes/Consultar.';
      return;
    }
    const contexto = this.contexto;
    this.cargarPacientes(1);
    if (this.idSugerido) this.cargarPacienteSugerido(this.idSugerido, contexto);
    this.solicitudes.add(this.catalogosService.getSucursales().subscribe({
      next: data => { if (this.vigente(contexto)) this.sucursales = data.filter(item => item.activa); },
      error: err => {
        if (this.vigente(contexto)) this.error = this.errores.messageFor(err, 'No se pudieron cargar las sucursales.');
      },
    }));
    if (this.puedeConsultarClinicas()) {
      this.solicitudes.add(this.catalogosService.getClinicas().subscribe({
        next: data => { if (this.vigente(contexto)) this.clinicas = data.filter(item => item.activa); },
        error: err => {
          if (this.vigente(contexto)) this.errorClinicas = this.errores.messageFor(err, 'No se pudieron cargar las clínicas.');
        },
      }));
    }
    const vinculado = this.session.currentUser()?.idEmpleado;
    if (vinculado != null) {
      if (!this.idValido(vinculado)) {
        this.errorMedicos = 'El vínculo de empleado no es válido.';
      } else if (!this.puedeConsultarEmpleados()) {
        // /auth/me solo proporciona IdEmpleado: no inferir su tipo a partir del rol.
        this.modoMedico = 'inferencia';
      } else {
        this.modoMedico = 'cargando';
        this.solicitudes.add(this.empleados.obtener(vinculado).subscribe({
          next: empleado => {
            if (!this.vigente(contexto)) return;
            if (empleado.idEmpleado !== vinculado) {
              this.modoMedico = 'bloqueado';
              this.errorMedicos = 'La respuesta no corresponde al empleado vinculado.';
            } else if (empleado.tipoEmpleado === 'Medico') {
              this.modoMedico = empleado.activo ? 'inferencia' : 'bloqueado';
              if (!empleado.activo) this.errorMedicos = 'El médico vinculado está inactivo.';
            } else {
              this.habilitarSeleccion();
            }
          },
          error: err => {
            if (!this.vigente(contexto)) return;
            this.modoMedico = 'bloqueado';
            this.errorMedicos = this.errores.messageFor(err, 'No se pudo verificar el empleado vinculado. La sesión puede haber expirado.');
          },
        }));
      }
    } else {
      this.habilitarSeleccion();
    }
  }

  private habilitarSeleccion(): void {
    if (!this.puedeConsultarEmpleados()) {
      this.modoMedico = 'bloqueado';
      this.errorMedicos = 'No tiene permiso Empleados/Consultar para obtener el catálogo de médicos.';
      return;
    }
    this.modoMedico = 'seleccion';
    this.cargarMedicos(1);
  }

  cargarMedicos(pagina: number): void {
    if (this.cargando || this.modoMedico !== 'seleccion' || !this.vigente(this.contexto) ||
      !this.puedeConsultarEmpleados() || !this.idValido(pagina) ||
      (pagina > 1 && pagina > this.totalPaginasMedicos)) return;
    const contexto = this.contexto;
    const revision = ++this.revisionPagina;
    this.paginaSolicitud?.unsubscribe();
    this.cargandoMedicos = true;
    this.errorMedicos = '';
    this.paginaSolicitud = this.empleados.listar(undefined, 'Medico', undefined, true,
      pagina, this.tamanoPaginaMedicos).subscribe({
      next: data => {
        if (!this.vigente(contexto) || revision !== this.revisionPagina) return;
        this.cargandoMedicos = false;
        if (!this.paginaValida(data, pagina)) {
          this.medicos = [];
          this.seleccionarMedico(null);
          this.errorMedicos = 'El catálogo devolvió una paginación incoherente. Recargue los médicos.';
          return;
        }
        this.paginaMedicos = pagina;
        this.totalMedicos = data.totalCount;
        this.totalPaginasMedicos = data.totalPages;
        this.medicos = data.items.filter(item => this.esMedicoElegible(item));
        const repetido = data.items.find(item => item.idEmpleado === this.form.idMedico);
        if (repetido && !this.esMedicoElegible(repetido)) this.seleccionarMedico(null);
        if (this.medicoSeleccionado && this.medicos.some(item => item.idEmpleado === this.form.idMedico)) {
          this.medicoSeleccionado = this.medicos.find(item => item.idEmpleado === this.form.idMedico)!;
        }
      },
      error: err => {
        if (!this.vigente(contexto) || revision !== this.revisionPagina) return;
        this.cargandoMedicos = false;
        this.medicos = [];
        this.seleccionarMedico(null);
        this.errorMedicos = this.errores.messageFor(err, 'No se pudo cargar el catálogo de médicos. La sesión puede haber expirado.');
      },
    });
  }

  seleccionarMedico(id: number | null): void {
    const medico = this.medicos.find(item => item.idEmpleado === id && this.esMedicoElegible(item))
      ?? (this.medicoSeleccionado?.idEmpleado === id ? this.medicoSeleccionado : null);
    this.medicoSeleccionado = medico;
    this.form.idMedico = medico?.idEmpleado ?? null;
  }

  seleccionEnPagina(): boolean { return this.medicos.some(item => item.idEmpleado === this.form.idMedico); }
  etiquetaMedico(medico: EmpleadoListadoResponse): string {
    return `${medico.nombres} ${medico.apellidos} · Médico #${medico.idEmpleado} · Sucursal #${medico.idSucursal}`;
  }
  private idValido(id: number): boolean { return Number.isInteger(id) && id > 0 && id <= 2_147_483_647; }
  private esMedicoElegible(medico: EmpleadoListadoResponse): boolean {
    return this.idValido(medico.idEmpleado) && medico.activo === true && medico.tipoEmpleado === 'Medico';
  }
  private paginaValida(data: PagedResponse<EmpleadoListadoResponse>, pagina: number): boolean {
    return Array.isArray(data.items) && data.page === pagina && data.pageSize === this.tamanoPaginaMedicos &&
      Number.isSafeInteger(data.totalCount) && data.totalCount >= 0 &&
      data.totalPages === Math.ceil(data.totalCount / data.pageSize) &&
      data.items.length === Math.min(data.pageSize, Math.max(0, data.totalCount - (pagina - 1) * data.pageSize)) &&
      new Set(data.items.map(item => item.idEmpleado)).size === data.items.length;
  }
  private contextoActual(): string {
    const user = this.session.currentUser();
    const token = this.session.token;
    const autenticado = this.session.isAuthenticated();
    // Leer ambos permisos siempre: revocarlos debe invalidar solicitudes en curso.
    const crear = this.puedeCrear(), consultar = this.puedeConsultarEmpleados();
    const pacientes = this.puedeConsultarPacientes(), clinicas = this.puedeConsultarClinicas();
    return `${autenticado && token && user ? `${user.idUsuario}:${token}:${user.idEmpleado}:${user.idRol}` : ''}:${crear}:${consultar}:${pacientes}:${clinicas}`;
  }
  private vigente(contexto: string): boolean {
    return !this.destruido && this.iniciado && this.session.isAuthenticated() && !!this.session.token &&
      !!this.session.currentUser() && this.puedeCrear() && this.puedeConsultarPacientes() && contexto === this.contextoActual();
  }
  ngOnDestroy(): void {
    this.destruido = true;
    this.solicitudes.unsubscribe();
    this.paginaSolicitud?.unsubscribe();
    this.solicitudPacientes?.unsubscribe();
    this.limpiarFoto();
  }
}
