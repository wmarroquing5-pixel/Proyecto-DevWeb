import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { EmpleadosService } from '../../core/services/empleado.service';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { PagedResponse, UsuarioResponse } from '../../core/models/usuario.model';
import { UsuariosComponent } from './usuarios.component';

describe('UsuariosComponent: descripciones relacionadas', () => {
  let fixture: ComponentFixture<UsuariosComponent>;
  let listarUsuarios: jasmine.Spy;
  let eliminarUsuario: jasmine.Spy;
  let listarRoles: jasmine.Spy;
  let listarEmpleados: jasmine.Spy;
  let permisosConsulta: Set<string>;
  let puedeCrear: boolean;
  let puedeModificar: boolean;
  let puedeEliminar: boolean;
  let sessionActive: boolean;
  let sessionToken: string | null;

  const usuarios: UsuarioResponse[] = [
    { idUsuario: 7, idRol: 2, username: 'medico.usuario', idEmpleado: 10, activo: true },
    { idUsuario: 8, idRol: 99, username: 'sin.catalogo', idEmpleado: 999, activo: true },
    { idUsuario: 9, idRol: 2, username: 'sin.empleado', idEmpleado: null, activo: false },
  ];
  const rol = { idRol: 2, nombre: 'Doctor', activo: true };
  const empleado = {
    idEmpleado: 10, idSucursal: 1, nombres: 'Ana', apellidos: 'López',
    tipoEmpleado: 'Medico', activo: true,
  };

  function page<T>(
    items: T[], pageNumber = 1, pageSize = 10, totalCount = items.length,
  ): PagedResponse<T> {
    return {
      items, page: pageNumber, pageSize, totalCount,
      totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    };
  }

  beforeEach(async () => {
    permisosConsulta = new Set([MODULOS_PERMISO.ROLES, MODULOS_PERMISO.EMPLEADOS]);
    puedeCrear = false;
    puedeModificar = false;
    puedeEliminar = false;
    sessionActive = true;
    sessionToken = 'test-token';
    listarUsuarios = jasmine.createSpy('listarUsuarios')
      .and.returnValue(of(page(usuarios, 1, 10, 12)));
    eliminarUsuario = jasmine.createSpy('eliminarUsuario').and.returnValue(of(void 0));
    listarRoles = jasmine.createSpy('listarRoles')
      .and.returnValue(of(page([rol], 1, 100)));
    listarEmpleados = jasmine.createSpy('listarEmpleados')
      .and.returnValue(of(page([empleado], 1, 100)));

    await TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [
        provideRouter([]),
        { provide: UsuariosService, useValue: {
          listar: listarUsuarios,
          eliminar: eliminarUsuario,
        } },
        { provide: RolesService, useValue: { listarRoles } },
        { provide: EmpleadosService, useValue: { listar: listarEmpleados } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => permisosConsulta.has(modulo),
          puedeCrear: () => puedeCrear,
          puedeModificar: () => puedeModificar,
          puedeEliminar: () => puedeEliminar,
        } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => sessionActive,
          currentUser: () => sessionActive ? { idUsuario: 1 } : null,
          get token(): string | null { return sessionToken; },
        } },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(UsuariosComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function cells(element: HTMLElement, row: number): HTMLTableCellElement[] {
    const rows = element.querySelectorAll<HTMLTableRowElement>('tbody tr');
    return Array.from(rows[row].querySelectorAll<HTMLTableCellElement>('td'));
  }

  it('sustituye los encabezados de identificadores por descripciones', () => {
    const headers = Array.from(render().querySelectorAll('th')).map(th => th.textContent?.trim());
    expect(headers).toEqual(['No.', 'Usuario', 'Rol', 'Tipo de empleado', 'Estado', 'Acciones']);
    expect(headers).not.toContain('ID Rol');
    expect(headers).not.toContain('ID Empleado');
  });

  it('muestra el nombre real del rol y el tipo real del empleado', () => {
    const row = cells(render(), 0);
    expect(row[2].textContent?.trim()).toBe('Doctor');
    expect(row[3].textContent?.trim()).toBe('Medico');
    expect(row[2].textContent).not.toContain('2');
    expect(row[3].textContent).not.toContain('10');
  });

  it('distingue relaciones inexistentes y relaciones nulas', () => {
    const element = render();
    expect(cells(element, 1)[2].textContent?.trim()).toBe('No disponible');
    expect(cells(element, 1)[3].textContent?.trim()).toBe('No disponible');
    expect(cells(element, 2)[3].textContent?.trim()).toBe('Sin relación');
  });

  it('no consulta catálogos sin permiso y lo indica sin inventar nombres', () => {
    permisosConsulta.clear();
    const element = render();
    expect(listarRoles).not.toHaveBeenCalled();
    expect(listarEmpleados).not.toHaveBeenCalled();
    expect(cells(element, 0)[2].textContent?.trim()).toBe('Sin autorización');
    expect(cells(element, 0)[3].textContent?.trim()).toBe('Sin autorización');
    expect(cells(element, 2)[3].textContent?.trim()).toBe('Sin relación');
  });

  it('conserva usuarios cuando falla el catálogo de roles', () => {
    listarRoles.and.returnValue(throwError(() => new Error('roles')));
    const element = render();
    expect(element.textContent).toContain('medico.usuario');
    expect(cells(element, 0)[2].textContent?.trim()).toBe('No disponible');
    expect(cells(element, 0)[3].textContent?.trim()).toBe('Medico');
  });

  it('conserva usuarios cuando falla el catálogo de empleados', () => {
    listarEmpleados.and.returnValue(throwError(() => new Error('empleados')));
    const element = render();
    expect(element.textContent).toContain('medico.usuario');
    expect(cells(element, 0)[2].textContent?.trim()).toBe('Doctor');
    expect(cells(element, 0)[3].textContent?.trim()).toBe('No disponible');
  });

  it('recorre páginas acotadas hasta encontrar un rol relacionado', () => {
    listarRoles.and.callFake((pageNumber: number) => pageNumber === 1
      ? of(page([], 1, 100, 101))
      : of(page([rol], 2, 100, 101)));
    const element = render();
    expect(listarRoles.calls.allArgs()).toEqual([[1, 100], [2, 100]]);
    expect(cells(element, 0)[2].textContent?.trim()).toBe('Doctor');
  });

  it('realiza una carga de cada catálogo y ninguna petición por fila', () => {
    render();
    expect(listarUsuarios).toHaveBeenCalledTimes(1);
    expect(listarRoles).toHaveBeenCalledTimes(1);
    expect(listarEmpleados).toHaveBeenCalledTimes(1);
  });

  it('mantiene paginación y actualiza las descripciones de la página nueva', () => {
    listarUsuarios.and.callFake((pageNumber: number, pageSize: number) => pageNumber === 1
      ? of(page(usuarios, 1, pageSize, 12))
      : of(page([
        { idUsuario: 12, idRol: 3, username: 'administrativo', idEmpleado: null, activo: true },
      ], 2, pageSize, 12)));
    listarRoles.and.callFake((_page: number, pageSize: number) => of(page([
      rol, { idRol: 3, nombre: 'Administrador', activo: true },
    ], 1, pageSize)));
    const element = render();
    fixture.componentInstance.cambiarPagina(2);
    fixture.detectChanges();
    expect(listarUsuarios).toHaveBeenCalledWith(2, 10);
    expect(cells(element, 0)[0].textContent?.trim()).toBe('11');
    expect(element.textContent).toContain('administrativo');
    expect(cells(element, 0)[2].textContent?.trim()).toBe('Administrador');
  });

  it('confirma la eliminación utilizando el ID real y vuelve a actualizar catálogos', () => {
    puedeEliminar = true;
    render();
    fixture.componentInstance.solicitarEliminacion(usuarios[1]);
    fixture.componentInstance.confirmarEliminacion();
    expect(eliminarUsuario).toHaveBeenCalledOnceWith(8);
    expect(listarUsuarios).toHaveBeenCalledTimes(2);
    expect(listarRoles).toHaveBeenCalledTimes(2);
    expect(listarEmpleados).toHaveBeenCalledTimes(2);
  });

  it('actualiza nombres después de una recarga confirmada', () => {
    const element = render();
    expect(cells(element, 0)[2].textContent?.trim()).toBe('Doctor');
    listarRoles.and.returnValue(of(page([{ ...rol, nombre: 'Médico clínico' }], 1, 100)));
    fixture.componentInstance.cargarUsuarios();
    fixture.detectChanges();
    expect(cells(element, 0)[2].textContent?.trim()).toBe('Médico clínico');
  });

  it('ignora una respuesta tardía de una carga anterior', () => {
    const primera = new Subject<PagedResponse<UsuarioResponse>>();
    listarUsuarios.and.returnValues(
      primera.asObservable(),
      of(page([{ ...usuarios[0], username: 'sesion.actual' }], 1, 10)),
    );
    const element = render();
    sessionToken = 'new-session-token';
    fixture.componentInstance.cargarUsuarios();
    fixture.detectChanges();
    primera.next(page([{ ...usuarios[0], username: 'respuesta.antigua' }], 1, 10));
    primera.complete();
    fixture.detectChanges();
    expect(element.textContent).toContain('sesion.actual');
    expect(element.textContent).not.toContain('respuesta.antigua');
  });

  it('ignora resultados que llegan después del logout', () => {
    const pending = new Subject<PagedResponse<UsuarioResponse>>();
    listarUsuarios.and.returnValue(pending.asObservable());
    const element = render();
    sessionActive = false;
    sessionToken = null;
    pending.next(page(usuarios, 1, 10));
    pending.complete();
    fixture.detectChanges();
    expect(element.querySelector('tbody tr')).toBeNull();
  });

  it('conserva la visibilidad dinámica de las operaciones CRUD', () => {
    puedeCrear = true;
    puedeModificar = true;
    puedeEliminar = true;
    const element = render();
    expect(element.textContent).toContain('Nuevo Usuario');
    expect(element.querySelector('[aria-label="Editar usuario"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Eliminar usuario"]')).not.toBeNull();
  });
});
