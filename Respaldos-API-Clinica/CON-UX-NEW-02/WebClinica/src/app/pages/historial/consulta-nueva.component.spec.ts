import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { CatalogosService } from '../../core/services/catalogos.service';
import { HistorialService } from '../../core/services/historial.service';
import { ConsultaNuevaComponent } from './consulta-nueva.component';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PermisosService } from '../../core/services/permisos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PacientesService } from '../../core/services/paciente.service';
import { User } from '../../core/models/user.model';
import { EmpleadoDetalleResponse, EmpleadoListadoResponse, PagedResponse } from '../../core/models/empleado.model';
import { ConsultaCreateDto, ConsultaDetalleDto } from '../../core/models/historial.model';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';

describe('ConsultaNuevaComponent catálogos activos', () => {
  let fixture: ComponentFixture<ConsultaNuevaComponent>;
  let crearConsulta: jasmine.Spy;

  beforeEach(async () => {
    crearConsulta = jasmine.createSpy('crearConsulta').and.returnValue(of({
      idConsulta: 15, idPaciente: 8, idMedico: 2, idSucursal: 3, idClinica: null,
      fechaConsulta: '2026-10-20T10:00:00', motivoConsulta: null, sintomas: null,
      observaciones: null, pesoLb: null, presionDiastolica: null,
      presionSistolica: null, alturaCm: null,
    }));
    await TestBed.configureTestingModule({
      imports: [ConsultaNuevaComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: () => '8' } },
        } },
        { provide: HistorialService, useValue: { crearConsulta } },
        { provide: AuthSessionService, useValue: {
          currentUser: signal({ idUsuario: 1, idRol: 2, username: 'medico', idEmpleado: 2 }),
          isAuthenticated: () => true, token: 'test-token',
        } },
        { provide: PermisosService, useValue: { puedeCrear: () => true, puedeConsultar: (modulo: string) => modulo === 'Pacientes' } },
        { provide: PacientesService, useValue: {
          listar: () => of({ items: [{ idPaciente: 8, nombres: 'Luis', apellidos: 'Paz', activo: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }),
          obtener: () => of({ idPaciente: 8, nombres: 'Luis', apellidos: 'Paz', activo: true }),
        } },
        { provide: EmpleadosService, useValue: {} },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([
            { idSucursal: 3, nombre: 'Central', direccion: null, activa: true },
            { idSucursal: 4, nombre: 'Cerrada', direccion: null, activa: false },
          ]),
        } },
      ],
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ConsultaNuevaComponent);
    fixture.detectChanges();
  });

  it('ofrece únicamente sucursales activas con etiquetas descriptivas', () => {
    const component = fixture.componentInstance;
    expect(component.sucursales.map(item => item.idSucursal)).toEqual([3]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Central');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Cerrada');
  });

  it('conserva el identificador real y rechaza una sucursal inactiva', () => {
    const component = fixture.componentInstance;
    component.form.idSucursal = 4;
    component.guardar();
    expect(component.error).toContain('sucursal activa');
    expect(crearConsulta).not.toHaveBeenCalled();

    component.form.idSucursal = 3;
    component.guardar();
    expect(crearConsulta).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      idPaciente: 8, idSucursal: 3,
    }));
  });
});

