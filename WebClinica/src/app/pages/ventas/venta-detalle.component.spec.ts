import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VentaConsultaResponse } from '../../core/models/venta.model';
import { VentasService } from '../../core/services/venta.service';
import { VentaDetalleComponent } from './venta-detalle.component';

describe('VentaDetalleComponent WEB-UX-01C2', () => {
  let fixture: ComponentFixture<VentaDetalleComponent>;
  const venta: VentaConsultaResponse = {
    idVenta: 72, idUsuario: 9, idSucursal: 2, idPaciente: null,
    fechaVenta: '2026-10-19T12:00:00', tipoFactura: 'Contado', total: 25,
    detalles: [
      { idDetalle: 501, idLote: 80, idMedicamento: 30, idServicio: null, cantidad: 1, precioUnitario: 10, subtotal: 10 },
      { idDetalle: 990, idLote: 91, idMedicamento: 44, idServicio: null, cantidad: 1, precioUnitario: 15, subtotal: 15 },
    ],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VentaDetalleComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '72' }) } } },
        { provide: VentasService, useValue: { obtenerVenta: jasmine.createSpy('obtenerVenta').and.returnValue(of(venta)) } },
      ],
    }).compileComponents();
  });

  it('numera la lista completa sin sustituir los IDs relacionados', () => {
    fixture = TestBed.createComponent(VentaDetalleComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('thead th')?.textContent?.trim()).toBe('No.');
    const filas = element.querySelectorAll('tbody tr');
    expect(filas[0].querySelector('td')?.textContent?.trim()).toBe('1');
    expect(filas[1].querySelector('td')?.textContent?.trim()).toBe('2');
    expect(filas[0].textContent).toContain('30');
    expect(filas[0].textContent).toContain('80');
  });
});
