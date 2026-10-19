import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-acceso-denegado',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="container py-5 text-center">
      <i class="bi bi-shield-lock fs-1 text-warning"></i>
      <h2 class="mt-3">Acceso denegado</h2>
      <p class="text-muted">No tienes autorización para acceder a esta función.</p>
      <a routerLink="/dashboard" class="btn btn-primary">Volver al dashboard</a>
    </div>
  `,
})
export class AccesoDenegadoComponent {}
