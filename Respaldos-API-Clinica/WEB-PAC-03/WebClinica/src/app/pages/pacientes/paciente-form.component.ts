import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, inject, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PacientesService } from '../../core/services/paciente.service';
import { GuardarPacienteRequest, PacienteResponse } from '../../core/models/paciente.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ContextoInventario, fechaInventarioValida, idInventarioValido } from '../inventario/inventario-ui';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { PacienteContactosComponent } from './paciente-contactos.component';

@Component({
    selector: 'app-paciente-form',
    imports: [RouterModule, FormsModule, ConfirmDialogComponent, PacienteContactosComponent],
    template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Paciente' : 'Nuevo Paciente' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form id="paciente-datos-form" (ngSubmit)="guardar()" class="card p-4 shadow-sm" aria-labelledby="datos-paciente-title">
        <h3 id="datos-paciente-title" class="h5">Datos del paciente</h3>
        <fieldset [disabled]="cargando || !puedeGuardar || !registroCargado">
        <div class="row g-3">
          <!-- Datos Personales -->
          <div class="col-md-6">
            <label for="paciente-form-nombres" class="form-label">Nombres *</label>
            <input id="paciente-form-nombres" type="text" class="form-control" [(ngModel)]="form.nombres" name="nombres" required maxlength="100">
          </div>
          <div class="col-md-6">
            <label for="paciente-form-apellidos" class="form-label">Apellidos *</label>
            <input id="paciente-form-apellidos" type="text" class="form-control" [(ngModel)]="form.apellidos" name="apellidos" required maxlength="100">
          </div>
          <div class="col-md-6">
            <label for="paciente-form-dpi" class="form-label">DPI</label>
            <input id="paciente-form-dpi" type="text" class="form-control" [(ngModel)]="form.dpi" name="dpi" maxlength="20">
          </div>
          <div class="col-md-6">
            <label for="paciente-form-fecha" class="form-label">Fecha de Nacimiento *</label>
            <input id="paciente-form-fecha" type="date" class="form-control" [(ngModel)]="form.fechaNacimiento" name="fechaNacimiento" required>
          </div>
          <div class="col-md-6">
            <label for="paciente-form-genero" class="form-label">Género</label>
            <select id="paciente-form-genero" class="form-select" [(ngModel)]="form.genero" name="genero">
              <option value="">Seleccione...</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
          <div class="col-md-6">
            <label for="paciente-form-sangre" class="form-label">Tipo de Sangre</label>
            <select id="paciente-form-sangre" class="form-select" [(ngModel)]="form.tipoSangre" name="tipoSangre">
              <option value="">Seleccione...</option>
              <option value="A+">A+</option>
              <option value="A-">A-</option>
              <option value="B+">B+</option>
              <option value="B-">B-</option>
              <option value="AB+">AB+</option>
              <option value="AB-">AB-</option>
              <option value="O+">O+</option>
              <option value="O-">O-</option>
            </select>
          </div>

          <!-- Contacto -->
          <div class="col-md-6">
            <label for="paciente-form-telefono" class="form-label">Teléfono</label>
            <input id="paciente-form-telefono" type="tel" class="form-control" [(ngModel)]="form.telefono" name="telefono" maxlength="20">
          </div>
          <div class="col-md-6">
            <label for="paciente-form-correo" class="form-label">Correo Electrónico</label>
            <input id="paciente-form-correo" type="email" class="form-control" [(ngModel)]="form.correo" name="correo" maxlength="100">
          </div>

          <!-- Facturación -->
          <div class="col-md-6">
            <label for="paciente-form-nit" class="form-label">NIT</label>
            <input id="paciente-form-nit" type="text" class="form-control" [(ngModel)]="form.nit" name="nit" maxlength="50">
          </div>
          <div class="col-md-6">
            <label for="paciente-form-facturacion" class="form-label">Nombre de Facturación</label>
            <input id="paciente-form-facturacion" type="text" class="form-control" [(ngModel)]="form.nombreFacturacion" name="nombreFacturacion" maxlength="150">
          </div>
          <div class="col-12">
            <label for="paciente-form-direccion" class="form-label">Dirección</label>
            <input id="paciente-form-direccion" type="text" class="form-control" [(ngModel)]="form.direccion" name="direccion" maxlength="150">
          </div>

        </div>

        </fieldset>
      </form>

      <section class="card p-4 shadow-sm mt-4" aria-labelledby="foto-title">
        <h3 id="foto-title" class="h5">Fotografía</h3>
        <p class="text-muted">JPEG, PNG o WebP; máximo 5 MB. La imagen se almacena mediante el endpoint protegido.</p>
        @if (errorFoto) { <div class="alert alert-danger" role="alert">{{ errorFoto }}</div> }
        @if (avisoFoto) { <div class="alert alert-success" role="status">{{ avisoFoto }}</div> }
        @if (cargandoFoto) { <p role="status">Cargando fotografía…</p> }
        @if (vistaPreviaFoto) { <img [src]="vistaPreviaFoto" alt="Fotografía del paciente" class="img-thumbnail mb-3" style="max-width: 240px; max-height: 240px; object-fit: contain"> }
        @else if (esEdicion && !cargandoFoto) { <p class="text-muted">El paciente no tiene fotografía.</p> }
        <div class="d-flex gap-2 flex-wrap align-items-end">
          <div>
            <label for="paciente-foto-archivo" class="form-label">Seleccionar fotografía</label>
            <input id="paciente-foto-archivo" type="file" class="form-control" accept="image/jpeg,image/png,image/webp"
              (change)="seleccionarFoto($event)" [disabled]="guardandoFoto || cargando">
          </div>
          @if (esEdicion && permisos.puedeModificar('Pacientes')) {
            <button type="button" class="btn btn-primary" (click)="guardarFoto()" [disabled]="!archivoFoto || guardandoFoto || cargando">{{ guardandoFoto ? 'Subiendo…' : (fotoDisponible ? 'Sustituir fotografía' : 'Subir fotografía') }}</button>
            @if (fotoDisponible) { <button type="button" class="btn btn-outline-danger" (click)="solicitarEliminarFoto()" [disabled]="guardandoFoto || cargando">Eliminar fotografía</button> }
          }
        </div>
        @if (esEdicion) { <p class="small text-muted mt-2 mb-0">Subir, sustituir o eliminar la fotografía se confirma inmediatamente y de forma independiente de los datos generales.</p> }
        @if (!esEdicion) { <p class="small text-muted mt-2 mb-0">La fotografía seleccionada se subirá después de confirmar el alta del paciente.</p> }
      </section>

      @if (esEdicion && registroCargado && idPaciente !== null) {
        <app-paciente-contactos [idPaciente]="idPaciente" />
      }

      <section class="card p-4 shadow-sm mt-4 mb-4" aria-labelledby="acciones-paciente-title">
        <h3 id="acciones-paciente-title" class="h5">Acciones</h3>
        <p class="small text-muted">
          Guardar confirma únicamente los datos generales. Cancelar abandona los cambios generales y la selección local de fotografía;
          no revierte fotografías ni contactos confirmados mediante sus propias acciones.
        </p>
        <div class="d-flex gap-2">
          <a routerLink="/pacientes" class="btn btn-secondary">Cancelar</a>
          <button type="submit" form="paciente-datos-form" class="btn btn-success"
            [disabled]="cargando || !puedeGuardar || !registroCargado">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
        </div>
      </section>

      @if (confirmarEliminarFoto) {
        <app-confirm-dialog title="Eliminar fotografía" description="¿Deseas eliminar la fotografía actual del paciente?"
          consequence="La referencia se retirará del paciente y la imagen dejará de estar disponible."
          confirmLabel="Eliminar" [busy]="guardandoFoto" (confirm)="eliminarFoto()" (cancel)="cancelarEliminarFoto()" />
      }
    </div>
  `
})
export class PacienteFormComponent implements OnInit {
  private service = inject(PacientesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly permisos = inject(PermisosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly contexto = new ContextoInventario(['Pacientes']);
  private contextoFormulario = this.contexto.clave();
  idPaciente: number | null = null;
  registroCargado = false;
  get puedeGuardar(): boolean {
    return this.esEdicion ? this.permisos.puedeModificar('Pacientes') : this.permisos.puedeCrear('Pacientes');
  }

  esEdicion = false;
  cargando = false;
  error = '';
  archivoFoto: File | null = null;
  vistaPreviaFoto: string | null = null;
  fotoDisponible = false;
  cargandoFoto = false;
  guardandoFoto = false;
  errorFoto = '';
  avisoFoto = '';
  confirmarEliminarFoto = false;
  altaConfirmadaFotoPendiente = false;
  private vistaPreviaEsObjeto = false;

  form: GuardarPacienteRequest = this.formVacio();

  constructor() {
    this.destroyRef.onDestroy(() => this.revocarVistaPrevia());
    this.contexto.observar(() => {
      this.cargando = this.cargandoFoto = this.guardandoFoto = false; this.form = this.formVacio(); this.limpiarEstadoFoto(); this.ngOnInit();
    });
  }

  private formVacio(): GuardarPacienteRequest { return {
    nombres: '',
    apellidos: '',
    dpi: null,
    fechaNacimiento: '',
    genero: null,
    telefono: null,
    correo: null,
    tipoSangre: null,
    nit: null,
    nombreFacturacion: null,
    direccion: null,
    urlFoto: null
  }; }

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.contextoFormulario = this.contexto.clave();
    this.esEdicion = id !== null;
    this.registroCargado = !this.esEdicion;
    this.error = '';
    this.idPaciente = id === null ? null : +id;
    if (!this.contexto.vigente(this.contextoFormulario)) { this.registroCargado = false; this.error = 'Se requiere una sesión vigente.'; return; }
    if (this.esEdicion) {
      if (!this.idPaciente || !idInventarioValido(this.idPaciente) || !this.permisos.puedeConsultar('Pacientes')) {
        this.error = 'No se puede consultar el paciente con el identificador y permisos actuales.'; return;
      }
      const clave = this.contextoFormulario;
      this.cargando = true;
      this.contexto.agregar(this.service.obtener(this.idPaciente).subscribe({
        next: (paciente: PacienteResponse) => {
          if (!this.contexto.vigente(clave)) return;
          if (paciente.idPaciente !== this.idPaciente || !paciente.activo) {
            this.error = 'El paciente devuelto no corresponde al solicitado o está inactivo.'; this.cargando = false; return;
          }
          this.form = {
            nombres: paciente.nombres,
            apellidos: paciente.apellidos,
            dpi: paciente.dpi,
            fechaNacimiento: paciente.fechaNacimiento,
            genero: paciente.genero,
            telefono: paciente.telefono,
            correo: paciente.correo,
            tipoSangre: paciente.tipoSangre,
            nit: paciente.nit,
            nombreFacturacion: paciente.nombreFacturacion,
            direccion: paciente.direccion,
            urlFoto: null
          };
          this.cargando = false;
          this.registroCargado = true;
          if (paciente.urlFoto) this.cargarFoto(paciente.idPaciente, this.contextoFormulario);
          else this.fotoDisponible = false;
        },
        error: err => {
          if (!this.contexto.vigente(clave)) return;
          this.error = this.apiErrors.messageFor(err, 'Paciente no encontrado o sesión expirada');
          this.cargando = false;
        }
      }));
    }
  }

  guardar() {
    if (this.cargando) return;
    if (this.altaConfirmadaFotoPendiente) {
      this.error = 'El paciente ya fue creado. Complete o descarte la fotografía pendiente desde su sección antes de salir.'; return;
    }
    const clave = this.contextoFormulario;
    if (!this.contexto.vigente(clave) || !this.puedeGuardar || !this.registroCargado) {
      this.error = 'Verifique la sesión, el permiso y el paciente antes de guardar.'; return;
    }
    const normalizar = (valor: string | null | undefined) => valor?.trim().replace(/\s+/g, ' ') || null;
    const nombres = normalizar(this.form.nombres), apellidos = normalizar(this.form.apellidos);
    const opcionales: [string | null | undefined, number][] = [
      [this.form.dpi, 20], [this.form.genero, 1], [this.form.telefono, 20], [this.form.correo, 100],
      [this.form.tipoSangre, 10], [this.form.nit, 50], [this.form.nombreFacturacion, 150], [this.form.direccion, 150], [this.form.urlFoto, 500],
    ];
    if (!nombres || nombres.length > 100 || !apellidos || apellidos.length > 100 ||
      !fechaInventarioValida(this.form.fechaNacimiento) || this.form.fechaNacimiento > new Date().toISOString().slice(0, 10) ||
      opcionales.some(([valor, limite]) => (normalizar(valor)?.length ?? 0) > limite)) {
      this.error = 'Complete nombres y apellidos válidos, una fecha de nacimiento existente no futura y los límites de los campos.'; return;
    }
    this.cargando = true;
    this.error = '';

    // Convertir campos vacíos a null
    const formData: GuardarPacienteRequest = {
      nombres,
      apellidos,
      fechaNacimiento: this.form.fechaNacimiento,
      dpi: this.form.dpi || null,
      genero: this.form.genero || null,
      telefono: this.form.telefono || null,
      correo: this.form.correo || null,
      tipoSangre: this.form.tipoSangre || null,
      nit: this.form.nit || null,
      nombreFacturacion: this.form.nombreFacturacion || null,
      direccion: this.form.direccion || null
    };

    const request = this.esEdicion ? this.service.actualizar(this.idPaciente!, formData) : this.service.crear(formData);
    this.contexto.agregar(request.subscribe({
      next: paciente => {
        if (!this.contexto.vigente(clave)) return;
        if (!paciente || !idInventarioValido(paciente.idPaciente) || (this.esEdicion && paciente.idPaciente !== this.idPaciente)) {
          this.error = 'La respuesta no confirma el paciente guardado. Compruebe el listado antes de repetir.'; this.cargando = false; return;
        }
        if (!this.esEdicion && this.archivoFoto) {
          this.subirFotoTrasCrear(paciente, clave);
          return;
        }
        this.router.navigate(['/pacientes']);
      },
      error: err => {
        if (!this.contexto.vigente(clave)) return;
        this.error = this.apiErrors.messageFor(err, this.esEdicion ? 'Error al actualizar el paciente.' : 'Error al crear el paciente.');
        this.cargando = false;
      },
    }));
  }

  seleccionarFoto(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.errorFoto = this.avisoFoto = '';
    if (!file) { this.archivoFoto = null; if (!this.fotoDisponible) this.revocarVistaPrevia(); return; }
    if (!(file instanceof File)) {
      this.archivoFoto = null; this.errorFoto = 'Seleccione un archivo de imagen válido.'; input.value = ''; return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      this.archivoFoto = null; this.errorFoto = 'Solo se admiten imágenes JPEG, PNG o WebP.'; input.value = ''; return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      this.archivoFoto = null; this.errorFoto = 'La fotografía debe tener contenido y no superar 5 MB.'; input.value = ''; return;
    }
    this.archivoFoto = file; this.mostrarBlob(file);
  }

  guardarFoto(): void {
    const file = this.archivoFoto; const id = this.idPaciente; const clave = this.contextoFormulario;
    if (this.guardandoFoto || !file || !id || !idInventarioValido(id) || !this.contexto.vigente(clave) ||
      !this.permisos.puedeModificar('Pacientes') || !this.registroCargado) {
      this.errorFoto = 'Verifique el archivo, el paciente, la sesión y el permiso Pacientes/Modificar.'; return;
    }
    this.subirFoto(id, file, clave, false);
  }

  solicitarEliminarFoto(): void {
    if (this.fotoDisponible && !this.guardandoFoto && this.permisos.puedeModificar('Pacientes')) this.confirmarEliminarFoto = true;
  }
  cancelarEliminarFoto(): void { if (!this.guardandoFoto) this.confirmarEliminarFoto = false; }
  eliminarFoto(): void {
    const id = this.idPaciente; const clave = this.contextoFormulario;
    if (!this.confirmarEliminarFoto || this.guardandoFoto || !id || !this.contexto.vigente(clave) ||
      !this.permisos.puedeModificar('Pacientes') || !this.fotoDisponible) {
      this.confirmarEliminarFoto = false; this.errorFoto = 'La sesión, el permiso o la fotografía cambiaron.'; return;
    }
    this.guardandoFoto = true; this.errorFoto = this.avisoFoto = '';
    this.contexto.agregar(this.service.eliminarFoto(id).subscribe({
      next: () => {
        if (!this.fotoVigente(clave, id)) return;
        this.guardandoFoto = false; this.confirmarEliminarFoto = false; this.fotoDisponible = false; this.archivoFoto = null;
        this.revocarVistaPrevia(); this.avisoFoto = 'Fotografía eliminada.';
      },
      error: (err: HttpErrorResponse) => {
        if (!this.fotoVigente(clave, id)) return;
        this.guardandoFoto = false; this.confirmarEliminarFoto = false;
        this.errorFoto = err.status === 0 || err.status >= 500
          ? 'Resultado incierto: vuelva a consultar la fotografía antes de repetir la eliminación.'
          : this.apiErrors.messageFor(err, 'No fue posible eliminar la fotografía.');
      },
    }));
  }

  private subirFotoTrasCrear(paciente: PacienteResponse, clave: string): void {
    const file = this.archivoFoto!;
    this.idPaciente = paciente.idPaciente; this.esEdicion = true; this.registroCargado = true;
    this.altaConfirmadaFotoPendiente = true;
    this.subirFoto(paciente.idPaciente, file, clave, true);
  }

  private subirFoto(id: number, file: File, clave: string, navegarAlFinal: boolean): void {
    this.guardandoFoto = true; this.cargando = navegarAlFinal; this.errorFoto = this.avisoFoto = '';
    this.contexto.agregar(this.service.guardarFoto(id, file).subscribe({
      next: response => {
        if (!this.fotoVigente(clave, id)) return;
        if (response?.url !== `/api/pacientes/${id}/foto`) {
          this.guardandoFoto = this.cargando = false;
          this.errorFoto = 'La respuesta no confirma la fotografía del paciente. Verifique antes de repetir.'; return;
        }
        this.guardandoFoto = this.cargando = false; this.fotoDisponible = true; this.archivoFoto = null; this.avisoFoto = 'Fotografía guardada.';
        this.altaConfirmadaFotoPendiente = false;
        if (navegarAlFinal) this.router.navigate(['/pacientes']); else this.cargarFoto(id, clave);
      },
      error: (err: HttpErrorResponse) => {
        if (!this.fotoVigente(clave, id)) return;
        this.guardandoFoto = this.cargando = false;
        const detalle = this.mensajeErrorFoto(err);
        this.errorFoto = navegarAlFinal ? `El paciente #${id} fue creado, pero la fotografía quedó pendiente. ${detalle}` : detalle;
      },
    }));
  }

  private cargarFoto(id: number, clave: string): void {
    this.cargandoFoto = true; this.errorFoto = '';
    this.contexto.agregar(this.service.obtenerFoto(id).subscribe({
      next: blob => {
        if (!this.fotoVigente(clave, id)) return;
        this.cargandoFoto = false;
        if (!blob || blob.size <= 0 || !['image/jpeg', 'image/png', 'image/webp'].includes(blob.type)) {
          this.fotoDisponible = false; this.errorFoto = 'La API devolvió una fotografía inválida.'; this.revocarVistaPrevia(); return;
        }
        this.fotoDisponible = true; this.mostrarBlob(blob);
      },
      error: (err: HttpErrorResponse) => {
        if (!this.fotoVigente(clave, id)) return;
        this.cargandoFoto = false; this.fotoDisponible = false; this.revocarVistaPrevia();
        if (err.status !== 404) this.errorFoto = this.apiErrors.messageFor(err, 'No fue posible cargar la fotografía.');
      },
    }));
  }

  private fotoVigente(clave: string, id: number): boolean {
    return this.contexto.vigente(clave) && this.idPaciente === id && this.registroCargado;
  }
  private mensajeErrorFoto(error: HttpErrorResponse): string {
    if (error.status === 0) return 'Resultado incierto: no se pudo confirmar la respuesta del servidor. Verifique la fotografía antes de repetir.';
    if (error.status === 400) return this.apiErrors.messageFor(error, 'El contenido de la fotografía no es una imagen válida.');
    if (error.status === 401) return 'La sesión expiró o dejó de ser válida. Inicie sesión antes de repetir la carga.';
    if (error.status === 403) return this.apiErrors.messageFor(error, 'No tienes autorización para modificar la fotografía.');
    if (error.status === 413) return this.apiErrors.messageFor(error, 'La fotografía supera el tamaño permitido.');
    if (error.status === 415) return this.apiErrors.messageFor(error, 'El formato o el tipo MIME de la fotografía no es compatible.');
    if (error.status >= 500) return 'Resultado incierto: el procesamiento o almacenamiento no confirmó la operación. Verifique la fotografía antes de repetir. No se reintentó automáticamente.';
    return this.apiErrors.messageFor(error, 'No fue posible guardar la fotografía.');
  }
  private mostrarBlob(blob: Blob): void {
    this.revocarVistaPrevia(); this.vistaPreviaFoto = URL.createObjectURL(blob); this.vistaPreviaEsObjeto = true;
  }
  private revocarVistaPrevia(): void {
    if (this.vistaPreviaFoto && this.vistaPreviaEsObjeto) URL.revokeObjectURL(this.vistaPreviaFoto);
    this.vistaPreviaFoto = null; this.vistaPreviaEsObjeto = false;
  }
  private limpiarEstadoFoto(): void {
    this.archivoFoto = null; this.fotoDisponible = false; this.errorFoto = this.avisoFoto = ''; this.confirmarEliminarFoto = false; this.altaConfirmadaFotoPendiente = false; this.revocarVistaPrevia();
  }
}
