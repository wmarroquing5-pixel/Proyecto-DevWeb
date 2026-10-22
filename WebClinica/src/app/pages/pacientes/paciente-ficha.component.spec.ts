import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { ContactoEmergenciaResponse } from '../../core/models/contacto-emergencia.model';
import { ConsultaDetalleDto, ConsultaListadoDto, DiagnosticoResponse, ExamenResponseDto, HistorialMedicoResponseDto, TratamientoResponseDto } from '../../core/models/historial.model';
import { PacienteResponse } from '../../core/models/paciente.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ContactosEmergenciaService } from '../../core/services/contacto-emergencia.service';
import { HistorialService } from '../../core/services/historial.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { PacienteFichaComponent } from './paciente-ficha.component';
import { routes } from '../../app.routes';
import { permisoGuard } from '../../core/guards/permiso.guard';
import { MODULOS_PERMISO, OPERACIONES_PERMISO } from '../../core/models/permiso.model';

const paciente = (id = 41, activo = true, urlFoto: string | null = null): PacienteResponse => ({
  idPaciente: id, activo, urlFoto, nombres: 'María', apellidos: 'Paz', fechaNacimiento: '1990-02-28',
  fechaRegistro: '2026-01-01T00:00:00Z', dpi: '123', telefono: '5555', direccion: 'Zona 1',
});
const contacto = (idContacto: number, idPaciente = 41, activo = true): ContactoEmergenciaResponse => ({
  idContacto, idPaciente, activo, nombres: `Contacto ${idContacto}`, apellidos: 'Paz',
  telefono: '5555', direccion: 'Zona 1', parentesco: 'Madre', correoElectronico: null,
});
const consulta = (idConsulta: number, idPaciente = 41): ConsultaListadoDto => ({
  idConsulta, idPaciente, idMedico: 5, idSucursal: 2, idClinica: null, fechaConsulta: '2026-03-01T10:00:00Z',
});
const pagina = <T>(items: T[], page = 1, pageSize = 10, totalCount = items.length) => ({
  items, page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize),
});
const errorHttp = (status: number) => new HttpErrorResponse({ status, error: { detail: `Fallo ${status}` } });

