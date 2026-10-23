import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  ConsultaDetalleDto, ConsultaListadoDto, DiagnosticoResponse,
  HistorialMedicoResponseDto, PagedResponse,
} from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultaDetalleComponent } from './consulta-detalle.component';
import { PacientesService } from '../../core/services/paciente.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { HistorialPacienteComponent } from './historial-paciente.component';

const consulta = (idConsulta = 17, idPaciente = 11): ConsultaDetalleDto => ({
  idConsulta, idPaciente, idMedico: 7, idSucursal: 3, idClinica: null,
  fechaConsulta: '2026-10-19T10:00:00Z', motivoConsulta: null, sintomas: null,
  observaciones: null, pesoLb: null, presionDiastolica: null, presionSistolica: null, alturaCm: null,
});
const diagnostico = (idDiagnostico: number, idConsulta = 17): DiagnosticoResponse => ({
  idDiagnostico, idConsulta, idMedico: 7, descripcion: `Diagnóstico ${idDiagnostico}`,
  fechaRegistro: '2026-10-19T11:00:00Z',
});
const evolucion = (idHistorial: number, idConsulta = 17, idPaciente = 11): HistorialMedicoResponseDto => ({
  idHistorial, idConsulta, idDiagnostico: 1, idPaciente, idMedico: 7,
  fechaHistorial: '2026-10-19T12:00:00Z', descripcion: `Evolución ${idHistorial}`,
});
const page = <T>(items: T[], current = 1, totalCount = items.length, pageSize = 100): PagedResponse<T> => ({
  items, page: current, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize),
});
const problem = (status: number) => new HttpErrorResponse({ status, error: {
  detail: `Detalle ${status}`, errors: status === 400 ? { descripcion: ['Descripción inválida'] } : undefined,
} });

