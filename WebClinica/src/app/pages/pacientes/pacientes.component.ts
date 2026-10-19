import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PacientesService } from '../../core/services/paciente.service';
import { PacienteListadoResponse, PagedResponse } from '../../core/models/paciente.model';

@Component({
  selector: 'app-pacientes',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2>Gestión de Pacientes</h2>
        <a routerLink="/pacientes/nuevo" class="btn btn-primary">
          <i class="fa fa-plus"></i> Nuevo Paciente
        </a>
      </div>

      <!-- Filtros -->
      <div class="card p-3 mb-4">
        <div class="row g-3">
          <div class="col-md-6">
            <input type="text" class="form-control" placeholder="Buscar por nombre o apellido..." [(ngModel)]="filtroNombre" (input)="buscar()">
          </div>
          <div class="col-md-3">
            <select class="form-select" [(ngModel)]="filtroActivo" (change)="buscar()">
              <option [value]="undefined">Todos</option>
              <option [value]="true">Activos</option>
              <option [value]="false">Inactivos</option>
            </select>
          </div>
          <div class="col-md-3">
            <button class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()">Limpiar</button>
          </div>
        </div>
      </div>

      @if (cargando) {
        <div class="text-center py-4">
          <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Cargando...</span>
          </div>
        </div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else {
        <div class="table-responsive">
          <table class="table table-striped table-hover">
            <thead class="table-dark">
              <tr>
                <th>ID</th>
                <th>Nombre Completo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (paciente of pacientes; track paciente.idPaciente) {
                <tr>
                  <td>{{ paciente.idPaciente }}</td>
                  <td>{{ paciente.nombres }} {{ paciente.apellidos }}</td>
                  <td>
                    <span class="badge" [class.bg-success]="paciente.activo" [class.bg-secondary]="!paciente.activo">
                      {{ paciente.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td>
                    <a [routerLink]="['/historial', paciente.idPaciente]" class="btn btn-sm btn-info me-1">
                      <i class="fa fa-file-medical"></i> Historial
                   </a>
                    <a [routerLink]="['/pacientes/editar', paciente.idPaciente]" class="btn btn-sm btn-warning me-1">
                      <i class="fa fa-edit"></i>
                    </a>
                    <button (click)="eliminar(paciente.idPaciente)" class="btn btn-sm btn-danger" [disabled]="!paciente.activo">
                      <i class="fa fa-trash"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} pacientes</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">
              Anterior
            </button>
            <span class="mx-2">Página {{ page }}</span>
            <button class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page + 1)" [disabled]="pacientes.length < pageSize">
              Siguiente
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class PacientesComponent implements OnInit {
  private service = inject(PacientesService);

  pacientes: PacienteListadoResponse[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';

  filtroNombre = '';
  filtroActivo: boolean | undefined = undefined;

  ngOnInit() {
    this.cargarPacientes();
  }

  cargarPacientes() {
    this.cargando = true;
    this.error = '';
    this.service.listar(
      this.filtroNombre || undefined,
      this.filtroActivo,
      this.page,
      this.pageSize
    ).subscribe({
      next: (res: PagedResponse<PacienteListadoResponse>) => {
        this.pacientes = res.items;
        this.total = res.totalCount;
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar los pacientes. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  buscar() {
    this.page = 1;
    this.cargarPacientes();
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroActivo = undefined;
    this.buscar();
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina > 0) {
      this.page = nuevaPagina;
      this.cargarPacientes();
    }
  }

  eliminar(id: number) {
    if (confirm('¿Estás seguro de desactivar este paciente?')) {
      this.service.eliminar(id).subscribe({
        next: () => this.cargarPacientes(),
        error: () => alert('No se pudo desactivar el paciente.')
      });
    }
  }
}
