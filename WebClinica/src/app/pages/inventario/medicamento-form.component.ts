import { Component, inject, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { InventarioService } from '../../core/services/inventario.service';
import {
  GuardarMedicamentoRequest,
  MedicamentoResponse,
  CategoriaResponse,
  MarcaResponse
} from '../../core/models/inventario.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { forkJoin, Subscription } from 'rxjs';
import { cargarCatalogoInventario, ContextoInventario, idInventarioValido } from './inventario-ui';

@Component({
    selector: 'app-medicamento-form',
    imports: [RouterModule, FormsModule],
    template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Medicamento' : 'Nuevo Medicamento' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }
      @if (errorCatalogos) { <div class="alert alert-danger" role="alert">{{ errorCatalogos }}</div> }
      @if (cargandoCatalogos) { <p role="status">Cargando todas las categorías y marcas...</p> }
      @if (!cargandoCatalogos && !errorCatalogos && (!categorias.length || !marcas.length)) {
        <p class="alert alert-info">No hay categorías o marcas disponibles.</p>
      }
      <button type="button" class="btn btn-link" [disabled]="cargando || cargandoCatalogos" (click)="cargarCatalogos()">Recargar catálogos</button>

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <fieldset [disabled]="cargando || cargandoCatalogos || !puedeGuardar">
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
              @for (c of categoriasDisponibles; track c.idCategoria) {
                <option [ngValue]="c.idCategoria">{{ c.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Marca *</label>
            <select class="form-select" [(ngModel)]="form.idMarca"
                    name="idMarca" required>
              <option [ngValue]="0">Seleccione...</option>
              @for (m of marcasDisponibles; track m.idMarca) {
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
          <button type="submit" class="btn btn-success" [disabled]="cargando || cargandoCatalogos || !!errorCatalogos || !puedeGuardar || !registroCargado">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/inventario" class="btn btn-secondary">Cancelar</a>
        </div>
        </fieldset>
      </form>
    </div>
  `
})
export class MedicamentoFormComponent implements OnInit {
  private service = inject(InventarioService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private permisos = inject(PermisosService);
  private errores = inject(ApiErrorService);
  private contexto = new ContextoInventario(['Medicamentos', 'Categorias', 'Marcas']);
  private catalogoSolicitud?: Subscription;
  private revisionCatalogos = 0;
  cargandoCatalogos = false;
  errorCatalogos = '';
  registroCargado = false;

  esEdicion = false;
  cargando = false;
  error = '';
  categorias: CategoriaResponse[] = [];
  marcas: MarcaResponse[] = [];
  idCategoriaOriginal: number | null = null;
  idMarcaOriginal: number | null = null;

  get categoriasDisponibles(): CategoriaResponse[] {
    return this.categorias.filter(item => item.activa
      || (this.esEdicion && item.idCategoria === this.idCategoriaOriginal));
  }

  get marcasDisponibles(): MarcaResponse[] {
    return this.marcas.filter(item => item.activa
      || (this.esEdicion && item.idMarca === this.idMarcaOriginal));
  }

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

  get puedeGuardar(): boolean {
    return this.esEdicion ? this.permisos.puedeModificar('Medicamentos') : this.permisos.puedeCrear('Medicamentos');
  }

  constructor() {
    this.contexto.observar(() => {
      this.catalogoSolicitud?.unsubscribe();
      this.categorias = []; this.marcas = []; this.cargando = false;
      this.idCategoriaOriginal = this.idMarcaOriginal = null;
      this.form = { idCategoria: 0, idMarca: 0, codigo: '', nombre: '', precioVenta: 0, descripcion: null, imagenURL: null, activo: true };
      this.ngOnInit();
    });
  }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.esEdicion = id !== null;
    this.registroCargado = !this.esEdicion;
    this.error = '';
    this.cargarCatalogos();
    if (id) {
      const clave = this.contexto.clave();
      if (!idInventarioValido(+id) || !this.contexto.vigente(clave) || !this.permisos.puedeConsultar('Medicamentos')) {
        this.error = 'No se puede consultar el medicamento con el identificador y permisos actuales.'; return;
      }
      this.cargando = true;
      this.contexto.agregar(this.service.obtenerMedicamento(+id).subscribe({
        next: (med: MedicamentoResponse) => {
          if (!this.contexto.vigente(clave)) return;
          if (med.idMedicamento !== +id) { this.error = 'La respuesta no corresponde al medicamento.'; this.cargando = false; return; }
          this.idCategoriaOriginal = med.idCategoria;
          this.idMarcaOriginal = med.idMarca;
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
          this.registroCargado = true;
        },
        error: err => {
          if (!this.contexto.vigente(clave)) return;
          this.error = this.errores.messageFor(err, 'Medicamento no encontrado o sesión expirada');
          this.cargando = false;
        }
      }));
    }
  }

  cargarCatalogos() {
    this.catalogoSolicitud?.unsubscribe();
    const revision = ++this.revisionCatalogos, clave = this.contexto.clave();
    this.errorCatalogos = ''; this.cargandoCatalogos = false;
    this.categorias = []; this.marcas = [];
    if (!this.contexto.vigente(clave) || !this.permisos.puedeConsultar('Categorias') || !this.permisos.puedeConsultar('Marcas')) {
      this.errorCatalogos = 'Se requieren permisos Categorias/Consultar y Marcas/Consultar vigentes.'; return;
    }
    this.cargandoCatalogos = true;
    this.catalogoSolicitud = forkJoin({
      categorias: cargarCatalogoInventario((p, t) => this.service.listarCategorias(p, t), c => c.idCategoria),
      marcas: cargarCatalogoInventario((p, t) => this.service.listarMarcas(p, t), m => m.idMarca),
    }).subscribe({
      next: data => {
        if (!this.contexto.vigente(clave) || revision !== this.revisionCatalogos) return;
        this.categorias = data.categorias; this.marcas = data.marcas; this.cargandoCatalogos = false;
      },
      error: err => {
        if (!this.contexto.vigente(clave) || revision !== this.revisionCatalogos) return;
        this.errorCatalogos = this.errores.messageFor(err, 'No se pudieron cargar los catálogos completos. Recargue los catálogos.');
        this.cargandoCatalogos = false;
      },
    });
    this.contexto.agregar(this.catalogoSolicitud);
  }

  guardar() {
    if (this.cargando) return;
    const clave = this.contexto.clave();
    if (!this.contexto.vigente(clave) || !this.puedeGuardar || !this.registroCargado ||
      this.cargandoCatalogos || this.errorCatalogos) {
      this.error = 'Verifique los permisos, el medicamento y los catálogos antes de guardar.'; return;
    }
    const categoriaValida = this.categoriasDisponibles.some(
      item => item.idCategoria === this.form.idCategoria,
    );
    const marcaValida = this.marcasDisponibles.some(item => item.idMarca === this.form.idMarca);
    if (this.cargando || !categoriaValida || !marcaValida) {
      this.error = 'Seleccione una categoría y una marca disponibles.';
      return;
    }
    if (!idInventarioValido(this.form.idCategoria) || !idInventarioValido(this.form.idMarca) ||
      !this.form.codigo?.trim() || this.form.codigo.trim().length > 50 ||
      !this.form.nombre?.trim() || this.form.nombre.trim().length > 150 ||
      (this.form.descripcion?.trim().length ?? 0) > 500 || (this.form.imagenURL?.length ?? 0) > 500 ||
      !Number.isFinite(this.form.precioVenta) || this.form.precioVenta <= 0 || this.form.precioVenta >= 1e16 ||
      !/^\d+(\.\d{1,2})?$/.test(String(this.form.precioVenta))) {
      this.error = 'Complete código y nombre válidos y un precio positivo con hasta dos decimales.'; return;
    }
    if ((this.esEdicion ? this.form.activo !== false : true) &&
      (!this.categorias.find(c => c.idCategoria === this.form.idCategoria)?.activa ||
       !this.marcas.find(m => m.idMarca === this.form.idMarca)?.activa)) {
      this.error = 'Un medicamento activo requiere categoría y marca activas.'; return;
    }
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
      this.contexto.agregar(this.service.actualizarMedicamento(id, formData).subscribe({
        next: () => { if (this.contexto.vigente(clave)) this.router.navigate(['/inventario']); },
        error: (err) => {
          if (!this.contexto.vigente(clave)) return;
          this.error = this.errores.messageFor(err, 'Error al actualizar el medicamento.');
          this.cargando = false;
        }
      }));
    } else {
      this.contexto.agregar(this.service.crearMedicamento(formData).subscribe({
        next: () => { if (this.contexto.vigente(clave)) this.router.navigate(['/inventario']); },
        error: (err) => {
          if (!this.contexto.vigente(clave)) return;
          this.error = this.errores.messageFor(err, 'Error al crear el medicamento.');
          this.cargando = false;
        }
      }));
    }
  }
}
