import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { VentaService } from '../../core/services/venta.service';
import { CarritoItem, Venta } from '../../core/models/venta.model';
import { LoteDisponible } from '../../core/mock/ventas.mock';

/**
 * Módulo Ventas de Farmacia — punto de venta.
 *  i.   Registro de ventas con su detalle de productos (carrito multi-línea).
 *  ii.  Cantidad, precio unitario, subtotal, total y usuario que realiza la venta.
 *  iii. Al completar la venta el backend descuenta automáticamente la
 *       existencia del lote (aquí se refleja en el catálogo compartido).
 *  iv.  Validación de disponibilidad por lote antes de completar la venta
 *       (stock suficiente, lote no vencido, medicamento activo).
 */
@Component({
  selector: 'app-ventas-nueva',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './ventas-nueva.component.html',
  styleUrl: './ventas-nueva.component.css',
})
export class VentasNuevaComponent implements OnInit {
  private svc = inject(VentaService);
  private auth = inject(AuthService);

  /* ------------------------- Catálogo (iv) ------------------------- */
  readonly disponibles = signal<LoteDisponible[]>([]);
  readonly cargandoCatalogo = signal(false);
  filtro = '';

  /** Sucursal donde se registra la venta (FK Venta.IdSucursal) */
  sucursales: Array<{ idSucursal: number; nombre: string }> = [];
  idSucursal = 1;

  /* --------------------------- Carrito (i/ii) ---------------------- */
  readonly carrito = signal<CarritoItem[]>([]);

  /* ---------------------------- Mensajes --------------------------- */
  readonly error = signal('');
  readonly aviso = signal('');
  guardando = false;

  /** Ticket confirmado tras registrar la venta (para "comprobante") */
  readonly ultimaVenta = signal<Venta | null>(null);

  readonly todayIso = new Date().toISOString().slice(0, 10);

  ngOnInit(): void {
    this.svc.sucursales().subscribe(s => {
      this.sucursales = s;
      this.idSucursal = s[0]?.idSucursal ?? 1;
    });
    this.cargarCatalogo();
  }

  get usuarioVendedor(): string {
    const u = this.auth.currentUser();
    return u ? `${u.fullName} (${u.username})` : '—';
  }

  cargarCatalogo(): void {
    this.cargandoCatalogo.set(true);
    this.svc.listarDisponibles(this.filtro).subscribe({
      next: list => this.disponibles.set(list),
      error: () => this.error.set('No se pudo cargar el catálogo de farmacia.'),
      complete: () => this.cargandoCatalogo.set(false),
    });
  }

  buscar(): void {
    this.cargarCatalogo();
  }

  /* --------------------- Agregar al carrito (i) -------------------- */

  agregar(l: LoteDisponible): void {
    this.error.set('');
    const actual = this.carrito();
    const existente = actual.find(c => c.idLote === l.idLote);
    if (existente) {
      // iv. validar disponibilidad acumulada antes de incrementar
      if (existente.cantidad + 1 > existente.stockDisponible) {
        this.error.set(`No hay más stock del lote ${l.numeroLote} (disponible: ${existente.stockDisponible}).`);
        return;
      }
      this.carrito.set(actual.map(c =>
        c.idLote === l.idLote ? { ...c, cantidad: c.cantidad + 1 } : c));
      return;
    }
    if (l.cantidadDisponible <= 0) {
      this.error.set(`El lote ${l.numeroLote} está agotado.`);
      return;
    }
    this.carrito.set([...actual, {
      idLote: l.idLote,
      numeroLote: l.numeroLote,
      idMedicamento: l.idMedicamento,
      medicamentoCodigo: l.medicamentoCodigo,
      medicamentoNombre: l.medicamentoNombre,
      categoriaNombre: l.categoriaNombre,
      fechaVencimiento: l.fechaVencimiento,
      stockDisponible: l.cantidadDisponible,
      precioUnitario: l.precioVenta,
      cantidad: 1,
    }]);
  }

  quitar(idLote: number): void {
    this.carrito.set(this.carrito().filter(c => c.idLote !== idLote));
  }

