import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { AsignarPacienteModalComponent } from './asignar-paciente-modal.component';

describe('AsignarPacienteModalComponent selector de paciente', () => {
  let fixture: ComponentFixture<AsignarPacienteModalComponent>;
  let asignarPaciente: jasmine.Spy;
  let listar: jasmine.Spy;

  beforeEach(async () => {
    asignarPaciente = jasmine.createSpy('asignarPaciente').and.returnValue(of({
      idAsignacion: 9, idHabitacion: 7, idPaciente: 12,
      fechaIngreso: '2026-10-20T10:00:00', fechaEgreso: null, observaciones: null,
    }));
    listar = jasmine.createSpy('listar').and.returnValue(of({
      items: [
        { idPaciente: 12, nombres: 'Ana', apellidos: 'López', activo: true },
        { idPaciente: 13, nombres: 'Luis', apellidos: 'Pérez', activo: false },
      ], page: 1, pageSize: 50, totalCount: 2, totalPages: 1,
    }));
    await TestBed.configureTestingModule({
      imports: [AsignarPacienteModalComponent],
      providers: [
        { provide: HabitacionesService, useValue: { asignarPaciente } },
        { provide: PacientesService, useValue: { listar } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.PACIENTES,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(AsignarPacienteModalComponent);
    fixture.componentInstance.habitacion = {
      idHabitacion: 7, idSucursal: 1, numeroHabitacion: '101',
      tipoHabitacion: null, estado: 'Libre', activa: true,
    };
    fixture.detectChanges();
  });

  it('consulta pacientes activos y asigna el identificador seleccionado', () => {
    const component = fixture.componentInstance;
    expect(listar).toHaveBeenCalledOnceWith(undefined, true, 1, 50);
    expect(component.pacientes.map(item => item.idPaciente)).toEqual([12]);
    component.request.idPaciente = 12;
    component.asignar();
    expect(asignarPaciente).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      idHabitacion: 7, idPaciente: 12,
    }));
  });

  it('rechaza una selección inactiva y conserva la búsqueda descriptiva', () => {
    const component = fixture.componentInstance;
    component.request.idPaciente = 13;
    component.asignar();
    expect(component.error).toContain('paciente activo');
    expect(asignarPaciente).not.toHaveBeenCalled();

    component.busquedaPaciente = ' Ana ';
    component.cargarPacientes();
    expect(listar).toHaveBeenCalledWith('Ana', true, 1, 50);
  });
});