describe('ConsultaNuevaComponent: atribución médica y autorización', () => {
  let fixture: ComponentFixture<ConsultaNuevaComponent>;
  let component: ConsultaNuevaComponent;
  let crear: jasmine.Spy, listar: jasmine.Spy, obtener: jasmine.Spy, navegar: jasmine.Spy;
  const user = signal<User | null>(null);
  const autenticado = signal(true), crearPermitido = signal(true), consultarPermitido = signal(true);
  const token = signal<string | null>('sesion-a');
  const medico = (id = 2, extra: Partial<EmpleadoListadoResponse> = {}): EmpleadoDetalleResponse => ({
    idEmpleado: id, idSucursal: 9, nombres: 'Ana', apellidos: 'García', tipoEmpleado: 'Medico',
    activo: true, dpi: 'test', ...extra,
  });
  const pagina = (items: EmpleadoListadoResponse[], page = 1, total = items.length): PagedResponse<EmpleadoListadoResponse> => ({
    items, page, pageSize: 20, totalCount: total, totalPages: Math.ceil(total / 20),
  });
  const respuesta = (idMedico = 2): ConsultaDetalleDto => ({
    idConsulta: 15, idPaciente: 8, idMedico, idSucursal: 3, idClinica: null,
    fechaConsulta: '2026-10-21T10:00:00', motivoConsulta: null, sintomas: null,
    observaciones: null, pesoLb: null, presionDiastolica: null, presionSistolica: null, alturaCm: null,
  });
  const iniciar = () => {
    fixture = TestBed.createComponent(ConsultaNuevaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.form.idSucursal = 3;
  };
  const seleccionar = () => component.seleccionarMedico(2);
  beforeEach(async () => {
    user.set({ idUsuario: 1, idRol: 99, username: 'autorizado', idEmpleado: null });
    autenticado.set(true); token.set('sesion-a'); crearPermitido.set(true); consultarPermitido.set(true);
    crear = jasmine.createSpy('crearConsulta').and.returnValue(of(respuesta()));
    listar = jasmine.createSpy('listar').and.returnValue(of(pagina([medico()])));
    obtener = jasmine.createSpy('obtener').and.callFake((id: number) => of(medico(id)));
    await TestBed.configureTestingModule({ imports: [ConsultaNuevaComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => '8' } } } },
      { provide: AuthSessionService, useValue: {
        currentUser: user, isAuthenticated: autenticado, get token() { return token(); },
      } },
      { provide: PermisosService, useValue: {
        puedeCrear: (modulo: string) => modulo === 'Consultas' && crearPermitido(),
        puedeConsultar: (modulo: string) => modulo === 'Pacientes' || (modulo === 'Empleados' && consultarPermitido()),
      } },
      { provide: PacientesService, useValue: {
        listar: () => of({ items: [{ idPaciente: 8, nombres: 'Luis', apellidos: 'Paz', activo: true }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }),
        obtener: () => of({ idPaciente: 8, nombres: 'Luis', apellidos: 'Paz', activo: true }),
      } },
      { provide: HistorialService, useValue: { crearConsulta: crear } },
      { provide: EmpleadosService, useValue: { listar, obtener } },
      { provide: CatalogosService, useValue: { getSucursales: () => of([
        { idSucursal: 3, nombre: 'Central', activa: true }, { idSucursal: 4, nombre: 'Cerrada', activa: false },
      ]) } },
    ] }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  it('conserva inferencia del médico vinculado independientemente del nombre de rol', () => {
    user.update(u => ({ ...u!, idEmpleado: 2, roles: ['ADMINISTRADOR'] }));
    iniciar(); component.guardar();
    expect(component.modoMedico).toBe('inferencia');
    expect(listar).not.toHaveBeenCalled();
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idMedico: null }));
    expect(navegar).toHaveBeenCalledWith(['/historial', 8, 'consulta', 15]);
  });
  it('no consulta empleados sin permiso y deja la inferencia exclusivamente al servidor', () => {
    user.update(u => ({ ...u!, idEmpleado: 2 })); consultarPermitido.set(false);
    iniciar(); component.guardar();
    expect(obtener).not.toHaveBeenCalled(); expect(listar).not.toHaveBeenCalled();
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idMedico: null }));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No tiene permiso');
  });
  it('bloquea un IdMedico arbitrario en una sesión médica', () => {
    user.update(u => ({ ...u!, idEmpleado: 2 })); iniciar();
    component.form.idMedico = 7; component.guardar();
    expect(crear).not.toHaveBeenCalled(); expect(component.error).toContain('servidor');
  });
  it('bloquea al médico vinculado inactivo sin ofrecer sustituto', () => {
    user.update(u => ({ ...u!, idEmpleado: 2 })); obtener.and.returnValue(of(medico(2, { activo: false })));
    iniciar(); component.guardar();
    expect(component.errorMedicos).toContain('inactivo');
    expect(listar).not.toHaveBeenCalled(); expect(crear).not.toHaveBeenCalled();
  });
  it('ofrece selector al administrador autorizado sin empleado médico', () => {
    user.update(u => ({ ...u!, roles: ['ADMINISTRADOR'] })); iniciar(); seleccionar(); component.guardar();
    expect(component.modoMedico).toBe('seleccion');
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idMedico: 2 }));
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Ana García');
  });
  it('ofrece selector a otro perfil vinculado a empleado no médico', () => {
    user.update(u => ({ ...u!, idEmpleado: 10, roles: ['ENFERMERA'] }));
    obtener.and.callFake((id: number) => of(medico(id, { tipoEmpleado: id === 10 ? 'Enfermera' : 'Medico' })));
    iniciar(); seleccionar(); component.guardar();
    expect(component.modoMedico).toBe('seleccion');
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idMedico: 2 }));
  });
  it('exige selección explícita y no preselecciona al primer médico', () => {
    iniciar(); component.guardar();
    expect(component.form.idMedico).toBeNull(); expect(crear).not.toHaveBeenCalled();
    expect(component.error).toContain('Seleccione un médico');
  });
  it('envía el identificador numérico elegido mediante el control visible', async () => {
    iniciar(); await fixture.whenStable(); fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#medico')!;
    select.selectedIndex = 1; select.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    expect(component.form.idMedico).toBe(2);
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idMedico: 2 }));
  });
  it('consulta únicamente médicos activos sin inventar filtro de sucursal', () => {
    iniciar();
    expect(listar).toHaveBeenCalledOnceWith(undefined, 'Medico', undefined, true, 1, 20);
    seleccionar(); component.guardar();
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idSucursal: 3, idMedico: 2 }));
    expect(component.medicoSeleccionado?.idSucursal).toBe(9);
  });
  for (const [nombre, extra] of [
    ['inactivo', { activo: false }], ['no médico', { tipoEmpleado: 'Enfermera' }], ['tipo con otra capitalización', { tipoEmpleado: 'medico' }],
  ] as const) {
    it(`no muestra ni selecciona empleado ${nombre}`, () => {
      listar.and.returnValue(of(pagina([medico(2, extra)]))); iniciar(); seleccionar(); component.guardar();
      expect(component.medicos).toEqual([]); expect(component.form.idMedico).toBeNull();
      expect(crear).not.toHaveBeenCalled();
    });
    it(`revalida antes del POST y rechaza empleado ahora ${nombre}`, () => {
      iniciar(); seleccionar(); obtener.and.returnValue(of(medico(2, extra))); component.guardar();
      expect(crear).not.toHaveBeenCalled(); expect(component.form.idMedico).toBeNull();
      expect(component.cargando).toBeFalse();
    });
  }
  for (const id of [999, 0, -1, 1.5, 2147483648]) {
    it(`rechaza identificador ajeno o inválido ${id}`, () => {
      iniciar(); seleccionar(); component.form.idMedico = id; component.guardar();
      expect(crear).not.toHaveBeenCalled(); expect(obtener).not.toHaveBeenCalled();
    });
  }
  it('alcanza médico 101 fuera de la primera página y conserva selección al navegar', () => {
    listar.and.callFake((_n: unknown, _t: unknown, _s: unknown, _a: unknown, page: number) => of(pagina(
      Array.from({ length: page === 6 ? 1 : 20 }, (_, i) => medico((page - 1) * 20 + i + 1)), page, 101)));
    iniciar();
    for (let page = 2; page <= 6; page++) component.cargarMedicos(page);
    component.seleccionarMedico(101); component.cargarMedicos(1); fixture.detectChanges();
    expect(component.form.idMedico).toBe(101);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Médico #101');
    crear.and.returnValue(of(respuesta(101))); component.guardar();
    expect(obtener).toHaveBeenCalledWith(101);
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idMedico: 101 }));
  });
  it('permite catálogo vacío sin inventar médicos', () => {
    listar.and.returnValue(of(pagina([]))); iniciar(); component.guardar();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay médicos activos');
    expect(crear).not.toHaveBeenCalled();
  });
  it('rechaza metadatos incompletos en lugar de truncar el catálogo', () => {
    listar.and.returnValue(of(pagina([medico()], 1, 101))); iniciar(); component.guardar();
    expect(component.errorMedicos).toContain('paginación incoherente'); expect(crear).not.toHaveBeenCalled();
  });
  it('un error de catálogo puede recuperarse con recarga explícita', () => {
    listar.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 }))); iniciar();
    listar.and.returnValue(of(pagina([medico()]))); component.cargarMedicos(1);
    seleccionar(); component.guardar();
    expect(component.errorMedicos).toBe(''); expect(crear).toHaveBeenCalledTimes(1);
  });
  it('rechaza una relectura con identificador diferente del seleccionado', () => {
    iniciar(); seleccionar(); obtener.and.returnValue(of(medico(7))); component.guardar();
    expect(crear).not.toHaveBeenCalled(); expect(component.form.idMedico).toBeNull();
  });
  it('bloquea una respuesta de empleado vinculado que corresponde a otra persona', () => {
    user.update(u => ({ ...u!, idEmpleado: 2 })); obtener.and.returnValue(of(medico(7)));
    iniciar(); component.guardar();
    expect(component.errorMedicos).toContain('no corresponde'); expect(crear).not.toHaveBeenCalled();
  });
  it('no habilita sustitución tras error al verificar al empleado vinculado', () => {
    user.update(u => ({ ...u!, idEmpleado: 2 }));
    obtener.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    iniciar(); component.guardar();
    expect(component.modoMedico).toBe('bloqueado'); expect(component.errorMedicos).toContain('autorización');
    expect(listar).not.toHaveBeenCalled(); expect(crear).not.toHaveBeenCalled();
  });
  it('descarta el catálogo antiguo cuando llega una nueva página', () => {
    const anterior = new Subject<PagedResponse<EmpleadoListadoResponse>>();
    iniciar(); component.totalPaginasMedicos = 2;
    listar.and.returnValue(anterior); component.cargarMedicos(2);
    listar.and.returnValue(of(pagina([medico(3)]))); component.cargarMedicos(1);
    anterior.next(pagina([medico(99)], 2, 21));
    expect(component.medicos.map(m => m.idEmpleado)).toEqual([3]);
    expect(anterior.observed).toBeFalse();
  });
  it('no permite operar sin Consultas/Crear aunque el rol diga administrador', () => {
    crearPermitido.set(false); user.update(u => ({ ...u!, roles: ['ADMINISTRADOR'] })); iniciar(); component.guardar();
    expect(listar).not.toHaveBeenCalled(); expect(crear).not.toHaveBeenCalled();
    expect(component.error).toContain('Consultas/Crear');
  });
  it('informa ausencia de Empleados/Consultar sin ampliar permisos', () => {
    consultarPermitido.set(false); iniciar(); component.guardar();
    expect(component.errorMedicos).toContain('Empleados/Consultar');
    expect(listar).not.toHaveBeenCalled(); expect(crear).not.toHaveBeenCalled();
  });
  for (const status of [401, 403, 404, 500]) {
    it(`informa error ${status} de catálogo sin permitir alta`, () => {
      listar.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      iniciar(); component.guardar();
      expect(component.errorMedicos).toBeTruthy(); expect(crear).not.toHaveBeenCalled();
      if (status === 403) expect(component.errorMedicos).toContain('autorización');
      if (status === 401) expect(component.errorMedicos).toContain('expirado');
    });
    it(`no envía POST si relectura del médico falla con ${status}`, () => {
      iniciar(); seleccionar(); obtener.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      component.guardar(); expect(crear).not.toHaveBeenCalled(); expect(component.cargando).toBeFalse();
    });
    it(`no navega ni reintenta si POST devuelve ${status}`, () => {
      iniciar(); seleccionar(); crear.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      component.guardar(); expect(crear).toHaveBeenCalledTimes(1);
      expect(navegar).not.toHaveBeenCalled(); expect(component.error).toBeTruthy();
    });
  }
  it('conserva el ProblemDetails del servidor sin anunciar éxito', () => {
    iniciar(); seleccionar(); crear.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400,
      error: { errors: { IdMedico: ['El médico indicado está inactivo.'] } } })));
    component.guardar(); expect(component.error).toBe('El médico indicado está inactivo.');
    expect(navegar).not.toHaveBeenCalled();
  });
  it('evita doble envío durante relectura y POST pendiente', () => {
    const lectura = new Subject<EmpleadoDetalleResponse>(), post = new Subject<ConsultaDetalleDto>();
    iniciar(); seleccionar(); obtener.and.returnValue(lectura); crear.and.returnValue(post);
    component.guardar(); component.guardar(); expect(obtener).toHaveBeenCalledTimes(1);
    lectura.next(medico()); component.guardar(); expect(crear).toHaveBeenCalledTimes(1);
    post.next(respuesta()); expect(navegar).toHaveBeenCalledTimes(1);
  });
  it('captura el DTO antes de una relectura asincrónica', () => {
    const lectura = new Subject<EmpleadoDetalleResponse>(); iniciar(); seleccionar(); obtener.and.returnValue(lectura);
    component.form.fechaConsulta = '2026-10-21T10:00'; component.guardar();
    component.form.fechaConsulta = '2026-10-22T11:00'; component.form.idMedico = 99; lectura.next(medico());
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ fechaConsulta: '2026-10-21T10:00', idMedico: 2 }));
  });
  it('descarta catálogo de otra identidad y reinicia selección', () => {
    const catalogo = new Subject<PagedResponse<EmpleadoListadoResponse>>();
    listar.and.returnValue(catalogo); iniciar(); user.set({ idUsuario: 5, idRol: 3, username: 'nuevo' });
    listar.and.returnValue(of(pagina([medico(5)]))); fixture.detectChanges(); catalogo.next(pagina([medico(99)]));
    expect(component.medicos.map(m => m.idEmpleado)).toEqual([5]);
    expect(component.form.idMedico).toBeNull(); expect(catalogo.observed).toBeFalse();
  });
  it('descarta verificación vinculada después de cambiar la sesión', () => {
    const propia = new Subject<EmpleadoDetalleResponse>(); user.update(u => ({ ...u!, idEmpleado: 2 }));
    obtener.and.returnValue(propia); iniciar();
    user.set({ idUsuario: 5, idRol: 1, username: 'nuevo' }); fixture.detectChanges(); propia.next(medico());
    expect(component.modoMedico).toBe('seleccion'); expect(propia.observed).toBeFalse();
  });
  it('no convierte relectura tardía en POST bajo otra identidad aunque no haya render', () => {
    const lectura = new Subject<EmpleadoDetalleResponse>(); iniciar(); seleccionar(); obtener.and.returnValue(lectura);
    component.guardar(); token.set('sesion-b'); lectura.next(medico());
    expect(crear).not.toHaveBeenCalled();
  });
  it('no navega por respuesta POST de una sesión anterior', () => {
    const post = new Subject<ConsultaDetalleDto>(); iniciar(); seleccionar(); crear.and.returnValue(post);
    component.guardar(); token.set('sesion-b'); post.next(respuesta());
    expect(navegar).not.toHaveBeenCalled();
  });
  it('revocar consulta de empleados elimina selección y cancela relectura pendiente', () => {
    const lectura = new Subject<EmpleadoDetalleResponse>(); iniciar(); seleccionar(); obtener.and.returnValue(lectura);
    component.guardar(); consultarPermitido.set(false); fixture.detectChanges(); lectura.next(medico());
    expect(component.form.idMedico).toBeNull(); expect(crear).not.toHaveBeenCalled();
    expect(lectura.observed).toBeFalse();
  });
  it('revocar Consultas/Crear bloquea una selección previamente válida', () => {
    iniciar(); seleccionar(); crearPermitido.set(false); component.guardar();
    expect(crear).not.toHaveBeenCalled(); fixture.detectChanges(); expect(component.form.idMedico).toBeNull();
  });
  it('cierre de sesión cancela catálogo pendiente y bloquea guardar', () => {
    const catalogo = new Subject<PagedResponse<EmpleadoListadoResponse>>();
    listar.and.returnValue(catalogo); iniciar(); autenticado.set(false); user.set(null); token.set(null);
    fixture.detectChanges(); catalogo.next(pagina([medico()])); component.guardar();
    expect(catalogo.observed).toBeFalse(); expect(component.medicos).toEqual([]);
    expect(crear).not.toHaveBeenCalled();
  });
  it('destruir el componente cancela POST y no aplica respuesta tardía', () => {
    const post = new Subject<ConsultaDetalleDto>(); iniciar(); seleccionar(); crear.and.returnValue(post);
    component.guardar(); fixture.destroy(); post.next(respuesta());
    expect(post.observed).toBeFalse(); expect(navegar).not.toHaveBeenCalled();
  });
  it('no anuncia éxito de una respuesta con otra atribución', () => {
    iniciar(); seleccionar(); crear.and.returnValue(of(respuesta(99))); component.guardar();
    expect(navegar).not.toHaveBeenCalled(); expect(component.error).toContain('no confirma');
  });
});