  /** Cambio de cantidad desde la tabla: valida contra el stock (iv) */
  cambiarCantidad(item: CarritoItem, ev: Event): void {
    const val = Number((ev.target as HTMLInputElement).value);
    const updated = this.carrito().map(c => {
      if (c.idLote !== item.idLote) return c;
      if (!Number.isFinite(val) || val < 1) return { ...c, cantidad: 1 };
      if (val > c.stockDisponible) {
        this.error.set(`Máximo disponible para el lote ${c.numeroLote}: ${c.stockDisponible} unidades.`);
        return { ...c, cantidad: c.stockDisponible };
      }
      return { ...c, cantidad: Math.floor(val) };
    });
    this.carrito.set(updated);
  }

  cambiarPrecio(item: CarritoItem, ev: Event): void {
    const val = Number((ev.target as HTMLInputElement).value);
    this.carrito.set(this.carrito().map(c =>
      c.idLote === item.idLote
        ? { ...c, precioUnitario: Number.isFinite(val) && val > 0 ? val : c.precioUnitario }
        : c));
  }

  subtotalDe(item: CarritoItem): number {
    return +(item.cantidad * item.precioUnitario).toFixed(2);
  }

  readonly total = computed(() =>
    +this.carrito().reduce((s, c) => s + this.subtotalDe(c), 0).toFixed(2));

  readonly totalUnidades = computed(() =>
    this.carrito().reduce((s, c) => s + c.cantidad, 0));

  vaciarCarrito(): void {
    this.carrito.set([]);
    this.error.set('');
  }

  /* ------------------- Completar la venta (iii/iv) ------------------ */

  /** Validación local previa (iv): el backend re-valida atómicamente */
  preValidar(): string | null {
    if (!this.carrito().length) return 'Agrega al menos un producto a la venta.';
    for (const c of this.carrito()) {
      if (c.cantidad <= 0) return `La cantidad de ${c.medicamentoNombre} debe ser mayor a cero.`;
      if (c.precioUnitario <= 0) return `El precio unitario de ${c.medicamentoNombre} debe ser mayor a cero.`;
      if (c.cantidad > c.stockDisponible) {
        return `Stock insuficiente de ${c.medicamentoNombre} (lote ${c.numeroLote}): solicitaste ${c.cantidad}, solo hay ${c.stockDisponible}.`;
      }
    }
    if (this.total() <= 0) return 'El total de la venta debe ser mayor a cero.';
    return null;
  }

  registrarVenta(): void {
    this.error.set('');
    this.aviso.set('');
    const problema = this.preValidar();
    if (problema) { this.error.set(problema); return; }

    this.guardando = true;
    this.svc.registrarVenta(
      this.carrito().map(c => ({ idLote: c.idLote, cantidad: c.cantidad, precioUnitario: c.precioUnitario })),
      this.idSucursal,
    ).subscribe({
      next: res => {
        this.guardando = false;
        this.ultimaVenta.set(res.venta);
        this.carrito.set([]);
        // iii. El stock ya fue descontado: recargar catálogo con las nuevas existencias
        this.cargarCatalogo();
        this.aviso.set(
          `Venta #${res.venta.idVenta} registrada. Se actualizaron ${res.movimientosGenerados} lote(s) en inventario.`);
      },
      error: err => {
        this.guardando = false;
        this.error.set(this.svc.mensajeError(err));
        // Otra sesión pudo mover el stock: refrescar catálogo
        this.cargarCatalogo();
      },
    });
  }

  nuevaVenta(): void {
    this.ultimaVenta.set(null);
    this.aviso.set('');
  }

  /* -------------------------- Utilidades ---------------------------- */

  diasRestantes(fechaVenc: string): number {
    return Math.ceil((new Date(fechaVenc).getTime() - new Date(this.todayIso).getTime()) / 86400000);
  }

  fmtMoneda(v: number): string {
    return v.toLocaleString('es-GT', { style: 'currency', currency: 'Q' });
  }

  fmtFechaHora(iso: string): string {
    return new Date(iso).toLocaleString('es-GT', { dateStyle: 'short', timeStyle: 'short' });
  }

  fmtFecha(iso: string): string {
    return new Date(iso).toLocaleDateString('es-GT', { dateStyle: 'medium' });
  }
}