describe('WEB-PAC-04 ficha médica de solo lectura', () => {
  let fixture: ComponentFixture<PacienteFichaComponent>;
  let pacientes: jasmine.SpyObj<PacientesService>;
  let contactos: jasmine.SpyObj<ContactosEmergenciaService>;
  let historial: jasmine.SpyObj<HistorialService>;
  let empleados: jasmine.SpyObj<EmpleadosService>;
  let parametros: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let usuario = signal<{ idUsuario: number; idRol: number } | null>({ idUsuario: 1, idRol: 1 });
  let permisos = signal(new Set<string>());
  let token = 'token-uno';

  beforeEach(async () => {
    parametros = new BehaviorSubject(convertToParamMap({ id: '41' }));
    usuario = signal({ idUsuario: 1, idRol: 1 }); token = 'token-uno';
    permisos = signal(new Set(['Pacientes', 'ContactosEmergencia', 'Consultas', 'Historial', 'Empleados']));
    pacientes = jasmine.createSpyObj<PacientesService>('PacientesService', ['obtener', 'obtenerFoto', 'crear', 'actualizar', 'eliminar', 'guardarFoto']);
    pacientes.obtener.and.returnValue(of(paciente()));
    contactos = jasmine.createSpyObj<ContactosEmergenciaService>('ContactosEmergenciaService', ['listar', 'crear', 'actualizar', 'eliminar']);
    contactos.listar.and.returnValue(of(pagina([], 1, 100)));
    historial = jasmine.createSpyObj<HistorialService>('HistorialService', ['listarConsultas', 'obtenerConsulta', 'listarDiagnosticos', 'listarTratamientos',
      'listarExamenes', 'listarHistorial', 'crearConsulta', 'actualizarConsulta', 'crearDiagnostico', 'crearTratamiento', 'crearExamen', 'crearEvolucion']);
    historial.listarConsultas.and.returnValue(of(pagina([])));
    historial.obtenerConsulta.and.returnValue(of({ ...consulta(7), motivoConsulta: 'Consulta general' } as ConsultaDetalleDto));
    empleados = jasmine.createSpyObj<EmpleadosService>('EmpleadosService', ['obtener']);
    empleados.obtener.and.returnValue(of({ idEmpleado: 5, idSucursal: 2, nombres: 'Ana', apellidos: 'López',
      dpi: '1', tipoEmpleado: 'Medico', activo: true }));
    historial.listarDiagnosticos.and.returnValue(of(pagina([], 1, 100)));
    historial.listarTratamientos.and.returnValue(of(pagina([], 1, 100)));
    historial.listarExamenes.and.returnValue(of(pagina([], 1, 100)));
    historial.listarHistorial.and.returnValue(of(pagina([], 1, 100)));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:foto-protegida');
    spyOn(URL, 'revokeObjectURL');
    await TestBed.configureTestingModule({ imports: [PacienteFichaComponent], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { paramMap: parametros.asObservable() } },
      { provide: PacientesService, useValue: pacientes },
      { provide: ContactosEmergenciaService, useValue: contactos },
      { provide: HistorialService, useValue: historial },
      { provide: EmpleadosService, useValue: empleados },
      { provide: AuthSessionService, useValue: { currentUser: usuario, isAuthenticated: () => !!usuario(), get token() { return token; } } },
      { provide: PermisosService, useValue: {
        puedeConsultar: (modulo: string) => permisos().has(modulo),
        puedeCrear: () => false, puedeModificar: () => false, puedeEliminar: () => false,
      } },
    ] }).compileComponents();
  });

  function abrir(): PacienteFichaComponent {
    fixture = TestBed.createComponent(PacienteFichaComponent); fixture.detectChanges(); return fixture.componentInstance;
  }
  function texto(): string { fixture.detectChanges(); return (fixture.nativeElement as HTMLElement).textContent ?? ''; }

  it('registra la ruta descriptiva con guard Pacientes/Consultar', () => {
    const ruta = routes.find(r => r.children)?.children?.find(r => r.path === 'pacientes/:id/ficha');
    expect(ruta?.canActivate).toContain(permisoGuard);
    expect(ruta?.data?.['permisos']).toEqual([{ modulo: MODULOS_PERMISO.PACIENTES, operacion: OPERACIONES_PERMISO.CONSULTAR }]);
    expect(ruta?.loadComponent).toBeDefined();
  });

  it('presenta paciente, estado, datos reales y encabezados', () => {
    const ficha = abrir(); const host = fixture.nativeElement as HTMLElement;
    expect(pacientes.obtener).toHaveBeenCalledOnceWith(41);
    expect(host.querySelector('h1')?.textContent).toContain('Ficha Médica del Paciente');
    expect(host.querySelector('#ficha-generales')).not.toBeNull();
    expect(host.querySelector('#ficha-contactos')).not.toBeNull();
    expect(host.querySelector('#ficha-historial')).not.toBeNull();
    expect(texto()).toContain('María Paz'); expect(texto()).toContain('Identificador interno: 41');
    expect(texto()).toContain('DPI'); expect(texto()).toContain('Zona 1');
    const hoy = new Date(); const edadEsperada = hoy.getFullYear() - 1990 -
      (hoy.getMonth() + 1 < 2 || (hoy.getMonth() + 1 === 2 && hoy.getDate() < 28) ? 1 : 0);
    expect(ficha.edad).toBe(edadEsperada);
    expect(host.querySelector<HTMLAnchorElement>('a[href="/historial/41"]')).toBeNull();
    expect(host.querySelector<HTMLAnchorElement>('a[href="/pacientes"]')).not.toBeNull();
  });

  it('organiza los doce datos en dos grupos de seis y admite valores largos sin omitir campos', () => {
    const direccion = 'Avenida de prueba '.repeat(20);
    pacientes.obtener.and.returnValue(of({ ...paciente(), direccion, correo: 'persona.con.nombre.largo@ejemplo.com' }));
    abrir();
    const host = fixture.nativeElement as HTMLElement;
    const columnas = [...host.querySelectorAll<HTMLElement>('.ficha-datos__col')];
    expect(columnas.length).toBe(2);
    expect([...columnas[0].querySelectorAll('dt')].map(c => c.textContent?.trim())).toEqual([
      'Nombres', 'Apellidos', 'DPI', 'Fecha de nacimiento', 'Edad', 'Género',
    ]);
    expect([...columnas[1].querySelectorAll('dt')].map(c => c.textContent?.trim())).toEqual([
      'Tipo de sangre', 'Teléfono', 'Correo electrónico', 'NIT', 'Nombre de facturación', 'Dirección',
    ]);
    expect(host.querySelectorAll('.ficha-datos dd').length).toBe(12);
    expect(host.querySelectorAll('.ficha-datos dd')[11].textContent?.trim()).toBe(direccion.trim());
    const estilos = (PacienteFichaComponent as unknown as { ɵcmp: { styles: string[] } }).ɵcmp.styles.join('\n');
    expect(estilos).toMatch(/display:\s*grid/);
    expect(estilos).toMatch(/@media\s*\(min-width:\s*992px\)/);
    expect(estilos).toContain('grid-template-columns: repeat(2, minmax(0, 1fr))');
    expect(estilos).toContain('overflow-wrap: anywhere');
    const grid = getComputedStyle(host.querySelector('.ficha-datos')!).gridTemplateColumns.trim().split(/\s+/);
    expect(grid.length).toBe(matchMedia('(min-width: 992px)').matches ? 2 : 1);
  });

  it('muestra un paciente inactivo sin confundirlo con un error', () => {
    pacientes.obtener.and.returnValue(of(paciente(41, false)));
    const ficha = abrir(); expect(ficha.errorPaciente).toBe(''); expect(texto()).toContain('Inactivo');
  });

  it('rechaza ID inválido y respuesta de otro paciente sin exponerla', () => {
    parametros.next(convertToParamMap({ id: '0' }));
    const ficha = abrir(); expect(pacientes.obtener).not.toHaveBeenCalled(); expect(ficha.errorPaciente).toContain('inválido');
    pacientes.obtener.and.returnValue(of(paciente(99))); parametros.next(convertToParamMap({ id: '41' }));
    expect(ficha.paciente).toBeNull(); expect(ficha.errorPaciente).toContain('contradictorio');
  });

  it('distingue inexistencia, 401 y 403 al cargar el paciente', () => {
    for (const status of [404, 401, 403]) {
      pacientes.obtener.and.returnValue(throwError(() => errorHttp(status)));
      const ficha = abrir(); expect(ficha.paciente).toBeNull(); expect(ficha.errorPaciente).toBeTruthy();
      if (status === 404) expect(ficha.errorPaciente).toContain('no encontrado');
      fixture.destroy();
    }
  });

  it('impide toda lectura sin Pacientes/Consultar', () => {
    permisos.update(actual => new Set([...actual].filter(p => p !== 'Pacientes')));
    const ficha = abrir(); expect(ficha.errorPaciente).toContain('Pacientes/Consultar');
    expect(pacientes.obtener).not.toHaveBeenCalled(); expect(contactos.listar).not.toHaveBeenCalled();
    expect(historial.listarConsultas).not.toHaveBeenCalled();
  });

  it('carga fotografía solo mediante Blob protegido y trata 404 como ausencia', () => {
    pacientes.obtener.and.returnValue(of(paciente(41, true, 'https://r2.invalid/no-usar')));
    pacientes.obtenerFoto.and.returnValue(of(new Blob(['imagen'], { type: 'image/webp' })));
    const ficha = abrir(); expect(pacientes.obtenerFoto).toHaveBeenCalledOnceWith(41);
    expect(ficha.fotoUrl).toBe('blob:foto-protegida');
    expect((fixture.nativeElement as HTMLElement).querySelector('img')?.getAttribute('src')).toBe('blob:foto-protegida');
    expect((fixture.nativeElement as HTMLElement).innerHTML).not.toContain('https://r2.invalid/no-usar');
    fixture.destroy(); expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto-protegida');
    pacientes.obtenerFoto.and.returnValue(throwError(() => errorHttp(404)));
    const sinFoto = abrir(); expect(sinFoto.fotoUrl).toBeNull(); expect(sinFoto.errorFoto).toContain('Sin fotografía');
  });

  for (const cantidad of [0, 1, 10]) {
    it(`representa ${cantidad} contactos de la página actual`, () => {
      contactos.listar.and.returnValue(of(pagina(Array.from({ length: cantidad }, (_, i) => contacto(i + 1)), 1, 100)));
      const ficha = abrir(); expect(ficha.contactos.length).toBe(cantidad);
      if (cantidad) expect(texto()).toContain('Contacto 1'); else expect(texto()).toContain('Sin contactos');
    });
  }

  it('carga todos los contactos sin paginador visible y distingue contacto retirado', () => {
    contactos.listar.and.callFake((_id, page) => of(page === 1
      ? pagina(Array.from({ length: 100 }, (_, i) => contacto(i + 1)), 1, 100, 101)
      : pagina([contacto(101, 41, false)], 2, 100, 101)));
    const ficha = abrir();
    expect(contactos.listar).toHaveBeenCalledWith(41, 2, 100);
    expect(ficha.contactos.length).toBe(101); expect(texto()).toContain('Retirado');
    expect((fixture.nativeElement as HTMLElement).querySelector('nav[aria-label="Páginas de contactos"]')).toBeNull();
  });

  it('no presenta contactos parciales si falla otra página y permite recargar el conjunto', () => {
    contactos.listar.and.callFake((_id, page) => page === 1
      ? of(pagina(Array.from({ length: 100 }, (_, i) => contacto(i + 1)), 1, 100, 101))
      : throwError(() => errorHttp(503)));
    const ficha = abrir();
    expect(ficha.contactos).toEqual([]);
    expect(ficha.errorContactos).toBeTruthy();
    expect(texto()).not.toContain('Contacto 1 Paz');
    const recargar = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('#ficha-contactos + app-ui-state button');
    expect(recargar?.textContent).toContain('Reintentar');
    contactos.listar.and.callFake((_id, page) => of(page === 1
      ? pagina(Array.from({ length: 100 }, (_, i) => contacto(i + 1)), 1, 100, 101)
      : pagina([contacto(101)], 2, 100, 101)));
    recargar?.click(); fixture.detectChanges();
    expect(ficha.errorContactos).toBe('');
    expect(ficha.contactos.length).toBe(101);
  });

  it('rechaza contactos ajenos al paciente', () => {
    contactos.listar.and.returnValue(of(pagina([contacto(1, 99)], 1, 100)));
    const ficha = abrir(); expect(ficha.contactos).toEqual([]); expect(ficha.errorContactos).toContain('contradictorios');
    expect(texto()).not.toContain('Contacto 1');
  });

  it('muestra historial vacío y varias consultas con el ID del paciente', () => {
    const ficha = abrir(); expect(texto()).toContain('Sin consultas registradas'); fixture.destroy();
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7), consulta(8)])));
    const conConsultas = abrir(); expect(conConsultas.consultas.length).toBe(2);
    expect(historial.listarConsultas.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ idPaciente: 41 }));
    expect(texto()).toContain('Consulta general'); expect(texto()).toContain('Ana López');
    expect(texto()).not.toContain('Acciones de lectura');
    expect((fixture.nativeElement as HTMLElement).querySelector('th:last-child')?.textContent).toBe('Acciones');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/historial/41/consulta/7"]')).toBeNull();
  });

  it('no consulta empleados sin permiso y no inventa nombres cuando faltan datos', () => {
    permisos.update(actual => new Set([...actual].filter(p => p !== 'Empleados')));
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    historial.obtenerConsulta.and.returnValue(of({ ...consulta(7), motivoConsulta: null } as ConsultaDetalleDto));
    abrir();
    expect(empleados.obtener).not.toHaveBeenCalled();
    expect(texto()).toContain('Consulta sin motivo registrado');
    expect(texto()).toContain('Médico no disponible');
  });

  it('reutiliza durante la ficha los nombres ya obtenidos al recargar consultas', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    const ficha = abrir();
    expect(texto()).toContain('Consulta general');
    expect(texto()).toContain('Ana López');
    ficha.cargarConsultas();
    expect(historial.obtenerConsulta).toHaveBeenCalledTimes(1);
    expect(empleados.obtener).toHaveBeenCalledTimes(1);
  });

  it('limpia el nombre del médico al revocarse Empleados/Consultar', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    abrir(); expect(texto()).toContain('Ana López');
    permisos.update(actual => new Set([...actual].filter(p => p !== 'Empleados')));
    fixture.detectChanges();
    expect(texto()).not.toContain('Ana López');
    expect(texto()).toContain('Médico no disponible');
  });

  it('carga diagnósticos, tratamientos, examen derivado y evolución asociados a la consulta', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    const diagnostico: DiagnosticoResponse = { idDiagnostico: 2, idConsulta: 7, idMedico: 5, descripcion: 'Diagnóstico real', fechaRegistro: '2026-03-01T10:00:00Z' };
    const tratamiento: TratamientoResponseDto = { idTratamiento: 3, idConsulta: 7, idPaciente: 41, idMedico: 5,
      descripcion: 'Tratamiento real', indicaciones: 'Reposo', fechaInicio: '2026-03-01', fechaFin: null, idLote: null, cantidad: null };
    const evolucion: HistorialMedicoResponseDto = { idHistorial: 4, idConsulta: 7, idPaciente: 41, idMedico: 5,
      idDiagnostico: 2, descripcion: 'Evolución real', fechaHistorial: '2026-03-02T10:00:00Z' };
    const examen: ExamenResponseDto = { idExamen: 5, idConsulta: null, idDiagnostico: 2, idTurno: null,
      nombreExamen: 'Hemograma', fechaExamen: '2026-03-02T10:00:00Z', fechaResultado: '2026-03-03', prioridad: null,
      idPaciente: 41, idMedico: 5 };
    historial.listarDiagnosticos.and.returnValue(of(pagina([diagnostico], 1, 100)));
    historial.listarTratamientos.and.returnValue(of(pagina([tratamiento], 1, 100)));
    historial.listarHistorial.and.returnValue(of(pagina([evolucion], 1, 100)));
    historial.listarExamenes.and.callFake(filtro => of(pagina(filtro.idDiagnostico === 2 ? [examen] : [], 1, 100)));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    expect(ficha.resumen?.diagnosticos).toEqual([diagnostico]); expect(ficha.resumen?.tratamientos).toEqual([tratamiento]);
    expect(ficha.resumen?.examenes).toEqual([examen]); expect(ficha.resumen?.evoluciones).toEqual([evolucion]);
    expect(texto()).toContain('Diagnóstico real'); expect(texto()).toContain('Tratamiento real');
    expect(texto()).toContain('El contrato de exámenes no proporciona contenido de resultados');
  });

  it('muestra el resumen descriptivo, sus cuatro secciones y cierra a la ficha', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    const host = fixture.nativeElement as HTMLElement;
    expect(texto()).toContain('Resumen clínico de María Paz');
    expect(texto()).toContain('Consulta general');
    expect(texto()).toContain('Ana López');
    expect(texto()).not.toContain('Resumen de consulta ID');
    for (const titulo of ['Diagnósticos', 'Tratamientos', 'Exámenes', 'Evolución']) {
      expect(host.querySelector('.resumen-contenido')?.textContent).toContain(titulo);
    }
    expect(host.querySelector<HTMLButtonElement>('.resumen-header button')?.disabled).toBeTrue();
    host.querySelector<HTMLButtonElement>('.resumen-header button:last-child')?.click();
    expect(ficha.consultaResumen).toBeNull();
    expect(texto()).toContain('Ficha Médica del Paciente');
  });

  it('abre un único panel debajo del historial sin cambiar ruta y devuelve el foco al cerrar', async () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7), consulta(8)])));
    abrir();
    const host = fixture.nativeElement as HTMLElement;
    const botones = host.querySelectorAll<HTMLButtonElement>('section[aria-labelledby="ficha-historial"] tbody button');
    const origen = botones[0];
    const url = location.href;
    const ventana = spyOn(window, 'open');
    origen.click(); fixture.detectChanges();
    const panel = host.querySelector<HTMLElement>('#ficha-resumen');
    expect(panel).not.toBeNull();
    expect(host.querySelectorAll('#ficha-resumen').length).toBe(1);
    expect(panel?.previousElementSibling).toBe(host.querySelector('section[aria-labelledby="ficha-historial"]'));
    expect(host.querySelector('#ficha-generales')).not.toBeNull();
    expect(host.querySelector('section[aria-labelledby="ficha-historial"] table')).not.toBeNull();
    expect(location.href).toBe(url);
    expect(ventana).not.toHaveBeenCalled();
    await fixture.whenStable();
    expect(document.activeElement).toBe(panel);
    panel?.querySelector<HTMLButtonElement>('.resumen-header button:last-child')?.click(); fixture.detectChanges();
    expect(host.querySelector('#ficha-resumen')).toBeNull();
    expect(document.activeElement).toBe(origen);
    botones[1].click(); fixture.detectChanges();
    expect(host.querySelectorAll('#ficha-resumen').length).toBe(1);
  });

  it('navega entre resúmenes y respeta los límites entre páginas', () => {
    historial.listarConsultas.and.callFake(filtro => of(filtro.page === 1
      ? pagina(Array.from({ length: 10 }, (_, i) => consulta(i + 1)), 1, 10, 11)
      : pagina([consulta(11)], 2, 10, 11)));
    historial.obtenerConsulta.and.callFake(id => of({ ...consulta(id), motivoConsulta: `Consulta ${id}` } as ConsultaDetalleDto));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    expect(ficha.puedeIrAnterior).toBeFalse(); expect(ficha.puedeIrSiguiente).toBeTrue();
    ficha.navegarResumen(-1); expect(ficha.consultaResumen?.idConsulta).toBe(1);
    ficha.navegarResumen(1); expect(ficha.consultaResumen?.idConsulta).toBe(2);
    expect(ficha.puedeIrAnterior).toBeTrue(); expect(ficha.puedeIrSiguiente).toBeTrue();
    ficha.verResumen(ficha.consultas[9]); ficha.navegarResumen(1);
    expect(historial.listarConsultas.calls.mostRecent().args[0].page).toBe(2);
    expect(ficha.consultaResumen?.idConsulta).toBe(11);
    expect(ficha.puedeIrSiguiente).toBeFalse();
    expect(texto()).toContain('Consulta 11');
    ficha.navegarResumen(-1);
    expect(ficha.consultaResumen?.idConsulta).toBe(10);
    expect(ficha.paginaConsultas).toBe(1);
  });

  it('al navegar sustituye los datos clínicos del resumen anterior', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7), consulta(8)])));
    historial.listarDiagnosticos.and.callFake(filtro => of(pagina([{
      idDiagnostico: filtro.idConsulta!, idConsulta: filtro.idConsulta!, idMedico: 5,
      descripcion: `Diagnóstico consulta ${filtro.idConsulta}`, fechaRegistro: '2026-03-01T10:00:00Z',
    }], 1, 100)));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    expect(texto()).toContain('Diagnóstico consulta 7');
    ficha.navegarResumen(1);
    expect(texto()).toContain('Diagnóstico consulta 8');
    expect(texto()).not.toContain('Diagnóstico consulta 7');
  });

  it('descarta una respuesta clínica anterior al seleccionar otra consulta', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7), consulta(8)])));
    const anterior = new Subject<ReturnType<typeof pagina<DiagnosticoResponse>>>();
    const actual = new Subject<ReturnType<typeof pagina<DiagnosticoResponse>>>();
    historial.listarDiagnosticos.and.callFake(filtro => filtro.idConsulta === 7 ? anterior : actual);
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    ficha.verResumen(ficha.consultas[1]);
    expect(anterior.observed).toBeFalse();
    anterior.next(pagina([{ idDiagnostico: 7, idConsulta: 7, idMedico: 5,
      descripcion: 'Dato obsoleto', fechaRegistro: '2026-03-01T10:00:00Z' }], 1, 100));
    anterior.complete();
    actual.next(pagina([{ idDiagnostico: 8, idConsulta: 8, idMedico: 5,
      descripcion: 'Dato actual', fechaRegistro: '2026-03-01T10:00:00Z' }], 1, 100));
    actual.complete();
    expect(ficha.resumen?.consulta.idConsulta).toBe(8);
    expect(texto()).toContain('Dato actual');
    expect(texto()).not.toContain('Dato obsoleto');
  });

  it('conserva la ficha y muestra error si falla una sección del resumen', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    historial.listarTratamientos.and.returnValue(throwError(() => errorHttp(503)));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    const host = fixture.nativeElement as HTMLElement;
    expect(ficha.resumen).toBeNull();
    expect(ficha.errorResumen).toBeTruthy();
    expect(texto()).toContain('No fue posible cargar el resumen clínico');
    expect(host.querySelector('#ficha-resumen')).not.toBeNull();
    expect(host.querySelector('#ficha-historial')).not.toBeNull();
  });

  it('oculta el panel al cambiar de paciente o perder sesión', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    pacientes.obtener.and.callFake(id => of(paciente(id)));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('#ficha-resumen')).not.toBeNull();
    parametros.next(convertToParamMap({ id: '42' })); fixture.detectChanges();
    expect(ficha.consultaResumen).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#ficha-resumen')).toBeNull();
    usuario.set(null); token = ''; fixture.detectChanges();
    expect(ficha.paciente).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#ficha-resumen')).toBeNull();
  });

  it('cerrar impide abrir un resumen de una página pendiente', () => {
    const paginaDos = new Subject<ReturnType<typeof pagina<ConsultaListadoDto>>>();
    historial.listarConsultas.and.callFake(filtro => filtro.page === 1
      ? of(pagina(Array.from({ length: 10 }, (_, i) => consulta(i + 1)), 1, 10, 11)) : paginaDos);
    const ficha = abrir(); ficha.verResumen(ficha.consultas[9]); ficha.navegarResumen(1);
    ficha.cerrarResumen();
    paginaDos.next(pagina([consulta(11)], 2, 10, 11));
    expect(ficha.consultaResumen).toBeNull();
    expect(texto()).toContain('Ficha Médica del Paciente');
  });

  it('rechaza un dato clínico de otro paciente y no permite resumen sin Historial/Consultar', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    historial.listarTratamientos.and.returnValue(of(pagina([{ idTratamiento: 3, idConsulta: 7, idPaciente: 99,
      idMedico: 5, descripcion: 'Ajeno', indicaciones: null, fechaInicio: '2026-03-01', fechaFin: null,
      idLote: null, cantidad: null }], 1, 100)));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    expect(ficha.resumen).toBeNull(); expect(ficha.errorResumen).toContain('ajena');
    permisos.update(actual => new Set([...actual].filter(p => p !== 'Historial'))); fixture.detectChanges();
    expect(ficha.resumen).toBeNull(); expect(texto()).toContain('Sin permiso Historial/Consultar');
  });

  it('oculta secciones clínicas o contactos sin su permiso específico', () => {
    permisos.set(new Set(['Pacientes'])); const ficha = abrir();
    expect(ficha.paciente).not.toBeNull(); expect(contactos.listar).not.toHaveBeenCalled();
    expect(historial.listarConsultas).not.toHaveBeenCalled();
    expect(texto()).toContain('Sin permiso ContactosEmergencia/Consultar');
    expect(texto()).toContain('Sin permiso Consultas/Consultar');
  });

  it('descarta la respuesta anterior al cambiar de paciente', () => {
    const anterior = new Subject<PacienteResponse>(); pacientes.obtener.and.callFake(id => id === 41 ? anterior : of(paciente(42)));
    const ficha = abrir(); parametros.next(convertToParamMap({ id: '42' })); fixture.detectChanges();
    expect(anterior.observed).toBeFalse(); anterior.next(paciente(41));
    expect(ficha.paciente?.idPaciente).toBe(42); expect(texto()).toContain('Identificador interno: 42');
  });

  it('borra datos y cancela respuestas pendientes al revocar la sesión', () => {
    const pendiente = new Subject<ReturnType<typeof pagina<ContactoEmergenciaResponse>>>();
    contactos.listar.and.returnValue(pendiente);
    const ficha = abrir(); expect(ficha.paciente?.idPaciente).toBe(41);
    usuario.set(null); token = ''; fixture.detectChanges();
    expect(pendiente.observed).toBeFalse(); expect(ficha.paciente).toBeNull();
    expect(ficha.errorPaciente).toContain('sesión'); expect(texto()).not.toContain('María Paz');
  });

  it('calcula edad solo para una fecha de nacimiento válida y no inventa datos ausentes', () => {
    pacientes.obtener.and.returnValue(of({ ...paciente(), fechaNacimiento: '2025-02-30', dpi: null, correo: null }));
    const ficha = abrir(); expect(ficha.edad).toBeNull();
    expect(texto()).toContain('No disponible'); expect(texto()).toContain('No registrado');
  });

  it('presenta explícitamente la fecha de nacimiento vacía como no registrada', () => {
    pacientes.obtener.and.returnValue(of({ ...paciente(), fechaNacimiento: '' }));
    abrir();
    const filas = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.ficha-datos__col:first-child dt')];
    const indice = filas.findIndex(fila => fila.textContent?.trim() === 'Fecha de nacimiento');
    expect(indice).toBe(3);
    const valores = (fixture.nativeElement as HTMLElement).querySelectorAll('.ficha-datos__col:first-child dd');
    expect(valores[indice].textContent?.trim()).toBe('No registrado');
  });

  it('no invoca POST, PUT ni DELETE desde la ficha', () => {
    historial.listarConsultas.and.returnValue(of(pagina([consulta(7)])));
    const ficha = abrir(); ficha.verResumen(ficha.consultas[0]);
    expect(pacientes.crear).not.toHaveBeenCalled(); expect(pacientes.actualizar).not.toHaveBeenCalled();
    expect(pacientes.eliminar).not.toHaveBeenCalled(); expect(pacientes.guardarFoto).not.toHaveBeenCalled();
    expect(contactos.crear).not.toHaveBeenCalled(); expect(contactos.actualizar).not.toHaveBeenCalled();
    expect(contactos.eliminar).not.toHaveBeenCalled(); expect(historial.crearConsulta).not.toHaveBeenCalled();
    expect(historial.actualizarConsulta).not.toHaveBeenCalled(); expect(historial.crearDiagnostico).not.toHaveBeenCalled();
    expect(historial.crearTratamiento).not.toHaveBeenCalled(); expect(historial.crearExamen).not.toHaveBeenCalled();
    expect(historial.crearEvolucion).not.toHaveBeenCalled();
  });
});