describe('Contrato HTTP de creación de consultas', () => {
  let http: HttpTestingController;
  let service: HistorialService;
  const invalidar = jasmine.createSpy('invalidateForToken');
  beforeEach(() => {
    invalidar.calls.reset();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: { token: 'test-token', invalidateForToken: invalidar } },
    ] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(HistorialService);
  });
  afterEach(() => http.verify());
  const dto = (idMedico: number | null): ConsultaCreateDto => ({
    idPaciente: 8, idSucursal: 3, idMedico, idClinica: null, fechaConsulta: '2026-10-21T10:00:00',
  });
  for (const id of [null, 101]) {
    it(`envía IdMedico ${id} en el DTO y conserva la atribución de respuesta simulada`, () => {
      let recibido: ConsultaDetalleDto | undefined;
      const request = dto(id); service.crearConsulta(request).subscribe(r => recibido = r);
      const req = http.expectOne(`${environment.apiUrl}/consultas`);
      expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(request);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(Object.keys(req.request.body)).not.toContain('idUsuario');
      expect(Object.keys(req.request.body)).toEqual(['idPaciente', 'idSucursal', 'idMedico', 'idClinica', 'fechaConsulta']);
      req.flush({ ...request, idConsulta: 15, idMedico: id ?? 2, motivoConsulta: null,
        sintomas: null, observaciones: null, pesoLb: null, alturaCm: null,
        presionSistolica: null, presionDiastolica: null });
      expect(recibido?.idMedico).toBe(id ?? 2);
    });
  }
  it('401 invalida exactamente el token usado, a través del interceptor actual', () => {
    service.crearConsulta(dto(null)).subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/consultas`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(invalidar).toHaveBeenCalledOnceWith('test-token');
  });
  it('403 no invalida la sesión ni reintenta el POST', () => {
    let status = 0; service.crearConsulta(dto(2)).subscribe({ error: err => status = err.status });
    http.expectOne(`${environment.apiUrl}/consultas`).flush({}, { status: 403, statusText: 'Forbidden' });
    expect(status).toBe(403); expect(invalidar).not.toHaveBeenCalled();
  });
  it('el catálogo usa los filtros y paginación existentes sin permisos en el payload', () => {
    TestBed.inject(EmpleadosService).listar(undefined, 'Medico', undefined, true, 6, 20).subscribe();
    const req = http.expectOne(r => r.url === `${environment.apiUrl}/empleados`);
    expect(req.request.params.keys().sort()).toEqual(['activo', 'page', 'pageSize', 'tipoEmpleado']);
    expect(req.request.params.get('page')).toBe('6'); expect(req.request.params.get('pageSize')).toBe('20');
    expect(req.request.params.get('tipoEmpleado')).toBe('Medico'); expect(req.request.params.get('activo')).toBe('true');
    req.flush({ items: [], page: 6, pageSize: 20, totalCount: 0, totalPages: 0 });
  });
});
