import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../core/services/inventario.service';
import { CatalogoMedicamentoResponse, PagedResponse } from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
    selector: 'app-inventario-list',
    imports: [CommonModule, RouterModule, FormsModule],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <h2><i class="fa fa-pills"></i> Inventario de Medicamentos</h2>
        <div class="page-header__actions">
          @if (permisos.puedeCrear(MODULOS_PERMISO.MEDICAMENTOS)) {
            <a routerLink="/inventario/medicamentos/nuevo" class="btn btn-primary">
              <i class="fa fa-plus"></i> Nuevo Medicamento
            </a>
          }
          @if (permisos.puedeConsultar(MODULOS_PERMISO.LOTES_MEDICAMENTO)) {
            <a routerLink="/inventario/lotes" class="btn btn-secondary">
              <i class="fa fa-boxes"></i> Gestionar Lotes
            </a>
          }
        </div>
      </header>

      <!-- Filtros -->
      <div class="ui-card ui-form mb-4">
        <div class="row g-3">
          <div class="col-md-5">
            <label for="inventario-nombre" class="form-label">Buscar por nombre</label>
            <input id="inventario-nombre" type="text" class="form-control" placeholder="Nombre del medicamento..."
                   [(ngModel)]="filtroNombre" (input)="buscar()">
          </div>
          <div class="col-md-3">
            <label for="inventario-categoria" class="form-label">Categoría</label>
            <select id="inventario-categoria" class="form-select" [(ngModel)]="filtroCategoriaId" (change)="buscar()">
              <option [ngValue]="null">Todas</option>
              @for (c of categorias; track c.idCategoria) {
                <option [ngValue]="c.idCategoria">{{ c.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-3">
            <label for="inventario-marca" class="form-label">Marca</label>
            <select id="inventario-marca" class="form-select" [(ngModel)]="filtroMarcaId" (change)="buscar()">
              <option [ngValue]="null">Todas</option>
              @for (m of marcas; track m.idMarca) {
                <option [ngValue]="m.idMarca">{{ m.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-1 d-flex align-items-end">
            <button type="button" class="btn btn-outline-secondary w-100" (click)="limpiarFiltros()" aria-label="Limpiar filtros" title="Limpiar filtros">
              <i class="fa fa-times"></i>
            </button>
          </div>
        </div>
      </div>

      @if (cargando) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (medicamentos.length === 0) {
        <div class="alert alert-info text-center">No hay medicamentos registrados.</div>
      } @else {
        <div class="ui-table-wrap">
          <table class="table table-striped table-hover ui-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th>Marca</th>
                <th class="ui-col-number">Precio</th>
                <th class="ui-col-number">Stock</th>
                <th class="ui-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (m of medicamentos; track m.idMedicamento) {
                <tr>
                  <td><code>{{ m.codigo }}</code></td>
                  <td>{{ m.nombre }}</td>
                  <td>{{ m.categoria }}</td>
                  <td>{{ m.marca }}</td>
                  <td class="ui-col-number">Q{{ m.precioVenta | number:'1.2-2' }}</td>
                  <td class="ui-col-number">
                    <span class="badge"
                          [class.bg-success]="m.existenciaTotal > 10"
                          [class.bg-warning]="m.existenciaTotal > 0 && m.existenciaTotal <= 10"
                          [class.bg-danger]="m.existenciaTotal === 0">
                      {{ m.existenciaTotal }}
                    </span>
                  </td>
                  <td class="ui-actions ui-col-actions">
                    @if (permisos.puedeModificar(MODULOS_PERMISO.MEDICAMENTOS)) {
                      <a [routerLink]="['/inventario/medicamentos/editar', m.idMedicamento]"
                         class="btn btn-sm btn-outline-primary ui-icon-button" aria-label="Editar medicamento" title="Editar medicamento">
                        <i class="fa fa-edit"></i>
                      </a>
                    }
                    @if (permisos.puedeEliminar(MODULOS_PERMISO.MEDICAMENTOS)) {
                      <button type="button" (click)="desactivar(m.idMedicamento)" class="btn btn-sm btn-outline-danger ui-icon-button"
                              [disabled]="!m.existenciaTotal" aria-label="Eliminar medicamento" title="Eliminar medicamento">
                        <i class="fa fa-trash"></i>
                      </button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Paginación -->
        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} medicamentos</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2"
                    (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">
              Anterior
            </button>
            <span class="mx-2">Página {{ page }}</span>
            <button class="btn btn-outline-secondary btn-sm"
                    (click)="cambiarPagina(page + 1)" [disabled]="medicamentos.length < pageSize">
              Siguiente
            </button>
          </div>
        </div>
      }
    </div>
  `
})
export class InventarioListComponent implements OnInit {
  private service = inject(InventarioService);
  readonly permisos = inject(PermisosService);
  readonly MODULOS_PERMISO = MODULOS_PERMISO;

  medicamentos: CatalogoMedicamentoResponse[] = [];
  categorias: { idCategoria: number; nombre: string }[] = [];
  marcas: { idMarca: number; nombre: string }[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';

  filtroNombre = '';
  filtroCategoriaId: number | null = null;
  filtroMarcaId: number | null = null;

  ngOnInit() {
    this.cargarCatalogos();
    this.cargarMedicamentos();
  }

  cargarCatalogos() {
    this.service.listarCategorias(1, 100).subscribe({
      next: (res) => this.categorias = res.items,
      error: () => console.error('Error cargando categorías')
    });
    this.service.listarMarcas(1, 100).subscribe({
      next: (res) => this.marcas = res.items,
      error: () => console.error('Error cargando marcas')
    });
  }

  cargarMedicamentos() {
    this.cargando = true;
    this.error = '';
    this.service.listarCatalogo({
      nombre: this.filtroNombre || null,
      categoriaId: this.filtroCategoriaId,
      marcaId: this.filtroMarcaId,
      page: this.page,
      pageSize: this.pageSize
    }).subscribe({
      next: (res: PagedResponse<CatalogoMedicamentoResponse>) => {
        this.medicamentos = res.items;
        this.total = res.totalCount;
        this.cargando = false;
      },
      error: () => {
        this.error = 'Error al cargar los medicamentos. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  buscar() {
    this.page = 1;
    this.cargarMedicamentos();
  }

  limpiarFiltros() {
    this.filtroNombre = '';
    this.filtroCategoriaId = null;
    this.filtroMarcaId = null;
    this.buscar();
  }

  cambiarPagina(n: number) {
    if (n > 0) {
      this.page = n;
      this.cargarMedicamentos();
    }
  }

  desactivar(id: number) {
    if (confirm('¿Estás seguro de desactivar este medicamento?')) {
      this.service.desactivarMedicamento(id).subscribe({
        next: () => this.cargarMedicamentos(),
        error: () => alert('No se pudo desactivar el medicamento.')
      });
    }
  }
}
