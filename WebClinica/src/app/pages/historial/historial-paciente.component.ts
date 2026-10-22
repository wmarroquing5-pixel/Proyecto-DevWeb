import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, effect, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultaListadoDto, PagedResponse } from '../../core/models/historial.model';
import { correlativoPaginado } from '../../shared/utils/correlativo';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ApiErrorService } from '../../core/services/api-error.service';

@Component({
    selector: 'app-historial-paciente',
    imports: [CommonModule, RouterModule, FormsModule],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h2>Historial Médico</h2>
          <p class="text-muted mb-0">Paciente ID: {{ idPaciente }}</p>
        </div>
        @if (permisos.puedeCrear(MODULOS_PERMISO.CONSULTAS) && permisos.puedeConsultar(MODULOS_PERMISO.PACIENTES)) {
          <a routerLink="/consultas/nueva" [queryParams]="{ idPaciente: idPaciente }" class="btn btn-primary" title="Crear consulta">
            <i class="bi bi-plus-lg" aria-hidden="true"></i> Nueva Consulta
          </a>
        }
      </header>

      <div class="ui-card ui-form mb-4">
        <div class="row g-3">
          <div class="col-md-4">
            <label for="historial-desde" class="form-label">Desde</label>
            <input id="historial-desde" type="date" class="form-control" [(ngModel)]="filtroDesde" (change)="buscar()">
          </div>
          <div class="col-md-4">
            <label for="historial-hasta" class="form-label">Hasta</label>
            <input id="historial-hasta" type="date" class="form-control" [(ngModel)]="filtroHasta" (change)="buscar()">
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()">Limpiar</button>
          </div>
        </div>
      </div>

      @if (cargando) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (consultas.length === 0) {
        <div class="alert alert-info text-center">No hay consultas registradas para este paciente.</div>
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-striped table-hover ui-table">
            <thead>
              <tr>
                <th scope="col" class="ui-col-index">No.</th>
                <th scope="col" class="ui-col-date">Fecha</th>
                <th>Médico</th>
                <th>Sucursal</th>
                <th scope="col" class="ui-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (c of consultas; track c.idConsulta; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index, page, pageSize) }}</td>
                  <td class="ui-col-date">{{ c.fechaConsulta | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ c.idMedico }}</td>
                  <td>{{ c.idSucursal }}</td>
                  <td class="ui-actions ui-col-actions">
                    @if (permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL)) {
                      <a [routerLink]="['/historial', idPaciente, 'consulta', c.idConsulta]"
                         class="btn btn-sm btn-outline-info" aria-label="Ver detalle de consulta" title="Ver detalle">
                        <i class="bi bi-eye" aria-hidden="true"></i> Ver
                      </a>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} consultas</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2"
                    (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">Anterior</button>
            <span class="mx-2">Página {{ page }}</span>
            <button class="btn btn-outline-secondary btn-sm"
                    (click)="cambiarPagina(page + 1)" [disabled]="page >= totalPages">Siguiente</button>
          </div>
        </div>
      }
    </div>
  `
})
export class HistorialPacienteComponent implements OnInit {
  private service = inject(HistorialService);
  private route = inject(ActivatedRoute);
  private session = inject(AuthSessionService);
  private apiErrors = inject(ApiErrorService);
  private destroyRef = inject(DestroyRef);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  idPaciente!: number;
  consultas: ConsultaListadoDto[] = [];
  total = 0;
  totalPages = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';
  filtroDesde = '';
  filtroHasta = '';
  private listado?: Subscription;
  private revisionListado = 0;
  private contextoObservado: string | null | undefined;

  constructor() {
    effect(() => {
      const contexto = this.contextoLectura();
      const cambio = this.contextoObservado !== undefined && contexto !== this.contextoObservado;
      this.contextoObservado = contexto;
      if (!contexto || cambio) {
        this.revisionListado++;
        this.listado?.unsubscribe();
        this.consultas = [];
        this.total = this.totalPages = 0;
        this.cargando = false;
        if (!contexto) this.error = 'No tiene sesión y permiso Consultas/Consultar vigentes.';
        else if (cambio && this.idValido(this.idPaciente)) this.cargarConsultas();
      }
    });
  }

  ngOnInit() {
    const paramId = this.route.snapshot.paramMap.get('id');
    if (!paramId || !this.idValido(Number(paramId))) {
      this.error = 'No se especificó un paciente';
      return;
    }
    this.idPaciente = +paramId;
    this.cargarConsultas();
  }

  cargarConsultas() {
    this.listado?.unsubscribe();
    const revision = ++this.revisionListado;
    const contexto = this.contextoLectura();
    const paciente = this.idPaciente;
    const pagina = this.page;
    if (!contexto || !this.idValido(paciente) || !this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)) {
      this.consultas = []; this.total = this.totalPages = 0; this.cargando = false;
      this.error = 'No tiene sesión y permiso Consultas/Consultar vigentes.'; return;
    }
    this.cargando = true;
    this.error = '';
    this.listado = this.service.listarConsultas({
      idPaciente: paciente,
      idMedico: null,
      idSucursal: null,
      idClinica: null,
      desde: this.filtroDesde || null,
      hasta: this.filtroHasta || null,
      page: pagina,
      pageSize: this.pageSize
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res: PagedResponse<ConsultaListadoDto>) => {
        if (revision !== this.revisionListado || contexto !== this.contextoLectura()
          || paciente !== this.idPaciente || pagina !== this.page) return;
        const totalPages = Math.ceil(res.totalCount / this.pageSize);
        const esperados = Math.min(this.pageSize, Math.max(0, res.totalCount - (pagina - 1) * this.pageSize));
        if (!Array.isArray(res.items) || res.page !== pagina || res.pageSize !== this.pageSize
          || !Number.isSafeInteger(res.totalCount) || res.totalCount < 0 || res.totalPages !== totalPages
          || res.items.length !== esperados || res.items.some(c => !this.idValido(c.idConsulta) || c.idPaciente !== paciente)) {
          this.consultas = []; this.total = this.totalPages = 0; this.cargando = false;
          this.error = 'La API devolvió una página de historial contradictoria. Recargue el historial.'; return;
        }
        this.consultas = res.items;
        this.total = res.totalCount;
        this.totalPages = res.totalPages;
        this.cargando = false;
      },
      error: (err: HttpErrorResponse) => {
        if (revision !== this.revisionListado || contexto !== this.contextoLectura()) return;
        this.consultas = []; this.total = this.totalPages = 0;
        this.error = this.apiErrors.messageFor(err, 'Error al cargar el historial. Verifica tus permisos.');
        this.cargando = false;
      }
    });
  }

  buscar() { this.page = 1; this.cargarConsultas(); }
  limpiarFiltros() { this.filtroDesde = ''; this.filtroHasta = ''; this.buscar(); }
  cambiarPagina(n: number) {
    if (Number.isInteger(n) && n > 0 && n <= Math.max(this.totalPages, 1)) {
      this.page = n; this.cargarConsultas();
    }
  }

  private contextoLectura(): string | null {
    const usuario = this.session.currentUser();
    const token = this.session.token;
    return this.session.isAuthenticated() && usuario && token
      ? `${usuario.idUsuario}:${usuario.idRol}:${token}:${this.permisos.puedeConsultar(MODULOS_PERMISO.CONSULTAS)}` : null;
  }

  private idValido(id: number): boolean {
    return Number.isSafeInteger(id) && id > 0 && id <= 2_147_483_647;
  }
}
