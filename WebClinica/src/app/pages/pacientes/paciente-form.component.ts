import { Component, inject, OnInit } from '@angular/core';

import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { PacientesService } from '../../core/services/paciente.service';
import { GuardarPacienteRequest, PacienteResponse } from '../../core/models/paciente.model';

@Component({
    selector: 'app-paciente-form',
    imports: [RouterModule, FormsModule],
    template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Paciente' : 'Nuevo Paciente' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <div class="row g-3">
          <!-- Datos Personales -->
          <div class="col-md-6">
            <label class="form-label">Nombres *</label>
            <input type="text" class="form-control" [(ngModel)]="form.nombres" name="nombres" required maxlength="100">
          </div>
          <div class="col-md-6">
            <label class="form-label">Apellidos *</label>
            <input type="text" class="form-control" [(ngModel)]="form.apellidos" name="apellidos" required maxlength="100">
          </div>
          <div class="col-md-6">
            <label class="form-label">DPI</label>
            <input type="text" class="form-control" [(ngModel)]="form.dpi" name="dpi" maxlength="20">
          </div>
          <div class="col-md-6">
            <label class="form-label">Fecha de Nacimiento *</label>
            <input type="date" class="form-control" [(ngModel)]="form.fechaNacimiento" name="fechaNacimiento" required>
          </div>
          <div class="col-md-6">
            <label class="form-label">Género</label>
            <select class="form-select" [(ngModel)]="form.genero" name="genero">
              <option value="">Seleccione...</option>
              <option value="M">Masculino</option>
              <option value="F">Femenino</option>
            </select>
          </div>
          <div class="col-md-6">
            <label class="form-label">Tipo de Sangre</label>
            <select class="form-select" [(ngModel)]="form.tipoSangre" name="tipoSangre">
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
            <label class="form-label">Teléfono</label>
            <input type="tel" class="form-control" [(ngModel)]="form.telefono" name="telefono" maxlength="20">
          </div>
          <div class="col-md-6">
            <label class="form-label">Correo Electrónico</label>
            <input type="email" class="form-control" [(ngModel)]="form.correo" name="correo" maxlength="100">
          </div>

          <!-- Facturación -->
          <div class="col-md-6">
            <label class="form-label">NIT</label>
            <input type="text" class="form-control" [(ngModel)]="form.nit" name="nit" maxlength="50">
          </div>
          <div class="col-md-6">
            <label class="form-label">Nombre de Facturación</label>
            <input type="text" class="form-control" [(ngModel)]="form.nombreFacturacion" name="nombreFacturacion" maxlength="150">
          </div>
          <div class="col-12">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-control" [(ngModel)]="form.direccion" name="direccion" maxlength="150">
          </div>

          <!-- Foto -->
          <div class="col-12">
            <label class="form-label">URL de Foto</label>
            <input type="url" class="form-control" [(ngModel)]="form.urlFoto" name="urlFoto" maxlength="500">
          </div>
        </div>

        <div class="d-flex gap-2 mt-4">
          <button type="submit" class="btn btn-success" [disabled]="cargando">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/pacientes" class="btn btn-secondary">Cancelar</a>
        </div>
      </form>
    </div>
  `
})
export class PacienteFormComponent implements OnInit {
  private service = inject(PacientesService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  esEdicion = false;
  cargando = false;
  error = '';

  form: GuardarPacienteRequest = {
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
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.cargando = true;
      this.service.obtener(+id).subscribe({
        next: (paciente: PacienteResponse) => {
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
        },
        error: () => {
          this.error = 'Paciente no encontrado';
          this.cargando = false;
        }
      });
    }
  }

  guardar() {
    this.cargando = true;
    this.error = '';

    // Convertir campos vacíos a null
    const formData: GuardarPacienteRequest = {
      ...this.form,
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

    if (this.esEdicion) {
      const id = +this.route.snapshot.paramMap.get('id')!;
      this.service.actualizar(id, formData).subscribe({
        next: () => this.router.navigate(['/pacientes']),
        error: (err) => {
          this.error = err.error?.message || 'Error al actualizar';
          this.cargando = false;
        }
      });
    } else {
      this.service.crear(formData).subscribe({
        next: () => this.router.navigate(['/pacientes']),
        error: (err) => {
          this.error = err.error?.message || 'Error al crear';
          this.cargando = false;
        }
      });
    }
  }
}