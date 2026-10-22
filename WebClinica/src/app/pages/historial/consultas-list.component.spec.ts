import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ConsultaFiltroDto, ConsultaListadoDto, PagedResponse } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { HistorialService } from '../../core/services/historial.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultasListComponent } from './consultas-list.component';

describe('ConsultasListComponent', () => {
  let fixture: ComponentFixture<ConsultasListComponent>;
  let listarConsultas: jasmine.Spy<(filtro: ConsultaFiltroDto) => Observable<PagedResponse<ConsultaListadoDto>>>;
  let authenticated: WritableSignal<boolean>;
  let consultasAllowed: WritableSignal<boolean>;
  let historialAllowed: WritableSignal<boolean>;
  let crearAllowed: WritableSignal<boolean>;
  let pacientesAllowed: WritableSignal<boolean>;
  let userId: WritableSignal<number>;
  let token: string;

  const consulta: ConsultaListadoDto = {
    idConsulta: 17,
    idPaciente: 11,
    idMedico: 8,
    idSucursal: 3,
    idClinica: null,
    fechaConsulta: '2026-10-19T14:30:00',
  };

  function page(
    items: ConsultaListadoDto[] = [consulta],
    number = 1,
    pageSize = 20,
    totalCount = items.length,
  ): PagedResponse<ConsultaListadoDto> {
    return {
      items, page: number, pageSize, totalCount,
      totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    };
  }

  beforeEach(() => {
    authenticated = signal(true);
    consultasAllowed = signal(true);
    historialAllowed = signal(true);
    crearAllowed = signal(true);
    pacientesAllowed = signal(true);
    userId = signal(7);
    token = 'session-one';
    listarConsultas = jasmine.createSpy('listarConsultas')
      .and.callFake(filtro => of(page([consulta], filtro.page, filtro.pageSize, 41)));

    TestBed.configureTestingModule({
      imports: [ConsultasListComponent],
      providers: [
        provideRouter([]),
        { provide: HistorialService, useValue: { listarConsultas } },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([{ idSucursal: 3, nombre: 'Central', direccion: null, activa: true }]),
          getClinicas: () => of([]),
        } },
        { provide: PacientesService, useValue: {
          listar: (_nombre: string, _activo: boolean, page: number, pageSize: number) => of({
            items: [{ idPaciente: 11, nombres: 'Ana', apellidos: 'Pérez', activo: true }],
            page, pageSize, totalCount: 1, totalPages: 1,
          }),
          obtener: (id: number) => of({ idPaciente: id, nombres: 'Ana', apellidos: 'Pérez' }),
          obtenerFoto: () => throwError(() => new HttpErrorResponse({ status: 404 })),
        } },
        { provide: EmpleadosService, useValue: {
          listar: (_nombre: string, _tipo: string, _sucursal: number, _activo: boolean,
                   page: number, pageSize: number) => of({
            items: [{ idEmpleado: 8, nombres: 'Dra. Luz', apellidos: 'García', tipoEmpleado: 'Medico', activo: true, idSucursal: 3 }],
            page, pageSize, totalCount: 1, totalPages: 1,
          }),
          obtener: (id: number) => of({ idEmpleado: id, nombres: 'Dra. Luz', apellidos: 'García' }),
        } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => authenticated(),
          currentUser: () => ({ idUsuario: userId() }),
          get token(): string { return token; },
        } },
        { provide: PermisosService, useValue: {
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.CONSULTAS && crearAllowed(),
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.CONSULTAS
            ? consultasAllowed() : modulo === MODULOS_PERMISO.PACIENTES
              ? pacientesAllowed() : historialAllowed(),
        } },
      ],
    });
  });

  function render(): ConsultasListComponent {
    fixture = TestBed.createComponent(ConsultasListComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('carga la primera página al iniciar', () => {
    const component = render();
    expect(listarConsultas).toHaveBeenCalledOnceWith(jasmine.objectContaining({ page: 1, pageSize: 20 }));
    expect(component.consultas).toEqual([consulta]);
    expect(component.totalCount).toBe(41);
  });

  it('ofrece Nueva consulta en Consultas solo con Crear y Pacientes/Consultar', () => {
    render();
    const enlace = () => (fixture.nativeElement as HTMLElement).querySelector<HTMLAnchorElement>('a[href="/consultas/nueva"]');
    expect(enlace()?.textContent).toContain('Nueva consulta');
    crearAllowed.set(false); fixture.detectChanges(); expect(enlace()).toBeNull();
    crearAllowed.set(true); pacientesAllowed.set(false); fixture.detectChanges(); expect(enlace()).toBeNull();
  });

  it('mantiene legible una respuesta anterior sin campos enriquecidos', () => {
    render();
    const element = fixture.nativeElement as HTMLElement;
    const text = element.textContent ?? '';
    expect(element.querySelector('thead th')?.textContent?.trim()).toBe('No.');
    expect(text).toContain('Evaluación inicial');
    expect(text).toContain('No disponible');
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('1');
    expect(text).toContain('11');
    expect(text).toContain('8');
    expect(text).toContain('3');
    expect(text).not.toContain('Motivo');
    expect(text).not.toContain('Síntomas');
  });

  it('muestra Estado sin inventar clasificaciones y admite respuestas antiguas', () => {
    listarConsultas.and.returnValue(of(page([
      { ...consulta, idConsulta: 1, estadoConsulta: null },
      { ...consulta, idConsulta: 2 },
      { ...consulta, idConsulta: 3, estadoConsulta: '   ' },
      { ...consulta, idConsulta: 4, estadoConsulta: 'En seguimiento' },
      { ...consulta, idConsulta: 5, estadoConsulta: 'Valor heredado' },
    ])));
    render();
    const element = fixture.nativeElement as HTMLElement;
    const headers = Array.from(element.querySelectorAll('thead th'), th => th.textContent?.trim());
    expect(headers).toEqual([
      'No.', 'Paciente', 'Evaluación inicial', 'Fecha', 'Médico', 'Estado', 'Acciones',
    ]);
    const states = Array.from(element.querySelectorAll('tbody tr td:nth-child(6) .consultas-estado'),
      cell => cell.textContent?.trim());
    expect(states).toEqual([
      'Sin estado registrado', 'Sin estado registrado', 'Sin estado registrado',
      'En seguimiento', 'Valor heredado',
    ]);
    expect(element.querySelectorAll('.consultas-estado--vacio').length).toBe(3);
    expect(element.querySelectorAll('tbody tr td:nth-child(6) button').length).toBe(0);
    expect(element.querySelector('.ui-table-wrap .consultas-table')).not.toBeNull();
    expect(getComputedStyle(element.querySelector('.consultas-table')!).minWidth).toBe('0px');
    expect(element.querySelectorAll('tbody tr:first-child .consultas-actions a').length).toBe(2);
  });

  it('interpola un estado desconocido como texto, sin contenido HTML activo', () => {
    listarConsultas.and.returnValue(of(page([
      { ...consulta, estadoConsulta: '<img src=x onerror=alert(1)>' },
    ])));
    render();
    const cell = (fixture.nativeElement as HTMLElement).querySelector('tbody td:nth-child(6)');
    expect(cell?.textContent?.trim()).toBe('<img src=x onerror=alert(1)>');
    expect(cell?.querySelector('img')).toBeNull();
  });

  it('calcula el correlativo con la página y tamaño devueltos por la API', () => {
    listarConsultas.and.returnValue(of(page([{ ...consulta, idConsulta: 901 }], 3, 10, 21)));
    render();
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody td')?.textContent?.trim()).toBe('21');
  });

  it('muestra estado vacío', () => {
    listarConsultas.and.returnValue(of(page([], 1, 20, 0)));
    render();
    expect((fixture.nativeElement as HTMLElement).textContent)
      .toContain('No se encontraron consultas');
  });

  it('muestra el estado de carga mientras la API responde', () => {
    listarConsultas.and.returnValue(new Subject<PagedResponse<ConsultaListadoDto>>());
    const component = render();
    expect(component.cargando).toBeTrue();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Cargando consultas');
  });

  it('aplica todos los filtros reales y vuelve a la página uno', () => {
    const component = render();
    component.page = 2;
    component.filtros = {
      idPaciente: 1, idMedico: 2, idSucursal: 3, idClinica: 4,
      desde: '2026-10-01', hasta: '2026-10-19',
    };
    component.buscar();
    expect(listarConsultas).toHaveBeenCalledWith({
      idPaciente: 1, idMedico: 2, idSucursal: 3, idClinica: 4,
      desde: '2026-10-01T00:00:00', hasta: '2026-10-19T23:59:59.999',
      page: 1, pageSize: 20,
    });
  });

  it('rechaza identificadores y rangos de fecha inválidos sin llamar a la API', () => {
    const component = render();
    listarConsultas.calls.reset();
    component.filtros.idPaciente = 0;
    component.buscar();
    expect(component.error).toContain('entero mayor que cero');
    component.filtros.idPaciente = 1;
    component.filtros.desde = '2026-10-20';
    component.filtros.hasta = '2026-10-19';
    component.buscar();
    expect(component.error).toContain('posterior o igual');
    expect(listarConsultas).not.toHaveBeenCalled();
  });

  it('conserva los filtros aplicados al cambiar de página', () => {
    const component = render();
    component.filtros.idPaciente = 11;
    component.buscar();
    component.filtros.idPaciente = 99;
    component.cambiarPagina(2);
    expect(listarConsultas.calls.mostRecent().args[0])
      .toEqual(jasmine.objectContaining({ idPaciente: 11, page: 2 }));
  });

  it('evita solicitudes de páginas inválidas', () => {
    const component = render();
    listarConsultas.calls.reset();
    component.cambiarPagina(0);
    component.cambiarPagina(4);
    component.cambiarPagina(1);
    expect(listarConsultas).not.toHaveBeenCalled();
  });

  it('muestra ProblemDetails mediante ApiErrorService y permite reintentar', () => {
    listarConsultas.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: { title: 'Validación fallida', detail: 'Filtro inválido.' },
    })));
    const component = render();
    expect(component.error).toBe('Filtro inválido.');
    listarConsultas.and.returnValue(of(page()));
    component.reintentar();
    expect(component.consultas).toEqual([consulta]);
  });

  it('construye rutas de detalle y ficha con ambos identificadores correctos', () => {
    render();
    const hrefs = fixture.debugElement.queryAll(By.css('a')).map(link =>
      link.nativeElement.getAttribute('href'));
    expect(hrefs).toContain('/historial/11/consulta/17');
    expect(hrefs).toContain('/pacientes/11/ficha');
    expect(hrefs).not.toContain('/historial/11');
  });

  it('mantiene Ficha médica con Pacientes/Consultar aunque falte Historial/Consultar', () => {
    historialAllowed.set(false);
    render();
    const hrefs = fixture.debugElement.queryAll(By.css('a')).map(link =>
      link.nativeElement.getAttribute('href'));
    expect(hrefs).toContain('/pacientes/11/ficha');
    expect(hrefs).not.toContain('/historial/11/consulta/17');
    expect(hrefs).not.toContain('/historial/11');
  });

  it('no solicita ni conserva datos sin Consultas/Consultar', () => {
    consultasAllowed.set(false);
    const component = render();
    expect(listarConsultas).not.toHaveBeenCalled();
    expect(component.consultas).toEqual([]);
  });

  it('limpia los datos cuando se revoca Consultas/Consultar', () => {
    const component = render();
    expect(component.consultas.length).toBe(1);
    consultasAllowed.set(false);
    TestBed.flushEffects();
    fixture.detectChanges();
    expect(component.consultas).toEqual([]);
    expect(component.totalCount).toBe(0);
  });

  it('descarta una respuesta pendiente después del logout', () => {
    const pending = new Subject<PagedResponse<ConsultaListadoDto>>();
    listarConsultas.and.returnValue(pending);
    const component = render();
    authenticated.set(false);
    TestBed.flushEffects();
    pending.next(page());
    pending.complete();
    fixture.detectChanges();
    expect(component.consultas).toEqual([]);
    expect(component.totalCount).toBe(0);
  });

  it('descarta datos de una solicitud al cambiar de usuario', () => {
    const pending = new Subject<PagedResponse<ConsultaListadoDto>>();
    listarConsultas.and.returnValue(pending);
    const component = render();
    userId.set(8);
    token = 'session-two';
    TestBed.flushEffects();
    pending.next(page());
    pending.complete();
    expect(component.consultas).toEqual([]);
  });
});
