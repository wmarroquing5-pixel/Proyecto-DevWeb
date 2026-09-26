import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {

  usuario: string = '';
  password: string = '';

  mostrarPassword: boolean = false;
  recordarme: boolean = false;

  iniciarSesion(): void {

    if (!this.usuario || !this.password) {

      alert('Por favor ingresa tu usuario y contraseña');

      return;
    }

    console.log('Usuario:', this.usuario);
    console.log('Contraseña:', this.password);

    /*
      Más adelante aquí conectaremos
      con la API .NET:

      this.authService.login(
        this.usuario,
        this.password
      );
    */
  }

}