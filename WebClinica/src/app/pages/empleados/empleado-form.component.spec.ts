import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PermisosService } from '../../core/services/permisos.service';
import { EmpleadoFormComponent } from './empleado-form.component';

describe('EmpleadoFormComponent: catálogos descriptivos', () => {
  const sucursales = [
    { idSucursal: 1, nombre: 'Central', direccion: null, activa: true },
    { idSucursal: 9, nombre: 'Anterior', direccion: null, activa: false },
  ];
  const especialidades = [
    { idEspecialidad: 2, nombre: 'Cardiología', activa: true },
    { idEspecialidad: 8, nombre: 'Retirada', activa: false },
  ];
  const turnos = [
    { idTurno: 3, nombre: 'Diurno', codigo: 'D', horaEntrada: '08:00', horaSalida: '16:00', jornada: 'Diurna', activo: true },
    { idTurno: 7, nombre: 'Anterior', codigo: 'A', horaEntrada: '08:00', horaSalida: '16:00', jornada: 'Diurna', activo: false },
  ];
  const empleado = {
    idEmpleado: 12, idSucursal: 1, idEspecialidad: 2, nombres: 'Lucía',
    apellidos: 'Gómez', dpi: '123', tipoEmpleado: 'Medico', activo: true,
    fechaIngreso: '2026-01-02', tipoSangre: 'O+', idTurno: 3,
    direccion: 'Zona 1', telefono: '55550000', correoElectronico: 'lucia@example.com',
  };

  function configure(options: {
    routeId?: string | null;
    permisos?: Partial<Record<string, boolean>>;
    sucursales$?: Observable<unknown>;
    especialidades$?: Observable<unknown>;
    turnos$?: Observable<unknown>;
    empleado$?: Observable<unknown>;
    crear$?: Observable<unknown>;
    actualizar$?: Observable<unknown>;
  } = {}) {
    const authenticated = signal(true);
    const token = signal<string | null>('session-one');
    const currentUser = signal({ idUsuario: 1, idRol: 2, username: 'admin' });
    const permissionState = signal<Record<string, boolean>>({
      [MODULOS_PERMISO.EMPLEADOS]: true,
      [MODULOS_PERMISO.SUCURSALES]: true,
      [MODULOS_PERMISO.ESPECIALIDADES]: true,
      [MODULOS_PERMISO.TURNOS]: true,
      ...options.permisos,
    });
    const getSucursales = jasmine.createSpy('getSucursales')
      .and.returnValue(options.sucursales$ ?? of(sucursales));
    const getEspecialidades = jasmine.createSpy('getEspecialidades')
      .and.returnValue(options.especialidades$ ?? of(especialidades));
    const getTurnos = jasmine.createSpy('getTurnos')
      .and.returnValue(options.turnos$ ?? of(turnos));
    const obtener = jasmine.createSpy('obtener').and.returnValue(options.empleado$ ?? of(empleado));
    const crear = jasmine.createSpy('crear').and.returnValue(options.crear$ ?? of(empleado));
    const actualizar = jasmine.createSpy('actualizar').and.returnValue(options.actualizar$ ?? of(empleado));

    TestBed.configureTestingModule({
      imports: [EmpleadoFormComponent],
      providers: [
        provideRouter([]),
        ApiErrorService,
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: () => options.routeId ?? null } },
        } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: authenticated,
          currentUser,
          get token(): string | null { return token(); },
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => permissionState()[modulo] ?? false,
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.EMPLEADOS
            && (permissionState()[modulo] ?? false),
          puedeModificar: (modulo: string) => modulo === MODULOS_PERMISO.EMPLEADOS
            && (permissionState()[modulo] ?? false),
        } },
        { provide: CatalogosService, useValue: { getSucursales, getEspecialidades, getTurnos } },
        { provide: EmpleadosService, useValue: { obtener, crear, actualizar } },
      ],
    });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(EmpleadoFormComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      token,
      permissionState,
      getSucursales,
      getEspecialidades,
      getTurnos,
      crear,
      actualizar,
      navigate,
    };
  }

  function fillRequired(component: EmpleadoFormComponent): void {
    component.form.nombres = 'Lucía';
    component.form.apellidos = 'Gómez';
    component.form.dpi = '123';
    component.form.tipoEmpleado = 'Medico';
    component.form.idSucursal = 1;
  }

  it('muestra sucursal, especialidad y turno por sus descripciones', () => {
    const { fixture } = configure();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Central');
    expect(text).toContain('Cardiología');
    expect(text).toContain('Diurno (Diurna)');
    expect(fixture.nativeElement.querySelector('input[name="idSucursal"]')).toBeNull();
  });

  it('crea con los IDs reales y relaciones opcionales nulas', () => {
    const { component, crear } = configure();
    fillRequired(component);
    component.form.idEspecialidad = null;
    component.form.idTurno = null;
    component.guardar();
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      idSucursal: 1, idEspecialidad: null, idTurno: null,
    }));
  });

  it('preselecciona IDs reales durante edición', () => {
    const { component, actualizar } = configure({ routeId: '12' });
    expect(component.form.idSucursal).toBe(1);
    expect(component.form.idEspecialidad).toBe(2);
    expect(component.form.idTurno).toBe(3);
    component.guardar();
    expect(actualizar).toHaveBeenCalledWith(12, jasmine.objectContaining({
      idSucursal: 1, idEspecialidad: 2, idTurno: 3,
    }));
  });

  it('conserva relaciones inactivas previamente guardadas', () => {
    const anterior = { ...empleado, idSucursal: 9, idEspecialidad: 8, idTurno: 7 };
    const { component } = configure({ routeId: '12', empleado$: of(anterior) });
    expect(component.sucursalesDisponibles.some(item => item.idSucursal === 9)).toBeTrue();
    expect(component.especialidadesDisponibles.some(item => item.idEspecialidad === 8)).toBeTrue();
    expect(component.turnosDisponibles.some(item => item.idTurno === 7)).toBeTrue();
    expect(component.puedeGuardar).toBeTrue();
  });

  it('no ofrece relaciones inactivas para una alta nueva', () => {
    const { component } = configure();
    expect(component.sucursalesDisponibles.map(item => item.idSucursal)).toEqual([1]);
    expect(component.especialidadesDisponibles.map(item => item.idEspecialidad)).toEqual([2]);
    expect(component.turnosDisponibles.map(item => item.idTurno)).toEqual([3]);
  });

  it('representa estado vacío y error recuperable por catálogo', () => {
    const { component } = configure({
      sucursales$: of([]),
      especialidades$: throwError(() => new Error('fallo')),
    });
    expect(component.estadoSucursales).toBe('empty');
    expect(component.estadoEspecialidades).toBe('error');
  });

  it('no consulta un catálogo si falta su permiso real', () => {
    const { component, getSucursales, getEspecialidades, getTurnos } = configure({
      permisos: { [MODULOS_PERMISO.ESPECIALIDADES]: false },
    });
    expect(getSucursales).toHaveBeenCalled();
    expect(getEspecialidades).not.toHaveBeenCalled();
    expect(getTurnos).toHaveBeenCalled();
    expect(component.estadoEspecialidades).toBe('unauthorized');
    expect(component.puedeGuardar).toBeFalse();
  });

  it('bloquea una selección inválida ausente del catálogo', () => {
    const { component, crear } = configure();
    fillRequired(component);
    component.form.idSucursal = 999;
    component.guardar();
    expect(crear).not.toHaveBeenCalled();
    expect(component.error).toContain('Revisa las relaciones');
  });

  it('impide doble envío y conserva el detalle ProblemDetails', () => {
    const response = new Subject<unknown>();
    const { component, crear } = configure({ crear$: response });
    fillRequired(component);
    component.guardar();
    component.guardar();
    expect(crear).toHaveBeenCalledTimes(1);
    response.error(new HttpErrorResponse({
      status: 409,
      error: { detail: 'El DPI ya está registrado.' },
    }));
    expect(component.error).toContain('DPI ya está registrado');
    expect(component.guardando).toBeFalse();
  });

  it('descarta respuestas tardías al cambiar la sesión', () => {
    const response = new Subject<unknown>();
    const { fixture, component, token } = configure({ sucursales$: response });
    token.set('session-two');
    fixture.detectChanges();
    response.next(sucursales);
    expect(component.sucursales).toEqual([]);
    expect(component.error).toContain('sesión cambió');
  });

  it('limpia los catálogos cuando se revoca una autorización', () => {
    const { fixture, component, permissionState } = configure();
    permissionState.update(value => ({ ...value, [MODULOS_PERMISO.TURNOS]: false }));
    fixture.detectChanges();
    expect(component.turnos).toEqual([]);
    expect(component.estadoTurnos).toBe('unauthorized');
  });
});
