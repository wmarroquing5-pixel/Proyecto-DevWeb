import { HttpErrorResponse } from '@angular/common/http';
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
  let obtenerFoto: jasmine.Spy;
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
    obtenerFoto = jasmine.createSpy('obtenerFoto').and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await TestBed.configureTestingModule({
      imports: [PacientesComponent],
      providers: [
        provideRouter([]),
        { provide: AuthSessionService, useValue: { currentUser: () => ({ idUsuario: 1, idRol: 1 }), isAuthenticated: () => true, token: 'test-token' } },
        { provide: PacientesService, useValue: { listar, eliminar, obtenerFoto } },
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
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Modificar paciente"]')?.getAttribute('href')).toBe('/pacientes/editar/41');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Ver ficha médica del paciente"]')?.getAttribute('href')).toBe('/pacientes/41/ficha');
    expect(element.querySelector('[aria-label="Ver ficha médica del paciente"]')?.textContent).toContain('Ficha médica');
    expect(element.querySelector('[aria-label="Modificar paciente"]')?.textContent).toContain('Modificar');
    expect(element.querySelector('[aria-label="Desactivar paciente"]')?.textContent).toContain('Desactivar');
    expect(element.querySelector('.pacientes-identidad')?.textContent).toContain('María López');
    expect(element.querySelector('.pacientes-identidad .pacientes-avatar--empty')).not.toBeNull();
    expect(element.querySelector('.pacientes-identidad img')).toBeNull();
    fixture.componentInstance.cargarPacientes();
    expect(obtenerFoto).toHaveBeenCalledOnceWith(41);
  });

  it('muestra la fotografía protegida a la izquierda del nombre y libera su URL al salir', () => {
    const blob = new Blob(['foto'], { type: 'image/webp' });
    obtenerFoto.and.returnValue(of(blob));
    const crearUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:paciente-41');
    const revocarUrl = spyOn(URL, 'revokeObjectURL');
    const element = render();
    const identidad = element.querySelector('.pacientes-identidad')!;
    const imagen = identidad.querySelector('img')!;
    expect(obtenerFoto).toHaveBeenCalledOnceWith(41);
    expect(crearUrl).toHaveBeenCalledOnceWith(blob);
    expect(imagen.getAttribute('src')).toBe('blob:paciente-41');
    expect(imagen.nextElementSibling?.textContent).toContain('María López');
    fixture.destroy();
    expect(revocarUrl).toHaveBeenCalledOnceWith('blob:paciente-41');
  });

  it('descarta fotografías de la página anterior y no mezcla pacientes', () => {
    const siguiente = { ...paciente, idPaciente: 42, nombres: 'Rosa', apellidos: 'Paz' };
    listar.and.callFake((_nombre: string | undefined, _activo: boolean | undefined, pagina: number) =>
      of(page(pagina === 1 ? [paciente] : [siguiente], pagina, 2)));
    obtenerFoto.and.callFake((id: number) => of(new Blob([String(id)], { type: 'image/webp' })));
    spyOn(URL, 'createObjectURL').and.returnValues('blob:paciente-41', 'blob:paciente-42');
    const revocarUrl = spyOn(URL, 'revokeObjectURL');
    const element = render();
    expect(element.querySelector('.pacientes-identidad img')?.getAttribute('src')).toBe('blob:paciente-41');
    fixture.componentInstance.cambiarPagina(2); fixture.detectChanges();
    expect(revocarUrl).toHaveBeenCalledWith('blob:paciente-41');
    expect(element.querySelector('.pacientes-identidad img')?.getAttribute('src')).toBe('blob:paciente-42');
    expect(element.querySelector('.pacientes-identidad')?.textContent).toContain('Rosa Paz');
    expect(element.textContent).not.toContain('María López');
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('no repite solicitudes de fotografías ausentes al volver a una página', () => {
    const siguiente = { ...paciente, idPaciente: 42, nombres: 'Rosa' };
    listar.and.callFake((_nombre: string | undefined, _activo: boolean | undefined, pagina: number) =>
      of(page(pagina === 1 ? [paciente] : [siguiente], pagina, 2)));
    render();
    fixture.componentInstance.cambiarPagina(2);
    fixture.componentInstance.cambiarPagina(1);
    expect(obtenerFoto.calls.allArgs()).toEqual([[41], [42]]);
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('alinea Limpiar con Nombre y Estado y conserva la lógica de filtros', () => {
    const element = render();
    const fila = element.querySelector('.pacientes-filtros')!;
    const limpiar = Array.from(fila.querySelectorAll('button')).find(boton => boton.textContent?.includes('Limpiar'))!;
    expect(fila.classList.contains('align-items-end')).toBeTrue();
    expect(limpiar.closest('.col-md-3')?.classList.contains('align-items-end')).toBeTrue();
    expect(fila.querySelector('label[for="paciente-nombre"]')).not.toBeNull();
    expect(fila.querySelector('label[for="paciente-estado"]')).not.toBeNull();
    fixture.componentInstance.filtroNombre = 'Rosa'; fixture.componentInstance.filtroActivo = true;
    limpiar.click(); fixture.detectChanges();
    expect(fixture.componentInstance.filtroNombre).toBe('');
    expect(fixture.componentInstance.filtroActivo).toBeUndefined();
    expect(listar).toHaveBeenCalledWith(undefined, undefined, 1, 10);
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('respeta los permisos dinámicos de acciones', () => {
    operaciones.clear();
    const element = render();
    expect(element.textContent).not.toContain('Nuevo Paciente');
    expect(element.querySelector('[aria-label="Modificar paciente"]')).toBeNull();
    expect(element.querySelector('[aria-label="Desactivar paciente"]')).toBeNull();
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