describe('ConsultaDetalleComponent CLOSE-07D', () => {
  let fixture: ComponentFixture<ConsultaDetalleComponent>;
  let authenticated: WritableSignal<boolean>;
  let userId: WritableSignal<number>;
  let readConsultas: WritableSignal<boolean>;
  let readHistorial: WritableSignal<boolean>;
  let createHistorial: WritableSignal<boolean>;
  let token: string;
  let service: jasmine.SpyObj<HistorialService>;

  beforeEach(() => {
    authenticated = signal(true); userId = signal(7); token = 'session-one';
    readConsultas = signal(true); readHistorial = signal(true); createHistorial = signal(true);
    service = jasmine.createSpyObj<HistorialService>('HistorialService', [
      'obtenerConsulta', 'listarDiagnosticos', 'listarTratamientos', 'obtenerTratamiento',
      'listarExamenes', 'listarHistorial', 'crearDiagnostico', 'crearExamen',
      'crearEvolucion', 'registrarConsumoClinico',
    ]);
    service.obtenerConsulta.and.returnValue(of(consulta()));
    service.listarDiagnosticos.and.returnValue(of(page([])));
    service.listarTratamientos.and.returnValue(of(page([])));
    service.listarExamenes.and.returnValue(of(page([])));
    service.listarHistorial.and.returnValue(of(page([])));
    service.crearDiagnostico.and.returnValue(of(diagnostico(1)));
    TestBed.configureTestingModule({
      imports: [ConsultaDetalleComponent],
      providers: [provideRouter([]), { provide: InventarioService, useValue: {} },
        { provide: PacientesService, useValue: { obtener: () => of({ idPaciente: 11, nombres: 'Ana', apellidos: 'López' }) } },
        { provide: EmpleadosService, useValue: { obtener: () => of({ idEmpleado: 7, nombres: 'Luis', apellidos: 'Pérez' }) } },
        { provide: CatalogosService, useValue: { obtenerSucursal: () => of({ idSucursal: 3, nombre: 'Centro' }), obtenerClinica: () => of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: {
          get: (key: string) => key === 'id' ? '11' : '17',
        } } } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => authenticated(), currentUser: () => ({ idUsuario: userId(), idRol: 2 }),
          get token(): string { return token; },
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.CONSULTAS ? readConsultas() : readHistorial(),
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.HISTORIAL ? createHistorial() : true,
          puedeModificar: () => false,
        } },
        { provide: HistorialService, useValue: service },
      ],
    });
  });

  function render(): ConsultaDetalleComponent {
    fixture = TestBed.createComponent(ConsultaDetalleComponent); fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('registra un diagnóstico válido con DTO independiente y recarga solo diagnósticos tras confirmación', () => {
    const c = render(); c.nuevoDiag.descripcion = '  Hallazgo confirmado  '; c.agregarDiagnostico();
    expect(service.crearDiagnostico).toHaveBeenCalledOnceWith({ idConsulta: 17, idMedico: null, descripcion: 'Hallazgo confirmado' });
    expect(service.listarDiagnosticos).toHaveBeenCalledTimes(2);
    expect(service.listarHistorial).toHaveBeenCalledTimes(1);
    expect(c.nuevoDiag.descripcion).toBe(''); expect(c.avisoDiagnostico).toContain('#1');
  });
  for (const descripcion of ['', '   ', 'x'.repeat(301)]) {
    it(`rechaza descripción inválida de longitud ${descripcion.length} sin POST`, () => {
      const c = render(); c.nuevoDiag.descripcion = descripcion; c.agregarDiagnostico();
      expect(service.crearDiagnostico).not.toHaveBeenCalled(); expect(c.errorDiagnostico).toContain('1 y 300');
    });
  }
  it('bloquea el doble POST y captura el texto antes de que cambie el formulario', () => {
    const pending = new Subject<DiagnosticoResponse>(); service.crearDiagnostico.and.returnValue(pending);
    const c = render(); c.nuevoDiag.descripcion = 'Original'; c.agregarDiagnostico();
    c.nuevoDiag.descripcion = 'Mutado'; c.agregarDiagnostico();
    expect(service.crearDiagnostico).toHaveBeenCalledTimes(1);
    expect(service.crearDiagnostico.calls.mostRecent().args[0]).toEqual({ idConsulta: 17, idMedico: null, descripcion: 'Original' });
    expect(c.guardandoDiagnostico).toBeTrue(); pending.complete(); expect(c.guardandoDiagnostico).toBeFalse();
  });
  it('no registra si el permiso Crear fue revocado antes de guardar', () => {
    const c = render(); c.nuevoDiag.descripcion = 'Dato'; createHistorial.set(false); c.agregarDiagnostico();
    expect(service.crearDiagnostico).not.toHaveBeenCalled();
  });
  it('cancela el POST pendiente si se revoca Historial/Crear', () => {
    const pending = new Subject<DiagnosticoResponse>(); service.crearDiagnostico.and.returnValue(pending);
    const c = render(); c.nuevoDiag.descripcion = 'Dato'; c.agregarDiagnostico();
    createHistorial.set(false); fixture.detectChanges();
    expect(pending.observed).toBeFalse(); expect(c.guardandoDiagnostico).toBeFalse();
    pending.next(diagnostico(8)); expect(c.avisoDiagnostico).toBe('');
    expect(service.listarDiagnosticos).toHaveBeenCalledTimes(1);
  });
  it('cancela el POST pendiente al cambiar sesión y no actualiza la pantalla', () => {
    const pending = new Subject<DiagnosticoResponse>(); service.crearDiagnostico.and.returnValue(pending);
    const c = render(); c.nuevoDiag.descripcion = 'Dato'; c.agregarDiagnostico();
    userId.set(8); token = 'session-two'; fixture.detectChanges();
    expect(pending.observed).toBeFalse(); pending.next(diagnostico(8));
    expect(c.avisoDiagnostico).toBe(''); expect(service.listarDiagnosticos).toHaveBeenCalledTimes(1);
  });
  it('ignora la confirmación si la consulta cambió durante el POST', () => {
    const pending = new Subject<DiagnosticoResponse>(); service.crearDiagnostico.and.returnValue(pending);
    const c = render(); c.nuevoDiag.descripcion = 'Dato'; c.agregarDiagnostico(); c.idConsulta = 18;
    pending.next(diagnostico(9)); expect(c.avisoDiagnostico).toBe(''); expect(service.listarDiagnosticos).toHaveBeenCalledTimes(1);
  });
  for (const status of [400, 401, 403, 404, 409, 500, 0]) {
    it(`muestra el error ${status} sin reintentar ni borrar el borrador`, () => {
      service.crearDiagnostico.and.returnValue(throwError(() => problem(status)));
      const c = render(); c.nuevoDiag.descripcion = 'Borrador clínico'; c.agregarDiagnostico();
      expect(service.crearDiagnostico).toHaveBeenCalledTimes(1); expect(c.nuevoDiag.descripcion).toBe('Borrador clínico');
      expect(c.errorDiagnostico).toContain(status === 400 ? 'Descripción inválida'
        : status === 401 ? 'sesión expiró' : status === 403 ? 'autorización'
          : status === 0 || status >= 500 ? 'Resultado incierto' : `Detalle ${status}`);
    });
  }
  for (const respuesta of [
    { ...diagnostico(0) }, { ...diagnostico(2), idConsulta: 99 },
    { ...diagnostico(3), idMedico: 0 }, { ...diagnostico(4), fechaRegistro: 'fecha-mala' },
  ]) {
    it(`no declara éxito ante confirmación incoherente ${respuesta.idDiagnostico}`, () => {
      service.crearDiagnostico.and.returnValue(of(respuesta));
      const c = render(); c.nuevoDiag.descripcion = 'Borrador'; c.agregarDiagnostico();
      expect(c.avisoDiagnostico).toBe(''); expect(c.errorDiagnostico).toContain('Resultado incierto');
      expect(service.listarDiagnosticos).toHaveBeenCalledTimes(1);
    });
  }
  it('carga diagnósticos y evoluciones más allá del registro 100, sin mezclarlos', () => {
    const diagnosticos1 = Array.from({ length: 100 }, (_, i) => diagnostico(i + 1));
    const evoluciones1 = Array.from({ length: 100 }, (_, i) => evolucion(i + 1));
    service.listarDiagnosticos.and.callFake(f => of(f.page === 1 ? page(diagnosticos1, 1, 101) : page([diagnostico(101)], 2, 101)));
    service.listarHistorial.and.callFake(f => of(f.page === 1 ? page(evoluciones1, 1, 101) : page([evolucion(101)], 2, 101)));
    const c = render();
    expect(service.listarDiagnosticos.calls.allArgs().map(a => a[0].page)).toEqual([1, 2]);
    expect(service.listarHistorial.calls.allArgs().map(a => a[0].page)).toEqual([1, 2]);
    expect(c.diagnosticos.length).toBe(101); expect(c.diagnosticos[100].idDiagnostico).toBe(101);
    expect(c.evoluciones.length).toBe(101); expect(c.evoluciones[100].idHistorial).toBe(101);
  });
  it('acepta totales vacíos sin solicitar una página inexistente', () => {
    const c = render(); expect(c.diagnosticos).toEqual([]); expect(c.evoluciones).toEqual([]);
    expect(service.listarDiagnosticos).toHaveBeenCalledTimes(1); expect(service.listarHistorial).toHaveBeenCalledTimes(1);
    expect(c.errorDiagnosticos).toBe(''); expect(c.errorEvoluciones).toBe('');
  });
  it('acepta una última página incompleta y detiene la carga en totalPages', () => {
    const primeros = Array.from({ length: 100 }, (_, i) => diagnostico(i + 1));
    service.listarDiagnosticos.and.callFake(f => of(f.page === 1 ? page(primeros, 1, 102) : page([diagnostico(101), diagnostico(102)], 2, 102)));
    const c = render(); expect(c.diagnosticos.length).toBe(102); expect(service.listarDiagnosticos).toHaveBeenCalledTimes(2);
  });
  it('detiene la carga exactamente en una página cuando el total es múltiplo de 100', () => {
    service.listarDiagnosticos.and.returnValue(of(page(Array.from({ length: 100 }, (_, i) => diagnostico(i + 1)), 1, 100)));
    const c = render(); expect(c.diagnosticos.length).toBe(100); expect(service.listarDiagnosticos).toHaveBeenCalledTimes(1);
  });
  it('presenta un error de la segunda página sin publicar la primera parcialmente', () => {
    service.listarDiagnosticos.and.callFake(f => f.page === 1
      ? of(page(Array.from({ length: 100 }, (_, i) => diagnostico(i + 1)), 1, 101))
      : throwError(() => problem(500)));
    const c = render(); expect(c.diagnosticos).toEqual([]); expect(c.errorDiagnosticos).toContain('todos los diagnósticos');
  });
  const contradictorias: Array<[string, PagedResponse<DiagnosticoResponse>]> = [
    ['page', { ...page([diagnostico(1)]), page: 2 }],
    ['pageSize', { ...page([diagnostico(1)]), pageSize: 20 }],
    ['totalPages', { ...page([diagnostico(1)]), totalPages: 2 }],
    ['cantidad', { ...page([diagnostico(1)], 1, 2) }],
    ['consulta', page([{ ...diagnostico(1), idConsulta: 99 }])],
    ['ID duplicado', page([diagnostico(1), diagnostico(1)])],
  ];
  for (const [caso, respuesta] of contradictorias) {
    it(`rechaza paginación o datos contradictorios: ${caso}`, () => {
      service.listarDiagnosticos.and.returnValue(of(respuesta)); const c = render();
      expect(c.diagnosticos).toEqual([]); expect(c.errorDiagnosticos).toMatch(/contradictoria|duplicados|otra consulta/);
    });
  }
  it('rechaza evoluciones pertenecientes a otro paciente', () => {
    service.listarHistorial.and.returnValue(of(page([evolucion(1, 17, 99)])));
    const c = render(); expect(c.evoluciones).toEqual([]); expect(c.errorEvoluciones).toContain('otra consulta');
  });
  it('cancela lecturas pendientes y limpia datos cuando cambia la identidad', () => {
    const pending = new Subject<PagedResponse<DiagnosticoResponse>>(); service.listarDiagnosticos.and.returnValue(pending);
    const c = render(); userId.set(9); token = 'new'; fixture.detectChanges();
    expect(pending.observed).toBeFalse(); expect(c.diagnosticos).toEqual([]); expect(c.consulta).toBeNull();
  });
  it('cancela lecturas y oculta datos al revocar Historial/Consultar', () => {
    const c = render(); readHistorial.set(false); fixture.detectChanges();
    expect(c.consulta).toBeNull(); expect(c.diagnosticos).toEqual([]); expect(c.evoluciones).toEqual([]);
  });
  it('rechaza una consulta devuelta para otro paciente y no carga secciones', () => {
    service.obtenerConsulta.and.returnValue(of(consulta(17, 99))); const c = render();
    expect(c.consulta).toBeNull(); expect(c.error).toContain('no corresponde');
    expect(service.listarDiagnosticos).not.toHaveBeenCalled();
  });
  it('una consulta antigua no reemplaza la nueva tras cambiar paciente y consulta', () => {
    const old = new Subject<ConsultaDetalleDto>(); service.obtenerConsulta.and.returnValues(old, of(consulta(18, 12)));
    const c = render(); c.idConsulta = 18; c.idPaciente = 12; c.cargarTodo();
    expect(old.observed).toBeFalse(); old.next(consulta());
    expect(c.consulta?.idConsulta).toBe(18); expect(c.consulta?.idPaciente).toBe(12);
  });
});

