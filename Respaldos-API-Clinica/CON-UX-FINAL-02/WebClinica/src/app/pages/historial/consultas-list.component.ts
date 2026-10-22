import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { ConsultaFiltroDto, ConsultaListadoDto } from '../../core/models/historial.model';
import { PacienteListadoResponse } from '../../core/models/paciente.model';
import { EmpleadoListadoResponse } from '../../core/models/empleado.model';
import { Clinica, Sucursal } from '../../core/models/catalogos.model';
import { PagedResponse } from '../../core/models/paged-response.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { HistorialService } from '../../core/services/historial.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { correlativoPaginado } from '../../shared/utils/correlativo';

interface FiltrosConsultaForm {
  idPaciente: number | null;
  idMedico: number | null;
  idSucursal: number | null;
  idClinica: number | null;
  desde: string;
  hasta: string;
}

const filtrosVacios = (): FiltrosConsultaForm => ({
  idPaciente: null,
  idMedico: null,
  idSucursal: null,
  idClinica: null,
  desde: '',
  hasta: '',
});

@Component({
    selector: 'app-consultas-list',
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './consultas-list.component.html',
    styles: [`
      :host { display: block; min-width: 0; }
      .consultas-flujo { display: flex; align-items: center; gap: 1.5rem; }
      .consultas-flujo__intro { flex: 0 0 13rem; }
      .consultas-flujo h2 { color: var(--ui-heading); font-size: 1.05rem; font-weight: 700; margin: 0 0 .2rem; }
      .consultas-flujo p { color: var(--ui-muted); font-size: .82rem; margin: 0; }
      .consultas-flujo__steps { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); align-items: start; gap: .35rem; flex: 1; list-style: none; margin: 0; padding: 0; }
      .consultas-flujo__steps li { position: relative; display: grid; justify-items: center; gap: .25rem; min-width: 0; color: #4c6380; font-size: .78rem; text-align: center; }
      .consultas-flujo__steps li + li::before { content: '›'; position: absolute; inset-inline-start: -.35rem; top: .3rem; color: #8192a7; font-size: 1.2rem; }
      .consultas-flujo__steps i { display: grid; place-items: center; width: 2.25rem; height: 2.25rem; border-radius: 50%; background: #eef3f8; color: #365f8c; font-size: 1.1rem; }
      .consultas-filtros__toolbar { display: flex; justify-content: flex-end; gap: .5rem; margin-top: .8rem; }
      .consultas-filtros__advanced { border-top: 1px solid #e3eaf1; margin-top: .9rem; padding-top: .65rem; }
      .consultas-filtros__advanced summary { width: fit-content; color: #275c8b; cursor: pointer; font-weight: 600; }
      .consultas-filtros__advanced summary:focus-visible, .consultas-ubicacion summary:focus-visible { outline: 2px solid #0d6efd; outline-offset: 2px; }
      .consultas-filtros__pager { display: flex; flex-wrap: wrap; align-items: center; gap: .35rem; margin-top: .35rem; }
      .consultas-filtros__pager span { color: var(--ui-muted); font-size: .8rem; }
      .consultas-filtros__hint { display: block; color: var(--ui-muted); font-size: .8rem; margin-top: .35rem; }
      .consultas-results { container: consultas-list / inline-size; }
      .consultas-table { width: 100%; min-width: 0; table-layout: fixed; }
      .consultas-table th:nth-child(1) { width: 5%; }
      .consultas-table th:nth-child(2) { width: 17%; }
      .consultas-table th:nth-child(3) { width: 14%; }
      .consultas-table th:nth-child(4) { width: 12%; }
      .consultas-table th:nth-child(5) { width: 12%; }
      .consultas-table th:nth-child(6) { width: 14%; }
      .consultas-table th:nth-child(7) { width: 26%; }
      .consultas-table > :not(caption) > * > * { padding: .55rem .5rem; }
      .consultas-table td { min-width: 0; overflow-wrap: break-word; }
      .consultas-table td.ui-col-actions, .consultas-table th.ui-col-actions { white-space: normal; }
      .consultas-identidad { display: flex; align-items: center; gap: .5rem; min-width: 0; }
      .consultas-identidad__text { min-width: 0; }
      .consultas-avatar { width: 2.4rem; height: 2.4rem; flex: 0 0 2.4rem; border-radius: 50%; object-fit: cover; }
      .consultas-avatar--empty { display: inline-flex; align-items: center; justify-content: center; background: #e8eef4; color: #627589; font-size: 1.25rem; }
      .consultas-ubicacion { margin-top: .15rem; color: var(--ui-muted); font-size: .75rem; }
      .consultas-ubicacion summary { width: fit-content; cursor: pointer; }
      .consultas-ubicacion span { display: block; line-height: 1.4; }
      .consultas-evaluacion { white-space: normal; }
      .consultas-estado { display: inline-block; max-width: 100%; padding: .25rem .4rem; border: 1px solid #d5e0e9; border-radius: .4rem; background: #f3f6f9; color: #435468; font-size: .78rem; font-weight: 500; line-height: 1.2; white-space: normal; word-break: normal; overflow-wrap: normal; }
      .consultas-estado--vacio { white-space: nowrap; }
      .consultas-actions { display: flex; flex-wrap: nowrap; justify-content: flex-end; gap: .3rem; }
      .consultas-actions .btn { display: inline-flex; align-items: center; justify-content: center; gap: .25rem; min-width: 2rem; padding: .25rem .35rem; white-space: nowrap; }
      .consultas-pagination { display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: .5rem; }
      .consultas-pagination__status { white-space: nowrap; }
      @container consultas-list (max-width: 1250px) { .consultas-action-label { display: none; } }
      @container consultas-list (max-width: 920px) {
        .consultas-table, .consultas-table tbody { display: block; width: 100%; box-sizing: border-box; }
        .consultas-table thead { display: block; position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; }
        .consultas-table thead tr, .consultas-table thead th { display: block; width: 1px !important; height: 1px; padding: 0 !important; border: 0; }
        .consultas-table tbody { padding: .5rem; }
        .consultas-table tbody tr { display: block; width: 100%; max-width: 100%; box-sizing: border-box; border: 1px solid #d9e2ec; border-radius: .5rem; margin-bottom: .6rem; overflow: visible; }
        .consultas-table tbody tr:last-child { margin-bottom: 0; }
        .consultas-table td { display: grid; grid-template-columns: minmax(6rem, 30%) minmax(0, 1fr); gap: .5rem; align-items: center; width: 100%; max-width: 100%; box-sizing: border-box; text-align: start; border-bottom: 1px solid #e8edf2; }
        .consultas-table td:last-child { border-bottom: 0; }
        .consultas-table td::before { content: attr(data-label); color: var(--ui-heading); font-size: .8rem; font-weight: 600; }
        .consultas-table td.ui-col-index { text-align: start; }
        .consultas-table td.ui-col-actions { white-space: normal; }
        .consultas-actions { justify-content: flex-start; flex-wrap: wrap; }
        .consultas-action-label { display: inline; }
      }
      @media (max-width: 1279.98px) { .consultas-flujo { display: block; } .consultas-flujo__intro { margin-bottom: .65rem; } }
      @media (max-width: 575.98px) { .consultas-flujo__steps { grid-template-columns: repeat(2, minmax(0, 1fr)); row-gap: .7rem; } .consultas-flujo__steps li:nth-child(odd)::before { display: none; } .consultas-filtros__toolbar .btn { flex: 1; } }
    `]
})
export class ConsultasListComponent implements OnInit, OnDestroy {
  private readonly service = inject(HistorialService);
  private readonly pacientesService = inject(PacientesService);
  private readonly empleadosService = inject(EmpleadosService);
  private readonly catalogosService = inject(CatalogosService);
  private readonly session = inject(AuthSessionService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  filtros = filtrosVacios();
  consultas: ConsultaListadoDto[] = [];
  page = 1;
  pageSize = 20;
  totalCount = 0;
  totalPages = 0;
  cargando = false;
  error = '';

  busquedaPaciente = '';
  busquedaMedico = '';
  pacientesPagina: PacienteListadoResponse[] = [];
  medicosPagina: EmpleadoListadoResponse[] = [];
  sucursales: Sucursal[] = [];
  clinicas: Clinica[] = [];
  pacienteSeleccionado: PacienteListadoResponse | null = null;
  medicoSeleccionado: EmpleadoListadoResponse | null = null;
  paginaPacientes = 1;
  paginasPacientes = 0;
  paginaMedicos = 1;
  paginasMedicos = 0;
  cargandoPacientes = false;
  cargandoMedicos = false;
  cargandoSucursales = false;
  cargandoClinicas = false;
  errorPacientes = '';
  errorMedicos = '';
  errorSucursales = '';
  errorClinicas = '';

  private filtrosAplicados = filtrosVacios();
  private solicitud?: Subscription;
  private revisionSolicitud = 0;
  private identidadCarga: string | null = null;
  private solicitudesPacientes = new Subscription();
  private solicitudesMedicos = new Subscription();
  private readonly nombresPacientes = new Map<number, string>();
  private readonly nombresMedicos = new Map<number, string>();
  private readonly fotos = new Map<number, string>();
  private catalogoContexto: string | null = null;
  private solicitudPacientes?: Subscription;
  private solicitudMedicos?: Subscription;
  private solicitudSucursales?: Subscription;
  private solicitudClinicas?: Subscription;
  private revisionPacientes = 0;
  private revisionMedicos = 0;
  private readonly tamanoCatalogo = 20;

  constructor() {
    effect(() => {
      const identidad = this.identidadActual();
      const autorizado = this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS);
      const pacientesAutorizados = this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES);
      const medicosAutorizados = this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS);
      const sucursalesAutorizadas = this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES);
      const clinicasAutorizadas = this.permisos.puedeConsultar(MODULOS_PERMISO.CLINICAS);
      if (!identidad || !autorizado) {
        this.limpiarDatosSensibles();
      } else if (this.identidadCarga && this.identidadCarga !== identidad) {
        this.limpiarDatosSensibles();
      }
      if (!pacientesAutorizados) this.limpiarPacientes();
      if (!medicosAutorizados) this.limpiarMedicos();
      const contexto = identidad && autorizado
        ? `${identidad}:${pacientesAutorizados}:${medicosAutorizados}:${sucursalesAutorizadas}:${clinicasAutorizadas}`
        : null;
      if (contexto !== this.catalogoContexto) {
        this.limpiarCatalogos();
        this.catalogoContexto = contexto;
        if (contexto) {
          if (pacientesAutorizados) this.cargarPacientes(1);
          if (medicosAutorizados) this.cargarMedicos(1);
          if (sucursalesAutorizadas) this.cargarSucursales();
          if (clinicasAutorizadas) this.cargarClinicas();
        }
      }
    });
  }

  ngOnInit(): void {
    this.cargarConsultas();
  }

  ngOnDestroy(): void {
    this.solicitud?.unsubscribe();
    this.limpiarRelacionados();
    this.limpiarCatalogos();
  }

  nombrePaciente(consulta: ConsultaListadoDto): string {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) return 'Paciente no disponible';
    if (consulta.nombrePaciente !== undefined) return consulta.nombrePaciente?.trim() || 'Paciente no disponible';
    return this.nombresPacientes.get(consulta.idPaciente) ?? 'Paciente no disponible';
  }

  nombreMedico(consulta: ConsultaListadoDto): string {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) return 'Médico no disponible';
    if (consulta.nombreMedico !== undefined) return consulta.nombreMedico?.trim() || 'Médico no disponible';
    return this.nombresMedicos.get(consulta.idMedico) ?? 'Médico no disponible';
  }

  fotoUrl(id: number): string | null {
    return this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)
      ? this.fotos.get(id) ?? null : null;
  }

  nombreSucursal(consulta: ConsultaListadoDto): string {
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.SUCURSALES)) return 'Sucursal no disponible';
    if (consulta.nombreSucursal !== undefined) return consulta.nombreSucursal?.trim() || 'Sucursal no disponible';
    return this.sucursales.find(item => item.idSucursal === consulta.idSucursal)?.nombre ?? 'Sucursal no disponible';
  }

  nombreClinica(consulta: ConsultaListadoDto): string {
    if (consulta.idClinica === null) return 'No asignada';
    if (!this.permisos.puedeConsultar(MODULOS_PERMISO.CLINICAS)) return 'Clínica no disponible';
    if (consulta.nombreClinica !== undefined) return consulta.nombreClinica?.trim() || 'Clínica no disponible';
    return this.clinicas.find(item => item.idClinica === consulta.idClinica)?.nombreClinica ?? 'Clínica no disponible';
  }

  evaluacionInicial(consulta: ConsultaListadoDto): string {
    return consulta.motivoConsulta?.trim() || 'No disponible';
  }

  estadoConsulta(consulta: ConsultaListadoDto): string {
    return consulta.estadoConsulta?.trim() || 'Sin estado registrado';
  }

  sucursalSeleccionadaDisponible(): boolean {
    return this.sucursales.some(item => item.idSucursal === this.filtros.idSucursal);
  }

  clinicaSeleccionadaDisponible(): boolean {
    return this.clinicas.some(item => item.idClinica === this.filtros.idClinica);
  }

  seleccionarPaciente(id: number | null): void {
    const item = this.pacientesPagina.find(p => p.idPaciente === id)
      ?? (this.pacienteSeleccionado?.idPaciente === id ? this.pacienteSeleccionado : null);
    this.pacienteSeleccionado = item;
    this.filtros.idPaciente = item?.idPaciente ?? null;
  }

  seleccionarMedico(id: number | null): void {
    const item = this.medicosPagina.find(m => m.idEmpleado === id)
      ?? (this.medicoSeleccionado?.idEmpleado === id ? this.medicoSeleccionado : null);
    this.medicoSeleccionado = item;
    this.filtros.idMedico = item?.idEmpleado ?? null;
  }

  cargarPacientes(pagina: number): void {
    if (!this.catalogoContexto || !this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES) ||
        !Number.isSafeInteger(pagina) || pagina < 1 || (pagina > 1 && pagina > this.paginasPacientes)) return;
    const contexto = this.catalogoContexto;
    const revision = ++this.revisionPacientes;
    this.solicitudPacientes?.unsubscribe();
    this.cargandoPacientes = true;
    this.errorPacientes = '';
    this.solicitudPacientes = this.pacientesService.listar(
      this.busquedaPaciente.trim() || undefined, undefined, pagina, this.tamanoCatalogo,
    ).subscribe({
      next: data => {
        if (!this.catalogoVigente(contexto) || revision !== this.revisionPacientes) return;
        this.cargandoPacientes = false;
        if (!this.paginaCatalogoValida(data, pagina)) {
          this.pacientesPagina = [];
          this.errorPacientes = 'El catálogo de pacientes devolvió una paginación incoherente.';
          return;
        }
        this.pacientesPagina = data.items;
        this.paginaPacientes = data.page;
        this.paginasPacientes = data.totalPages;
        const seleccionado = data.items.find(item => item.idPaciente === this.filtros.idPaciente);
        if (seleccionado) this.pacienteSeleccionado = seleccionado;
      },
      error: error => {
        if (!this.catalogoVigente(contexto) || revision !== this.revisionPacientes) return;
        this.cargandoPacientes = false;
        this.pacientesPagina = [];
        this.errorPacientes = this.errorCatalogo(error, 'pacientes');
      },
    });
  }

  cargarMedicos(pagina: number): void {
    if (!this.catalogoContexto || !this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS) ||
        !Number.isSafeInteger(pagina) || pagina < 1 || (pagina > 1 && pagina > this.paginasMedicos)) return;
    const contexto = this.catalogoContexto;
    const revision = ++this.revisionMedicos;
    this.solicitudMedicos?.unsubscribe();
    this.cargandoMedicos = true;
    this.errorMedicos = '';
    this.solicitudMedicos = this.empleadosService.listar(
      this.busquedaMedico.trim() || undefined, 'Medico', undefined, undefined,
      pagina, this.tamanoCatalogo,
    ).subscribe({
      next: data => {
        if (!this.catalogoVigente(contexto) || revision !== this.revisionMedicos) return;
        this.cargandoMedicos = false;
        if (!this.paginaCatalogoValida(data, pagina)) {
          this.medicosPagina = [];
          this.errorMedicos = 'El catálogo de médicos devolvió una paginación incoherente.';
          return;
        }
        this.medicosPagina = data.items.filter(item => item.tipoEmpleado === 'Medico');
        this.paginaMedicos = data.page;
        this.paginasMedicos = data.totalPages;
        const seleccionado = this.medicosPagina.find(item => item.idEmpleado === this.filtros.idMedico);
        if (seleccionado) this.medicoSeleccionado = seleccionado;
      },
      error: error => {
        if (!this.catalogoVigente(contexto) || revision !== this.revisionMedicos) return;
        this.cargandoMedicos = false;
        this.medicosPagina = [];
        this.errorMedicos = this.errorCatalogo(error, 'médicos');
      },
    });
  }

  private cargarSucursales(): void {
    const contexto = this.catalogoContexto;
    if (!contexto) return;
    this.cargandoSucursales = true;
    this.errorSucursales = '';
    this.solicitudSucursales = this.catalogosService.getSucursales().subscribe({
      next: items => {
        if (!this.catalogoVigente(contexto)) return;
        this.sucursales = items;
        this.cargandoSucursales = false;
      },
      error: error => {
        if (!this.catalogoVigente(contexto)) return;
        this.sucursales = [];
        this.cargandoSucursales = false;
        this.errorSucursales = this.errorCatalogo(error, 'sucursales');
      },
    });
  }

  private cargarClinicas(): void {
    const contexto = this.catalogoContexto;
    if (!contexto) return;
    this.cargandoClinicas = true;
    this.errorClinicas = '';
    this.solicitudClinicas = this.catalogosService.getClinicas().subscribe({
      next: items => {
        if (!this.catalogoVigente(contexto)) return;
        this.clinicas = items;
        this.cargandoClinicas = false;
      },
      error: error => {
        if (!this.catalogoVigente(contexto)) return;
        this.clinicas = [];
        this.cargandoClinicas = false;
        this.errorClinicas = this.errorCatalogo(error, 'clínicas');
      },
    });
  }

  private paginaCatalogoValida<T>(data: PagedResponse<T>, pagina: number): boolean {
    return Array.isArray(data.items) && data.page === pagina && data.pageSize === this.tamanoCatalogo &&
      Number.isSafeInteger(data.totalCount) && data.totalCount >= 0 &&
      data.totalPages === Math.ceil(data.totalCount / data.pageSize) &&
      data.items.length === Math.min(data.pageSize, Math.max(0, data.totalCount - (pagina - 1) * data.pageSize));
  }

  private catalogoVigente(contexto: string): boolean {
    const identidad = this.identidadActual();
    return identidad !== null && this.catalogoContexto === contexto &&
      contexto.startsWith(`${identidad}:`);
  }

  private errorCatalogo(error: unknown, nombre: string): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return `Acceso denegado al catálogo de ${nombre}; puede filtrar por ID.`;
    }
    const fallback = `No se pudo cargar el catálogo de ${nombre}; puede filtrar por ID.`;
    return error instanceof HttpErrorResponse ? this.apiErrors.messageFor(error, fallback)
      : error instanceof Error ? `${error.message} Puede filtrar por ID.` : fallback;
  }

  buscar(): void {
    const validationError = this.validarFiltros();
    if (validationError) {
      this.error = validationError;
      return;
    }

    this.filtrosAplicados = { ...this.filtros };
    this.page = 1;
    this.cargarConsultas();
  }

  limpiarFiltros(): void {
    this.filtros = filtrosVacios();
    this.filtrosAplicados = filtrosVacios();
    this.pacienteSeleccionado = null;
    this.medicoSeleccionado = null;
    this.busquedaPaciente = '';
    this.busquedaMedico = '';
    if (this.catalogoContexto) {
      if (this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) this.cargarPacientes(1);
      if (this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) this.cargarMedicos(1);
    }
    this.page = 1;
    this.cargarConsultas();
  }

  cambiarPagina(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page || this.cargando) return;
    this.page = page;
    this.cargarConsultas();
  }

  cambiarTamanoPagina(pageSize: number): void {
    if (![10, 20, 50, 100].includes(Number(pageSize))) return;
    this.pageSize = Number(pageSize);
    this.page = 1;
    this.cargarConsultas();
  }

  reintentar(): void {
    this.cargarConsultas();
  }

  private cargarConsultas(): void {
    const identidad = this.identidadActual();
    if (!identidad || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) {
      this.limpiarDatosSensibles();
      return;
    }

    const revision = ++this.revisionSolicitud;
    this.solicitud?.unsubscribe();
    this.limpiarRelacionados();
    this.identidadCarga = identidad;
    this.cargando = true;
    this.error = '';

    const filtro: ConsultaFiltroDto = {
      idPaciente: this.filtrosAplicados.idPaciente,
      idMedico: this.filtrosAplicados.idMedico,
      idSucursal: this.filtrosAplicados.idSucursal,
      idClinica: this.filtrosAplicados.idClinica,
      desde: this.inicioDelDia(this.filtrosAplicados.desde),
      hasta: this.finDelDia(this.filtrosAplicados.hasta),
      page: this.page,
      pageSize: this.pageSize,
    };

    this.solicitud = this.service.listarConsultas(filtro).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => {
        if (revision === this.revisionSolicitud) this.cargando = false;
      }),
    ).subscribe({
      next: response => {
        if (!this.respuestaPerteneceASesion(revision, identidad)) return;
        this.consultas = response.items;
        this.page = response.page;
        this.pageSize = response.pageSize;
        this.totalCount = response.totalCount;
        this.totalPages = response.totalPages;
        this.cargarRelacionados(response.items, revision, identidad);
      },
      error: error => {
        if (!this.respuestaPerteneceASesion(revision, identidad)) return;
        this.consultas = [];
        this.totalCount = 0;
        this.totalPages = 0;
        this.error = this.apiErrors.messageFor(
          error,
          'No fue posible cargar las consultas médicas.',
        );
      },
    });
  }

  private validarFiltros(): string {
    const identificadores: Array<[number | null, string]> = [
      [this.filtros.idPaciente, 'paciente'],
      [this.filtros.idMedico, 'médico'],
      [this.filtros.idSucursal, 'sucursal'],
      [this.filtros.idClinica, 'clínica'],
    ];
    const invalido = identificadores.find(([value]) =>
      value !== null && (!Number.isInteger(Number(value)) || Number(value) <= 0));
    if (invalido) return `El identificador de ${invalido[1]} debe ser un entero mayor que cero.`;
    if (this.filtros.desde && this.filtros.hasta && this.filtros.desde > this.filtros.hasta) {
      return 'La fecha Hasta debe ser posterior o igual a Desde.';
    }
    return '';
  }

  private inicioDelDia(value: string): string | null {
    return value ? `${value}T00:00:00` : null;
  }

  private finDelDia(value: string): string | null {
    return value ? `${value}T23:59:59.999` : null;
  }

  private respuestaPerteneceASesion(revision: number, identidad: string): boolean {
    return revision === this.revisionSolicitud
      && identidad === this.identidadActual()
      && this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS);
  }

  private cargarRelacionados(items: ConsultaListadoDto[], revision: number, identidad: string): void {
    if (this.permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
      const nombresPendientes = new Set(items.filter(item => item.nombrePaciente === undefined)
        .map(item => item.idPaciente));
      const fotosPermitidas = new Set(items.filter(item => item.nombrePaciente !== null)
        .map(item => item.idPaciente));
      for (const id of new Set(items.map(item => item.idPaciente))) {
        if (!Number.isSafeInteger(id) || id <= 0) continue;
        if (nombresPendientes.has(id)) {
          this.solicitudesPacientes.add(this.pacientesService.obtener(id).subscribe({
            next: paciente => {
              if (!this.respuestaRelacionadaVigente(revision, identidad, id, 'paciente') || paciente.idPaciente !== id) return;
              const nombre = `${paciente.nombres ?? ''} ${paciente.apellidos ?? ''}`.trim();
              if (nombre) this.nombresPacientes.set(id, nombre);
            },
            error: () => { /* Una respuesta antigua puede carecer del nombre relacionado. */ },
          }));
        }
        if (!fotosPermitidas.has(id)) continue;
        this.solicitudesPacientes.add(this.pacientesService.obtenerFoto(id).subscribe({
          next: blob => {
            if (!this.respuestaRelacionadaVigente(revision, identidad, id, 'paciente')) return;
            if (!(blob instanceof Blob) || blob.size === 0 ||
                !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) return;
            const anterior = this.fotos.get(id);
            if (anterior) URL.revokeObjectURL(anterior);
            this.fotos.set(id, URL.createObjectURL(blob));
          },
          error: () => { /* Una foto ausente o inaccesible usa el marcador neutro. */ },
        }));
      }
    }
    if (this.permisos.puedeConsultar(MODULOS_PERMISO.EMPLEADOS)) {
      const nombresPendientes = new Set(items.filter(item => item.nombreMedico === undefined)
        .map(item => item.idMedico));
      for (const id of new Set(items.map(item => item.idMedico))) {
        if (!Number.isSafeInteger(id) || id <= 0 || !nombresPendientes.has(id)) continue;
        this.solicitudesMedicos.add(this.empleadosService.obtener(id).subscribe({
          next: medico => {
            if (!this.respuestaRelacionadaVigente(revision, identidad, id, 'medico') || medico.idEmpleado !== id) return;
            const nombre = `${medico.nombres ?? ''} ${medico.apellidos ?? ''}`.trim();
            if (nombre) this.nombresMedicos.set(id, nombre);
          },
          error: () => { /* No se sustituye por un nombre no verificado. */ },
        }));
      }
    }
  }

  private respuestaRelacionadaVigente(revision: number, identidad: string, id: number, tipo: 'paciente' | 'medico'): boolean {
    return this.respuestaPerteneceASesion(revision, identidad)
      && this.consultas.some(item => tipo === 'paciente' ? item.idPaciente === id : item.idMedico === id)
      && this.permisos.puedeConsultar(tipo === 'paciente' ? MODULOS_PERMISO.PACIENTES : MODULOS_PERMISO.EMPLEADOS);
  }

  private limpiarPacientes(): void {
    this.solicitudesPacientes.unsubscribe();
    this.solicitudesPacientes = new Subscription();
    this.nombresPacientes.clear();
    for (const url of this.fotos.values()) URL.revokeObjectURL(url);
    this.fotos.clear();
  }

  private limpiarMedicos(): void {
    this.solicitudesMedicos.unsubscribe();
    this.solicitudesMedicos = new Subscription();
    this.nombresMedicos.clear();
  }

  private limpiarRelacionados(): void {
    this.limpiarPacientes();
    this.limpiarMedicos();
  }

  private limpiarCatalogos(): void {
    this.revisionPacientes++;
    this.revisionMedicos++;
    this.solicitudPacientes?.unsubscribe();
    this.solicitudMedicos?.unsubscribe();
    this.solicitudSucursales?.unsubscribe();
    this.solicitudClinicas?.unsubscribe();
    this.solicitudPacientes = this.solicitudMedicos = this.solicitudSucursales = this.solicitudClinicas = undefined;
    this.pacientesPagina = [];
    this.medicosPagina = [];
    this.sucursales = [];
    this.clinicas = [];
    this.pacienteSeleccionado = null;
    this.medicoSeleccionado = null;
    this.cargandoPacientes = this.cargandoMedicos = this.cargandoSucursales = this.cargandoClinicas = false;
    this.errorPacientes = this.errorMedicos = this.errorSucursales = this.errorClinicas = '';
    this.paginaPacientes = this.paginaMedicos = 1;
    this.paginasPacientes = this.paginasMedicos = 0;
  }

  private identidadActual(): string | null {
    const userId = this.session.currentUser()?.idUsuario;
    const token = this.session.token;
    return this.session.isAuthenticated() && userId && token ? `${userId}:${token}` : null;
  }

  private limpiarDatosSensibles(): void {
    this.revisionSolicitud++;
    this.solicitud?.unsubscribe();
    this.solicitud = undefined;
    this.identidadCarga = null;
    this.limpiarRelacionados();
    this.limpiarCatalogos();
    this.catalogoContexto = null;
    this.filtros = filtrosVacios();
    this.filtrosAplicados = filtrosVacios();
    this.busquedaPaciente = this.busquedaMedico = '';
    this.consultas = [];
    this.totalCount = 0;
    this.totalPages = 0;
    this.cargando = false;
    this.error = '';
  }
}
