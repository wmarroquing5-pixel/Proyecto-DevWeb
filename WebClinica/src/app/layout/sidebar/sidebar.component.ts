import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MenuItem } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';
import { MenuService } from '../../core/services/menu.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  menuService = inject(MenuService);
  auth = inject(AuthService);

  /** Rutas abiertas del submenú (por label) */
  open: Record<string, boolean> = {};

  toggle(label: string): void {
    this.open[label] = !this.open[label];
  }

  hasChildren(item: MenuItem): boolean {
    return !!item.children && item.children.length > 0;
  }
}
