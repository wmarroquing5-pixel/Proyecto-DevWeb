import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { MarcasAdminComponent } from './marcas-admin.component';

describe('MarcasAdminComponent', () => {
  let fixture: ComponentFixture<MarcasAdminComponent>;
  let component: MarcasAdminComponent;
  let service: jasmine.SpyObj<InventarioService>;
  const item = { idMarca: 7, nombre: 'Laboratorio Uno', activa: true };
  const page = { items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };

  beforeEach(async () => {
    service = jasmine.createSpyObj<InventarioService>('InventarioService', [
      'listarMarcas', 'crearMarca', 'actualizarMarca', 'desactivarMarca',
    ]);
    service.listarMarcas.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [MarcasAdminComponent],
      providers: [
        { provide: InventarioService, useValue: service },
        { provide: PermisosService, useValue: {
          puedeCrear: () => true, puedeModificar: () => true, puedeEliminar: () => true,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MarcasAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista y pagina manteniendo el identificador real', () => {
    expect(component.rows[0]).toEqual({
      id: 7, label: 'Laboratorio Uno', activa: true, values: { nombre: 'Laboratorio Uno' },
    });
    component.load(2);
    expect(service.listarMarcas).toHaveBeenCalledWith(2, 20);
  });

  it('crea una marca una sola vez', () => {
    const pending = new Subject<typeof item>();
    service.crearMarca.and.returnValue(pending);
    component.openCreate();
    component.form.controls.nombre.setValue('  Laboratorio Dos  ');
    component.save();
    component.save();
    expect(service.crearMarca).toHaveBeenCalledOnceWith({ nombre: 'Laboratorio Dos' });
    pending.next(item);
    pending.complete();
  });

  it('edita, desactiva y reactiva mediante los contratos existentes', () => {
    service.actualizarMarca.and.returnValue(of(item));
    service.desactivarMarca.and.returnValue(of(void 0));
    component.openEdit(7);
    component.form.controls.nombre.setValue('Laboratorio actualizado');
    component.save();
    expect(service.actualizarMarca).toHaveBeenCalledWith(7, {
      nombre: 'Laboratorio actualizado', activa: true,
    });
    component.deactivate(7);
    expect(service.desactivarMarca).toHaveBeenCalledOnceWith(7);
    component.items = [{ ...item, activa: false }];
    component.reactivate(7);
    expect(service.actualizarMarca).toHaveBeenCalledWith(7, {
      nombre: 'Laboratorio Uno', activa: true,
    });
  });

  it('muestra el conflicto por referencias sin convertirlo en éxito', () => {
    service.desactivarMarca.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'La marca tiene medicamentos activos.' },
    })));
    component.deactivate(7);
    expect(component.operationError).toBe('La marca tiene medicamentos activos.');
    expect(component.successMessage).toBe('');
  });

  it('valida el nombre antes de invocar la API', () => {
    component.openCreate();
    component.form.controls.nombre.setValue('');
    component.save();
    expect(service.crearMarca).not.toHaveBeenCalled();
    expect(component.form.controls.nombre.touched).toBeTrue();
  });
});
