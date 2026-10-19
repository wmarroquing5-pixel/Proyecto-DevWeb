import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MenuItem, resolverIconoMenu } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';
import { PermisosService } from '../../core/services/permisos.service';

const RUTAS_PENDIENTES = new Set(['/citas', '/reportes/citas', '/reportes/pacientes']);

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent {
  private readonly menu = inject(MenuService);
  private readonly permisos = inject(PermisosService);
  readonly auth = inject(AuthService);
  readonly icono = resolverIconoMenu;

  readonly nombreUsuario = computed(() =>
    this.auth.currentUser()?.fullName ?? this.auth.currentUser()?.username ?? 'Usuario',
  );

  readonly opcionesVisibles = computed(() => this.aplanar(this.menu.menu())
    .filter(item => !!item.route && item.route !== '/dashboard'));

  readonly accesosRapidos = computed(() => this.opcionesVisibles()
    .filter(item => !!item.route && !RUTAS_PENDIENTES.has(item.route)));

  readonly estado = computed(() => {
    if (this.permisos.estado() === 'no-cargados' || this.permisos.estado() === 'cargando'
      || this.menu.estado() === 'no-cargado' || this.menu.estado() === 'cargando') {
      return 'cargando' as const;
    }
    if (this.permisos.estado() === 'error' || !this.permisos.autorizacionVigente()
      || this.menu.estado() === 'error') {
      return 'error' as const;
    }
    return 'listo' as const;
  });

  private aplanar(items: readonly MenuItem[]): MenuItem[] {
    return items.flatMap(item => item.children?.length ? this.aplanar(item.children) : [item]);
  }
}

