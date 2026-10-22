import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { ConsultaFiltroDto, ConsultaListadoDto, PagedResponse } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { HistorialService } from '../../core/services/historial.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultasListComponent } from './consultas-list.component';

describe('CON-UX-02 Gestión de Consultas', () => {
  let fixture: ComponentFixture<ConsultasListComponent>;
  let listar: jasmine.Spy<(filtro: ConsultaFiltroDto) => Observable<PagedResponse<ConsultaListadoDto>>>;
  let paciente: jasmine.Spy;
  let foto: jasmine.Spy;
  let medico: jasmine.Spy;
  let autorizacion: WritableSignal<boolean>;
  let pacientesPermitidos: WritableSignal<boolean>;
  let medicosPermitidos: WritableSignal<boolean>;
  let historialPermitido: WritableSignal<boolean>;
  let crearPermitido: WritableSignal<boolean>;
  let sucursalesPermitidas: WritableSignal<boolean>;
  let usuario: WritableSignal<number>;
  let token: string;

  const consulta: ConsultaListadoDto = {
    idConsulta: 17, idPaciente: 11, idMedico: 8, idSucursal: 3,
    idClinica: null, fechaConsulta: '2026-10-19T14:30:00',
  };

  function page(items: ConsultaListadoDto[], number = 1, totalCount = items.length): PagedResponse<ConsultaListadoDto> {
    return { items, page: number, pageSize: 20, totalCount,
      totalPages: totalCount ? Math.ceil(totalCount / 20) : 0 };
  }

  function render(): ConsultasListComponent {
    fixture = TestBed.createComponent(ConsultasListComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function text(): string { return (fixture.nativeElement as HTMLElement).textContent ?? ''; }

  beforeEach(() => {
    autorizacion = signal(true);
    pacientesPermitidos = signal(true);
    medicosPermitidos = signal(true);
    historialPermitido = signal(true);
    crearPermitido = signal(true);
    sucursalesPermitidas = signal(true);
    usuario = signal(7);
    token = 'session-one';
    listar = jasmine.createSpy('listarConsultas').and.returnValue(of(page([consulta])));
    paciente = jasmine.createSpy('obtenerPaciente').and.callFake((id: number) =>
      of({ idPaciente: id, nombres: 'Ana', apellidos: 'Pérez' }));
    foto = jasmine.createSpy('obtenerFoto').and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    medico = jasmine.createSpy('obtenerMedico').and.callFake((id: number) =>
      of({ idEmpleado: id, nombres: 'Dra. Luz', apellidos: 'García' }));

    TestBed.configureTestingModule({
      imports: [ConsultasListComponent],
      providers: [
        provideRouter([]),
        { provide: HistorialService, useValue: { listarConsultas: listar } },
        { provide: PacientesService, useValue: { obtener: paciente, obtenerFoto: foto } },
        { provide: EmpleadosService, useValue: { obtener: medico } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => autorizacion(),
          currentUser: () => ({ idUsuario: usuario() }),
          get token(): string { return token; },
        } },
        { provide: PermisosService, useValue: {
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.CONSULTAS && crearPermitido(),
          puedeConsultar: (modulo: string) => {
            switch (modulo) {
              case MODULOS_PERMISO.CONSULTAS: return autorizacion();
              case MODULOS_PERMISO.PACIENTES: return pacientesPermitidos();
              case MODULOS_PERMISO.EMPLEADOS: return medicosPermitidos();
              case MODULOS_PERMISO.HISTORIAL: return historialPermitido();
              case MODULOS_PERMISO.SUCURSALES: return sucursalesPermitidas();
              default: return false;
            }
          },
        } },
      ],
    });
  });

  it('muestra encabezado, guía informativa y solo columnas respaldadas por el listado', () => {
    listar.and.returnValue(of(page([consulta, { ...consulta, idConsulta: 18 }])));
    render();
    expect(text()).toContain('Gestión de Consultas');
    expect(text()).toContain('Administra consultas médicas y accede al expediente clínico del paciente.');
    const flujo = (fixture.nativeElement as HTMLElement).querySelectorAll('.consultas-flujo__item');
    expect(Array.from(flujo).map(item => item.textContent?.trim())).toEqual([
      'Evaluación', 'Exámenes', 'Diagnóstico', 'Tratamiento', 'Evolución', 'Hospitalización',
    ]);
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.consultas-flujo a, .consultas-flujo button').length).toBe(0);
    const columnas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('thead th'))
      .map(item => item.textContent?.trim());
    expect(columnas).toEqual(['No.', 'Paciente', 'Fecha', 'Médico', 'Sucursal', 'Clínica', 'Acciones']);
    expect(text()).toContain('Ana Pérez');
    expect(text()).toContain('Dra. Luz García');
    expect(paciente).toHaveBeenCalledOnceWith(11);
    expect(medico).toHaveBeenCalledOnceWith(8);
    expect(foto).toHaveBeenCalledOnceWith(11);
  });

  it('muestra foto autenticada y libera el objeto al cambiar de página', () => {
    const create = spyOn(URL, 'createObjectURL').and.returnValue('blob:foto-11');
    const revoke = spyOn(URL, 'revokeObjectURL');
    foto.and.returnValue(of(new Blob(['imagen'], { type: 'image/webp' })));
    listar.and.callFake(filtro => of(page(filtro.page === 1 ? [consulta] : [
      { ...consulta, idConsulta: 18, idPaciente: 12 },
    ], filtro.page, 41)));
    const component = render();
    fixture.detectChanges();
    expect(create).toHaveBeenCalledTimes(1);
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('.consultas-avatar')?.src)
      .toContain('blob:foto-11');
    foto.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    component.cambiarPagina(2);
    fixture.detectChanges();
    expect(revoke).toHaveBeenCalledOnceWith('blob:foto-11');
    expect((fixture.nativeElement as HTMLElement).querySelector('.consultas-avatar--empty')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.consultas-avatar:not(.consultas-avatar--empty)')).toBeNull();
  });

  it('respeta permisos de creación, ficha y datos relacionados sin consultar recursos denegados', () => {
    crearPermitido.set(false);
    pacientesPermitidos.set(false);
    medicosPermitidos.set(false);
    historialPermitido.set(false);
    render();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/consultas/nueva"]')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('.consultas-actions a')).toBeNull();
    expect(text()).toContain('Sin acceso clínico');
    expect(paciente).not.toHaveBeenCalled();
    expect(foto).not.toHaveBeenCalled();
    expect(medico).not.toHaveBeenCalled();
    crearPermitido.set(true);
    pacientesPermitidos.set(true);
    sucursalesPermitidas.set(false);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/consultas/nueva"]')).toBeNull();
  });

  it('limpia los filtros reales y conserva la paginación devuelta por la API', () => {
    listar.and.callFake(filtro => of(page([consulta], filtro.page, 41)));
    const component = render();
    component.filtros.idPaciente = 11;
    component.filtros.desde = '2026-10-01';
    component.buscar();
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      idPaciente: 11, desde: '2026-10-01T00:00:00', page: 1,
    }));
    component.cambiarPagina(2);
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ idPaciente: 11, page: 2 }));
    component.limpiarFiltros();
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ idPaciente: null, desde: null, page: 1 }));
    fixture.detectChanges();
    expect(text()).toContain('Total: 41 consultas');
    expect(text()).toContain('Página 1 de 3');
  });

  it('descarta lecturas relacionadas tardías al cambiar de página y sesión', () => {
    const pacientePendiente = new Subject<{ idPaciente: number; nombres: string; apellidos: string }>();
    const fotoPendiente = new Subject<Blob>();
    paciente.and.returnValue(pacientePendiente);
    foto.and.returnValue(fotoPendiente);
    listar.and.callFake(filtro => of(page(filtro.page === 1 ? [consulta] : [
      { ...consulta, idConsulta: 18, idPaciente: 12 },
    ], filtro.page, 41)));
    const component = render();
    component.cambiarPagina(2);
    pacientePendiente.next({ idPaciente: 11, nombres: 'Nombre', apellidos: 'Anterior' });
    fotoPendiente.next(new Blob(['vieja'], { type: 'image/webp' }));
    fixture.detectChanges();
    expect(text()).not.toContain('Nombre Anterior');
    expect(component.fotoUrl(11)).toBeNull();
    usuario.set(9);
    token = 'session-two';
    TestBed.flushEffects();
    fixture.detectChanges();
    expect(text()).not.toContain('Nombre Anterior');
  });
});
