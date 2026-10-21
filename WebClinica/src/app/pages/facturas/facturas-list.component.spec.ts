import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PermisosService } from '../../core/services/permisos.service';
import { FacturaService } from '../../core/services/factura.service';
import { FacturasListComponent } from './facturas-list.component';

describe('FacturasListComponent', () => {
  let fixture: ComponentFixture<FacturasListComponent>;
  let listar: jasmine.Spy;
  let permitirCrear: boolean;

  beforeEach(async () => {
    permitirCrear = true;
    listar = jasmine.createSpy('listar').and.callFake((filtro: { page: number; pageSize: number }) => of({
      items: [{
        idFactura: 58, idUsuario: 9, idSucursal: 2, idPaciente: 5,
        fechaFactura: '2026-10-20T12:00:00Z', tipoFactura: 'Estancia Medica',
        nit: 'CF', nombreFacturacion: 'Paciente Demo', total: 35,
      }],
      page: filtro.page, pageSize: filtro.pageSize, totalCount: 21, totalPages: 2,
    }));
    await TestBed.configureTestingModule({
      imports: [FacturasListComponent],
      providers: [
        provideRouter([]),
        { provide: FacturaService, useValue: { listar } },
        { provide: PermisosService, useValue: { puedeCrear: () => permitirCrear } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FacturasListComponent);
    fixture.detectChanges();
  });

  it('muestra los registros, la navegación y la acción Crear autorizada', () => {
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Paciente Demo');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Ver detalle de factura"]')?.getAttribute('href'))
      .toBe('/facturas/58');
    expect(element.querySelector<HTMLAnchorElement>('a[href="/facturas/nueva"]')).not.toBeNull();
  });

  it('reinicia la página al aplicar filtros y pagina con correlativo estable', () => {
    fixture.componentInstance.page = 2;
    fixture.componentInstance.filtro.idPaciente = 5;
    fixture.componentInstance.buscar();
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ idPaciente: 5, page: 1 }));
  });

  it('oculta Nueva factura cuando Facturas/Crear no está autorizado', () => {
    permitirCrear = false;
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/facturas/nueva"]')).toBeNull();
  });

  it('muestra el estado vacío confirmado por la API', () => {
    listar.and.returnValue(of({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }));
    fixture = TestBed.createComponent(FacturasListComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay facturas');
  });
});
