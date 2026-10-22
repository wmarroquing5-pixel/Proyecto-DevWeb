import { Component, inject, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PacientesService } from '../../core/services/paciente.service';
import { GuardarPacienteRequest, PacienteResponse } from '../../core/models/paciente.model';
import { PermisosService } from '../../core/services/permisos.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { ContextoInventario, fechaInventarioValida, idInventarioValido } from '../inventario/inventario-ui';

@Component({
    selector: 'app-paciente-form',
    imports: [RouterModule, FormsModule],
    template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Paciente' : 'Nuevo Paciente' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
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

          <!-- Foto -->
          <div class="col-12">
            <label for="paciente-form-foto" class="form-label">URL de Foto</label>
            <input id="paciente-form-foto" type="url" class="form-control" [(ngModel)]="form.urlFoto" name="urlFoto" maxlength="500">
          </div>
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/pacientes" class="btn btn-secondary">Cancelar</a>
        </div>
        </fieldset>
      </form>
    </div>
  `
})
export class PacienteFormComponent implements OnInit {
  private service = inject(PacientesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private readonly permisos = inject(PermisosService);
  private readonly apiErrors = inject(ApiErrorService);
  private readonly contexto = new ContextoInventario(['Pacientes']);
  private contextoFormulario = this.contexto.clave();
  private idPaciente: number | null = null;
  registroCargado = false;
  get puedeGuardar(): boolean {
    return this.esEdicion ? this.permisos.puedeModificar('Pacientes') : this.permisos.puedeCrear('Pacientes');
  }

  esEdicion = false;
  cargando = false;
  error = '';

  form: GuardarPacienteRequest = this.formVacio();

  constructor() {
    this.contexto.observar(() => {
      this.cargando = false; this.form = this.formVacio(); this.ngOnInit();
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
            urlFoto: paciente.urlFoto
          };
          this.cargando = false;
          this.registroCargado = true;
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
      ...this.form,
      nombres,
      apellidos,
      dpi: this.form.dpi || null,
      genero: this.form.genero || null,
      telefono: this.form.telefono || null,
      correo: this.form.correo || null,
      tipoSangre: this.form.tipoSangre || null,
      nit: this.form.nit || null,
      nombreFacturacion: this.form.nombreFacturacion || null,
      direccion: this.form.direccion || null,
      urlFoto: this.form.urlFoto || null
    };

    const request = this.esEdicion ? this.service.actualizar(this.idPaciente!, formData) : this.service.crear(formData);
    this.contexto.agregar(request.subscribe({
      next: paciente => {
        if (!this.contexto.vigente(clave)) return;
        if (!paciente || !idInventarioValido(paciente.idPaciente) || (this.esEdicion && paciente.idPaciente !== this.idPaciente)) {
          this.error = 'La respuesta no confirma el paciente guardado. Compruebe el listado antes de repetir.'; this.cargando = false; return;
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
}
