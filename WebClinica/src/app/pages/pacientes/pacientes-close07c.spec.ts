import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { GuardarPacienteRequest, PacienteListadoResponse, PacienteResponse, PagedResponse } from '../../core/models/paciente.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PacientesService } from '../../core/services/paciente.service';
import { ContactosEmergenciaService } from '../../core/services/contacto-emergencia.service';
import { PermisosService } from '../../core/services/permisos.service';
import { PacienteFormComponent } from './paciente-form.component';
import { PacientesComponent } from './pacientes.component';

const paciente: PacienteResponse = {
  idPaciente: 41, nombres: 'María', apellidos: 'López', activo: true,
  fechaNacimiento: '1990-02-28', fechaRegistro: '2026-01-01T00:00:00Z',
};
const pagina = (items: PacienteListadoResponse[] = [paciente]): PagedResponse<PacienteListadoResponse> => ({
  items, page: 1, pageSize: 10, totalCount: items.length, totalPages: items.length ? 1 : 0,
});
const problema = (status: number) => new HttpErrorResponse({ status, error: {
  detail: `Detalle ${status}`, errors: status === 400 ? { nombres: ['Validación del servidor'] } : undefined,
} });
const mensaje = (status: number, fallback: string) => status === 400 ? 'Validación del servidor'
  : status === 403 ? 'No tienes autorización para realizar esta operación.'
    : status === 401 || status >= 500 ? fallback : `Detalle ${status}`;