describe('HistorialPacienteComponent CLOSE-07D', () => {
  let fixture: ComponentFixture<HistorialPacienteComponent>;
  let authenticated: WritableSignal<boolean>;
  let read: WritableSignal<boolean>;
  let userId: WritableSignal<number>;
  let token: string;
  let listar: jasmine.Spy<(f: { idPaciente: number; page: number; pageSize: number }) => Observable<PagedResponse<ConsultaListadoDto>>>;
  const item = (idConsulta: number, idPaciente = 29): ConsultaListadoDto => ({
    idConsulta, idPaciente, idMedico: 7, idSucursal: 3, idClinica: null, fechaConsulta: '2026-10-19T10:00:00Z',
  });
  const page10 = (pagina: number, total: number): PagedResponse<ConsultaListadoDto> => {
    const cantidad = Math.min(10, Math.max(0, total - (pagina - 1) * 10));
    return page(Array.from({ length: cantidad }, (_, i) => item((pagina - 1) * 10 + i + 1)), pagina, total, 10);
  };
  beforeEach(async () => {
    authenticated = signal(true); read = signal(true); userId = signal(1); token = 'token-one';
    listar = jasmine.createSpy('listarConsultas').and.callFake(f => of(page10(f.page, 20)));
    await TestBed.configureTestingModule({
      imports: [HistorialPacienteComponent], providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '29' }) } } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => authenticated(), currentUser: () => ({ idUsuario: userId(), idRol: 1 }),
          get token(): string { return token; },
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: () => read(), puedeCrear: () => true,
        } },
        { provide: HistorialService, useValue: { listarConsultas: listar } },
      ],
    }).compileComponents();
  });
  function render(): HistorialPacienteComponent {
    fixture = TestBed.createComponent(HistorialPacienteComponent); fixture.detectChanges(); return fixture.componentInstance;
  }
  it('representa total vacío con totalPages cero', () => {
    listar.and.returnValue(of(page10(1, 0))); const c = render();
    expect(c.consultas).toEqual([]); expect(c.total).toBe(0); expect(c.totalPages).toBe(0); expect(c.error).toBe('');
  });
  it('acepta última página incompleta y conserva el paciente al cambiar página', () => {
    listar.and.callFake(f => of(page10(f.page, 15))); const c = render(); c.cambiarPagina(2);
    expect(c.consultas.length).toBe(5); expect(c.totalPages).toBe(2);
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ idPaciente: 29, page: 2, pageSize: 10 }));
  });
  it('no ofrece ni solicita una tercera página cuando el total es múltiplo exacto', () => {
    const c = render(); c.cambiarPagina(2); fixture.detectChanges();
    const next = [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button')]
      .find(b => b.textContent?.includes('Siguiente'))!;
    expect(c.totalPages).toBe(2); expect(next.disabled).toBeTrue(); c.cambiarPagina(3); expect(listar).toHaveBeenCalledTimes(2);
  });
  it('cancela la búsqueda anterior y no publica su respuesta tardía', () => {
    const first = new Subject<PagedResponse<ConsultaListadoDto>>(); const second = new Subject<PagedResponse<ConsultaListadoDto>>();
    listar.and.returnValues(first, second); const c = render(); c.filtroDesde = '2026-01-01'; c.buscar();
    expect(first.observed).toBeFalse(); second.next(page([item(80)], 1, 1, 10)); first.next(page([item(1)], 1, 1, 10));
    expect(c.consultas[0].idConsulta).toBe(80);
  });
  it('ignora una respuesta del paciente anterior', () => {
    const first = new Subject<PagedResponse<ConsultaListadoDto>>(); listar.and.returnValue(first);
    const c = render(); c.idPaciente = 30; listar.and.returnValue(of(page([item(90, 30)], 1, 1, 10))); c.cargarConsultas();
    expect(first.observed).toBeFalse(); first.next(page([item(1)], 1, 1, 10)); expect(c.consultas[0].idPaciente).toBe(30);
  });
  it('cancela y limpia el historial cuando cambia la sesión', () => {
    const pending = new Subject<PagedResponse<ConsultaListadoDto>>(); listar.and.returnValue(pending);
    const c = render(); listar.and.returnValue(of(page([item(80)], 1, 1, 10)));
    userId.set(2); token = 'token-two'; fixture.detectChanges();
    expect(pending.observed).toBeFalse(); expect(c.consultas.map(x => x.idConsulta)).toEqual([80]); expect(c.totalPages).toBe(1);
  });
  it('no consulta y limpia datos al revocar Consultas/Consultar', () => {
    const c = render(); read.set(false); fixture.detectChanges(); c.cargarConsultas();
    expect(c.consultas).toEqual([]); expect(c.error).toContain('Consultar'); expect(listar).toHaveBeenCalledTimes(1);
  });
  for (const status of [400, 401, 403, 404, 409, 500]) {
    it(`muestra error ${status} de una página sin conservar filas antiguas`, () => {
      listar.and.returnValue(throwError(() => problem(status))); const c = render();
      expect(c.consultas).toEqual([]); expect(c.total).toBe(0); expect(c.cargando).toBeFalse();
      expect(c.error).toContain(status === 400 ? 'Descripción inválida' : status === 403 ? 'autorización'
        : status === 404 || status === 409 ? `Detalle ${status}` : 'historial');
    });
  }
  const badPages: Array<[string, PagedResponse<ConsultaListadoDto>]> = [
    ['page', { ...page([item(1)], 1, 1, 10), page: 2 }],
    ['pageSize', { ...page([item(1)], 1, 1, 10), pageSize: 20 }],
    ['totalPages', { ...page([item(1)], 1, 1, 10), totalPages: 2 }],
    ['items', { ...page([item(1)], 1, 2, 10) }],
    ['paciente', page([item(1, 99)], 1, 1, 10)],
  ];
  for (const [caso, respuesta] of badPages) {
    it(`rechaza metadatos o identidad contradictorios: ${caso}`, () => {
      listar.and.returnValue(of(respuesta)); const c = render();
      expect(c.consultas).toEqual([]); expect(c.error).toContain('contradictoria');
    });
  }
});
