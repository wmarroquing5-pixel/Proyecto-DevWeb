import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
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
    imports: [RouterModule, FormsModule, ConfirmDialogComponent],
    template: `
    <div class="container mt-4 mb-4 medicamento-form-page">
      <h2 class="medicamento-form-page__title">{{ esEdicion ? 'Editar Medicamento' : 'Nuevo Medicamento' }}</h2>

      @if (error) { <div class="alert alert-danger" role="alert">{{ error }}</div> }
      @if (resultadoAltaIncierto) {
        <p class="alert alert-warning" role="alert">El resultado del alta es incierto. Consulte el listado antes de crear otro medicamento.</p>
      }
      @if (errorCatalogos) { <div class="alert alert-danger" role="alert">{{ errorCatalogos }}</div> }
      @if (cargandoCatalogos) { <p role="status">Cargando todas las categorías y marcas...</p> }
      @if (!cargandoCatalogos && !errorCatalogos && (!categorias.length || !marcas.length)) {
        <p class="alert alert-info">No hay categorías o marcas disponibles.</p>
      }
      <button type="button" class="btn btn-link" [disabled]="cargando || cargandoCatalogos || guardandoFoto" (click)="cargarCatalogos()">Recargar catálogos</button>

      <form id="medicamento-datos-form" (ngSubmit)="guardar()" class="ui-card medicamento-form-page__card" aria-labelledby="datos-medicamento-title">
        <h3 id="datos-medicamento-title" class="h5 medicamento-form-page__heading">Datos del medicamento</h3>
        <fieldset [disabled]="cargando || cargandoCatalogos || guardandoFoto || !puedeGuardar || !registroCargado || idCreado !== null">
        <div class="row g-3">
          <div class="col-md-6">
            <label for="medicamento-codigo" class="form-label">Código <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="medicamento-codigo" type="text" class="form-control" placeholder="Ingrese código" [(ngModel)]="form.codigo"
                   name="codigo" required maxlength="50">
          </div>
          <div class="col-md-6">
            <label for="medicamento-nombre" class="form-label">Nombre <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="medicamento-nombre" type="text" class="form-control" placeholder="Ingrese nombre" [(ngModel)]="form.nombre"
                   name="nombre" required maxlength="150">
          </div>
          <div class="col-md-6">
            <label for="medicamento-categoria" class="form-label">Categoría <span class="text-danger" aria-hidden="true">*</span></label>
            <select id="medicamento-categoria" class="form-select" [(ngModel)]="form.idCategoria"
                    name="idCategoria" required>
              <option [ngValue]="0">Seleccione...</option>
              @for (c of categoriasDisponibles; track c.idCategoria) {
                <option [ngValue]="c.idCategoria">{{ c.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label for="medicamento-marca" class="form-label">Marca <span class="text-danger" aria-hidden="true">*</span></label>
            <select id="medicamento-marca" class="form-select" [(ngModel)]="form.idMarca"
                    name="idMarca" required>
              <option [ngValue]="0">Seleccione...</option>
              @for (m of marcasDisponibles; track m.idMarca) {
                <option [ngValue]="m.idMarca">{{ m.nombre }}</option>
              }
            </select>
          </div>
          <div class="col-md-6">
            <label for="medicamento-precio" class="form-label">Precio de venta <span class="text-danger" aria-hidden="true">*</span></label>
            <input id="medicamento-precio" type="number" step="0.01" min="0" class="form-control"
                   [(ngModel)]="form.precioVenta" name="precioVenta" required>
          </div>
          <div class="col-md-6">
            <label for="medicamento-imagen-url" class="form-label">URL de imagen</label>
            <input id="medicamento-imagen-url" type="url" class="form-control" placeholder="Ingrese URL de imagen" [(ngModel)]="form.imagenURL"
                   name="imagenURL" maxlength="500">
          </div>
          <div class="col-12">
            <label for="medicamento-descripcion" class="form-label">Descripción</label>
            <textarea id="medicamento-descripcion" class="form-control" rows="3" [(ngModel)]="form.descripcion"
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
        </fieldset>
      </form>

      <section class="ui-card medicamento-form-page__card mt-4" aria-labelledby="foto-medicamento-title">
        <h3 id="foto-medicamento-title" class="h5 medicamento-form-page__heading">Fotografía</h3>
        @if (errorFoto) { <div class="alert alert-danger" role="alert">{{ errorFoto }}</div> }
        @if (avisoFoto) { <div class="alert alert-success" role="status">{{ avisoFoto }}</div> }
        @if (revisandoFoto || cargandoFoto) { <p role="status">{{ revisandoFoto ? 'Validando fotografía…' : 'Cargando fotografía…' }}</p> }
        @if (vistaPreviaFoto) {
          <img [src]="vistaPreviaFoto" alt="Vista previa de la fotografía del medicamento" class="img-thumbnail mb-3 medicamento-form-page__preview">
          @if (archivoFoto) { <p class="small text-muted">Vista previa sin guardar.</p> }
        } @else if (esEdicion && !cargandoFoto) {
          <p class="text-muted">El medicamento no tiene fotografía disponible.</p>
        }
        <div class="medicamento-form-page__upload">
          <div class="medicamento-form-page__upload-icon" aria-hidden="true"><i class="bi bi-cloud-arrow-up"></i></div>
          <div class="medicamento-form-page__upload-copy">
            <strong>Seleccionar archivo</strong>
            <span>Formatos permitidos: JPG, PNG y WebP (máx. 5 MB)</span>
          </div>
          <input id="medicamento-foto-archivo" type="file" class="visually-hidden" accept="image/jpeg,image/png,image/webp"
            (change)="seleccionarFoto($event)" [disabled]="cargando || guardandoFoto || revisandoFoto || !puedeSeleccionarFoto">
          <label for="medicamento-foto-archivo" class="btn btn-outline-primary medicamento-form-page__upload-button"
            [class.disabled]="cargando || guardandoFoto || revisandoFoto || !puedeSeleccionarFoto">Seleccionar archivo</label>
        </div>
        @if (esEdicion && permisos.puedeModificar('Medicamentos')) {
          <button type="button" class="btn btn-primary mt-3" (click)="guardarFoto()"
            [disabled]="!archivoFoto || guardandoFoto || revisandoFoto || cargando">
            {{ guardandoFoto ? 'Procesando…' : (fotoDisponible ? 'Sustituir fotografía' : 'Subir fotografía') }}
          </button>
          @if (fotoDisponible) {
            <button type="button" class="btn btn-outline-danger mt-3 ms-2" (click)="solicitarEliminarFoto()"
              [disabled]="guardandoFoto || revisandoFoto || cargando">Eliminar fotografía</button>
          }
        }
        @if (idCreado !== null) {
          <p class="small mt-3 mb-2">El medicamento ya se creó. La fotografía se guarda por separado.</p>
          <a [routerLink]="['/inventario/medicamentos/editar', idCreado]" class="btn btn-outline-primary btn-sm">Abrir ficha para verificar o reintentar la fotografía</a>
        } @else if (!esEdicion) {
          <p class="small text-muted mt-2 mb-0">La fotografía seleccionada se subirá después de confirmar el alta del medicamento.</p>
        }
      </section>

      <section class="ui-card medicamento-form-page__card mt-4" aria-labelledby="acciones-medicamento-title">
        <h3 id="acciones-medicamento-title" class="h5 medicamento-form-page__heading">Acciones</h3>
        <div class="d-flex gap-2 flex-wrap">
          <a routerLink="/inventario" class="btn btn-secondary">Cancelar</a>
          <button type="submit" form="medicamento-datos-form" class="btn btn-success"
            [disabled]="cargando || guardandoFoto || revisandoFoto || cargandoCatalogos || !!errorCatalogos || !puedeGuardar || !registroCargado || idCreado !== null || resultadoAltaIncierto">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </section>
      @if (confirmarEliminarFoto) {
        <app-confirm-dialog title="Eliminar fotografía" description="¿Deseas eliminar la fotografía actual del medicamento?"
          consequence="La eliminación se confirma de forma independiente de los datos del formulario."
          confirmLabel="Eliminar" [busy]="guardandoFoto" (confirmed)="eliminarFoto()" (cancelled)="cancelarEliminarFoto()" />
      }
    </div>
  `,
  styles: [`
    .medicamento-form-page__title { color: var(--ui-heading); font-size: clamp(1.9rem, 3vw, 2.5rem); font-weight: 700; margin-bottom: 1rem; }
    .medicamento-form-page__card { padding: 1.4rem; }
    .medicamento-form-page__heading { color: var(--ui-heading); font-weight: 700; margin-bottom: 1rem; }
    .medicamento-form-page .form-control, .medicamento-form-page .form-select { min-height: 2.5rem; }
    .medicamento-form-page .form-control::placeholder { color: #8090a7; opacity: 1; }
    .medicamento-form-page__preview { max-width: 240px; max-height: 240px; object-fit: contain; }
    .medicamento-form-page__upload { display: flex; align-items: center; flex-wrap: wrap; gap: .9rem; padding: .9rem 1rem; border: 1px dashed #bfd0e3; border-radius: .5rem; background: #f8fbff; }
    .medicamento-form-page__upload-icon { display: grid; place-items: center; width: 3.5rem; height: 3.5rem; flex: 0 0 auto; border-radius: .4rem; background: #edf3f8; color: #647b9d; font-size: 1.6rem; }
    .medicamento-form-page__upload-copy { display: grid; min-width: 0; color: var(--ui-heading); }
    .medicamento-form-page__upload-copy span { color: var(--ui-muted); font-size: .875rem; }
    .medicamento-form-page__upload-button { margin-left: auto; }
    .medicamento-form-page__upload:focus-within { outline: 3px solid #0d6efd; outline-offset: 2px; }
    @media (max-width: 575.98px) { .medicamento-form-page__card { padding: 1rem; } .medicamento-form-page__upload-button { width: 100%; margin-left: 0; } }
  `]
})
export class MedicamentoFormComponent implements OnInit {
  private service = inject(InventarioService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly permisos = inject(PermisosService);
  private errores = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private contexto = new ContextoInventario(['Medicamentos', 'Categorias', 'Marcas']);
  private catalogoSolicitud?: Subscription;
  private revisionCatalogos = 0;
  cargandoCatalogos = false;
  errorCatalogos = '';
  registroCargado = false;

  esEdicion = false;
  cargando = false;
  error = '';
  errorFoto = '';
  avisoFoto = '';
  archivoFoto: File | null = null;
  vistaPreviaFoto: string | null = null;
  revisandoFoto = false;
  cargandoFoto = false;
  guardandoFoto = false;
  fotoDisponible = false;
  confirmarEliminarFoto = false;
  idCreado: number | null = null;
  resultadoAltaIncierto = false;
  private revisionFoto = 0;
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

  get puedeSeleccionarFoto(): boolean {
    return this.esEdicion
      ? this.registroCargado && this.permisos.puedeModificar('Medicamentos')
      : this.permisos.puedeCrear('Medicamentos') && this.permisos.puedeModificar('Medicamentos');
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.revocarVistaPrevia());
    this.contexto.observar(() => {
      this.catalogoSolicitud?.unsubscribe();
      this.categorias = []; this.marcas = []; this.cargando = false;
      this.revisionFoto++; this.archivoFoto = null; this.revocarVistaPrevia();
      this.errorFoto = this.avisoFoto = ''; this.guardandoFoto = this.cargandoFoto = this.revisandoFoto = false;
      this.fotoDisponible = false; this.confirmarEliminarFoto = false;
      this.idCreado = null; this.resultadoAltaIncierto = false;
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
    this.idCreado = null;
    this.resultadoAltaIncierto = false;
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
          if (med.imagenURL) this.cargarFoto(med.idMedicamento, clave);
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
    if (this.idCreado !== null || this.resultadoAltaIncierto) {
      this.error = 'El alta ya se confirmó o su resultado es incierto. Verifique el medicamento antes de repetirla.';
      return;
    }
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
    if (!this.esEdicion && this.archivoFoto && !this.permisos.puedeModificar('Medicamentos')) {
      this.error = 'Se requiere Medicamentos/Modificar para subir la fotografía después del alta.'; return;
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
        next: (creado: MedicamentoResponse) => {
          if (!this.contexto.vigente(clave)) return;
          if (!creado || !idInventarioValido(creado.idMedicamento)) {
            this.resultadoAltaIncierto = true;
            this.error = 'La respuesta no confirma el medicamento creado. Consulte el listado antes de repetir el alta.';
            this.cargando = false; return;
          }
          if (!this.archivoFoto) { this.router.navigate(['/inventario']); return; }
          this.idCreado = creado.idMedicamento;
          this.subirFoto(creado.idMedicamento, this.archivoFoto, clave, true);
        },
        error: (err: HttpErrorResponse) => {
          if (!this.contexto.vigente(clave)) return;
          if (err.status === 0 || err.status >= 500) this.resultadoAltaIncierto = true;
          this.error = this.errores.messageFor(err, 'Error al crear el medicamento.');
          this.cargando = false;
        }
      }));
    }
  }

  async seleccionarFoto(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const revision = ++this.revisionFoto;
    const clave = this.contexto.clave();
    this.archivoFoto = null;
    this.errorFoto = this.avisoFoto = '';
    if (!file) return;
    this.revocarVistaPrevia();
    if (!this.puedeSeleccionarFoto || !this.contexto.vigente(clave)) {
      this.errorFoto = 'Se requiere una sesión vigente y permiso Medicamentos/Modificar para la fotografía.';
      input.value = ''; return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.errorFoto = 'Solo se admiten imágenes JPEG, PNG o WebP.'; input.value = ''; return;
    }
    if (file.size < 1 || file.size > 5 * 1024 * 1024) {
      this.errorFoto = 'La fotografía debe tener contenido y no superar 5 MB.'; input.value = ''; return;
    }
    this.revisandoFoto = true;
    try {
      const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
      if (revision !== this.revisionFoto || !this.contexto.vigente(clave)) return;
      const png = bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10]
        .every((value, index) => bytes[index] === value);
      const jpeg = bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
        && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
      const valido = file.type === 'image/png' && png || file.type === 'image/jpeg' && jpeg
        || file.type === 'image/webp' && webp;
      if (!valido) {
        this.errorFoto = 'El contenido de la imagen no coincide con su formato.';
        input.value = ''; return;
      }
      this.archivoFoto = file;
      this.mostrarBlob(file);
    } catch {
      if (revision === this.revisionFoto && this.contexto.vigente(clave))
        this.errorFoto = 'No se pudo leer la fotografía seleccionada.';
    } finally {
      if (revision === this.revisionFoto) this.revisandoFoto = false;
    }
  }

  guardarFoto(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const clave = this.contexto.clave();
    if (!this.esEdicion || !idInventarioValido(id) || !this.archivoFoto ||
      this.guardandoFoto || !this.registroCargado || !this.contexto.vigente(clave) ||
      !this.permisos.puedeModificar('Medicamentos')) {
      this.errorFoto = 'Verifique la fotografía, el medicamento y el permiso Medicamentos/Modificar.';
      return;
    }
    this.subirFoto(id, this.archivoFoto, clave, false);
  }

  solicitarEliminarFoto(): void {
    const clave = this.contexto.clave();
    if (this.esEdicion && this.registroCargado && this.fotoDisponible &&
      !this.guardandoFoto && !this.cargando && this.contexto.vigente(clave) &&
      this.permisos.puedeModificar('Medicamentos')) this.confirmarEliminarFoto = true;
  }

  cancelarEliminarFoto(): void {
    if (!this.guardandoFoto) this.confirmarEliminarFoto = false;
  }

  eliminarFoto(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    const clave = this.contexto.clave();
    if (!this.confirmarEliminarFoto || !this.esEdicion || !idInventarioValido(id) ||
      !this.registroCargado || !this.fotoDisponible || this.guardandoFoto ||
      !this.contexto.vigente(clave) || !this.permisos.puedeModificar('Medicamentos')) {
      this.confirmarEliminarFoto = false;
      this.errorFoto = 'La sesión, el permiso o la fotografía cambiaron. Vuelva a consultar la ficha.';
      return;
    }
    this.guardandoFoto = true;
    this.errorFoto = this.avisoFoto = '';
    this.contexto.agregar(this.service.eliminarFotoMedicamento(id).subscribe({
      next: () => {
        if (!this.contexto.vigente(clave) || Number(this.route.snapshot.paramMap.get('id')) !== id) return;
        this.guardandoFoto = false;
        this.confirmarEliminarFoto = false;
        this.fotoDisponible = false;
        this.archivoFoto = null;
        this.form.imagenURL = null;
        this.revocarVistaPrevia();
        this.avisoFoto = 'Fotografía eliminada.';
      },
      error: (err: HttpErrorResponse) => {
        if (!this.contexto.vigente(clave)) return;
        this.guardandoFoto = false;
        this.confirmarEliminarFoto = false;
        this.errorFoto = err.status === 0 || err.status >= 500
          ? 'El resultado de la eliminación es incierto. Vuelva a consultar la ficha antes de reintentar.'
          : this.errores.messageFor(err, 'No se pudo eliminar la fotografía.');
      }
    }));
  }

  private subirFoto(id: number, file: File, clave: string, trasAlta: boolean): void {
    this.guardandoFoto = true;
    this.errorFoto = this.avisoFoto = '';
    this.contexto.agregar(this.service.guardarFotoMedicamento(id, file).subscribe({
      next: response => {
        if (!this.contexto.vigente(clave) || (trasAlta && this.idCreado !== id)) return;
        this.guardandoFoto = false;
        this.cargando = false;
        if (response?.url !== `/api/medicamentos/${id}/foto`) {
          this.errorFoto = `El medicamento #${id} se guardó, pero no se confirmó su fotografía. Abra su ficha para verificarla antes de reintentar.`;
          return;
        }
        this.archivoFoto = null;
        this.fotoDisponible = true;
        this.form.imagenURL = response.url;
        this.avisoFoto = 'Fotografía guardada.';
        if (trasAlta) this.router.navigate(['/inventario']);
      },
      error: (err: HttpErrorResponse) => {
        if (!this.contexto.vigente(clave) || (trasAlta && this.idCreado !== id)) return;
        this.guardandoFoto = false;
        this.cargando = false;
        const detalle = err.status === 0 || err.status >= 500
          ? 'El resultado de la carga es incierto. Abra la ficha para verificar la fotografía antes de reintentar.'
          : this.errores.messageFor(err, 'No se pudo subir la fotografía.');
        this.errorFoto = trasAlta
          ? `El medicamento #${id} fue creado, pero la fotografía quedó pendiente. ${detalle}` : detalle;
      }
    }));
  }

  private cargarFoto(id: number, clave: string): void {
    this.cargandoFoto = true;
    this.contexto.agregar(this.service.obtenerFotoMedicamento(id).subscribe({
      next: blob => {
        if (!this.contexto.vigente(clave) || !this.esEdicion ||
          Number(this.route.snapshot.paramMap.get('id')) !== id) return;
        this.cargandoFoto = false;
        if (this.archivoFoto) return;
        if (!blob || blob.size === 0 || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
          this.errorFoto = 'La API devolvió una fotografía inválida.'; return;
        }
        this.fotoDisponible = true;
        this.mostrarBlob(blob);
      },
      error: (err: HttpErrorResponse) => {
        if (!this.contexto.vigente(clave)) return;
        this.cargandoFoto = false;
        if (err.status !== 404) this.errorFoto = this.errores.messageFor(err, 'No se pudo cargar la fotografía.');
      }
    }));
  }

  private mostrarBlob(blob: Blob): void {
    this.revocarVistaPrevia();
    this.vistaPreviaFoto = URL.createObjectURL(blob);
  }

  private revocarVistaPrevia(): void {
    if (this.vistaPreviaFoto) URL.revokeObjectURL(this.vistaPreviaFoto);
    this.vistaPreviaFoto = null;
  }
}
