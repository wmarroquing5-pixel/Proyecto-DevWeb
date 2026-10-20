import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NgForm } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { GuardarPermisoRolRequest, PermisoRolResponse } from '../../core/models/rol.model';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { PermisosComponent } from './permisos.component';

describe('PermisosComponent', () => {
  let fixture: ComponentFixture<PermisosComponent>;
  let puedeCrear: boolean;
  let puedeModificar: boolean;
  let puedeEliminar: boolean;

  const permiso: PermisoRolResponse = {
    idPermiso: 21,
    idRol: 2,
    modulo: 'ConsumoClinico',
    puedeConsultar: false,
    puedeCrear: true,
    puedeModificar: false,
    puedeEliminar: false,
  };
  const listarTodosRoles = jasmine.createSpy().and.returnValue(of([
    { idRol: 1, nombre: 'Administrador', activo: true },
    { idRol: 2, nombre: 'MEDICO', activo: true },
  ]));
  const listarModulosPermiso = jasmine.createSpy().and.returnValue(of([
    'ConsumoClinico', 'Pacientes', 'Permisos',
  ]));
  const listarPermisos = jasmine.createSpy().and.returnValue(of({
    items: [permiso], page: 1, pageSize: 10, totalCount: 1, totalPages: 1,
  }));
  const crearPermiso = jasmine.createSpy().and.returnValue(of(permiso));
  const actualizarPermiso = jasmine.createSpy().and.returnValue(of(permiso));
  const eliminarPermiso = jasmine.createSpy().and.returnValue(of(undefined));
  const revalidarAhora = jasmine.createSpy().and.returnValue(of(true));

  beforeEach(async () => {
    puedeCrear = false;
    puedeModificar = false;
    puedeEliminar = false;
    listarTodosRoles.calls.reset();
    listarModulosPermiso.calls.reset();
    listarPermisos.calls.reset();
    crearPermiso.calls.reset();
    actualizarPermiso.calls.reset();
    eliminarPermiso.calls.reset();
    revalidarAhora.calls.reset();
    listarTodosRoles.and.returnValue(of([
      { idRol: 1, nombre: 'Administrador', activo: true },
      { idRol: 2, nombre: 'MEDICO', activo: true },
    ]));
    listarModulosPermiso.and.returnValue(of(['ConsumoClinico', 'Pacientes', 'Permisos']));
    listarPermisos.and.returnValue(of({
      items: [permiso], page: 1, pageSize: 10, totalCount: 1, totalPages: 1,
    }));

    await TestBed.configureTestingModule({
      imports: [PermisosComponent],
      providers: [
        { provide: RolesService, useValue: {
          listarTodosRoles, listarModulosPermiso, listarPermisos,
          crearPermiso, actualizarPermiso, eliminarPermiso,
        } },
        { provide: PermisosService, useValue: {
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.PERMISOS && puedeCrear,
          puedeModificar: (modulo: string) => modulo === MODULOS_PERMISO.PERMISOS && puedeModificar,
          puedeEliminar: (modulo: string) => modulo === MODULOS_PERMISO.PERMISOS && puedeEliminar,
        } },
        { provide: AutorizacionActualizacionService, useValue: { revalidarAhora } },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(PermisosComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function validForm(): NgForm {
    return { invalid: false } as NgForm;
  }

  it('carga roles, módulos autorizados y asignaciones paginadas', () => {
    const element = render();
    expect(listarTodosRoles).toHaveBeenCalledTimes(1);
    expect(listarModulosPermiso).toHaveBeenCalledTimes(1);
    expect(listarPermisos).toHaveBeenCalledWith(1, 10, { idRol: undefined, modulo: undefined });
    expect(element.textContent).toContain('MEDICO');
    expect(element.textContent).toContain('Consumo clínico');
  });

  it('carga permisos aunque exista un rol heredado sin nombre y lo identifica por ID', () => {
    listarTodosRoles.and.returnValue(of([
      { idRol: 1, nombre: 'Administrador', activo: true },
      { idRol: 7, nombre: '', activo: false },
    ]));
    const element = render();
    expect(element.textContent).toContain('Rol sin nombre (ID 7)');
    expect(element.textContent).toContain('Consumo clínico');
  });

  it('aplica los filtros de rol y módulo en la consulta HTTP', () => {
    render();
    fixture.componentInstance.filtroRol = 2;
    fixture.componentInstance.filtroModulo = 'ConsumoClinico';
    fixture.componentInstance.aplicarFiltros();
    expect(listarPermisos).toHaveBeenCalledWith(1, 10, {
      idRol: 2,
      modulo: 'ConsumoClinico',
    });
  });

  it('crea una asignación con el DTO real y revalida la autorización', () => {
    puedeCrear = true;
    render();
    fixture.componentInstance.abrirCrear();
    fixture.componentInstance.formulario = {
      idRol: 2, modulo: 'Pacientes', puedeConsultar: true,
      puedeCrear: false, puedeModificar: true, puedeEliminar: false,
    };
    fixture.componentInstance.guardar(validForm());
    const expected: GuardarPermisoRolRequest = {
      idRol: 2, modulo: 'Pacientes', puedeConsultar: true,
      puedeCrear: false, puedeModificar: true, puedeEliminar: false,
    };
    expect(crearPermiso).toHaveBeenCalledWith(expected);
    expect(revalidarAhora).toHaveBeenCalled();
  });

  it('edita utilizando el identificador real y descarta operaciones inexistentes', () => {
    puedeModificar = true;
    render();
    fixture.componentInstance.abrirEditar(permiso);
    fixture.componentInstance.formulario.puedeModificar = true;
    fixture.componentInstance.guardar(validForm());
    expect(actualizarPermiso).toHaveBeenCalledWith(21, jasmine.objectContaining({
      idRol: 2,
      modulo: 'ConsumoClinico',
      puedeModificar: false,
    }));
  });

  it('solo habilita Crear para ConsumoClinico', async () => {
    puedeCrear = true;
    const element = render();
    fixture.componentInstance.abrirCrear();
    fixture.componentInstance.cambiarModulo('ConsumoClinico');
    await fixture.whenStable();
    fixture.detectChanges();
    expect((element.querySelector('[name="puedeConsultar"]') as HTMLInputElement).disabled).toBeTrue();
    expect((element.querySelector('[name="puedeCrear"]') as HTMLInputElement).disabled).toBeFalse();
    expect((element.querySelector('[name="puedeModificar"]') as HTMLInputElement).disabled).toBeTrue();
    expect((element.querySelector('[name="puedeEliminar"]') as HTMLInputElement).disabled).toBeTrue();
  });

  it('confirma la revocación por ID y permite cancelarla', () => {
    puedeEliminar = true;
    render();
    fixture.componentInstance.solicitarEliminacion(permiso);
    fixture.componentInstance.cancelarEliminacion();
    expect(eliminarPermiso).not.toHaveBeenCalled();
    fixture.componentInstance.solicitarEliminacion(permiso);
    fixture.componentInstance.confirmarEliminacion();
    expect(eliminarPermiso).toHaveBeenCalledOnceWith(21);
    expect(revalidarAhora).toHaveBeenCalled();
  });

  it('oculta las acciones que la autorización vigente no concede', () => {
    const element = render();
    expect(element.textContent).not.toContain('Nuevo permiso');
    expect(element.querySelector('[aria-label="Editar permiso"]')).toBeNull();
    expect(element.querySelector('[aria-label="Eliminar permiso"]')).toBeNull();
  });

  it('presenta errores de carga sin exponer detalles internos', () => {
    listarPermisos.and.returnValue(throwError(() => new Error('Catálogo temporalmente no disponible.')));
    const element = render();
    expect(element.textContent).toContain('Catálogo temporalmente no disponible.');
    expect(element.querySelector('[role="alert"]')).not.toBeNull();
  });
});
