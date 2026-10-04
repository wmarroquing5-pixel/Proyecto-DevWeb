import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  private auth = inject(AuthService);
  private menu = inject(MenuService);
  private router = inject(Router);

  usuario: string = '';
  password: string = '';

  mostrarPassword: boolean = false;
  recordarme: boolean = false;

  cargando: boolean = false;
  error: string = '';

  iniciarSesion(): void {
    if (!this.usuario || !this.password) {
      this.error = 'Por favor ingresa tu usuario y contraseña';
      return;
    }

    this.cargando = true;
    this.error = '';

    this.auth.login(this.usuario, this.password).subscribe({
      next: (res) => {
        // El backend (o el mock) devuelve el menú del usuario en la respuesta de login
        if (res.menu?.length) this.menu.setMenu(res.menu);
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.error = 'Usuario o contraseña incorrectos, o el servidor no está disponible.';
      },
      complete: () => (this.cargando = false),
    });
  }
}
