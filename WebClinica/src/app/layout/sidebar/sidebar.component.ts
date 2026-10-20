import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { finalize } from 'rxjs';
import { MenuItem, resolverIconoMenu } from '../../core/models/menu-item.model';
import { AuthService } from '../../core/services/auth.service';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';
import { MenuService } from '../../core/services/menu.service';
import { PermisosService } from '../../core/services/permisos.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  readonly menuService = inject(MenuService);
  readonly auth = inject(AuthService);
  readonly permisos = inject(PermisosService);
  private readonly actualizacion = inject(AutorizacionActualizacionService);
  readonly mobileOpen = signal(false);
  readonly reintentando = signal(false);
  readonly icono = resolverIconoMenu;
  readonly claveMenu = (item: MenuItem): string =>
    item.route ?? `grupo:${item.label.toLocaleLowerCase('es')}`;

  readonly estadoVacio = computed(() => {
    if (!this.auth.isAuthenticated()) {
      return { tipo: 'sesion', mensaje: 'La sesión finalizó. Inicia sesión nuevamente.' } as const;
    }
    if (this.permisos.estado() === 'no-cargados' || this.permisos.estado() === 'cargando') {
      return { tipo: 'cargando', mensaje: 'Validando permisos…' } as const;
    }
    if (this.permisos.estado() === 'error' || !this.permisos.autorizacionVigente()) {
      return { tipo: 'error', mensaje: 'No fue posible validar tus permisos.' } as const;
    }
    if (this.menuService.estado() === 'no-cargado' || this.menuService.estado() === 'cargando') {
      return { tipo: 'cargando', mensaje: 'Cargando menú…' } as const;
    }
    if (this.menuService.estado() === 'error') {
      return { tipo: 'error', mensaje: 'No fue posible cargar el menú.' } as const;
    }
    return this.menuService.elementosRecibidos() === 0
      ? { tipo: 'vacio', mensaje: 'Tu cuenta no tiene módulos disponibles.' } as const
      : { tipo: 'vacio', mensaje: 'No tienes opciones autorizadas disponibles.' } as const;
  });

  /** Rutas abiertas del submenú (por label) */
  open: Record<string, boolean> = {};

  toggle(label: string): void {
    this.open[label] = !this.open[label];
  }

  hasChildren(item: MenuItem): boolean {
    return !!item.children && item.children.length > 0;
  }

  toggleMobile(): void {
    this.mobileOpen.update(open => !open);
  }

  closeMobile(): void {
    this.mobileOpen.set(false);
  }

  reintentar(): void {
    if (this.reintentando()) return;
    this.reintentando.set(true);
    this.actualizacion.revalidarAhora().pipe(
      finalize(() => this.reintentando.set(false)),
    ).subscribe();
  }

  logout(): void {
    this.closeMobile();
    this.auth.logout();
  }
}
