import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { EmpleadoListadoResponse, PagedResponse } from '../../core/models/empleado.model';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PermisosService } from '../../core/services/permisos.service';
import { EmpleadosComponent } from './empleados.component';

describe('EmpleadosComponent WEB-UX-01C1', () => {
  let fixture: ComponentFixture<EmpleadosComponent>;
  let listar: jasmine.Spy;
  let eliminar: jasmine.Spy;
  let operaciones: Set<string>;

  const empleado: EmpleadoListadoResponse = {
    idEmpleado: 73, idSucursal: 2, nombres: 'Carlos', apellidos: 'Pérez',
    tipoEmpleado: 'Medico', activo: true,
  };
  const page = (items: EmpleadoListadoResponse[], current = 1, totalPages = 1): PagedResponse<EmpleadoListadoResponse> => ({
    items, page: current, pageSize: 10, totalCount: totalPages * 10, totalPages,
  });

  beforeEach(async () => {
    operaciones = new Set(['Crear', 'Modificar', 'Eliminar']);
    listar = jasmine.createSpy('listar').and.returnValue(of(page([empleado])));
    eliminar = jasmine.createSpy('eliminar').and.returnValue(of(void 0));
    await TestBed.configureTestingModule({
      imports: [EmpleadosComponent],
      providers: [
        provideRouter([]),
        { provide: EmpleadosService, useValue: { listar, eliminar } },
        { provide: PermisosService, useValue: {
          puedeCrear: () => operaciones.has('Crear'),
          puedeModificar: () => operaciones.has('Modificar'),
          puedeEliminar: () => operaciones.has('Eliminar'),
        } },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(EmpleadosComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('presenta el listado y la edición con el ID real', () => {
    const element = render();
    expect(element.querySelector('th')?.textContent?.trim()).toBe('No.');
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('1');
    expect(element.textContent).toContain('Carlos Pérez');
    expect(element.textContent).toContain('Medico');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Editar empleado"]')?.getAttribute('href')).toBe('/admin/empleados/editar/73');
  });

  it('alinea filtros y muestra acciones con texto sin cambiar su significado', () => {
    const element = render();
    const filtros = element.querySelector('.empleados-filtros');
    expect(filtros?.classList.contains('align-items-end')).toBeTrue();
    expect(filtros?.querySelector('label[for="empleado-nombre"]')).not.toBeNull();
    expect(filtros?.querySelector('label[for="empleado-tipo"]')).not.toBeNull();
    expect(filtros?.querySelector('label[for="empleado-estado"]')).not.toBeNull();
    expect(filtros?.querySelector('.col-md-2.d-flex.align-items-end button')?.textContent).toContain('Limpiar');
    expect(element.querySelector('.empleados-actions a')?.textContent).toContain('Modificar');
    expect(element.querySelector('.empleados-actions button')?.textContent).toContain('Eliminar');
    expect(element.querySelector('nav[aria-label="Páginas de empleados"]')?.classList.contains('flex-wrap')).toBeTrue();
  });

  it('respeta los permisos dinámicos de acciones', () => {
    operaciones.clear();
    const element = render();
    expect(element.textContent).not.toContain('Nuevo Empleado');
    expect(element.querySelector('[aria-label="Editar empleado"]')).toBeNull();
    expect(element.querySelector('[aria-label="Eliminar empleado"]')).toBeNull();
  });

  it('cancela la confirmación sin llamar a la API', () => {
    render();
    fixture.componentInstance.solicitarEliminacion(empleado);
    fixture.componentInstance.cancelarEliminacion();
    expect(eliminar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.empleadoPendiente).toBeNull();
  });

  it('confirma la eliminación con el ID real y recarga', () => {
    render();
    fixture.componentInstance.solicitarEliminacion(empleado);
    fixture.componentInstance.confirmarEliminacion();
    expect(eliminar).toHaveBeenCalledOnceWith(73);
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('muestra los estados vacío y error', () => {
    listar.and.returnValue(of(page([])));
    expect(render().textContent).toContain('No se encontraron empleados');
    fixture.destroy();
    listar.and.returnValue(throwError(() => new Error('fallo')));
    expect(render().querySelector('[role="alert"]')?.textContent).toContain('Error al cargar los empleados');
  });

  it('conserva el estado de carga', () => {
    listar.and.returnValue(new Subject<PagedResponse<EmpleadoListadoResponse>>());
    expect(render().querySelector('[role="status"]')?.textContent).toContain('Cargando empleados');
  });

  it('pagina dentro del total informado por la API', () => {
    listar.and.returnValue(of(page([empleado], 1, 2)));
    render();
    fixture.componentInstance.cambiarPagina(2);
    fixture.detectChanges();
    expect(listar).toHaveBeenCalledWith(undefined, undefined, undefined, undefined, 2, 10);
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody td')?.textContent?.trim()).toBe('11');
    fixture.componentInstance.cambiarPagina(3);
    expect(listar).toHaveBeenCalledTimes(2);
  });
});
