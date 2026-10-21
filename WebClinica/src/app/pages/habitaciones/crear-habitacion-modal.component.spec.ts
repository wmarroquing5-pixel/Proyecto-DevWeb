import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { CatalogosService } from '../../core/services/catalogos.service';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { PermisosService } from '../../core/services/permisos.service';
import { CrearHabitacionModalComponent } from './crear-habitacion-modal.component';

describe('CrearHabitacionModalComponent selector de sucursal', () => {
  let fixture: ComponentFixture<CrearHabitacionModalComponent>;
  let crearHabitacion: jasmine.Spy;

  beforeEach(async () => {
    crearHabitacion = jasmine.createSpy('crearHabitacion').and.returnValue(of({
      idHabitacion: 1, idSucursal: 5, numeroHabitacion: '101', tipoHabitacion: null,
      estado: 'Libre', activa: true,
    }));
    await TestBed.configureTestingModule({
      imports: [CrearHabitacionModalComponent],
      providers: [
        { provide: HabitacionesService, useValue: { crearHabitacion } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.SUCURSALES,
        } },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([
            { idSucursal: 5, nombre: 'Norte', direccion: null, activa: true },
            { idSucursal: 6, nombre: 'Antigua', direccion: null, activa: false },
          ]),
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CrearHabitacionModalComponent);
    fixture.detectChanges();
  });

  it('muestra sucursales activas y envía el identificador real', () => {
    const component = fixture.componentInstance;
    expect(component.sucursales.map(item => item.idSucursal)).toEqual([5]);
    component.request.idSucursal = 5;
    component.request.numeroHabitacion = '101';
    component.crear();
    expect(crearHabitacion).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      idSucursal: 5, numeroHabitacion: '101',
    }));
  });

  it('rechaza una sucursal inactiva', () => {
    const component = fixture.componentInstance;
    component.request.idSucursal = 6;
    component.request.numeroHabitacion = '102';
    component.crear();
    expect(component.error).toContain('sucursal activa');
    expect(crearHabitacion).not.toHaveBeenCalled();
  });
});
