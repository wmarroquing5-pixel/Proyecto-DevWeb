import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PermisosService } from '../../core/services/permisos.service';
import { EspecialidadesAdminComponent } from './especialidades-admin.component';

describe('EspecialidadesAdminComponent', () => {
  let fixture: ComponentFixture<EspecialidadesAdminComponent>;
  let component: EspecialidadesAdminComponent;
  let service: jasmine.SpyObj<CatalogosService>;
  const item = { idEspecialidad: 4, nombre: 'Cardiología', activa: true };
  const page = { items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };

  beforeEach(async () => {
    service = jasmine.createSpyObj<CatalogosService>('CatalogosService', [
      'listarEspecialidades', 'crearEspecialidad', 'actualizarEspecialidad', 'desactivarEspecialidad',
    ]);
    service.listarEspecialidades.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [EspecialidadesAdminComponent],
      providers: [
        { provide: CatalogosService, useValue: service },
        { provide: PermisosService, useValue: {
          puedeCrear: () => true, puedeModificar: () => true, puedeEliminar: () => true,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(EspecialidadesAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista y pagina con el contrato real sin descripción ficticia', () => {
    expect(component.rows[0]).toEqual({
      id: 4, label: 'Cardiología', activa: true, values: { nombre: 'Cardiología' },
    });
    component.load(2);
    expect(service.listarEspecialidades).toHaveBeenCalledWith(2, 20);
  });

  it('crea una especialidad una sola vez', () => {
    const pending = new Subject<typeof item>();
    service.crearEspecialidad.and.returnValue(pending);
    component.openCreate();
    component.form.controls.nombre.setValue('  Pediatría  ');
    component.save();
    component.save();
    expect(service.crearEspecialidad).toHaveBeenCalledOnceWith({ nombre: 'Pediatría' });
    pending.next(item);
    pending.complete();
  });

  it('edita y conserva el estado actual', () => {
    service.actualizarEspecialidad.and.returnValue(of(item));
    component.openEdit(4);
    component.form.controls.nombre.setValue('Cardiología clínica');
    component.save();
    expect(service.actualizarEspecialidad).toHaveBeenCalledOnceWith(4, {
      nombre: 'Cardiología clínica', activa: true,
    });
  });

  it('desactiva y reactiva exclusivamente por las operaciones soportadas', () => {
    service.desactivarEspecialidad.and.returnValue(of(void 0));
    service.actualizarEspecialidad.and.returnValue(of(item));
    component.deactivate(4);
    expect(service.desactivarEspecialidad).toHaveBeenCalledOnceWith(4);
    component.reactivate(4);
    expect(service.actualizarEspecialidad).toHaveBeenCalledOnceWith(4, {
      nombre: 'Cardiología', activa: true,
    });
  });

  it('rechaza un formulario inválido y conserva el mensaje HTTP 409', () => {
    component.openCreate();
    component.save();
    expect(service.crearEspecialidad).not.toHaveBeenCalled();
    component.form.controls.nombre.setValue('Cardiología');
    service.crearEspecialidad.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { detail: 'La especialidad ya existe.' },
    })));
    component.save();
    expect(component.operationError).toBe('La especialidad ya existe.');
  });
});
