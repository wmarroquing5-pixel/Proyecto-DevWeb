import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { CrearUsuarioRequest, ActualizarUsuarioRequest } from '../../core/models/usuario.model';

@Component({
  selector: 'app-usuario-form',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <h2>{{ esEdicion ? 'Editar Usuario' : 'Nuevo Usuario' }}</h2>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <form (ngSubmit)="guardar()" class="card p-4 shadow-sm">
        <div class="mb-3">
          <label class="form-label">Username</label>
          <input type="text" class="form-control" [(ngModel)]="form.username" name="username" required>
        </div>

        @if (!esEdicion) {
          <div class="mb-3">
            <label class="form-label">Contraseña</label>
            <input type="password" class="form-control" [(ngModel)]="formPassword" name="password" required>
          </div>
        }

        <div class="mb-3">
          <label class="form-label">ID Rol</label>
          <input type="number" class="form-control" [(ngModel)]="form.idRol" name="idRol" required>
        </div>

        <div class="mb-3">
          <label class="form-label">ID Empleado (Opcional)</label>
          <input type="number" class="form-control" [(ngModel)]="form.idEmpleado" name="idEmpleado">
        </div>

        @if (esEdicion) {
          <div class="mb-3 form-check">
            <input type="checkbox" class="form-check-input" id="activo" [(ngModel)]="form.activo" name="activo">
            <label class="form-check-label" for="activo">Activo</label>
          </div>
        }

        <div class="d-flex gap-2">
          <button type="submit" class="btn btn-success" [disabled]="cargando">
            {{ cargando ? 'Guardando...' : 'Guardar' }}
          </button>
          <a routerLink="/admin/usuarios" class="btn btn-secondary">Cancelar</a>
        </div>
      </form>
    </div>
  `
})
export class UsuarioFormComponent implements OnInit {
  private service = inject(UsuariosService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  esEdicion = false;
  cargando = false;
  error = '';
  formPassword = '';

  form: any = {
    username: '',
    idRol: 1,
    idEmpleado: null,
    activo: true
  };

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.esEdicion = true;
      this.cargando = true;
      this.service.obtener(+id).subscribe({
        next: (user) => {
          this.form = user;
          this.cargando = false;
        },
        error: () => {
          this.error = 'Usuario no encontrado';
          this.cargando = false;
        }
      });
    }
  }

  guardar() {
    this.cargando = true;
    this.error = '';

    if (this.esEdicion) {
      const request: ActualizarUsuarioRequest = this.form;
      this.service.actualizar(this.form.idUsuario, request).subscribe({
        next: () => this.router.navigate(['/admin/usuarios']),
        error: () => { this.error = 'Error al actualizar'; this.cargando = false; }
      });
    } else {
      const request: CrearUsuarioRequest = { ...this.form, password: this.formPassword };
      this.service.crear(request).subscribe({
        next: () => this.router.navigate(['/admin/usuarios']),
        error: () => { this.error = 'Error al crear'; this.cargando = false; }
      });
    }
  }
}