import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { VentaService } from '../../core/services/venta.service';
import { ResumenVentas, Venta } from '../../core/models/venta.model';

/**
 * Módulo Ventas de Farmacia — historial y KPIs.
 *  i.   Listado de ventas registradas con su detalle de productos (expandible).
 *  ii.  Muestra cantidad, precio unitario, subtotal, total y usuario vendedor.
 */
@Component({
  selector: 'app-ventas-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ventas-list.component.html',
  styleUrl: './ventas-list.component.css',
})
export class VentasListComponent implements OnInit {
  private svc = inject(VentaService);

  readonly ventas = signal<Venta[]>([]);
  readonly resumen = signal<ResumenVentas | null>(null);
  readonly cargando = signal(false);
  readonly error = signal('');

  filtro = '';

  /** IDs de ventas con el detalle expandido */
  expandidas = new Set<number>();

  ngOnInit(): void {
    this.cargar();
    this.svc.resumen().subscribe(r => this.resumen.set(r));
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.svc.listarVentas(this.filtro).subscribe({
      next: list => this.ventas.set(list),
      error: () => this.error.set('No se pudo conectar con el servidor de ventas.'),
      complete: () => this.cargando.set(false),
    });
  }

  buscar(): void {
    this.cargar();
  }

  limpiarFiltro(): void {
    this.filtro = '';
    this.cargar();
  }

  toggleDetalle(id: number): void {
    if (this.expandidas.has(id)) this.expandidas.delete(id);
    else this.expandidas.add(id);
    // Trigger cambio de referencia para @if en la plantilla
    this.expandidas = new Set(this.expandidas);
  }

  unidadesDe(v: Venta): number {
    return v.detalle.reduce((s, d) => s + d.cantidad, 0);
  }

  esHoy(iso: string): boolean {
    return iso.slice(0, 10) === new Date().toISOString().slice(0, 10);
  }

  fmtMoneda(v: number): string {
    return v.toLocaleString('es-GT', { style: 'currency', currency: 'Q' });
  }

  fmtFechaHora(iso: string): string {
    return new Date(iso).toLocaleString('es-GT', { dateStyle: 'medium', timeStyle: 'short' });
  }
}
