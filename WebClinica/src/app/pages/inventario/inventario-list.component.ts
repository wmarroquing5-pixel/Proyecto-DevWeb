import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  Categoria,
  LoteFormData,
  Marca,
  MedicamentoConLotes,
  MedicamentoFormData,
  STOCK_MINIMO_ALERTA,
} from '../../core/models/inventario.model';
import { InventarioService } from '../../core/services/inventario.service';
import { estadoLote } from '../../core/mock/inventario.mock';

/**
 * Módulo Inventario de Medicamentos
 *  i.   Registro de medicamentos (listado + alta/edición en modal)
 *  ii.  Registro de lotes por medicamento (modal con FEFO y alertas)
 *  iii. Acceso al historial de entradas/salidas en la vista de detalle.
 */
@Component({
  selector: 'app-inventario-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './inventario-list.component.html',
  styleUrl: './inventario-list.component.css',
})
export class InventarioListComponent implements OnInit {
  private svc = inject(InventarioService);

  readonly medicamentos = signal<MedicamentoConLotes[]>([]);
  readonly categorias = signal<Categoria[]>([]);
  readonly marcas = signal<Marca[]>([]);
  readonly cargando = signal(false);
  readonly error = signal('');
  readonly aviso = signal('');

  filtro = this.svc.filtro();
  mostrarInactivos = false;
  stockAlerta = STOCK_MINIMO_ALERTA;
  readonly todayIso = new Date().toISOString().slice(0, 10);

  /** Modal medicamento */
  modalMed = false;
  editandoMed = false;
  idEditMed: number | null = null;
  guardandoMed = false;
  formMed: MedicamentoFormData = this.formMedVacio();

  /** Modal lote */
  modalLote = false;
  medParaLote: MedicamentoConLotes | null = null;
  guardandoLote = false;
  formLote: LoteFormData = this.formLoteVacio();

  ngOnInit(): void {
    this.svc.categorias().subscribe(c => this.categorias.set(c));
    this.svc.marcas().subscribe(m => this.marcas.set(m));
    this.cargar();
  }

  get tituloModalMed(): string {
    return this.editandoMed ? 'Editar medicamento' : 'Registrar medicamento';
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this.svc.listarMedicamentos(this.filtro).subscribe({
      next: list => this.medicamentos.set(this.mostrarInactivos ? list : list.filter(m => m.activo)),
      error: () => this.error.set('No se pudo conectar con el servidor de inventario.'),
      complete: () => this.cargando.set(false),
    });
  }

  buscar(): void {
    this.svc.filtro.set(this.filtro);
    this.cargar();
  }

  limpiarFiltro(): void {
    this.filtro = '';
    this.buscar();
  }

  toggleInactivos(): void {
    this.mostrarInactivos = !this.mostrarInactivos;
    this.cargar();
  }

  /* ------------------- i. Modal de medicamento ------------------- */

  nuevoMedicamento(): void {
    this.formMed = this.formMedVacio();
    this.editandoMed = false;
    this.idEditMed = null;
    this.aviso.set('');
    this.modalMed = true;
  }

  editarMedicamento(m: MedicamentoConLotes): void {
    this.formMed = {
      idCategoria: m.idCategoria, idMarca: m.idMarca, codigo: m.codigo,
      nombre: m.nombre, descripcion: m.descripcion ?? '',
      precioVenta: m.precioVenta, imagenUrl: m.imagenUrl ?? '', activo: m.activo,
    };
    this.editandoMed = true;
    this.idEditMed = m.idMedicamento;
    this.aviso.set('');
    this.modalMed = true;
  }

  cerrarMed(): void { this.modalMed = false; }

  guardarMedicamento(f: any): void {
    this.aviso.set('');
    if (!f?.valid) {
      this.aviso.set('Complete los campos obligatorios: categoría, marca, código, nombre y precio.');
      return;
    }
    // CHK_Medicamento_Precio: PrecioVenta > 0
    if (this.formMed.precioVenta === null || this.formMed.precioVenta <= 0) {
      this.aviso.set('El precio de venta debe ser mayor a cero (CHK_Medicamento_Precio).');
      return;
    }
    this.guardandoMed = true;
    const req = this.editandoMed && this.idEditMed !== null
      ? this.svc.actualizarMedicamento(this.idEditMed, this.formMed)
      : this.svc.crearMedicamento(this.formMed);

    req.subscribe({
      next: m => {
        this.aviso.set(`Medicamento ${m.nombre} guardado correctamente.`);
        this.modalMed = false;
        this.cargar();
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? '';
        this.aviso.set(msg.includes('DUPLICATE_CODE')
          ? 'El código ya existe (restricción UNIQUE en Medicamento.Codigo).'
          : 'Error al guardar el medicamento.');
      },
      complete: () => (this.guardandoMed = false),
    });
  }

