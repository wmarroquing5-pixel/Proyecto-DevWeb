import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../../core/services/usuarios.service';
import { UsuarioResponse, PagedResponse } from '../../core/models/usuario.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2>Gestión de Usuarios</h2>
        <a routerLink="/admin/usuarios/nuevo" class="btn btn-primary">
          <i class="fa fa-plus"></i> Nuevo Usuario
        </a>
      </div>

      @if (cargando) {
        <div class="text-center py-4">Cargando usuarios...</div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else {
        <table class="table table-striped table-hover">
          <thead>
            <tr>
              <th>ID</th>
              <th>Usuario</th>
              <th>ID Rol</th>
              <th>ID Empleado</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (user of usuarios; track user.idUsuario) {
              <tr>
                <td>{{ user.idUsuario }}</td>
                <td>{{ user.username }}</td>
                <td>{{ user.idRol }}</td>
                <td>{{ user.idEmpleado ?? 'N/A' }}</td>
                <td>
                  <span class="badge" [class.bg-success]="user.activo" [class.bg-secondary]="!user.activo">
                    {{ user.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td>
                  <a [routerLink]="['/admin/usuarios/editar', user.idUsuario]" class="btn btn-sm btn-warning me-1">
                    <i class="fa fa-edit"></i>
                  </a>
                  <button (click)="eliminar(user.idUsuario)" class="btn btn-sm btn-danger" [disabled]="!user.activo">
                    <i class="fa fa-trash"></i>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>

        <!-- Paginación Simple -->
        <div class="d-flex justify-content-between align-items-center mt-3">
          <span>Total: {{ total }} usuarios</span>
          <div>
            <button class="btn btn-outline-secondary btn-sm me-2" (click)="cambiarPagina(page - 1)" [disabled]="page <= 1">Anterior</button>
            <button class="btn btn-outline-secondary btn-sm" (click)="cambiarPagina(page + 1)" [disabled]="usuarios.length < pageSize">Siguiente</button>
          </div>
        </div>
      }
    </div>
  `
})
export class UsuariosComponent implements OnInit {
  private service = inject(UsuariosService);
  
  usuarios: UsuarioResponse[] = [];
  total = 0;
  page = 1;
  pageSize = 10;
  cargando = false;
  error = '';

  ngOnInit() {
    this.cargarUsuarios();
  }

  cargarUsuarios() {
    this.cargando = true;
    this.error = '';
    this.service.listar(this.page, this.pageSize).subscribe({
      next: (res: PagedResponse<UsuarioResponse>) => {
        this.usuarios = res.items;
        this.total = res.total;
        this.cargando = false;
      },
      error: (err) => {
        this.error = 'Error al cargar los usuarios. Verifica tus permisos.';
        this.cargando = false;
      }
    });
  }

  cambiarPagina(nuevaPagina: number) {
    if (nuevaPagina > 0) {
      this.page = nuevaPagina;
      this.cargarUsuarios();
    }
  }

  eliminar(id: number) {
    if (confirm('¿Estás seguro de eliminar este usuario?')) {
      this.service.eliminar(id).subscribe({
        next: () => this.cargarUsuarios(),
        error: () => alert('No se pudo eliminar el usuario.')
      });
    }
  }
}