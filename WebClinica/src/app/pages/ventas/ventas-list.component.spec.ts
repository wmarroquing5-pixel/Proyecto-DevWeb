import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VentaConsultaResumenResponse } from '../../core/models/venta.model';
import { PermisosService } from '../../core/services/permisos.service';
import { VentasService } from '../../core/services/venta.service';
import { VentasListComponent } from './ventas-list.component';

describe('VentasListComponent WEB-UX-01C2', () => {
  let fixture: ComponentFixture<VentasListComponent>;
  let listarVentas: jasmine.Spy;

  const venta: VentaConsultaResumenResponse = {
    idVenta: 58, idUsuario: 9, idSucursal: 2, idPaciente: null,
    fechaVenta: '2026-10-19T12:00:00', total: 35,
  };

  beforeEach(async () => {
    listarVentas = jasmine.createSpy('listarVentas').and.callFake((filtro: { page: number; pageSize: number }) => of({
      items: [venta], page: filtro.page, pageSize: filtro.pageSize, totalCount: 21, totalPages: 3,
    }));
    await TestBed.configureTestingModule({
      imports: [VentasListComponent],
      providers: [
        provideRouter([]),
        { provide: VentasService, useValue: { listarVentas } },
        { provide: PermisosService, useValue: { puedeCrear: () => true } },
      ],
    }).compileComponents();
  });

  it('pagina el correlativo y abre el detalle con el ID real', () => {
    fixture = TestBed.createComponent(VentasListComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('thead th')?.textContent?.trim()).toBe('No.');
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('1');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Ver detalle de venta"]')?.getAttribute('href'))
      .toBe('/ventas/58');

    fixture.componentInstance.cambiarPagina(3);
    fixture.detectChanges();
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('21');
  });
});
