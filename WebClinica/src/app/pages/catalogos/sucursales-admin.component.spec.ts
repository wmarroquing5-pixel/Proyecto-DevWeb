import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PermisosService } from '../../core/services/permisos.service';
import { SucursalesAdminComponent } from './sucursales-admin.component';

describe('SucursalesAdminComponent', () => {
  let fixture: ComponentFixture<SucursalesAdminComponent>;
  let component: SucursalesAdminComponent;
  let service: jasmine.SpyObj<CatalogosService>;
  const central = { idSucursal: 8, nombre: 'Central', direccion: 'Zona 1', activa: true };
  const page = { items: [central], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };
  const permissions = {
    puedeCrear: () => true,
    puedeModificar: () => true,
    puedeEliminar: () => true,
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<CatalogosService>('CatalogosService', [
      'listarSucursales', 'crearSucursal', 'actualizarSucursal', 'desactivarSucursal',
    ]);
    service.listarSucursales.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [SucursalesAdminComponent],
      providers: [
        { provide: CatalogosService, useValue: service },
        { provide: PermisosService, useValue: permissions },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SucursalesAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista y pagina conservando el identificador real', () => {
    expect(service.listarSucursales).toHaveBeenCalledOnceWith(1, 20);
    expect(component.rows[0].id).toBe(8);
    component.load(2);
    expect(service.listarSucursales).toHaveBeenCalledWith(2, 20);
  });

  it('filtra la página actual por texto y estado sin agregar parámetros inexistentes', () => {
    component.items = [central, { idSucursal: 9, nombre: 'Norte', direccion: null, activa: false }];
    component.searchControl.setValue('zona');
    expect(component.rows.map(row => row.id)).toEqual([8]);
    component.searchControl.setValue('');
    component.statusControl.setValue('inactivos');
    expect(component.rows.map(row => row.id)).toEqual([9]);
  });

  it('crea una sucursal una sola vez y normaliza la dirección vacía', () => {
    const pending = new Subject<typeof central>();
    service.crearSucursal.and.returnValue(pending);
    component.openCreate();
    component.form.setValue({ nombre: '  Central  ', direccion: '   ' });
    component.save();
    component.save();
    expect(service.crearSucursal).toHaveBeenCalledOnceWith({ nombre: 'Central', direccion: null });
    pending.next(central);
    pending.complete();
    expect(component.formOpen).toBeFalse();
  });

  it('edita, desactiva y reactiva mediante los contratos permitidos', () => {
    service.actualizarSucursal.and.returnValue(of(central));
    service.desactivarSucursal.and.returnValue(of(void 0));
    component.openEdit(8);
    component.form.controls.nombre.setValue('Central Norte');
    component.save();
    expect(service.actualizarSucursal).toHaveBeenCalledWith(8, {
      nombre: 'Central Norte', direccion: 'Zona 1', activa: true,
    });
    component.deactivate(8);
    expect(service.desactivarSucursal).toHaveBeenCalledOnceWith(8);
    component.reactivate(8);
    expect(service.actualizarSucursal).toHaveBeenCalledWith(8, {
      nombre: 'Central', direccion: 'Zona 1', activa: true,
    });
  });

  it('valida el formulario y presenta errores ProblemDetails', () => {
    component.openCreate();
    component.form.controls.nombre.setValue('');
    component.save();
    expect(service.crearSucursal).not.toHaveBeenCalled();

    component.form.controls.nombre.setValue('Central');
    service.crearSucursal.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { title: 'Conflicto', detail: 'La sucursal ya existe.' },
    })));
    component.save();
    expect(component.operationError).toBe('La sucursal ya existe.');
  });
});