describe('Pacientes CLOSE-07C: formularios y contexto local', () => {
  let ruta: string | null;
  let token: string;
  let permisos: ReturnType<typeof signal<Set<string>>>;
  let usuario: ReturnType<typeof signal<{ idUsuario: number; idRol: number } | null>>;
  let api: jasmine.SpyObj<PacientesService>;
  let navegar: jasmine.Spy;
  let listado: ComponentFixture<PacientesComponent>;
  let formulario: ComponentFixture<PacienteFormComponent>;

  beforeEach(async () => {
    ruta = null; token = 'token-inicial';
    permisos = signal(new Set(['Consultar', 'Crear', 'Modificar', 'Eliminar']));
    usuario = signal<{ idUsuario: number; idRol: number } | null>({ idUsuario: 1, idRol: 1 });
    api = jasmine.createSpyObj<PacientesService>('PacientesService', ['listar', 'obtener', 'crear', 'actualizar', 'eliminar', 'obtenerFoto']);
    api.listar.and.returnValue(of(pagina())); api.obtener.and.returnValue(of(paciente));
    api.crear.and.returnValue(of(paciente)); api.actualizar.and.returnValue(of(paciente));
    api.eliminar.and.returnValue(of(void 0));
    api.obtenerFoto.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    await TestBed.configureTestingModule({
      imports: [PacientesComponent, PacienteFormComponent],
      providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { get paramMap() { return convertToParamMap(ruta === null ? {} : { id: ruta }); } } } },
        { provide: PacientesService, useValue: api },
        { provide: ContactosEmergenciaService, useValue: { listar: () => of({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 }) } },
        { provide: AuthSessionService, useValue: {
          currentUser: usuario, isAuthenticated: () => !!usuario(), get token() { return token; },
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: () => permisos().has('Consultar'), puedeCrear: () => permisos().has('Crear'),
          puedeModificar: () => permisos().has('Modificar'), puedeEliminar: () => permisos().has('Eliminar'),
        } },
      ],
    }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function abrirListado(): PacientesComponent {
    listado = TestBed.createComponent(PacientesComponent); listado.detectChanges();
    return listado.componentInstance;
  }
  function abrirFormulario(id: string | null = null): PacienteFormComponent {
    ruta = id; formulario = TestBed.createComponent(PacienteFormComponent); formulario.detectChanges();
    return formulario.componentInstance;
  }
  function completar(c: PacienteFormComponent): void {
    c.form.nombres = '  María   Elena '; c.form.apellidos = ' López '; c.form.fechaNacimiento = '1990-02-28';
  }
  function revocar(operacion: string): void { permisos.update(actual => new Set([...actual].filter(x => x !== operacion))); }

  for (const [indice, esperado] of [[0, undefined], [1, true], [2, false]] as const) {
    it(`envía Estado ${indice} con tipo boolean/undefined desde el select real`, async () => {
      const c = abrirListado(); await listado.whenStable();
      const select = (listado.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#paciente-estado')!;
      select.selectedIndex = indice; select.dispatchEvent(new Event('change')); await listado.whenStable();
      expect(c.filtroActivo).toBe(esperado);
      expect(api.listar).toHaveBeenCalledWith(undefined, esperado, 1, 10);
    });
  }
  it('cancela la búsqueda anterior y conserva únicamente los resultados recientes', () => {
    const anterior = new Subject<PagedResponse<PacienteListadoResponse>>();
    const reciente = new Subject<PagedResponse<PacienteListadoResponse>>();
    api.listar.and.returnValues(anterior, reciente);
    const c = abrirListado(); c.filtroNombre = 'nuevo'; c.buscar();
    expect(anterior.observed).toBeFalse();
    reciente.next(pagina([{ ...paciente, idPaciente: 42, nombres: 'Actual' }])); anterior.next(pagina());
    expect(c.pacientes[0].idPaciente).toBe(42); expect(c.cargando).toBeFalse();
  });
  it('no consulta sin Pacientes/Consultar', () => {
    revocar('Consultar'); const c = abrirListado(); expect(api.listar).not.toHaveBeenCalled();
    expect(c.error).toContain('Consultar'); expect(c.cargando).toBeFalse();
  });
  it('descarta la respuesta de listado al cambiar de sesión antes del siguiente render', () => {
    const respuesta = new Subject<PagedResponse<PacienteListadoResponse>>(); api.listar.and.returnValue(respuesta);
    const c = abrirListado(); usuario.set({ idUsuario: 2, idRol: 1 }); respuesta.next(pagina());
    expect(c.pacientes).toEqual([]);
    listado.detectChanges(); expect(respuesta.observed).toBeTrue(); // Nueva solicitud del contexto nuevo.
    listado.destroy(); expect(respuesta.observed).toBeFalse();
  });
  it('limpia filas, filtros y confirmación al perder la sesión', () => {
    api.obtenerFoto.and.returnValue(of(new Blob(['foto'], { type: 'image/webp' })));
    spyOn(URL, 'createObjectURL').and.returnValue('blob:paciente-anterior');
    const revocarFoto = spyOn(URL, 'revokeObjectURL');
    const c = abrirListado(); c.solicitarDesactivacion(paciente); c.filtroNombre = 'dato anterior';
    usuario.set(null); listado.detectChanges();
    expect(c.pacientes).toEqual([]); expect(c.filtroNombre).toBe(''); expect(c.pacientePendiente).toBeNull();
    expect(revocarFoto).toHaveBeenCalledWith('blob:paciente-anterior');
    expect(c.fotoUrl(41)).toBeNull();
    expect(api.eliminar).not.toHaveBeenCalled(); expect(api.listar).toHaveBeenCalledTimes(1);
  });
  it('cancela el listado pendiente al destruir la vista', () => {
    const respuesta = new Subject<PagedResponse<PacienteListadoResponse>>(); api.listar.and.returnValue(respuesta);
    abrirListado(); listado.destroy(); expect(respuesta.observed).toBeFalse();
  });
  for (const invalido of [{ ...paciente, idPaciente: 0 }, { ...paciente, idPaciente: 99 }, { ...paciente, activo: false }]) {
    it(`no abre una baja para ID ${invalido.idPaciente}, activo ${invalido.activo}`, () => {
      const c = abrirListado(); c.solicitarDesactivacion(invalido);
      expect(c.pacientePendiente).toBeNull(); expect(api.eliminar).not.toHaveBeenCalled();
    });
  }
  it('revalida Eliminar después de abrir el diálogo, sin esperar un render', () => {
    const c = abrirListado(); c.solicitarDesactivacion(paciente); revocar('Eliminar'); c.confirmarDesactivacion();
    expect(api.eliminar).not.toHaveBeenCalled(); expect(c.pacientePendiente).toBeNull(); expect(c.errorOperacion).toContain('cambiaron');
  });
  it('rechaza confirmar una baja si el paciente ya no está en la página', () => {
    const c = abrirListado(); c.solicitarDesactivacion(paciente); c.pacientes = []; c.confirmarDesactivacion();
    expect(api.eliminar).not.toHaveBeenCalled();
  });
  it('rechaza una confirmación vinculada al token anterior', () => {
    const c = abrirListado(); c.solicitarDesactivacion(paciente); token = 'otro-token'; c.confirmarDesactivacion();
    expect(api.eliminar).not.toHaveBeenCalled();
  });
  it('envía una sola baja, bloquea las demás y recarga exclusivamente al confirmar la API', () => {
    const respuesta = new Subject<void>(); api.eliminar.and.returnValue(respuesta);
    const c = abrirListado(); c.solicitarDesactivacion(paciente); c.confirmarDesactivacion(); c.confirmarDesactivacion();
    listado.detectChanges();
    expect(api.eliminar).toHaveBeenCalledOnceWith(41); expect(api.listar).toHaveBeenCalledTimes(1);
    expect((listado.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[aria-label="Desactivar paciente"]')!.disabled).toBeTrue();
    c.cancelarDesactivacion(); expect(c.pacientePendiente).not.toBeNull();
    respuesta.next(); expect(api.listar).toHaveBeenCalledTimes(2); expect(c.pacientePendiente).toBeNull();
  });
  for (const status of [400, 401, 403, 404, 409, 500]) {
    it(`presenta error ${status} en baja sin esconder las filas ni fingir éxito`, () => {
      api.eliminar.and.returnValue(throwError(() => problema(status)));
      const c = abrirListado(); c.solicitarDesactivacion(paciente); c.confirmarDesactivacion(); listado.detectChanges();
      expect(c.errorOperacion).toBe(mensaje(status, 'No se pudo desactivar el paciente.'));
      expect(c.error).toBe(''); expect(c.pacientes).toEqual([paciente]); expect(api.listar).toHaveBeenCalledTimes(1);
      expect((listado.nativeElement as HTMLElement).querySelector('tbody')?.textContent).toContain('María');
    });
  }
  it('una baja tardía del contexto anterior no provoca una recarga', () => {
    const respuesta = new Subject<void>(); api.eliminar.and.returnValue(respuesta);
    const c = abrirListado(); c.solicitarDesactivacion(paciente); c.confirmarDesactivacion();
    token = 'renovado'; respuesta.next(); expect(api.listar).toHaveBeenCalledTimes(1);
  });

  it('crea con DTO independiente, nombres normalizados y campos vacíos nulos', () => {
    const c = abrirFormulario(); completar(c); c.form.telefono = ''; const original = c.form;
    c.guardar(); const dto = api.crear.calls.mostRecent().args[0];
    expect(dto).not.toBe(original); expect(dto.nombres).toBe('María Elena'); expect(dto.apellidos).toBe('López');
    expect(dto.telefono).toBeNull(); expect(Object.keys(dto)).not.toContain('activo');
    expect(api.actualizar).not.toHaveBeenCalled(); expect(navegar).toHaveBeenCalledOnceWith(['/pacientes']);
  });
  it('edita exclusivamente el paciente real cargado sin incluir estado ni autoría', () => {
    const c = abrirFormulario('41'); c.form.telefono = '5555'; c.guardar();
    expect(api.obtener).toHaveBeenCalledOnceWith(41);
    expect(api.actualizar).toHaveBeenCalledOnceWith(41, jasmine.objectContaining({ telefono: '5555' }));
    const dto = api.actualizar.calls.mostRecent().args[1];
    for (const campo of ['activo', 'fechaRegistro', 'idPaciente', 'idUsuario']) expect(Object.keys(dto)).not.toContain(campo);
    expect(api.crear).not.toHaveBeenCalled();
  });
  it('impide doble POST y mantiene la instantánea mientras la respuesta está pendiente', () => {
    const respuesta = new Subject<PacienteResponse>(); api.crear.and.returnValue(respuesta);
    const c = abrirFormulario(); completar(c); c.guardar(); c.form.nombres = 'Cambio posterior'; c.guardar();
    expect(api.crear).toHaveBeenCalledTimes(1); expect(api.crear.calls.mostRecent().args[0].nombres).toBe('María Elena');
    expect(navegar).not.toHaveBeenCalled(); formulario.detectChanges();
    expect((formulario.nativeElement as HTMLElement).querySelector<HTMLFieldSetElement>('fieldset')!.disabled).toBeTrue();
    respuesta.next(paciente); expect(navegar).toHaveBeenCalledOnceWith(['/pacientes']);
    c.guardar(); expect(api.crear).toHaveBeenCalledTimes(1);
  });
  it('impide doble PUT durante el guardado', () => {
    api.actualizar.and.returnValue(new Subject<PacienteResponse>());
    const c = abrirFormulario('41'); c.guardar(); c.guardar(); expect(api.actualizar).toHaveBeenCalledTimes(1);
  });
  for (const id of ['0', '-1', 'abc', '1.5', '2147483648']) {
    it(`rechaza ruta de edición inválida ${id} sin GET ni PUT`, () => {
      const c = abrirFormulario(id); completar(c); c.guardar();
      expect(api.obtener).not.toHaveBeenCalled(); expect(api.actualizar).not.toHaveBeenCalled(); expect(api.crear).not.toHaveBeenCalled();
    });
  }
  for (const respuesta of [{ ...paciente, activo: false }, { ...paciente, idPaciente: 42 }]) {
    it(`bloquea edición de respuesta inactiva o ajena (${respuesta.idPaciente}/${respuesta.activo})`, () => {
      api.obtener.and.returnValue(of(respuesta)); const c = abrirFormulario('41'); completar(c); c.guardar();
      expect(c.registroCargado).toBeFalse(); expect(api.actualizar).not.toHaveBeenCalled();
    });
  }
  it('no convierte un GET 404 en un PUT sobre un formulario vacío', () => {
    api.obtener.and.returnValue(throwError(() => problema(404)));
    const c = abrirFormulario('41'); expect(c.error).toBe('Detalle 404'); completar(c); c.guardar();
    expect(api.actualizar).not.toHaveBeenCalled(); expect(c.registroCargado).toBeFalse();
  });
  for (const [operacion, id] of [['Crear', null], ['Modificar', '41']] as const) {
    it(`revalida ${operacion} justo antes de enviar`, () => {
      const c = abrirFormulario(id); completar(c); revocar(operacion); c.guardar();
      expect(api.crear).not.toHaveBeenCalled(); expect(api.actualizar).not.toHaveBeenCalled(); expect(navegar).not.toHaveBeenCalled();
    });
  }
  it('no permite editar sin permiso Consultar aunque se tenga Modificar', () => {
    revocar('Consultar'); const c = abrirFormulario('41'); completar(c); c.guardar();
    expect(api.obtener).not.toHaveBeenCalled(); expect(api.actualizar).not.toHaveBeenCalled();
  });
  for (const campo of ['nombres', 'apellidos'] as const) {
    for (const valor of ['   ', 'x'.repeat(101)]) {
      it(`rechaza ${campo} ${valor.length === 3 ? 'vacío normalizado' : 'mayor de 100'}`, () => {
        const c = abrirFormulario(); completar(c); c.form[campo] = valor; c.guardar();
        expect(api.crear).not.toHaveBeenCalled(); expect(c.error).toContain('nombres');
      });
    }
  }
  for (const fecha of ['', '0001-01-01', '2025-02-29', '2024-02-30', '2999-01-01', '2020-2-2']) {
    it(`rechaza fecha vacía, inexistente o futura: ${fecha}`, () => {
      const c = abrirFormulario(); completar(c); c.form.fechaNacimiento = fecha; c.guardar(); expect(api.crear).not.toHaveBeenCalled();
    });
  }
  for (const [campo, limite] of [
    ['dpi', 20], ['genero', 1], ['telefono', 20], ['correo', 100], ['tipoSangre', 10],
    ['nit', 50], ['nombreFacturacion', 150], ['direccion', 150], ['urlFoto', 500],
  ] as const) {
    it(`respeta longitud del contrato: ${campo} <= ${limite}`, () => {
      const c = abrirFormulario(); completar(c); c.form[campo] = 'x'.repeat(limite + 1); c.guardar();
      expect(api.crear).not.toHaveBeenCalled();
    });
  }
  it('acepta fecha bisiesta y conserva opcionales sin imponer reglas de negocio nuevas', () => {
    const c = abrirFormulario(); completar(c); c.form.fechaNacimiento = '2000-02-29';
    c.form.genero = 'X'; c.form.tipoSangre = 'Otra'; c.guardar();
    expect(api.crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ fechaNacimiento: '2000-02-29', genero: 'X', tipoSangre: 'Otra' }));
  });
  for (const status of [400, 401, 403, 404, 409, 500]) {
    it(`presenta error HTTP ${status} de guardado sin navegar ni borrar el borrador`, () => {
      api.crear.and.returnValue(throwError(() => problema(status)));
      const c = abrirFormulario(); completar(c); c.guardar();
      expect(c.error).toBe(mensaje(status, 'Error al crear el paciente.'));
      expect(c.form.nombres).toBe('  María   Elena '); expect(c.cargando).toBeFalse(); expect(navegar).not.toHaveBeenCalled();
    });
  }
  it('conserva el correo inválido rechazado por validación del servidor para corregirlo', () => {
    api.crear.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400, error: { errors: { correo: ['Correo inválido'] } } })));
    const c = abrirFormulario(); completar(c); c.form.correo = 'incorrecto'; c.guardar();
    expect(c.error).toBe('Correo inválido'); expect(c.form.correo).toBe('incorrecto'); expect(navegar).not.toHaveBeenCalled();
  });
  it('no envía un borrador del token anterior incluso antes de procesar el cambio reactivo', () => {
    const c = abrirFormulario(); completar(c); token = 'renovado'; c.guardar(); expect(api.crear).not.toHaveBeenCalled();
  });
  it('limpia el borrador al cambiar usuario y evita navegar por una respuesta tardía', () => {
    const respuesta = new Subject<PacienteResponse>(); api.crear.and.returnValue(respuesta);
    const c = abrirFormulario(); completar(c); c.guardar(); usuario.set({ idUsuario: 2, idRol: 1 });
    respuesta.next(paciente); expect(navegar).not.toHaveBeenCalled(); formulario.detectChanges();
    expect(respuesta.observed).toBeFalse(); expect(c.form.nombres).toBe(''); expect(c.cargando).toBeFalse();
  });
  it('una carga tardía del token anterior no rellena el formulario', () => {
    const respuesta = new Subject<PacienteResponse>(); api.obtener.and.returnValue(respuesta);
    const c = abrirFormulario('41'); token = 'renovado'; respuesta.next(paciente);
    expect(c.form.nombres).toBe(''); expect(c.registroCargado).toBeFalse();
  });
  it('destruir el formulario cancela la petición pendiente', () => {
    const respuesta = new Subject<PacienteResponse>(); api.crear.and.returnValue(respuesta);
    const c = abrirFormulario(); completar(c); c.guardar(); formulario.destroy();
    expect(respuesta.observed).toBeFalse(); respuesta.next(paciente); expect(navegar).not.toHaveBeenCalled();
  });
  for (const id of [0, -1, 1.5]) {
    it(`no anuncia éxito de creación si el servidor devuelve ID inválido ${id}`, () => {
      api.crear.and.returnValue(of({ ...paciente, idPaciente: id }));
      const c = abrirFormulario(); completar(c); c.guardar();
      expect(navegar).not.toHaveBeenCalled(); expect(c.error).toContain('no confirma');
    });
  }
  it('no anuncia éxito de edición si la respuesta pertenece a otro paciente', () => {
    api.actualizar.and.returnValue(of({ ...paciente, idPaciente: 42 })); const c = abrirFormulario('41'); c.guardar();
    expect(navegar).not.toHaveBeenCalled(); expect(c.error).toContain('no confirma');
  });
  it('asocia cada uno de los doce controles a su etiqueta existente', () => {
    abrirFormulario(); const elemento = formulario.nativeElement as HTMLElement;
    const controles = elemento.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select');
    expect(controles.length).toBe(12);
    controles.forEach(control => expect(elemento.querySelector(`label[for="${control.id}"]`)?.textContent?.trim()).toBeTruthy());
  });
});

