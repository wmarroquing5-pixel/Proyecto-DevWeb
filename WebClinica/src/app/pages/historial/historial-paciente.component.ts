import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HistorialService } from '../../core/services/historial.service';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultaListadoDto, PagedResponse } from '../../core/models/historial.model';

@Component({
  selector: 'app-historial-paciente',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Historial Médico</h2>
          <p class="text-muted mb-0">Paciente ID: {{ idPaciente }}</p>
        </div>
        @if (permisos.puedeCrear(MODULOS_PERMISO.CONSULTAS)) {
          <a [routerLink]="['/historial', idPaciente, 'nueva-consulta']" class="btn btn-primary">
            <i class="fa fa-plus"></i> Nueva Consulta
          </a>
        }
      </div>

      <div class="card p-3 mb-4">
        <div class="row g-3">
          <div class="col-md-4">
            <label class="form-label">Desde</label>
            <input type="date" class="form-control" [(ngModel)]="filtroDesde" (change)="buscar()">
          </div>
          <div class="col-md-4">
            <label class="form-label">Hasta</label>
            <input type="date" class="form-control" [(ngModel)]="filtroHasta" (change)="buscar()">
          </div>
          <div class="col-md-4 d-flex align-items-end">
            <button class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()">Limpiar</button>
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
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead class="table-dark">
              <tr>
                <th>#</th>
                <th>Fecha</th>
                <th>Médico</th>
                <th>Sucursal</th>
                <th>Motivo</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (c of consultas; track c.idConsulta) {
                <tr>
                  <td>{{ c.idConsulta }}</td>
                  <td>{{ c.fechaConsulta | date:'dd/MM/yyyy HH:mm' }}</td>
                  <td>{{ c.idMedico }}</td>
                  <td>{{ c.idSucursal }}</td>
                  <td>
                    @if (permisos.puedeConsultar(MODULOS_PERMISO.HISTORIAL)) {
                      <a [routerLink]="['/historial', idPaciente, 'consulta', c.idConsulta]"
                         class="btn btn-sm btn-info me-1">
                        <i class="fa fa-eye"></i> Ver
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
