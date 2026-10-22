import { Component, effect, inject, OnDestroy, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { ConsultaCreateDto, ConsultaDetalleDto } from '../../core/models/historial.model';
import { Sucursal } from '../../core/models/catalogos.model';
import { EmpleadoListadoResponse, PagedResponse } from '../../core/models/empleado.model';
import { EmpleadosService } from '../../core/services/empleado.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-consulta-nueva',
    imports: [RouterModule, FormsModule],
    template: `
    <div class="container mt-4">
      <h2>Nueva Consulta Médica</h2>
      <p class="text-muted">Paciente ID: {{ idPaciente }}</p>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <fieldset [disabled]="cargando || !puedeCrear()">
        <div class="row g-3">
          <div class="col-12">
            @if (modoMedico === 'inferencia') {
              <p class="alert alert-info">El servidor asignará el médico vinculado a su sesión.
                @if (!puedeConsultarEmpleados()) {
                  No tiene permiso para consultar empleados ni seleccionar otro médico.
                  Si su vínculo no es médico, solicite revisión de acceso al catálogo.
                }
              </p>
            } @else if (modoMedico === 'seleccion') {
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
              <div class="d-flex gap-2 align-items-center mt-2">
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
          <div class="col-md-6">
            <label class="form-label">Sucursal *</label>
            <select class="form-select" [(ngModel)]="form.idSucursal" name="idSucursal" required>
              <option [ngValue]="null">Seleccione...</option>
              @for (s of sucursales; track s.idSucursal) {
                <option [ngValue]="s.idSucursal">{{ s.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Fecha de Consulta *</label>
            <input type="datetime-local" class="form-control" [(ngModel)]="form.fechaConsulta" name="fechaConsulta" required>
          </div>

          <div class="col-12">
            <label class="form-label">Motivo de Consulta</label>
            <textarea class="form-control" rows="2" [(ngModel)]="form.motivoConsulta" name="motivoConsulta" maxlength="300"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label">Síntomas</label>
            <textarea class="form-control" rows="2" [(ngModel)]="form.sintomas" name="sintomas" maxlength="300"></textarea>
          </div>
          <div class="col-12">
            <label class="form-label">Observaciones</label>
            <textarea class="form-control" rows="2" [(ngModel)]="form.observaciones" name="observaciones" maxlength="300"></textarea>
          </div>

          <div class="col-md-3">
            <label class="form-label">Peso (lb)</label>
            <input type="number" step="0.1" class="form-control" [(ngModel)]="form.pesoLb" name="pesoLb">
          </div>
          <div class="col-md-3">
            <label class="form-label">Altura (cm)</label>
            <input type="number" class="form-control" [(ngModel)]="form.alturaCm" name="alturaCm">
          </div>
          <div class="col-md-3">
            <label class="form-label">Presión Sistólica</label>
            <input type="number" class="form-control" [(ngModel)]="form.presionSistolica" name="presionSistolica">
          </div>
          <div class="col-md-3">
            <label class="form-label">Presión Diastólica</label>
            <input type="number" class="form-control" [(ngModel)]="form.presionDiastolica" name="presionDiastolica">
          </div>
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando || modoMedico === 'bloqueado' || modoMedico === 'cargando' || cargandoMedicos">
            {{ cargando ? 'Guardando...' : 'Guardar Consulta' }}
          </button>
          <a [routerLink]="['/historial', idPaciente]" class="btn btn-secondary">Cancelar</a>
        </div>
        </fieldset>
      </form>
    </div>
  `
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
  private solicitudes = new Subscription();
  private paginaSolicitud?: Subscription;
  private revisionPagina = 0;
  private contexto = '';
  private iniciado = false;
  private destruido = false;

  idPaciente!: number;
  cargando = false;
  error = '';
  sucursales: Sucursal[] = [];
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
    fechaConsulta: '',
    motivoConsulta: null,
    sintomas: null,
    observaciones: null,
    pesoLb: null,
    presionDiastolica: null,
    presionSistolica: null,
    alturaCm: null
  };

  constructor() {
    effect(() => {
      const contexto = this.contextoActual();
      if (this.iniciado && contexto !== this.contexto) this.configurarContexto();
    });
  }

  puedeCrear(): boolean { return this.permisos.puedeCrear('Consultas'); }
  puedeConsultarEmpleados(): boolean { return this.permisos.puedeConsultar('Empleados'); }

  ngOnInit() {
    const paramId = this.route.snapshot.paramMap.get('id');
    if (!paramId || !this.idValido(+paramId)) { this.error = 'No se especificó un paciente válido'; return; }
    this.idPaciente = +paramId;
    this.form.idPaciente = this.idPaciente;

    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    this.form.fechaConsulta = now.toISOString().slice(0, 16);

    this.iniciado = true;
    this.configurarContexto();
  }

  guardar() {
    if (this.cargando) return;
    if (!this.vigente(this.contexto) || !this.puedeCrear()) {
      this.error = 'No tiene una sesión y permiso Consultas/Crear vigentes.';
      return;
    }
    if (!this.sucursales.some(
      item => item.idSucursal === this.form.idSucursal && item.activa,
    )) {
      this.error = 'Seleccione una sucursal activa.';
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
    const request = { ...this.form, idPaciente: this.idPaciente,
      idMedico: this.modoMedico === 'inferencia' ? null : medico!.idEmpleado };
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
    this.contexto = this.contextoActual();
    this.cargando = false;
    this.cargandoMedicos = false;
    this.medicos = [];
    this.medicoSeleccionado = null;
    this.form.idMedico = null;
    this.sucursales = [];
    this.totalMedicos = this.totalPaginasMedicos = 0;
    this.paginaMedicos = 1;
    this.error = this.errorMedicos = '';
    this.modoMedico = 'bloqueado';
    if (!this.session.isAuthenticated() || !this.session.token || !this.puedeCrear()) {
      this.errorMedicos = 'Se requiere una sesión vigente y permiso Consultas/Crear.';
      return;
    }
    const contexto = this.contexto;
    this.solicitudes.add(this.catalogosService.getSucursales().subscribe({
      next: data => { if (this.vigente(contexto)) this.sucursales = data.filter(item => item.activa); },
      error: err => {
        if (this.vigente(contexto)) this.error = this.errores.messageFor(err, 'No se pudieron cargar las sucursales.');
      },
    }));
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
    return `${autenticado && token && user ? `${user.idUsuario}:${token}:${user.idEmpleado}:${user.idRol}` : ''}:${crear}:${consultar}`;
  }
  private vigente(contexto: string): boolean {
    return !this.destruido && this.iniciado && this.session.isAuthenticated() && !!this.session.token &&
      !!this.session.currentUser() && this.puedeCrear() && contexto === this.contextoActual();
  }
  ngOnDestroy(): void {
    this.destruido = true;
    this.solicitudes.unsubscribe();
    this.paginaSolicitud?.unsubscribe();
  }
}
