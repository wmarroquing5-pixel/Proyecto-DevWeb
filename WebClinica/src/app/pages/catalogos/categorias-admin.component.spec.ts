import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { CategoriasAdminComponent } from './categorias-admin.component';

describe('CategoriasAdminComponent', () => {
  let fixture: ComponentFixture<CategoriasAdminComponent>;
  let component: CategoriasAdminComponent;
  let service: jasmine.SpyObj<InventarioService>;
  const item = { idCategoria: 12, nombre: 'Analgésicos', activa: true };
  const page = { items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };

  beforeEach(async () => {
    service = jasmine.createSpyObj<InventarioService>('InventarioService', [
      'listarCategorias', 'crearCategoria', 'actualizarCategoria', 'desactivarCategoria',
    ]);
    service.listarCategorias.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [CategoriasAdminComponent],
      providers: [
        { provide: InventarioService, useValue: service },
        { provide: PermisosService, useValue: {
          puedeCrear: () => true, puedeModificar: () => true, puedeEliminar: () => true,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(CategoriasAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista y pagina manteniendo el identificador real', () => {
    expect(service.listarCategorias).toHaveBeenCalledOnceWith(1, 20);
    expect(component.rows[0]).toEqual({
      id: 12, label: 'Analgésicos', activa: true, values: { nombre: 'Analgésicos' },
    });
    component.load(2);
    expect(service.listarCategorias).toHaveBeenCalledWith(2, 20);
  });

  it('crea una categoría una sola vez y normaliza el nombre', () => {
    const pending = new Subject<typeof item>();
    service.crearCategoria.and.returnValue(pending);
    component.openCreate();
    component.form.controls.nombre.setValue('  Antibióticos  ');
    component.save();
    component.save();
    expect(service.crearCategoria).toHaveBeenCalledOnceWith({ nombre: 'Antibióticos' });
    pending.next(item);
    pending.complete();
  });

  it('edita conservando el estado e identificador', () => {
    service.actualizarCategoria.and.returnValue(of(item));
    component.openEdit(12);
    component.form.controls.nombre.setValue('Analgésicos generales');
    component.save();
    expect(service.actualizarCategoria).toHaveBeenCalledOnceWith(12, {
      nombre: 'Analgésicos generales', activa: true,
    });
  });

  it('desactiva y conserva visible el conflicto por medicamentos activos', () => {
    service.desactivarCategoria.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'La categoría tiene medicamentos activos.' },
    })));
    component.deactivate(12);
    expect(service.desactivarCategoria).toHaveBeenCalledOnceWith(12);
    expect(component.operationError).toBe('La categoría tiene medicamentos activos.');
  });

  it('reactiva mediante PUT con el nombre vigente', () => {
    component.items = [{ ...item, activa: false }];
    service.actualizarCategoria.and.returnValue(of(item));
    component.reactivate(12);
    expect(service.actualizarCategoria).toHaveBeenCalledOnceWith(12, {
      nombre: 'Analgésicos', activa: true,
    });
  });

  it('no envía formularios inválidos', () => {
    component.openCreate();
    component.form.controls.nombre.setValue('');
    component.save();
    expect(service.crearCategoria).not.toHaveBeenCalled();
    expect(component.form.controls.nombre.touched).toBeTrue();
  });
});
