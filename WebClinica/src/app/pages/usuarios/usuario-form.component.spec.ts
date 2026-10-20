import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { UsuarioFormComponent } from './usuario-form.component';

describe('UsuarioFormComponent: selectores descriptivos', () => {
  const roles = [
    { idRol: 2, nombre: 'Operador', activo: true },
    { idRol: 3, nombre: 'Médico', activo: true },
    { idRol: 4, nombre: 'Rol retirado', activo: false },
  ];
  const empleados = [
    { idEmpleado: 14, idSucursal: 1, nombres: 'Ana', apellidos: 'López', tipoEmpleado: 'Medico', activo: true },
    { idEmpleado: 21, idSucursal: 1, nombres: 'Ana', apellidos: 'Pérez', tipoEmpleado: 'Enfermera', activo: true },
  ];

  function configure(options: {
    routeId?: string | null;
    permisos?: Partial<Record<string, boolean>>;
    roles$?: Observable<readonly typeof roles[number][]>;
    empleados$?: Observable<unknown>;
    usuario$?: Observable<unknown>;
    empleadoDetalle$?: Observable<unknown>;
    crear$?: Observable<unknown>;
    actualizar$?: Observable<unknown>;
  } = {}) {
    const authenticated = signal(true);
    const token = signal<string | null>('session-one');
    const currentUser = signal({ idUsuario: 1, idRol: 2, username: 'admin' });
    const permissionState = signal<Record<string, boolean>>({
      [MODULOS_PERMISO.USUARIOS]: true,
      [MODULOS_PERMISO.ROLES]: true,
      [MODULOS_PERMISO.EMPLEADOS]: true,
      ...options.permisos,
    });
    const modificarRoles = signal(true);
    const listarTodosRoles = jasmine.createSpy('listarTodosRoles')
      .and.returnValue(options.roles$ ?? of(roles));
    const listarEmpleados = jasmine.createSpy('listarEmpleados')
      .and.returnValue(options.empleados$ ?? of({
        items: empleados, page: 1, pageSize: 20, totalCount: 2, totalPages: 1,
      }));
    const obtenerEmpleado = jasmine.createSpy('obtenerEmpleado')
      .and.returnValue(options.empleadoDetalle$ ?? of({
        ...empleados[0], dpi: '1', idEspecialidad: null, fechaIngreso: null,
        tipoSangre: null, idTurno: null, direccion: null, telefono: null,
        correoElectronico: null,
      }));
    const crear = jasmine.createSpy('crear').and.returnValue(options.crear$ ?? of({}));
    const actualizar = jasmine.createSpy('actualizar').and.returnValue(options.actualizar$ ?? of({}));
    const usuario = {
      idUsuario: 7, username: 'operador', idRol: 3, idEmpleado: 14, activo: true,
    };
    const obtenerUsuario = jasmine.createSpy('obtenerUsuario')
      .and.returnValue(options.usuario$ ?? of(usuario));

    TestBed.configureTestingModule({
      imports: [UsuarioFormComponent],
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
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.USUARIOS
            && (permissionState()[modulo] ?? false),
          puedeModificar: (modulo: string) => modulo === MODULOS_PERMISO.ROLES
            ? modificarRoles()
            : modulo === MODULOS_PERMISO.USUARIOS && (permissionState()[modulo] ?? false),
        } },
        { provide: RolesService, useValue: { listarTodosRoles } },
        { provide: EmpleadosService, useValue: {
          listar: listarEmpleados,
          obtener: obtenerEmpleado,
        } },
        { provide: UsuariosService, useValue: {
          obtener: obtenerUsuario,
          crear,
          actualizar,
        } },
      ],
    });
    const navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    const fixture = TestBed.createComponent(UsuarioFormComponent);
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      authenticated,
      token,
      currentUser,
      permissionState,
      modificarRoles,
      listarTodosRoles,
      listarEmpleados,
      obtenerEmpleado,
      crear,
      actualizar,
      navigate,
    };
  }

  it('muestra nombres de rol y empleados con información diferenciadora', () => {
    const { fixture } = configure();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Operador');
    expect(text).toContain('Ana López — Medico');
    expect(text).toContain('Ana Pérez — Enfermera');
    expect(fixture.nativeElement.querySelector('input[name="idRol"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[name="idEmpleado"]')).toBeNull();
  });

  it('crea con los IDs reales y permite una relación de empleado nula', () => {
    const { component, crear } = configure();
    component.form.username = 'nuevo';
    component.form.idRol = 3;
    component.form.idEmpleado = null;
    component.formPassword = 'Clave-segura-2026';
    component.guardar();
    expect(crear).toHaveBeenCalledOnceWith({
      username: 'nuevo', password: 'Clave-segura-2026', idRol: 3, idEmpleado: null,
    });
  });

  it('preselecciona una relación fuera de la página y conserva un empleado inactivo', () => {
    const inactivo = {
      idEmpleado: 14, idSucursal: 1, nombres: 'Ana', apellidos: 'López',
      tipoEmpleado: 'Medico', activo: false, dpi: '1', idEspecialidad: null,
      fechaIngreso: null, tipoSangre: null, idTurno: null, direccion: null,
      telefono: null, correoElectronico: null,
    };
    const { component, actualizar } = configure({
      routeId: '7',
      empleados$: of({ items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 }),
      empleadoDetalle$: of(inactivo),
    });
    expect(component.form.idEmpleado).toBe(14);
    expect(component.empleadosDisponibles[0].activo).toBeFalse();
    component.guardar();
    expect(actualizar).toHaveBeenCalledWith(7,
      jasmine.objectContaining({ idRol: 3, idEmpleado: 14 }));
  });

  it('bloquea un rol inactivo porque la API no permite asignarlo', () => {
    const { component, crear } = configure();
    component.form.username = 'nuevo';
    component.formPassword = 'Clave-segura-2026';
    component.form.idRol = 4;
    component.guardar();
    expect(crear).not.toHaveBeenCalled();
    expect(component.error).toContain('Revisa la selección');
  });

  it('representa catálogos vacíos y errores recuperables', () => {
    const { component } = configure({
      roles$: of([]),
      empleados$: throwError(() => new Error('fallo')),
    });
    expect(component.estadoRoles).toBe('empty');
    expect(component.estadoEmpleados).toBe('error');
  });

  it('no consulta catálogos sin sus permisos reales', () => {
    const { component, listarTodosRoles, listarEmpleados } = configure({
      permisos: { [MODULOS_PERMISO.ROLES]: false, [MODULOS_PERMISO.EMPLEADOS]: false },
    });
    expect(listarTodosRoles).not.toHaveBeenCalled();
    expect(listarEmpleados).not.toHaveBeenCalled();
    expect(component.estadoRoles).toBe('unauthorized');
    expect(component.estadoEmpleados).toBe('unauthorized');
  });

  it('debouncea la búsqueda remota y conserva la paginación del endpoint', fakeAsync(() => {
    const { component, listarEmpleados } = configure();
    listarEmpleados.calls.reset();
    component.programarBusquedaEmpleado('An');
    tick(150);
    component.programarBusquedaEmpleado('Ana');
    tick(299);
    expect(listarEmpleados).not.toHaveBeenCalled();
    tick(1);
    expect(listarEmpleados).toHaveBeenCalledOnceWith('Ana', undefined, undefined, true, 1, 20);
  }));

  it('impide el doble envío y muestra ProblemDetails', () => {
    const response = new Subject<unknown>();
    const { component, crear } = configure({ crear$: response });
    component.form.username = 'nuevo';
    component.formPassword = 'Clave-segura-2026';
    component.form.idRol = 3;
    component.guardar();
    component.guardar();
    expect(crear).toHaveBeenCalledTimes(1);
    response.error(new HttpErrorResponse({
      status: 409,
      error: { detail: 'El nombre de usuario ya existe.' },
    }));
    expect(component.error).toContain('ya existe');
    expect(component.guardando).toBeFalse();
  });

  it('descarta una respuesta tardía cuando cambia la sesión', () => {
    const rolesResponse = new Subject<readonly typeof roles[number][]>();
    const { fixture, component, token } = configure({ roles$: rolesResponse });
    token.set('session-two');
    fixture.detectChanges();
    rolesResponse.next(roles);
    expect(component.roles).toEqual([]);
    expect(component.error).toContain('sesión cambió');
  });

  it('limpia catálogos al revocarse el permiso durante la edición', () => {
    const { fixture, component, permissionState } = configure();
    permissionState.update(value => ({ ...value, [MODULOS_PERMISO.EMPLEADOS]: false }));
    fixture.detectChanges();
    expect(component.empleados).toEqual([]);
    expect(component.estadoEmpleados).toBe('unauthorized');
  });
});
