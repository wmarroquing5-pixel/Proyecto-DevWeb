import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Observable, of, throwError } from 'rxjs';
import {
  ActualizarLoteMedicamentoRequest,
  LoteMedicamentoResponse,
} from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { InventarioService } from '../../core/services/inventario.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PermisosService } from '../../core/services/permisos.service';
import { LoteFormComponent } from './lote-form.component';

describe('LoteFormComponent: ajuste de existencia', () => {
  let fixture: ComponentFixture<LoteFormComponent>;
  let actualizarLote: jasmine.Spy<(id: number, body: ActualizarLoteMedicamentoRequest) => Observable<LoteMedicamentoResponse>>;
  let modificar: WritableSignal<boolean>;
  let navigate: jasmine.Spy;

  const lote: LoteMedicamentoResponse = {
    idLote: 7,
    idMedicamento: 3,
    numeroLote: 'LT-007',
    fechaIngreso: '2026-10-01',
    fechaVencimiento: '2027-10-01',
    cantidadDisponible: 25,
  };

  beforeEach(() => {
    modificar = signal(true);
    navigate = jasmine.createSpy('navigate');
    actualizarLote = jasmine.createSpy('actualizarLote').and.returnValue(of(lote));
    TestBed.configureTestingModule({
      imports: [LoteFormComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '7' } } } },
        { provide: PermisosService, useValue: {
          puedeCrear: () => true,
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.SUCURSALES,
          puedeModificar: (modulo: string) => modulo === MODULOS_PERMISO.LOTES_MEDICAMENTO
            && modificar(),
        } },
        { provide: InventarioService, useValue: {
          listarMedicamentos: () => of({
            items: [{
              idMedicamento: 3, idCategoria: 1, idMarca: 1, codigo: 'MED-3',
              nombre: 'Paracetamol', descripcion: null, precioVenta: 12.5,
              imagenURL: null, activo: false,
            }, {
              idMedicamento: 4, idCategoria: 1, idMarca: 1, codigo: 'MED-4',
              nombre: 'Ibuprofeno', descripcion: null, precioVenta: 10,
              imagenURL: null, activo: true,
            }],
            page: 1, pageSize: 100, totalCount: 2, totalPages: 1,
          }),
          obtenerLote: () => of(lote),
          actualizarLote,
          crearLote: jasmine.createSpy('crearLote'),
        } },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([
            { idSucursal: 2, nombre: 'Central', direccion: null, activa: true },
            { idSucursal: 9, nombre: 'Cerrada', direccion: null, activa: false },
          ]),
        } },
      ],
    });
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function render(): LoteFormComponent {
    fixture = TestBed.createComponent(LoteFormComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('conserva cantidadEsperada al cargar el lote', () => {
    const component = render();
    expect(component.cantidadEsperada).toBe(25);
    expect(component.form.cantidadDisponible).toBe(25);
    expect(component.requiereTrazabilidad).toBeFalse();
    expect(component.medicamentosDisponibles.map(item => item.idMedicamento)).toEqual([3, 4]);
  });

  it('exige sucursal y justificación cuando cambia la existencia', () => {
    const component = render();
    component.form.cantidadDisponible = 24;
    component.alCambiarCantidad();
    component.guardar();
    expect(component.error).toContain('sucursal y la justificación');
    expect(actualizarLote).not.toHaveBeenCalled();
  });

  it('respeta la cancelación de un ajuste sensible', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const component = render();
    component.form.cantidadDisponible = 24;
    component.alCambiarCantidad();
    component.form.idSucursal = 2;
    component.form.observaciones = 'Conteo físico';
    component.guardar();
    expect(actualizarLote).not.toHaveBeenCalled();
  });

  it('envía ajuste, cantidad esperada, sucursal y justificación', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const component = render();
    component.form.cantidadDisponible = 24;
    component.alCambiarCantidad();
    component.form.idSucursal = 2;
    component.form.observaciones = 'Conteo físico';
    component.guardar();
    expect(actualizarLote).toHaveBeenCalledOnceWith(7, jasmine.objectContaining({
      cantidadDisponible: 24,
      cantidadEsperada: 25,
      idSucursal: 2,
      observaciones: 'Conteo físico',
    }));
    expect(navigate).toHaveBeenCalledWith(['/inventario/lotes']);
  });

  it('bloquea el ajuste si se revoca LotesMedicamento/Modificar', () => {
    const component = render();
    modificar.set(false);
    component.form.cantidadDisponible = 24;
    component.alCambiarCantidad();
    component.form.idSucursal = 2;
    component.form.observaciones = 'Conteo físico';
    component.guardar();
    expect(actualizarLote).not.toHaveBeenCalled();
  });

  it('muestra el ProblemDetails de un conflicto de concurrencia', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    actualizarLote.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'La existencia del lote cambió. Recargue e intente nuevamente.' },
    })));
    const component = render();
    component.form.cantidadDisponible = 24;
    component.alCambiarCantidad();
    component.form.idSucursal = 2;
    component.form.observaciones = 'Conteo físico';
    component.guardar();
    expect(component.error).toContain('existencia del lote cambió');
    expect(component.cargando).toBeFalse();
  });

  it('solo permite sucursales activas para el ajuste', () => {
    const component = render();
    component.form.cantidadDisponible = 24;
    component.alCambiarCantidad();
    expect(component.sucursales.map(item => item.idSucursal)).toEqual([2]);
    component.form.idSucursal = 9;
    component.form.observaciones = 'Conteo físico';
    component.guardar();
    expect(component.error).toContain('sucursal y la justificación');
    expect(actualizarLote).not.toHaveBeenCalled();
  });
});
