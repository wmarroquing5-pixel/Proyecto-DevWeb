import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { VentasService } from '../../core/services/venta.service';
import { VentaConsultaResponse } from '../../core/models/venta.model';
import { correlativoLista } from '../../shared/utils/correlativo';

@Component({
    selector: 'app-venta-detalle',
    imports: [CommonModule, RouterModule],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <h2><i class="fa fa-receipt"></i> Detalle de Venta #{{ idVenta }}</h2>
        <a routerLink="/ventas" class="btn btn-secondary">
          <i class="fa fa-arrow-left"></i> Volver
        </a>
      </header>

      @if (cargando) {
        <div class="text-center py-5">
          <div class="spinner-border text-primary"></div>
        </div>
      } @else if (error) {
        <div class="alert alert-danger">{{ error }}</div>
      } @else if (venta) {
        <!-- Información general -->
        <div class="ui-card mb-4">
          <div class="card-body">
            <div class="row">
              <div class="col-md-3">
                <strong>ID Venta:</strong>
                <p>{{ venta.idVenta }}</p>
              </div>
              <div class="col-md-3">
                <strong>Fecha:</strong>
                <p>{{ venta.fechaVenta | date:'dd/MM/yyyy HH:mm' }}</p>
              </div>
              <div class="col-md-3">
                <strong>Sucursal:</strong>
                <p>{{ venta.idSucursal }}</p>
              </div>
              <div class="col-md-3">
                <strong>Usuario:</strong>
                <p>{{ venta.idUsuario }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Detalle de productos -->
        <div class="card ui-card">
          <div class="card-header bg-primary text-white">
            <h5 class="mb-0">Productos Vendidos</h5>
          </div>
          <div class="card-body">
            <div class="ui-table-wrap">
              <table class="table table-striped ui-table">
                <thead>
                  <tr>
                    <th class="ui-col-index">No.</th>
                    <th>ID Medicamento</th>
                    <th>ID Lote</th>
                    <th class="ui-col-number">Cantidad</th>
                    <th class="ui-col-number">Precio Unitario</th>
                    <th class="ui-col-number">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (d of venta.detalles; track d.idDetalle; let i = $index) {
                    <tr>
                      <td class="ui-col-index">{{ correlativo(i) }}</td>
                      <td>{{ d.idMedicamento }}</td>
                      <td>{{ d.idLote }}</td>
                      <td class="ui-col-number">{{ d.cantidad }}</td>
                      <td class="ui-col-number">Q{{ d.precioUnitario | number:'1.2-2' }}</td>
                      <td class="fw-bold ui-col-number">Q{{ d.subtotal | number:'1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
                <tfoot class="table-info">
                  <tr>
                    <td colspan="5" class="text-end fw-bold">TOTAL:</td>
                    <td class="fw-bold text-success fs-5">Q{{ venta.total | number:'1.2-2' }}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class VentaDetalleComponent implements OnInit {
  private service = inject(VentasService);
  private route = inject(ActivatedRoute);
  readonly correlativo = correlativoLista;

  idVenta!: number;
  venta: VentaConsultaResponse | null = null;
  cargando = false;
  error = '';

  ngOnInit() {
    this.idVenta = +this.route.snapshot.paramMap.get('id')!;
    this.cargarVenta();
  }

  cargarVenta() {
    this.cargando = true;
    this.service.obtenerVenta(this.idVenta).subscribe({
      next: (v) => {
        this.venta = v;
        this.cargando = false;
      },
      error: () => {
        this.error = 'No se pudo cargar el detalle de la venta.';
        this.cargando = false;
      }
    });
  }
}
