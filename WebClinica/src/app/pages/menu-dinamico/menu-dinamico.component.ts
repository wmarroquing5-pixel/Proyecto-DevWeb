import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';

/**
 * Página de DEMO del menú dinámico (src/app/pages/menu-dinamico).
 *
 * Permite adelantar el diseño sin backend: cambia de "usuario" (rol)
 * y observa cómo el menú se filtra en tiempo real. Cuando la API .NET
 * esté lista, esta página se elimina; el menú real vive en el Sidebar.
 */
@Component({
  selector: 'app-menu-dinamico',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './menu-dinamico.component.html',
  styleUrl: './menu-dinamico.component.css',
})
export class MenuDinamicoComponent {
  menuService = inject(MenuService);
  auth = inject(AuthService);

  /** Roles disponibles para simular distintos usuarios logueados */
  readonly perfiles: { nombre: string; roles: string[] }[] = [
    { nombre: 'Administrador', roles: ['ADMIN'] },
    { nombre: 'Médico', roles: ['MEDICO'] },
    { nombre: 'Recepcionista', roles: ['RECEPCION'] },
  ];

  perfilActivo = this.perfiles[0];

  /** Menú filtrado serializado, para mostrar el contrato JSON de la API */
  readonly menuJson = computed(() => JSON.stringify(this.menuService.menu(), null, 2));

  /** Submenús abiertos (por label) */
  open: Record<string, boolean> = {};

  toggle(label: string): void {
    this.open[label] = !this.open[label];
  }

  hasChildren(item: MenuItem): boolean {
    return !!item.children && item.children.length > 0;
  }

  /** Simula el login de otro rol: setea al usuario y recarga el menú */
  cambiarPerfil(perfil: { nombre: string; roles: string[] }): void {
    this.perfilActivo = perfil;
    this.auth.currentUser.update(u =>
      u ? { ...u, roles: perfil.roles, fullName: `${perfil.nombre} Demo` } : u
    );
    // Recarga para aplicar el nuevo filtrado por roles
    this.menuService.loadMenu().subscribe();
  }
}
