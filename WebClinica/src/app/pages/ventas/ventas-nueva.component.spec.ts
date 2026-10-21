import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogoMedicamentoResponse } from '../../core/models/inventario.model';
import { CatalogosService } from '../../core/services/catalogos.service';
import { VentasService } from '../../core/services/venta.service';
import { VentasNuevaComponent } from './ventas-nueva.component';

describe('VentasNuevaComponent WEB-UX-01C2', () => {
  let fixture: ComponentFixture<VentasNuevaComponent>;
  let crearVenta: jasmine.Spy;
  const medicamento: CatalogoMedicamentoResponse = {
    idMedicamento: 77, codigo: 'MED-77', nombre: 'Medicamento', precioVenta: 5,
    marca: 'Marca', categoria: 'Categoría', descripcion: null, imagenURL: null, existenciaTotal: 4,
  };

  beforeEach(async () => {
    crearVenta = jasmine.createSpy('crearVenta').and.returnValue(of({
      idVenta: 90, idUsuario: 1, idSucursal: 3, fechaVenta: '2026-10-19T12:00:00', total: 5, detalles: [],
    }));
    await TestBed.configureTestingModule({
      imports: [VentasNuevaComponent],
      providers: [
        provideRouter([]),
        { provide: VentasService, useValue: {
          buscarMedicamentos: () => of({ items: [medicamento], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }),
          crearVenta,
        } },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([
            { idSucursal: 3, nombre: 'Central', direccion: null, activa: true },
            { idSucursal: 4, nombre: 'Anterior', direccion: null, activa: false },
          ]),
        } },
      ],
    }).compileComponents();
  });

  it('mantiene el carrito responsive y crea la venta con el ID real del medicamento', () => {
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(VentasNuevaComponent);
    fixture.detectChanges();
    fixture.componentInstance.idSucursal = 3;
    fixture.componentInstance.agregarAlCarrito(medicamento);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.ui-table-wrap')).not.toBeNull();
    expect(element.querySelector('[aria-label="Quitar medicamento"]')).not.toBeNull();
    fixture.componentInstance.confirmarVenta();
    expect(crearVenta).toHaveBeenCalledOnceWith({
      idSucursal: 3, items: [{ idMedicamento: 77, cantidad: 1 }],
    });
  });

  it('muestra sucursales descriptivas activas y rechaza una selección inactiva', () => {
    fixture = TestBed.createComponent(VentasNuevaComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(component.sucursales.map(item => item.idSucursal)).toEqual([3]);
    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#venta-sucursal option'),
    ).map(option => option.textContent?.trim());
    expect(options).toContain('Central');
    expect(options).not.toContain('Anterior');

    component.idSucursal = 4;
    component.agregarAlCarrito(medicamento);
    component.confirmarVenta();
    expect(component.error).toContain('sucursal activa');
    expect(crearVenta).not.toHaveBeenCalled();
  });
});
