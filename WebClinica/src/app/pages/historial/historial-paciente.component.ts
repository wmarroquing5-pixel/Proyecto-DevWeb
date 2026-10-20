import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultaListadoDto, PagedResponse } from '../../core/models/historial.model';
import { correlativoPaginado } from '../../shared/utils/correlativo';

@Component({
  selector: 'app-historial-paciente',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h2>Historial Médico</h2>
          <p class="text-muted mb-0">Paciente ID: {{ idPaciente }}</p>
        </div>
        @if (permisos.puedeCrear(MODULOS_PERMISO.CONSULTAS)) {
          <a [routerLink]="['/historial', idPaciente, 'nueva-consulta']" class="btn btn-primary" title="Crear consulta">
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
                    (click)="cambiarPagina(page + 1)" [disabled]="consultas.length < pageSize">Siguiente</button>
          </div>
        </div>
      }
    </div>
  `
})
export class HistorialPacienteComponent implements OnInit {
  private service = inject(HistorialService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;
  readonly correlativo = correlativoPaginado;

  idPaciente!: number;
  consultas: ConsultaListadoDto[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';
  filtroDesde = '';
  filtroHasta = '';

  ngOnInit() {
    const paramId = this.route.snapshot.paramMap.get('id');
    if (!paramId) {
      this.error = 'No se especificó un paciente';
      return;
    }
    this.idPaciente = +paramId;
    this.cargarConsultas();
  }

  cargarConsultas() {
    this.cargando = true;
    this.error = '';
    this.service.listarConsultas({
      idPaciente: this.idPaciente,
      idMedico: null,
      idSucursal: null,
      idClinica: null,
      desde: this.filtroDesde || null,
      hasta: this.filtroHasta || null,
      page: this.page,
      pageSize: this.pageSize
    }).subscribe({
      next: (res: PagedResponse<ConsultaListadoDto>) => {
        this.consultas = res.items;
        this.total = res.totalCount;
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar el historial. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  buscar() { this.page = 1; this.cargarConsultas(); }
  limpiarFiltros() { this.filtroDesde = ''; this.filtroHasta = ''; this.buscar(); }
  cambiarPagina(n: number) { if (n > 0) { this.page = n; this.cargarConsultas(); } }
}
