import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { FacturaService } from '../../core/services/factura.service';
import { FacturaDetalleComponent } from './factura-detalle.component';

describe('FacturaDetalleComponent', () => {
  let fixture: ComponentFixture<FacturaDetalleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FacturaDetalleComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '72' }) } } },
        { provide: FacturaService, useValue: { obtener: () => of({
          idFactura: 72, idUsuario: 9, idSucursal: 2, idPaciente: 5,
          fechaFactura: '2026-10-20T12:00:00Z', tipoFactura: 'Estancia Medica',
          nit: null, nombreFacturacion: 'Paciente Demo', total: 25,
          detalles: [
            { idDetalle: 1, idServicio: 8, idLote: null, idMedicamento: null, cantidad: 1, precioUnitario: 10, subtotal: 10 },
            { idDetalle: 2, idServicio: null, idLote: 91, idMedicamento: 44, cantidad: 1, precioUnitario: 15, subtotal: 15 },
          ],
        }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FacturaDetalleComponent);
    fixture.detectChanges();
  });

  it('distingue servicios y medicamentos y conserva el lote utilizado', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Servicio 8');
    expect(text).toContain('Medicamento 44');
    expect(text).toContain('91');
    expect(text).toContain('Paciente Demo');
  });
});