  desactivar(m: MedicamentoConLotes): void {
    if (!confirm(`¿Desactivar "${m.nombre}"? (baja lógica, Activo = 0)`)) return;
    this.svc.desactivarMedicamento(m.idMedicamento).subscribe(() => {
      this.aviso.set('Medicamento desactivado.');
      this.cargar();
    });
  }

  reactivar(m: MedicamentoConLotes): void {
    this.svc.actualizarMedicamento(m.idMedicamento, {
      idCategoria: m.idCategoria, idMarca: m.idMarca, codigo: m.codigo,
      nombre: m.nombre, descripcion: m.descripcion ?? '',
      precioVenta: m.precioVenta, imagenUrl: m.imagenUrl ?? '', activo: true,
    }).subscribe(() => {
      this.aviso.set('Medicamento reactivado.');
      this.cargar();
    });
  }

  /* -------------------- ii. Modal de lote ------------------------ */

  abrirLote(m: MedicamentoConLotes): void {
    this.medParaLote = m;
    this.formLote = { ...this.formLoteVacio(), idMedicamento: m.idMedicamento, fechaIngreso: this.todayIso };
    this.aviso.set('');
    this.modalLote = true;
  }

  cerrarLote(): void { this.modalLote = false; }

  guardarLote(f: any): void {
    this.aviso.set('');
    if (!f?.valid) {
      this.aviso.set('Complete: medicamento, número de lote, fechas y cantidad disponible.');
      return;
    }
    // CHK_Lote_Cantidad: CantidadDisponible >= 0
    if (this.formLote.cantidadDisponible === null || this.formLote.cantidadDisponible < 0) {
      this.aviso.set('La cantidad disponible no puede ser negativa (CHK_Lote_Cantidad >= 0).');
      return;
    }
    // Regla de negocio: el vencimiento debe ser posterior al ingreso
    if (this.formLote.fechaVencimiento <= this.formLote.fechaIngreso) {
      this.aviso.set('La fecha de vencimiento debe ser posterior a la fecha de ingreso.');
      return;
    }
    this.guardandoLote = true;
    this.svc.crearLote(this.formLote).subscribe({
      next: l => {
        this.aviso.set(`Lote ${l.numeroLote} registrado (entrada automática en movimientos).`);
        this.modalLote = false;
        this.cargar();
      },
      error: err => {
        const msg = err?.error?.message ?? err?.message ?? '';
        this.aviso.set(msg.includes('DUPLICATE_LOTE')
          ? `Ya existe un lote "${this.formLote.numeroLote}" para este medicamento.`
          : 'Error al registrar el lote.');
      },
      complete: () => (this.guardandoLote = false),
    });
  }

  /* ------------------------- Utilidades -------------------------- */

  estadoLoteDe(l: any): string {
    return estadoLote(l);
  }

  clasesEstado(l: any): string {
    switch (estadoLote(l)) {
      case 'Vencido': return 'badge bg-danger';
      case 'Agotado': return 'badge bg-secondary';
      case 'Próx. vencer': return 'badge bg-warning text-dark';
      case 'Stock bajo': return 'badge bg-info text-dark';
      default: return 'badge bg-success';
    }
  }

  fmtMoneda(v: number): string {
    return v.toLocaleString('es-GT', { style: 'currency', currency: 'Q' });
  }

  fmtFecha(d: string): string {
    return d ? d.slice(0, 10) : '—';
  }

  diasRestantes(vencimiento: string): number {
    return Math.ceil((new Date(vencimiento).getTime() - Date.now()) / 86400000);
  }

  private formMedVacio(): MedicamentoFormData {
    return {
      idCategoria: null, idMarca: null, codigo: '', nombre: '',
      descripcion: '', precioVenta: null, imagenUrl: '', activo: true,
    };
  }

  private formLoteVacio(): LoteFormData {
    return {
      idMedicamento: null, numeroLote: '', fechaIngreso: '',
      fechaVencimiento: '', cantidadDisponible: null,
    };
  }
}
