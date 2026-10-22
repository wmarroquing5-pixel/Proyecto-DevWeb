import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { PacienteListadoResponse, PagedResponse } from '../../core/models/paciente.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { PacientesComponent } from './pacientes.component';
import { AuthSessionService } from '../../core/services/auth-session.service';

describe('PacientesComponent WEB-UX-01C1', () => {
  let fixture: ComponentFixture<PacientesComponent>;
  let listar: jasmine.Spy;
  let eliminar: jasmine.Spy;
  let operaciones: Set<string>;

  const paciente: PacienteListadoResponse = {
    idPaciente: 41, nombres: 'María', apellidos: 'López', activo: true,
  };
  const page = (items: PacienteListadoResponse[], current = 1, totalPages = 1): PagedResponse<PacienteListadoResponse> => ({
    items, page: current, pageSize: 10, totalCount: totalPages * 10, totalPages,
  });

  beforeEach(async () => {
    operaciones = new Set(['Crear', 'Modificar', 'Eliminar']);
    listar = jasmine.createSpy('listar').and.returnValue(of(page([paciente])));
    eliminar = jasmine.createSpy('eliminar').and.returnValue(of(void 0));
    await TestBed.configureTestingModule({
      imports: [PacientesComponent],
      providers: [
        provideRouter([]),
        { provide: AuthSessionService, useValue: { currentUser: () => ({ idUsuario: 1, idRol: 1 }), isAuthenticated: () => true, token: 'test-token' } },
        { provide: PacientesService, useValue: { listar, eliminar } },
        { provide: PermisosService, useValue: {
          puedeCrear: () => operaciones.has('Crear'),
          puedeModificar: () => operaciones.has('Modificar'),
          puedeEliminar: () => operaciones.has('Eliminar'),
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.CONSULTAS || modulo === MODULOS_PERMISO.PACIENTES,
        } },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(PacientesComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('presenta listado y rutas con el ID real', () => {
    const element = render();
    expect(element.querySelector('th')?.textContent?.trim()).toBe('No.');
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('1');
    expect(element.textContent).toContain('María López');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Editar paciente"]')?.getAttribute('href')).toBe('/pacientes/editar/41');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Ver historial del paciente"]')?.getAttribute('href')).toBe('/historial/41');
  });

  it('respeta los permisos dinámicos de acciones', () => {
    operaciones.clear();
    const element = render();
    expect(element.textContent).not.toContain('Nuevo Paciente');
    expect(element.querySelector('[aria-label="Editar paciente"]')).toBeNull();
    expect(element.querySelector('[aria-label="Eliminar paciente"]')).toBeNull();
  });

  it('cancela la confirmación sin llamar a la API', () => {
    render();
    fixture.componentInstance.solicitarDesactivacion(paciente);
    fixture.componentInstance.cancelarDesactivacion();
    expect(eliminar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.pacientePendiente).toBeNull();
  });

  it('confirma la desactivación con el ID real y recarga', () => {
    render();
    fixture.componentInstance.solicitarDesactivacion(paciente);
    fixture.componentInstance.confirmarDesactivacion();
    expect(eliminar).toHaveBeenCalledOnceWith(41);
    expect(listar).toHaveBeenCalledTimes(2);
  });

  it('muestra los estados vacío y error', () => {
    listar.and.returnValue(of(page([])));
    expect(render().textContent).toContain('No se encontraron pacientes');
    fixture.destroy();
    listar.and.returnValue(throwError(() => new Error('fallo')));
    expect(render().querySelector('[role="alert"]')?.textContent).toContain('Error al cargar los pacientes');
  });

  it('conserva el estado de carga', () => {
    listar.and.returnValue(new Subject<PagedResponse<PacienteListadoResponse>>());
    expect(render().querySelector('[role="status"]')?.textContent).toContain('Cargando pacientes');
  });

  it('pagina dentro del total informado por la API', () => {
    listar.and.returnValue(of(page([paciente], 1, 2)));
    render();
    fixture.componentInstance.cambiarPagina(2);
    fixture.detectChanges();
    expect(listar).toHaveBeenCalledWith(undefined, undefined, 2, 10);
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody td')?.textContent?.trim()).toBe('11');
    fixture.componentInstance.cambiarPagina(3);
    expect(listar).toHaveBeenCalledTimes(2);
  });
});
