import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FacturaDetalle, FacturaDetalleItem } from '../../core/models/factura.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { FacturaService } from '../../core/services/factura.service';
import { UiStateComponent } from '../../shared/components/ui-state.component';
import { correlativoLista } from '../../shared/utils/correlativo';

@Component({
    selector: 'app-factura-detalle',
    imports: [CommonModule, RouterModule, UiStateComponent],
    template: `
    <div class="page-shell">
      <header class="page-header">
        <div>
          <h2><i class="fa fa-file-invoice"></i> Detalle de factura</h2>
          <p class="page-header__subtitle">Consulta de importes históricos confirmados por la API.</p>
        </div>
        <a routerLink="/facturas" class="btn btn-secondary"><i class="fa fa-arrow-left"></i> Volver</a>
      </header>

      @if (cargando) {
        <app-ui-state kind="loading" title="Cargando factura"></app-ui-state>
      } @else if (error) {
        <app-ui-state kind="error" title="No se pudo cargar la factura" [description]="error"
                      [retryable]="true" (retry)="cargar()"></app-ui-state>
      } @else if (factura) {
        <section class="ui-card mb-4">
          <div class="row g-3">
            <div class="col-sm-6 col-lg-3"><strong>Factura</strong><div>{{ factura.idFactura }}</div></div>
            <div class="col-sm-6 col-lg-3"><strong>Fecha</strong><div>{{ factura.fechaFactura | date:'dd/MM/yyyy HH:mm' }}</div></div>
            <div class="col-sm-6 col-lg-3"><strong>Tipo</strong><div>{{ factura.tipoFactura }}</div></div>
            <div class="col-sm-6 col-lg-3"><strong>Paciente</strong><div>{{ factura.idPaciente ?? 'Sin asociación' }}</div></div>
            <div class="col-sm-6 col-lg-3"><strong>Sucursal</strong><div>{{ factura.idSucursal }}</div></div>
            <div class="col-sm-6 col-lg-3"><strong>Usuario</strong><div>{{ factura.idUsuario }}</div></div>
            <div class="col-sm-6 col-lg-3"><strong>NIT</strong><div>{{ factura.nit || 'Consumidor final' }}</div></div>
            <div class="col-sm-6 col-lg-3"><strong>Nombre</strong><div>{{ factura.nombreFacturacion || 'Consumidor final' }}</div></div>
          </div>
        </section>

        <section class="ui-table-wrap">
          <table class="table ui-table">
            <thead><tr><th class="ui-col-index">No.</th><th>Concepto</th><th>Lote</th>
              <th class="ui-col-number">Cantidad</th><th class="ui-col-number">Precio unitario</th>
              <th class="ui-col-number">Subtotal</th></tr></thead>
            <tbody>
              @for (detalle of factura.detalles; track detalle.idDetalle; let index = $index) {
                <tr>
                  <td class="ui-col-index">{{ correlativo(index) }}</td>
                  <td>{{ concepto(detalle) }}</td>
                  <td>{{ detalle.idLote ?? 'No aplica' }}</td>
                  <td class="ui-col-number">{{ detalle.cantidad }}</td>
                  <td class="ui-col-number">{{ detalle.precioUnitario | currency:'GTQ':'symbol-narrow':'1.2-2' }}</td>
                  <td class="ui-col-number fw-bold">{{ detalle.subtotal | currency:'GTQ':'symbol-narrow':'1.2-2' }}</td>
                </tr>
              }
            </tbody>
            <tfoot><tr><td colspan="5" class="text-end fw-bold">Total</td>
              <td class="ui-col-number fw-bold text-success">{{ factura.total | currency:'GTQ':'symbol-narrow':'1.2-2' }}</td></tr></tfoot>
          </table>
        </section>
      }
    </div>
  `
})
export class FacturaDetalleComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly facturasService = inject(FacturaService);
  private readonly apiErrors = inject(ApiErrorService);
  readonly correlativo = correlativoLista;
  readonly idFactura = Number(this.route.snapshot.paramMap.get('id'));

  factura: FacturaDetalle | null = null;
  cargando = false;
  error = '';

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    if (!Number.isInteger(this.idFactura) || this.idFactura <= 0) {
      this.error = 'El identificador de la factura no es válido.';
      return;
    }
    this.cargando = true;
    this.error = '';
    this.facturasService.obtener(this.idFactura).subscribe({
      next: factura => { this.factura = factura; this.cargando = false; },
      error: (error: HttpErrorResponse) => {
        this.error = this.apiErrors.messageFor(error, 'No fue posible consultar la factura.');
        this.cargando = false;
      },
    });
  }

  concepto(detalle: FacturaDetalleItem): string {
    if (detalle.idServicio !== null) return `Servicio ${detalle.idServicio}`;
    if (detalle.idMedicamento !== null) return `Medicamento ${detalle.idMedicamento}`;
    return 'Concepto no identificado';
  }
}
