import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LoteMedicamento,
  MotivoMovimiento,
  MovimientoFormData,
  MovimientoInventario,
  ResumenInventario,
  TipoMovimiento,
} from '../../core/models/inventario.model';
import { InventarioService } from '../../core/services/inventario.service';

/**
 * Módulo Inventario de Medicamentos — iii. Actualización de entradas y salidas
 * por ventas o uso clínico (tabla sugerida MovimientoInventario).
 * Cada movimiento descuenta/suma CantidadDisponible del lote correspondiente.
 */
@Component({
  selector: 'app-inventario-movimientos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventario-movimientos.component.html',
  styleUrl: './inventario-movimientos.component.css',
})
export class InventarioMovimientosComponent implements OnInit {
  private svc = inject(InventarioService);
  private route = inject(ActivatedRoute);

  readonly resumen = signal<ResumenInventario | null>(null);
  readonly movimientos = signal<MovimientoInventario[]>([]);
  readonly lotes = signal<LoteMedicamento[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  /** Filtros del historial */
  filtroTipo: '' | TipoMovimiento = '';
  idMedicamentoFiltro: number | null = null;

  /** Modal de registro */
  modalAbierto = false;
  guardando = false;
  motivos: MotivoMovimiento[] = ['Compra', 'Devolución', 'Venta', 'Uso clínico', 'Ajuste', 'Merma'];
  form: MovimientoFormData = this.formVacio();

  readonly todayIso = new Date().toISOString().slice(0, 10);

  ngOnInit(): void {
    // Si vengo del listado con ?idMedicamento=x, pre-filtra sus lotes/movimientos
    this.route.queryParamMap.subscribe(pm => {
      const idm = pm.get('idMedicamento');
      this.idMedicamentoFiltro = idm ? Number(idm) : null;
      this.cargarLotes();
      this.cargar();
    });
    this.svc.resumen().subscribe(r => this.resumen.set(r));
  }

  get loteSeleccionado(): LoteMedicamento | undefined {
    return this.lotes().find(l => l.idLote === this.form.idLote);
  }

  get esSalida(): boolean {
    return this.form.tipo === 'Salida';
  }

  cargarLotes(): void {
    this.svc.listarLotes(this.idMedicamentoFiltro ?? undefined)
      .subscribe(list => this.lotes.set(list));
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.svc.listarMovimientos(this.filtroTipo ? { tipo: this.filtroTipo } : undefined).subscribe({
      next: list => {
        this.movimientos.set(this.idMedicamentoFiltro
          ? list.filter(m => m.idMedicamento === this.idMedicamentoFiltro)
          : list);
      },
      error: () => this.error.set('No se pudo cargar el historial de movimientos.'),
      complete: () => {
        this.cargando.set(false);
        this.svc.resumen().subscribe(r => this.resumen.set(r));
      },
    });
  }

  cambiarFiltro(): void {
    this.cargarLotes();
    this.cargar();
  }

  /* ---------------------- Registrar movimiento ---------------------- */

  abrirModal(tipo: TipoMovimiento): void {
    this.form = { ...this.formVacio(), tipo };
    this.aviso.set('');
    this.modalAbierto = true;
  }

  cerrar(): void { this.modalAbierto = false; }

  onTipoChange(): void {
    // Al cambiar tipo, sugiere un motivo coherente
    if (this.form.tipo === 'Entrada' && !['Compra', 'Devolución', 'Ajuste'].includes(this.form.motivo)) {
      this.form.motivo = 'Compra';
    }
    if (this.form.tipo === 'Salida' && !['Venta', 'Uso clínico', 'Merma', 'Ajuste'].includes(this.form.motivo)) {
      this.form.motivo = 'Venta';
    }
  }

  guardar(f: any): void {
    this.aviso.set('');
    if (!f?.valid) {
      this.aviso.set('Complete: lote, tipo, motivo y cantidad.');
      return;
    }
    if (this.form.cantidad === null || this.form.cantidad <= 0) {
      this.aviso.set('La cantidad debe ser mayor a cero.');
      return;
    }
    const lote = this.loteSeleccionado;
    if (!lote) { this.aviso.set('Seleccione un lote válido.'); return; }

    if (this.form.tipo === 'Salida') {
      if (lote.fechaVencimiento < this.todayIso) {
        this.aviso.set(`El lote ${lote.numeroLote} está VENCIDO y no puede despacharse.`);
        return;
      }
      if (this.form.cantidad > lote.cantidadDisponible) {
        this.aviso.set(
          `Stock insuficiente: el lote ${lote.numeroLote} solo tiene ${lote.cantidadDisponible} unidades.`);
        return;
      }
    }

    this.guardando = true;
    this.svc.registrarMovimiento(this.form).subscribe({
      next: mov => {
        this.aviso.set(`${mov.tipo} registrada: ${mov.cantidad} u. de ${mov.medicamentoNombre} (lote ${mov.numeroLote}).`);
        this.modalAbierto = false;
        this.cargarLotes();
        this.cargar();
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? '';
        if (msg.includes('INSUFFICIENT_STOCK')) this.aviso.set('Stock insuficiente en el lote seleccionado.');
        else if (msg.includes('EXPIRED_LOTE')) this.aviso.set('No se pueden dar salidas de lotes vencidos.');
        else this.aviso.set('Error al registrar el movimiento.');
      },
      complete: () => (this.guardando = false),
    });
  }

  /* -------------------------- Utilidades --------------------------- */

  clasesMotivo(motivo: MotivoMovimiento): string {
    switch (motivo) {
      case 'Venta': return 'badge text-bg-primary';
      case 'Uso clínico': return 'badge text-bg-info';
      case 'Compra': return 'badge text-bg-success';
      case 'Devolución': return 'badge text-bg-secondary';
      case 'Merma': return 'badge text-bg-danger';
      default: return 'badge text-bg-light border';
    }
  }

  fmtFechaHora(d: string): string {
    const f = new Date(d);
    return f.toLocaleDateString('es-GT') + ' ' +
           f.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  fmtMoneda(v: number): string {
    return v.toLocaleString('es-GT', { style: 'currency', currency: 'Q' });
  }

  private formVacio(): MovimientoFormData {
    return {
      idLote: this.idMedicamentoFiltro
        ? (this.lotes().find(l => l.idMedicamento === this.idMedicamentoFiltro)?.idLote ?? null)
        : null,
      tipo: 'Salida', motivo: 'Venta', cantidad: null, referencia: '',
    };
  }
}
