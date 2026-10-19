import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { VentasService } from '../../core/services/venta.service';
import {
  CrearVentaRequest,
  VentaResponse,
  CatalogoMedicamentoResponse,
  PagedResponse
} from '../../core/models/venta.model';

interface ItemCarrito {
  idMedicamento: number;
  codigo: string;
  nombre: string;
  precioUnitario: number;
  cantidad: number;
  existenciaTotal: number;
  subtotal: number;
}

@Component({
  selector: 'app-ventas-nueva',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="container-fluid mt-4">
      <div class="d-flex justify-content-between align-items-center mb-4">
        <h2><i class="fa fa-plus-circle"></i> Nueva Venta de Farmacia</h2>
        <a routerLink="/ventas" class="btn btn-secondary">
          <i class="fa fa-arrow-left"></i> Volver
        </a>
      </div>

      @if (error) { <div class="alert alert-danger">{{ error }}</div> }

      <div class="row g-4">
        <!-- Panel izquierdo: Búsqueda de medicamentos -->
        <div class="col-md-5">
          <div class="card p-3 shadow-sm">
            <h5><i class="fa fa-search"></i> Buscar Medicamento</h5>
            <div class="mb-3">
              <label class="form-label">ID Sucursal *</label>
              <input type="number" class="form-control" [(ngModel)]="idSucursal" min="1" required>
            </div>
            <div class="mb-3">
              <label class="form-label">Buscar por nombre</label>
              <input type="text" class="form-control" [(ngModel)]="busqueda"
                     (input)="buscarMedicamentos()" placeholder="Ej: Paracetamol...">
            </div>

            @if (cargandoBusqueda) {
              <div class="text-center py-3">
                <div class="spinner-border spinner-border-sm text-primary"></div>
              </div>
            } @else if (medicamentos.length === 0) {
              <div class="alert alert-info text-center small">
                Escribe para buscar medicamentos disponibles.
              </div>
            } @else {
              <div class="list-group" style="max-height: 400px; overflow-y: auto;">
                @for (m of medicamentos; track m.idMedicamento) {
                  <button type="button" class="list-group-item list-group-item-action"
                          (click)="agregarAlCarrito(m)"
                          [disabled]="m.existenciaTotal === 0">
                    <div class="d-flex justify-content-between">
                      <div>
                        <strong>{{ m.nombre }}</strong>
                        <br><small class="text-muted">{{ m.codigo }} - {{ m.marca }}</small>
                      </div>
                      <div class="text-end">
                        <span class="badge"
                              [class.bg-success]="m.existenciaTotal > 10"
                              [class.bg-warning]="m.existenciaTotal > 0 && m.existenciaTotal <= 10"
                              [class.bg-danger]="m.existenciaTotal === 0">
                          Stock: {{ m.existenciaTotal }}
                        </span>
                        <br><small class="text-success fw-bold">Q{{ m.precioVenta | number:'1.2-2' }}</small>
                      </div>
                    </div>
                  </button>
                }
              </div>
            }
          </div>
        </div>

        <!-- Panel derecho: Carrito de venta -->
        <div class="col-md-7">
          <div class="card p-3 shadow-sm">
            <h5><i class="fa fa-shopping-cart"></i> Carrito de Venta</h5>

            @if (carrito.length === 0) {
              <div class="alert alert-info text-center">
                Agrega medicamentos desde el panel de búsqueda.
              </div>
            } @else {
              <div class="table-responsive">
                <table class="table table-sm">
                  <thead class="table-light">
                    <tr>
                      <th>Medicamento</th>
                      <th>Precio</th>
                      <th>Cantidad</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (item of carrito; track item.idMedicamento) {
                      <tr>
                        <td>
                          <strong>{{ item.nombre }}</strong>
                          <br><small class="text-muted">{{ item.codigo }}</small>
                        </td>
                        <td>Q{{ item.precioUnitario | number:'1.2-2' }}</td>
                        <td>
                          <div class="input-group input-group-sm">
                            <button class="btn btn-outline-secondary" (click)="cambiarCantidad(item, -1)">-</button>
                            <input type="number" class="form-control text-center"
                                   [(ngModel)]="item.cantidad" min="1" [max]="item.existenciaTotal"
                                   (change)="recalcularSubtotal(item)" style="max-width: 60px;">
                            <button class="btn btn-outline-secondary" (click)="cambiarCantidad(item, 1)">+</button>
                          </div>
                          <small class="text-muted">Stock: {{ item.existenciaTotal }}</small>
                        </td>
                        <td class="fw-bold">Q{{ item.subtotal | number:'1.2-2' }}</td>
                        <td>
                          <button class="btn btn-sm btn-danger" (click)="eliminarDelCarrito(item)">
                            <i class="fa fa-trash"></i>
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>

              <div class="d-flex justify-content-between align-items-center mt-3 p-3 bg-light rounded">
                <h4 class="mb-0">Total:</h4>
                <h3 class="mb-0 text-success fw-bold">Q{{ total | number:'1.2-2' }}</h3>
              </div>

              <div class="d-flex gap-2 mt-3">
                <button class="btn btn-success flex-fill" (click)="confirmarVenta()"
                        [disabled]="cargando || carrito.length === 0 || idSucursal <= 0">
                  {{ cargando ? 'Procesando...' : 'Confirmar Venta' }}
                </button>
                <button class="btn btn-outline-danger" (click)="limpiarCarrito()"
                        [disabled]="cargando">
                  <i class="fa fa-times"></i> Cancelar
                </button>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `
})
export class VentasNuevaComponent implements OnInit {
  private service = inject(VentasService);
  private router = inject(Router);

  idSucursal = 1;
  busqueda = '';
  medicamentos: CatalogoMedicamentoResponse[] = [];
  carrito: ItemCarrito[] = [];
  cargandoBusqueda = false;
  cargando = false;
  error = '';

  ngOnInit() {
    // Carga inicial de medicamentos
    this.buscarMedicamentos();
  }

  buscarMedicamentos() {
    this.cargandoBusqueda = true;
    this.service.buscarMedicamentos(this.busqueda || undefined).subscribe({
      next: (res: PagedResponse<CatalogoMedicamentoResponse>) => {
        this.medicamentos = res.items;
        this.cargandoBusqueda = false;
      },
      error: () => {
        this.medicamentos = [];
        this.cargandoBusqueda = false;
      }
    });
  }

  agregarAlCarrito(med: CatalogoMedicamentoResponse) {
    const existente = this.carrito.find(i => i.idMedicamento === med.idMedicamento);
    if (existente) {
      if (existente.cantidad < med.existenciaTotal) {
        existente.cantidad++;
        existente.subtotal = existente.cantidad * existente.precioUnitario;
      } else {
        this.error = `No hay más stock disponible para ${med.nombre}`;
        setTimeout(() => this.error = '', 3000);
      }
    } else {
      this.carrito.push({
        idMedicamento: med.idMedicamento,
        codigo: med.codigo,
        nombre: med.nombre,
        precioUnitario: med.precioVenta,
        cantidad: 1,
        existenciaTotal: med.existenciaTotal,
        subtotal: med.precioVenta
      });
    }
  }

  cambiarCantidad(item: ItemCarrito, delta: number) {
    const nuevaCantidad = item.cantidad + delta;
    if (nuevaCantidad >= 1 && nuevaCantidad <= item.existenciaTotal) {
      item.cantidad = nuevaCantidad;
      item.subtotal = item.cantidad * item.precioUnitario;
    }
  }

  recalcularSubtotal(item: ItemCarrito) {
    if (item.cantidad < 1) item.cantidad = 1;
    if (item.cantidad > item.existenciaTotal) item.cantidad = item.existenciaTotal;
    item.subtotal = item.cantidad * item.precioUnitario;
  }

  eliminarDelCarrito(item: ItemCarrito) {
    this.carrito = this.carrito.filter(i => i.idMedicamento !== item.idMedicamento);
  }

  limpiarCarrito() {
    this.carrito = [];
    this.busqueda = '';
    this.buscarMedicamentos();
  }

  get total(): number {
    return this.carrito.reduce((sum, item) => sum + item.subtotal, 0);
  }

  confirmarVenta() {
    if (this.carrito.length === 0 || this.idSucursal <= 0) return;

    this.cargando = true;
    this.error = '';

    const request: CrearVentaRequest = {
      idSucursal: this.idSucursal,
      items: this.carrito.map(i => ({
        idMedicamento: i.idMedicamento,
        cantidad: i.cantidad
      }))
    };

    this.service.crearVenta(request).subscribe({
      next: (res: VentaResponse) => {
        this.router.navigate(['/ventas', res.idVenta]);
      },
      error: (err) => {
        this.error = err.error?.message || 'Error al procesar la venta. Verifica el stock disponible.';
        this.cargando = false;
      }
    });
  }
}