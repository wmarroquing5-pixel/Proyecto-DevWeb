import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PermisosService } from '../../core/services/permisos.service';
import { TurnosAdminComponent } from './turnos-admin.component';

describe('TurnosAdminComponent', () => {
  let fixture: ComponentFixture<TurnosAdminComponent>;
  let component: TurnosAdminComponent;
  let service: jasmine.SpyObj<CatalogosService>;
  const item = {
    idTurno: 6, nombre: 'Diurno', codigo: 'D1', horaEntrada: '08:00:00',
    horaSalida: '16:00:00', jornada: 'Diurna' as const, activo: true,
  };
  const page = { items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };

  beforeEach(async () => {
    service = jasmine.createSpyObj<CatalogosService>('CatalogosService', [
      'listarTurnos', 'crearTurno', 'actualizarTurno', 'desactivarTurno',
    ]);
    service.listarTurnos.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [TurnosAdminComponent],
      providers: [
        { provide: CatalogosService, useValue: service },
        { provide: PermisosService, useValue: {
          puedeCrear: () => true, puedeModificar: () => true, puedeEliminar: () => true,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TurnosAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista y presenta horario, jornada e identificador reales', () => {
    expect(component.rows[0]).toEqual({
      id: 6,
      label: 'Diurno',
      activa: true,
      values: { nombre: 'Diurno', codigo: 'D1', horario: '08:00–16:00', jornada: 'Diurna' },
    });
    component.load(2);
    expect(service.listarTurnos).toHaveBeenCalledWith(2, 20);
  });

  it('crea una sola vez con jornada tipada y horas compatibles con TimeOnly', () => {
    const pending = new Subject<typeof item>();
    service.crearTurno.and.returnValue(pending);
    component.openCreate();
    component.form.setValue({
      nombre: 'Nocturno', codigo: 'N1', horaEntrada: '18:00', horaSalida: '06:00', jornada: 'Nocturna',
    });
    component.save();
    component.save();
    expect(service.crearTurno).toHaveBeenCalledOnceWith({
      nombre: 'Nocturno', codigo: 'N1', horaEntrada: '18:00:00',
      horaSalida: '06:00:00', jornada: 'Nocturna',
    });
    pending.next(item);
    pending.complete();
  });

  it('edita sin enviar un indicador de reactivación', () => {
    service.actualizarTurno.and.returnValue(of(item));
    component.openEdit(6);
    component.form.controls.nombre.setValue('Diurno actualizado');
    component.save();
    expect(service.actualizarTurno).toHaveBeenCalledOnceWith(6, {
      nombre: 'Diurno actualizado', codigo: 'D1', horaEntrada: '08:00:00',
      horaSalida: '16:00:00', jornada: 'Diurna',
    });
    expect('activo' in service.actualizarTurno.calls.mostRecent().args[1]).toBeFalse();
  });

  it('permite la baja lógica y no expone una operación de reactivación', () => {
    service.desactivarTurno.and.returnValue(of(void 0));
    component.deactivate(6);
    expect(service.desactivarTurno).toHaveBeenCalledOnceWith(6);
    expect('reactivate' in component).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label^="Reactivar"]')).toBeNull();
  });

  it('valida campos requeridos y presenta restricciones HTTP', () => {
    component.openCreate();
    component.save();
    expect(service.crearTurno).not.toHaveBeenCalled();
    component.form.setValue({
      nombre: 'Diurno', codigo: 'D1', horaEntrada: '08:00', horaSalida: '16:00', jornada: 'Diurna',
    });
    service.crearTurno.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { detail: 'El código del turno ya está registrado.' },
    })));
    component.save();
    expect(component.operationError).toBe('El código del turno ya está registrado.');
  });
});
