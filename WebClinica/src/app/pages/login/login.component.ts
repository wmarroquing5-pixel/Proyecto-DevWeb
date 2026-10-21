import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { ApiErrorService } from '../../core/services/api-error.service';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
    selector: 'app-login',
    imports: [FormsModule],
    templateUrl: './login.component.html',
    styleUrl: './login.component.css'
})
export class LoginComponent {
  private auth = inject(AuthService);
  private menu = inject(MenuService);
  private router = inject(Router);
  private apiErrors = inject(ApiErrorService);
  private permisos = inject(PermisosService);

  usuario = '';
  password = '';
  mostrarPassword = false;
  recordarme = false;
  cargando = false;
  error = '';

  iniciarSesion(): void {
    if (!this.usuario || !this.password) {
      this.error = 'Por favor ingresa tu usuario y contraseña';
      return;
    }

    this.cargando = true;
    this.error = '';

    // 1️⃣ Login → obtiene el token
    this.auth.login(this.usuario, this.password).subscribe({
      next: () => {
        // 2️⃣ Cargar usuario desde GET /api/auth/me
        this.auth.loadCurrentUser().subscribe({
          next: () => {
            // 3️⃣ Cargar permisos operativos antes de habilitar la interfaz
            this.permisos.cargarPermisos().subscribe({
              next: () => {
                // 4️⃣ Cargar menú filtrado desde GET /api/menu
                this.menu.loadMenu().subscribe({
                  next: () => {
                    this.cargando = false;
                    this.router.navigate(['/dashboard']);
                  },
                  error: () => {
                    this.cargando = false;
                    this.router.navigate(['/dashboard']);
                  },
                });
              },
              error: () => {
                this.error = 'No se pudieron cargar los permisos de la sesión.';
                this.cargando = false;
              },
            });
          },
          error: () => {
            this.error = 'No se pudo cargar la información del usuario.';
            this.cargando = false;
          },
        });
      },
      error: (err: HttpErrorResponse) => {
        this.error = this.apiErrors.messageFor(err,
          err.status === 401
            ? 'Usuario o contraseña incorrectos.'
            : 'No se pudo iniciar sesión.');
        this.cargando = false;
      },
    });
  }
}
