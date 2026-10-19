import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../core/services/inventario.service';
import {
  GuardarMedicamentoRequest,
  MedicamentoResponse,
  CategoriaResponse,
  MarcaResponse
} from '../../core/models/inventario.model';

@Component({
  selector: 'app-medicamento-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Medicamento' : 'Nuevo Medicamento' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <div class="row g-3">
          <div class="col-md-6">
            <label class="form-label">Código *</label>
            <input type="text" class="form-control" [(ngModel)]="form.codigo"
                   name="codigo" required maxlength="50">
          </div>
          <div class="col-md-6">
            <label class="form-label">Nombre *</label>
            <input type="text" class="form-control" [(ngModel)]="form.nombre"
                   name="nombre" required maxlength="150">
          </div>
          <div class="col-md-6">
            <label class="form-label">Categoría *</label>
            <select class="form-select" [(ngModel)]="form.idCategoria"
                    name="idCategoria" required>
              <option [ngValue]="0">Seleccione...</option>
              @for (c of categorias; track c.idCategoria) {
                <option [ngValue]="c.idCategoria">{{ c.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Marca *</label>
            <select class="form-select" [(ngModel)]="form.idMarca"
                    name="idMarca" required>
              <option [ngValue]="0">Seleccione...</option>
              @for (m of marcas; track m.idMarca) {
                <option [ngValue]="m.idMarca">{{ m.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Precio de Venta *</label>
            <input type="number" step="0.01" min="0" class="form-control"
                   [(ngModel)]="form.precioVenta" name="precioVenta" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">URL de Imagen</label>
            <input type="url" class="form-control" [(ngModel)]="form.imagenURL"
                   name="imagenURL" maxlength="500">
          </div>
          <div class="col-12">
            <label class="form-label">Descripción</label>
            <textarea class="form-control" rows="3" [(ngModel)]="form.descripcion"
                      name="descripcion" maxlength="500"></textarea>
          </div>
          @if (esEdicion) {
            <div class="col-md-4 d-flex align-items-end">
              <div class="form-check">
                <input type="checkbox" class="form-check-input" id="activo"
                       [(ngModel)]="form.activo" name="activo">
                <label class="form-check-label" for="activo">Activo</label>
              </div>
            </div>
          }
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/inventario" class="btn btn-secondary">Cancelar</a>
        </div>
      </form>
    </div>
  `
})
export class MedicamentoFormComponent implements OnInit {
  private service = inject(InventarioService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  esEdicion = false;
  cargando = false;
  error = '';
  categorias: CategoriaResponse[] = [];
  marcas: MarcaResponse[] = [];

  form: GuardarMedicamentoRequest = {
    idCategoria: 0,
    idMarca: 0,
    codigo: '',
    nombre: '',
    descripcion: null,
    precioVenta: 0,
    imagenURL: null,
    activo: true
  };

  ngOnInit() {
    this.cargarCatalogos();

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.cargando = true;
      this.service.obtenerMedicamento(+id).subscribe({
        next: (med: MedicamentoResponse) => {
          this.form = {
            idCategoria: med.idCategoria,
            idMarca: med.idMarca,
            codigo: med.codigo,
            nombre: med.nombre,
            descripcion: med.descripcion,
            precioVenta: med.precioVenta,
            imagenURL: med.imagenURL,
            activo: med.activo
          };
          this.cargando = false;
        },
        error: () => {
          this.error = 'Medicamento no encontrado';
          this.cargando = false;
        }
      });
    }
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

  guardar() {
    this.cargando = true;
    this.error = '';

    const formData: GuardarMedicamentoRequest = {
      ...this.form,
      idCategoria: this.form.idCategoria || 0,
      idMarca: this.form.idMarca || 0,
      descripcion: this.form.descripcion || null,
      imagenURL: this.form.imagenURL || null,
      activo: this.esEdicion ? this.form.activo : null
    };

    if (this.esEdicion) {
      const id = +this.route.snapshot.paramMap.get('id')!;
      this.service.actualizarMedicamento(id, formData).subscribe({
        next: () => this.router.navigate(['/inventario']),
        error: (err) => {
          this.error = err.error?.message || 'Error al actualizar';
          this.cargando = false;
        }
      });
    } else {
      this.service.crearMedicamento(formData).subscribe({
        next: () => this.router.navigate(['/inventario']),
        error: (err) => {
          this.error = err.error?.message || 'Error al crear';
          this.cargando = false;
        }
      });
    }
  }
}