describe('Pacientes CLOSE-07C: contrato HTTP simulado con interceptor real', () => {
  let http: HttpTestingController;
  let service: PacientesService;
  let invalidar: jasmine.Spy;
  const url = `${environment.apiUrl}/pacientes`;
  const dto: GuardarPacienteRequest = { nombres: 'María', apellidos: 'López', fechaNacimiento: '1990-02-28' };
  beforeEach(() => {
    invalidar = jasmine.createSpy('invalidateForToken');
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: { token: 'token-simulado', invalidateForToken: invalidar } },
    ] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(PacientesService);
  });
  afterEach(() => http.verify());
  for (const activo of [undefined, true, false]) {
    it(`serializa el filtro ${String(activo)} sin enviar cadenas undefined ni vacías`, () => {
      service.listar(undefined, activo, 2, 10).subscribe();
      const req = http.expectOne(r => r.url === url);
      expect(req.request.method).toBe('GET'); expect(req.request.params.get('page')).toBe('2');
      expect(req.request.params.get('pageSize')).toBe('10'); expect(req.request.params.has('nombre')).toBeFalse();
      expect(req.request.params.get('activo')).toBe(activo === undefined ? null : String(activo)); req.flush(pagina());
    });
  }
  it('mantiene POST, PUT y DELETE existentes con ID real y Bearer sin red externa', () => {
    service.crear(dto).subscribe(); const post = http.expectOne(url);
    expect(post.request.method).toBe('POST'); expect(post.request.body).toEqual(dto);
    expect(post.request.headers.get('Authorization')).toBe('Bearer token-simulado'); post.flush(paciente);
    service.actualizar(41, dto).subscribe(); const put = http.expectOne(`${url}/41`);
    expect(put.request.method).toBe('PUT'); expect(put.request.body).toEqual(dto); put.flush(paciente);
    service.eliminar(41).subscribe(); const baja = http.expectOne(`${url}/41`);
    expect(baja.request.method).toBe('DELETE'); baja.flush(null, { status: 204, statusText: 'No Content' });
  });
  for (const status of [400, 401, 403, 404, 409, 500]) {
    it(`propaga ${status} y solo invalida sesión para 401 del token usado`, () => {
      let observado = 0; service.crear(dto).subscribe({ error: (e: HttpErrorResponse) => observado = e.status });
      http.expectOne(url).flush({ detail: 'Respuesta simulada' }, { status, statusText: 'Error simulado' });
      expect(observado).toBe(status);
      if (status === 401) expect(invalidar).toHaveBeenCalledOnceWith('token-simulado');
      else expect(invalidar).not.toHaveBeenCalled();
    });
  }
});
