import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NgForm } from '@angular/forms';
import { of, throwError } from 'rxjs';
import { PermisoRolResponse, RolResponse } from '../../core/models/rol.model';
import { ApiErrorService } from '../../core/services/api-error.service';
import { AutorizacionActualizacionService } from '../../core/services/autorizacion-actualizacion.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RolesService } from '../../core/services/roles.service';
import { RolesComponent } from './roles.component';

describe('RolesComponent', () => {
  let fixture: ComponentFixture<RolesComponent>;
  let rolesService: jasmine.SpyObj<RolesService>;
  let roleCreate: boolean;
  let roleModify: boolean;
  let roleDelete: boolean;
  let permissionConsult: boolean;
  let permissionCreate: boolean;
  let permissionModify: boolean;
  let permissionDelete: boolean;

  const rol: RolResponse = { idRol: 2, nombre: 'Doctor', activo: true };
  const permiso: PermisoRolResponse = {
    idPermiso: 5, idRol: 2, modulo: 'Pacientes',
    puedeConsultar: true, puedeCrear: false, puedeModificar: false, puedeEliminar: false,
  };

  beforeEach(async () => {
    roleCreate = false;
    roleModify = false;
    roleDelete = false;
    permissionConsult = false;
    permissionCreate = false;
    permissionModify = false;
    permissionDelete = false;

    rolesService = jasmine.createSpyObj<RolesService>('RolesService', [
      'listarRoles', 'crearRol', 'actualizarRol', 'eliminarRol',
      'listarTodosPermisos', 'crearPermiso', 'actualizarPermiso', 'eliminarPermiso',
    ]);
    rolesService.listarRoles.and.returnValue(of({
      items: [rol], page: 1, pageSize: 10, totalCount: 1, totalPages: 1,
    }));
    rolesService.crearRol.and.callFake(body => of({ idRol: 3, ...body }));
    rolesService.actualizarRol.and.callFake((id, body) => of({ idRol: id, ...body }));
    rolesService.eliminarRol.and.returnValue(of(undefined));
    rolesService.listarTodosPermisos.and.returnValue(of([permiso]));
    rolesService.crearPermiso.and.callFake(body => of({ idPermiso: 9, ...body }));
    rolesService.actualizarPermiso.and.callFake((id, body) => of({ idPermiso: id, ...body }));
    rolesService.eliminarPermiso.and.returnValue(of(undefined));

    await TestBed.configureTestingModule({
      imports: [RolesComponent],
      providers: [
        ApiErrorService,
        { provide: RolesService, useValue: rolesService },
        { provide: AutorizacionActualizacionService, useValue: {
          revalidarAhora: jasmine.createSpy('revalidarAhora').and.returnValue(of(true)),
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => modulo === 'Permisos' ? permissionConsult : true,
          puedeCrear: (modulo: string) => modulo === 'Roles' ? roleCreate : permissionCreate,
          puedeModificar: (modulo: string) => modulo === 'Roles' ? roleModify : permissionModify,
          puedeEliminar: (modulo: string) => modulo === 'Roles' ? roleDelete : permissionDelete,
        } },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(RolesComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function buttonByText(element: HTMLElement, text: string): HTMLButtonElement {
    const button = Array.from(element.querySelectorAll('button'))
      .find(value => value.textContent?.trim().includes(text));
    if (!button) throw new Error(`No se encontró el botón ${text}`);
    return button;
  }

  function openPermissions(element: HTMLElement): HTMLElement {
    const button = element.querySelector('[aria-label="Administrar permisos de Doctor"]') as HTMLButtonElement;
    button.click();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function permissionRow(element: HTMLElement, module: string): HTMLTableRowElement {
    const row = Array.from(element.querySelectorAll('tbody tr'))
      .find(value => value.querySelector('th')?.textContent?.trim() === module);
    if (!row) throw new Error(`No se encontró la fila ${module}`);
    return row as HTMLTableRowElement;
  }

  it('muestra el listado con permiso de consulta sin conceder acciones', () => {
    const element = render();
    expect(element.textContent).toContain('Doctor');
    expect(element.textContent).not.toContain('Nuevo rol');
    expect(element.querySelector('[aria-label="Editar rol Doctor"]')).toBeNull();
    expect(element.querySelector('[aria-label="Eliminar rol Doctor"]')).toBeNull();
  });

  it('muestra crear únicamente con Roles/Crear', () => {
    roleCreate = true;
    expect(render().textContent).toContain('Nuevo rol');
  });

  it('muestra editar únicamente con Roles/Modificar', () => {
    roleModify = true;
    const element = render();
    expect(element.querySelector('[aria-label="Editar rol Doctor"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Eliminar rol Doctor"]')).toBeNull();
  });

  it('muestra eliminar únicamente con Roles/Eliminar', () => {
    roleDelete = true;
    const element = render();
    expect(element.querySelector('[aria-label="Eliminar rol Doctor"]')).not.toBeNull();
    expect(element.querySelector('[aria-label="Editar rol Doctor"]')).toBeNull();
  });

  it('requiere Permisos/Consultar para abrir la matriz', () => {
    let element = render();
    expect(element.querySelector('[aria-label="Administrar permisos de Doctor"]')).toBeNull();
    permissionConsult = true;
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[aria-label="Administrar permisos de Doctor"]')).not.toBeNull();
  });

  it('crea un rol con un formulario válido y nombre normalizado', () => {
    roleCreate = true;
    let element = render();
    buttonByText(element, 'Nuevo rol').click();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    fixture.componentInstance.rolForm.nombre = '  Auditor  ';
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.directive(NgForm)).injector.get(NgForm);
    fixture.componentInstance.guardarRol(form);
    expect(rolesService.crearRol).toHaveBeenCalledWith({ nombre: 'Auditor', activo: true });
  });

  it('no envía un formulario de rol inválido', () => {
    roleCreate = true;
    let element = render();
    buttonByText(element, 'Nuevo rol').click();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(new Event('submit'));
    expect(rolesService.crearRol).not.toHaveBeenCalled();
  });

  it('permite cancelar la edición sin escribir', () => {
    roleModify = true;
    let element = render();
    (element.querySelector('[aria-label="Editar rol Doctor"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    buttonByText(element, 'Cancelar').click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    expect(rolesService.actualizarRol).not.toHaveBeenCalled();
  });

  it('solicita confirmación antes de eliminar un rol', () => {
    roleDelete = true;
    const confirm = spyOn(window, 'confirm').and.returnValue(false);
    let element = render();
    (element.querySelector('[aria-label="Eliminar rol Doctor"]') as HTMLButtonElement).click();
    expect(confirm).toHaveBeenCalled();
    expect(rolesService.eliminarRol).not.toHaveBeenCalled();
    confirm.and.returnValue(true);
    (element.querySelector('[aria-label="Eliminar rol Doctor"]') as HTMLButtonElement).click();
    expect(rolesService.eliminarRol).toHaveBeenCalledWith(2);
  });

  it('construye la matriz solo con módulos devueltos por la API', () => {
    permissionConsult = true;
    rolesService.listarTodosPermisos.and.returnValue(of([
      permiso,
      { ...permiso, idPermiso: 8, idRol: 3, modulo: 'Inventario' },
    ]));
    const element = openPermissions(render());
    expect(element.textContent).toContain('Pacientes');
    expect(element.textContent).toContain('Inventario');
    expect(element.textContent).not.toContain('Habitaciones');
  });

  it('actualiza una fila existente mediante un PUT individual', () => {
    permissionConsult = true;
    permissionModify = true;
    let element = openPermissions(render());
    const row = permissionRow(element, 'Pacientes');
    const checkbox = row.querySelector('[aria-label="Pacientes: Crear"]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    buttonByText(permissionRow(element, 'Pacientes'), 'Guardar').click();
    expect(rolesService.actualizarPermiso).toHaveBeenCalledWith(5, jasmine.objectContaining({
      idRol: 2, modulo: 'Pacientes', puedeCrear: true,
    }));
  });

  it('crea una fila ausente mediante un POST individual', () => {
    permissionConsult = true;
    permissionCreate = true;
    rolesService.listarTodosPermisos.and.returnValue(of([
      { ...permiso, idPermiso: 8, idRol: 3, modulo: 'Inventario' },
    ]));
    let element = openPermissions(render());
    let row = permissionRow(element, 'Inventario');
    (row.querySelector('[aria-label="Inventario: Consultar"]') as HTMLInputElement).click();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    row = permissionRow(element, 'Inventario');
    buttonByText(row, 'Guardar').click();
    expect(rolesService.crearPermiso).toHaveBeenCalledWith(jasmine.objectContaining({
      idRol: 2, modulo: 'Inventario', puedeConsultar: true,
    }));
  });

  it('impide asignar módulos nuevos a un rol inactivo como exige la API', async () => {
    permissionConsult = true;
    permissionCreate = true;
    const inactivo = { ...rol, nombre: 'Suspendido', activo: false };
    rolesService.listarRoles.and.returnValue(of({
      items: [inactivo], page: 1, pageSize: 10, totalCount: 1, totalPages: 1,
    }));
    rolesService.listarTodosPermisos.and.returnValue(of([
      { ...permiso, idPermiso: 8, idRol: 3, modulo: 'Inventario' },
    ]));
    let element = render();
    (element.querySelector('[aria-label="Administrar permisos de Suspendido"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('La API no permite asignarle módulos nuevos');
    expect(fixture.componentInstance.puedeEditarFila(fixture.componentInstance.filasPermisos[0])).toBeFalse();
    expect((permissionRow(element, 'Inventario').querySelector('input') as HTMLInputElement).disabled).toBeTrue();
  });

  it('muestra ProblemDetails cuando falla el guardado de un permiso', () => {
    permissionConsult = true;
    permissionModify = true;
    rolesService.actualizarPermiso.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { title: 'Conflicto', detail: 'El permiso cambió en otra operación.' },
    })));
    let element = openPermissions(render());
    let row = permissionRow(element, 'Pacientes');
    (row.querySelector('[aria-label="Pacientes: Crear"]') as HTMLInputElement).click();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    row = permissionRow(element, 'Pacientes');
    buttonByText(row, 'Guardar').click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('El permiso cambió en otra operación.');
  });

  it('deshabilita la matriz si se revoca el permiso durante la edición', async () => {
    permissionConsult = true;
    permissionModify = true;
    let element = openPermissions(render());
    expect((permissionRow(element, 'Pacientes').querySelector('input') as HTMLInputElement).disabled).toBeFalse();
    permissionModify = false;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    const fila = fixture.componentInstance.filasPermisos[0];
    expect(fixture.componentInstance.puedeEditarFila(fila)).toBeFalse();
    expect((permissionRow(element, 'Pacientes').querySelector('input') as HTMLInputElement).disabled).toBeTrue();
  });

  it('restablece cambios pendientes sin llamar a la API', () => {
    permissionConsult = true;
    permissionModify = true;
    let element = openPermissions(render());
    let row = permissionRow(element, 'Pacientes');
    const checkbox = row.querySelector('[aria-label="Pacientes: Crear"]') as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
    buttonByText(element, 'Cancelar cambios pendientes').click();
    fixture.detectChanges();
    expect(fixture.componentInstance.filasPermisos[0].puedeCrear).toBeFalse();
    expect(rolesService.actualizarPermiso).not.toHaveBeenCalled();
  });

  it('elimina una asignación de permiso solo después de confirmarla', () => {
    permissionConsult = true;
    permissionDelete = true;
    spyOn(window, 'confirm').and.returnValue(true);
    const element = openPermissions(render());
    buttonByText(permissionRow(element, 'Pacientes'), 'Quitar').click();
    expect(rolesService.eliminarPermiso).toHaveBeenCalledWith(5);
  });
});
