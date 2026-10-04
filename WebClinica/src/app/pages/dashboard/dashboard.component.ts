import { Component, OnInit, inject } from '@angular/core';
import { MenuService } from '../../core/services/menu.service';
import { MenuItem } from '../../core/models/menu-item.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: `
    <h2>Dashboard</h2>
    <p>Bienvenido al sistema de gestión de la clínica.</p>
    <p class="hint">Ítems visibles en el menú: {{ count }}</p>
  `,
  styles: ['.hint{color:#64748b}']
})
export class DashboardComponent implements OnInit {
  private menu = inject(MenuService);
  count = 0;
  ngOnInit(): void {
    // Si el menú aún no está cargado (ej. recarga de página), pedirlo ahora
    if (this.menu.menu().length === 0) {
      this.menu.loadMenu().subscribe();
    }
    this.count = this.menu.menu().length;
  }
}

