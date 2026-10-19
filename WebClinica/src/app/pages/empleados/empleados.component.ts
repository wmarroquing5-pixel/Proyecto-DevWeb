import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EmpleadosService } from '../../core/services/empleado.service';
import { EmpleadoListadoResponse, PagedResponse } from '../../core/models/empleado.model';

@Component({
  selector: 'app-empleados',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2>Gestión de Empleados</h2>
        <a routerLink="/admin/empleados/nuevo" class="btn btn-primary">
          <i class="fa fa-plus"></i> Nuevo Empleado
        </a>
      </div>

      <!-- Filtros -->
      <div class="card p-3 mb-4">
        <div class="row g-3">
          <div class="col-md-4">
            <input type="text" class="form-control" placeholder="Buscar por nombre..." [(ngModel)]="filtroNombre" (input)="buscar()">
          </div>
          <div class="col-md-3">
            <select class="form-select" [(ngModel)]="filtroTipo" (change)="buscar()">
              <option value="">Todos los tipos</option>
              <option value="Medico">Médico</option>
              <option value="Enfermera">Enfermera</option>
              <option value="Administrativo">Administrativo</option>

            </select>
          </div>
          <div class="col-md-3">
            <select class="form-select" [(ngModel)]="filtroActivo" (change)="buscar()">
              <option [ngValue]="undefined">Todos</option>
              <option [ngValue]="true">Activos</option>
              <option [ngValue]="false">Inactivos</option>
            </select>
          </div>
          <div class="col-md-2">
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
                <th>Sucursal</th>
                <th>Tipo</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (emp of empleados; track emp.idEmpleado) {
                <tr>
                  <td>{{ emp.idEmpleado }}</td>
                  <td>{{ emp.nombres }} {{ emp.apellidos }}</td>
                  <td>{{ emp.idSucursal }}</td>
                  <td>
                    <span class="badge bg-info">{{ emp.tipoEmpleado }}</span>
                  </td>
                  <td>
                    <span class="badge" [class.bg-success]="emp.activo" [class.bg-secondary]="!emp.activo">
                      {{ emp.activo ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td>
                    <a [routerLink]="['/admin/empleados/editar', emp.idEmpleado]" class="btn btn-sm btn-warning me-1">
                      <i class="fa fa-edit"></i>
                    </a>
                    <button (click)="eliminar(emp.idEmpleado)" class="btn btn-sm btn-danger" [disabled]="!emp.activo">
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
          <span>Total: {{ total }} empleados</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">
              Anterior
            </button>
            <span class="mx-2">Página {{ page }}</span>
            <button class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page + 1)" [disabled]="empleados.length < pageSize">
              Siguiente
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class EmpleadosComponent implements OnInit {
  private service = inject(EmpleadosService);

  empleados: EmpleadoListadoResponse[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';

  filtroNombre = '';
  filtroTipo = '';
  filtroActivo: boolean | undefined = undefined;

  ngOnInit() {
    this.cargarEmpleados();
  }

  cargarEmpleados() {
    this.cargando = true;
    this.error = '';
    this.service.listar(
      this.filtroNombre || undefined,
      this.filtroTipo || undefined,
      undefined,
      this.filtroActivo,
      this.page,
      this.pageSize
    ).subscribe({
      next: (res: PagedResponse<EmpleadoListadoResponse>) => {
        this.empleados = res.items;
        this.total = res.totalCount;
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar los empleados. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  buscar() {
    this.page = 1;
    this.cargarEmpleados();
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroTipo = '';
    this.filtroActivo = undefined;
    this.buscar();
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina > 0) {
      this.page = nuevaPagina;
      this.cargarEmpleados();
    }
  }

  eliminar(id: number) {
    if (confirm('¿Estás seguro de eliminar este empleado?')) {
      this.service.eliminar(id).subscribe({
        next: () => this.cargarEmpleados(),
        error: () => alert('No se pudo eliminar el empleado.')
      });
    }
  }
}
