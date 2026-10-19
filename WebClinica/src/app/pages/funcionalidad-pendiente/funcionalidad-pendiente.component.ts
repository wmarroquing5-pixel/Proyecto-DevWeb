import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-funcionalidad-pendiente',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './funcionalidad-pendiente.component.html',
})
export class FuncionalidadPendienteComponent {
  private readonly route = inject(ActivatedRoute);

  readonly titulo = this.route.snapshot.data['titulo'] as string;
  readonly descripcion = this.route.snapshot.data['descripcion'] as string;
}
