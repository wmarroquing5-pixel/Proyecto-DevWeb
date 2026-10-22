import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { ContactoEmergenciaResponse } from '../../core/models/contacto-emergencia.model';
import { PacienteResponse } from '../../core/models/paciente.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ContactosEmergenciaService } from '../../core/services/contacto-emergencia.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { PacienteContactosComponent } from './paciente-contactos.component';
import { PacienteFormComponent } from './paciente-form.component';

const paciente = (urlFoto: string | null = null): PacienteResponse => ({
  idPaciente: 41, nombres: 'María', apellidos: 'López', activo: true,
  fechaNacimiento: '1990-02-28', fechaRegistro: '2026-01-01T00:00:00Z', urlFoto,
});
const contacto = (idContacto: number, idPaciente = 41, activo = true): ContactoEmergenciaResponse => ({
  idContacto, idPaciente, activo, nombres: `Nombre ${idContacto}`, apellidos: 'Contacto',
  telefono: '5555-5555', direccion: 'Guatemala', correoElectronico: null, parentesco: 'Familiar',
});
const pagina = <T>(items: T[], page = 1, totalCount = items.length, pageSize = 10) => ({
  items, page, pageSize, totalCount, totalPages: Math.ceil(totalCount / pageSize),
});
const problema = (status: number) => new HttpErrorResponse({ status, error: {
  detail: `Detalle ${status}`, errors: status === 400 ? { nombres: ['Nombre inválido'] } : undefined,
} });

describe('WEB-PAC-01 contratos HTTP', () => {
  let http: HttpTestingController;
  let pacientes: PacientesService;
  let contactos: ContactosEmergenciaService;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: { token: 'jwt-prueba', isAuthenticated: () => true, currentUser: () => ({ idUsuario: 1, idRol: 1 }), invalidateSession: jasmine.createSpy() } },
    ] });
    http = TestBed.inject(HttpTestingController); pacientes = TestBed.inject(PacientesService); contactos = TestBed.inject(ContactosEmergenciaService);
  });
  afterEach(() => http.verify());

  it('sube un PNG real sin alterar sus bytes, autenticado y sin fijar Content-Type manualmente', async () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('PNG no generado')), 'image/png'));
    const file = new File([blob], 'paciente.png', { type: 'image/png' });
    const bytesOriginales = Array.from(new Uint8Array(await file.arrayBuffer()));
    pacientes.guardarFoto(41, file).subscribe(r => expect(r.url).toBe('/api/pacientes/41/foto'));
    const req = http.expectOne(`${environment.apiUrl}/pacientes/41/foto`);
    expect(req.request.method).toBe('POST'); expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-prueba');
    expect(req.request.body instanceof FormData).toBeTrue(); const enviado = (req.request.body as FormData).get('foto') as File;
    expect(enviado.name).toBe(file.name); expect(enviado.type).toBe(file.type); expect(enviado.size).toBe(file.size);
    expect(Array.from(new Uint8Array(await enviado.arrayBuffer()))).toEqual(bytesOriginales);
    expect(req.request.headers.has('Content-Type')).toBeFalse(); req.flush({ url: '/api/pacientes/41/foto' });
  });
  it('lee una fotografía protegida como Blob', () => {
    pacientes.obtenerFoto(41).subscribe(blob => expect(blob.type).toBe('image/webp'));
    const req = http.expectOne(`${environment.apiUrl}/pacientes/41/foto`);
    expect(req.request.method).toBe('GET'); expect(req.request.responseType).toBe('blob');
    expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-prueba'); req.flush(new Blob(['img'], { type: 'image/webp' }));
  });
  it('elimina la fotografía por el endpoint protegido', () => {
    pacientes.eliminarFoto(41).subscribe(); const req = http.expectOne(`${environment.apiUrl}/pacientes/41/foto`);
    expect(req.request.method).toBe('DELETE'); expect(req.request.headers.get('Authorization')).toBe('Bearer jwt-prueba'); req.flush(null);
  });
  it('lista contactos exclusivamente por paciente con paginación', () => {
    contactos.listar(41, 2, 10).subscribe(); const req = http.expectOne(r => r.url === `${environment.apiUrl}/contactos-emergencia`);
    expect(req.request.method).toBe('GET'); expect(req.request.params.get('idPaciente')).toBe('41');
    expect(req.request.params.get('page')).toBe('2'); expect(req.request.params.get('pageSize')).toBe('10'); req.flush(pagina([], 2, 10));
  });
  it('crea, actualiza y retira contactos por sus IDs reales', () => {
    const dto = { nombres: 'Ana', apellidos: 'Paz', telefono: '5555', direccion: 'Zona 1', correoElectronico: null, parentesco: null, idPaciente: 41 };
    contactos.crear(dto).subscribe(); let req = http.expectOne(`${environment.apiUrl}/contactos-emergencia`); expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(dto); req.flush(contacto(7));
    contactos.actualizar(7, dto).subscribe(); req = http.expectOne(`${environment.apiUrl}/contactos-emergencia/7`); expect(req.request.method).toBe('PUT'); expect(req.request.body.idPaciente).toBe(41); req.flush(contacto(7));
    contactos.eliminar(7).subscribe(); req = http.expectOne(`${environment.apiUrl}/contactos-emergencia/7`); expect(req.request.method).toBe('DELETE'); req.flush(null);
  });
});

describe('WEB-PAC-01 fotografía del paciente', () => {
  let fixture: ComponentFixture<PacienteFormComponent>;
  let api: jasmine.SpyObj<PacientesService>;
  let contactosApi: jasmine.SpyObj<ContactosEmergenciaService>;
  let usuario: WritableSignal<{ idUsuario: number; idRol: number } | null>;
  let operaciones: WritableSignal<Set<string>>;
  let token: string;
  let ruta: string | null;
  let navegar: jasmine.Spy;

  beforeEach(async () => {
    usuario = signal({ idUsuario: 1, idRol: 1 }); operaciones = signal(new Set(['Consultar', 'Crear', 'Modificar', 'Eliminar']));
    token = 'token-uno'; ruta = null;
    api = jasmine.createSpyObj<PacientesService>('PacientesService', ['obtener', 'crear', 'actualizar', 'guardarFoto', 'obtenerFoto', 'eliminarFoto']);
    api.obtener.and.returnValue(of(paciente())); api.crear.and.returnValue(of(paciente())); api.actualizar.and.returnValue(of(paciente()));
    api.guardarFoto.and.returnValue(of({ url: '/api/pacientes/41/foto' })); api.obtenerFoto.and.returnValue(of(new Blob(['img'], { type: 'image/webp' })));
    api.eliminarFoto.and.returnValue(of(void 0));
    contactosApi = jasmine.createSpyObj<ContactosEmergenciaService>('ContactosEmergenciaService', ['listar', 'crear', 'actualizar', 'eliminar']);
    contactosApi.listar.and.returnValue(of(pagina([])));
    await TestBed.configureTestingModule({ imports: [PacienteFormComponent], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { get paramMap() { return convertToParamMap(ruta ? { id: ruta } : {}); } } } },
      { provide: PacientesService, useValue: api }, { provide: ContactosEmergenciaService, useValue: contactosApi },
      { provide: AuthSessionService, useValue: { currentUser: usuario, isAuthenticated: () => !!usuario(), get token() { return token; } } },
      { provide: PermisosService, useValue: {
        puedeConsultar: () => operaciones().has('Consultar'), puedeCrear: () => operaciones().has('Crear'),
        puedeModificar: () => operaciones().has('Modificar'), puedeEliminar: () => operaciones().has('Eliminar'),
      } },
    ] }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview'); spyOn(URL, 'revokeObjectURL');
  });
  function abrir(id: string | null = null, conFoto = false): PacienteFormComponent {
    ruta = id; api.obtener.and.returnValue(of(paciente(conFoto ? '/api/pacientes/41/foto' : null)));
    fixture = TestBed.createComponent(PacienteFormComponent); fixture.detectChanges(); return fixture.componentInstance;
  }
  function archivo(type = 'image/webp', size = 3): File { return new File([new Uint8Array(size)], 'foto.webp', { type }); }
  function elegir(c: PacienteFormComponent, file: File): void { c.seleccionarFoto({ target: { files: [file], value: 'x' } } as unknown as Event); }
  function completar(c: PacienteFormComponent): void { c.form.nombres = 'María'; c.form.apellidos = 'López'; c.form.fechaNacimiento = '1990-02-28'; }

  it('ordena Datos, Fotografía, Contactos y Acciones, con un único Guardar y Cancelar al final', () => {
    const c = abrir('41'); const host = fixture.nativeElement as HTMLElement;
    const datos = host.querySelector('#paciente-datos-form') as HTMLFormElement;
    const foto = host.querySelector('[aria-labelledby="foto-title"]') as HTMLElement;
    const contactos = host.querySelector('app-paciente-contactos') as HTMLElement;
    const acciones = host.querySelector('[aria-labelledby="acciones-paciente-title"]') as HTMLElement;
    expect(datos.compareDocumentPosition(foto) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(foto.compareDocumentPosition(contactos) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(contactos.compareDocumentPosition(acciones) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const guardar = Array.from(host.querySelectorAll('button')).filter(button => button.textContent?.trim() === 'Guardar') as HTMLButtonElement[];
    const cancelar = Array.from(host.querySelectorAll('a')).filter(link => link.textContent?.trim() === 'Cancelar');
    expect(guardar.length).toBe(1); expect(cancelar.length).toBe(1); expect(guardar[0].form).toBe(datos);
    expect(datos.getAttribute('aria-labelledby')).toBe('datos-paciente-title');
    expect(acciones.textContent).toContain('no revierte fotografías ni contactos');
    c.cargando = true; fixture.detectChanges();
    expect(guardar[0].disabled).toBeTrue(); expect(guardar[0].textContent).toContain('Guardando');
  });

  it('presenta seis filas de datos, etiquetas asociadas y el selector de foto del diseño', async () => {
    abrir(); await fixture.whenStable(); fixture.detectChanges();
    const host = fixture.nativeElement as HTMLElement;
    const form = host.querySelector('#paciente-datos-form') as HTMLFormElement;
    const columnas = [...form.querySelectorAll<HTMLElement>('.row > div')];
    expect(columnas.length).toBe(11);
    expect(columnas.slice(0, 10).every(col => col.classList.contains('col-md-6'))).toBeTrue();
    expect(columnas[10].classList.contains('col-12')).toBeTrue();
    const campos = [...form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input, select')];
    expect(campos.map(campo => campo.name)).toEqual([
      'nombres', 'apellidos', 'dpi', 'fechaNacimiento', 'genero', 'tipoSangre',
      'telefono', 'correo', 'nit', 'nombreFacturacion', 'direccion',
    ]);
    for (const campo of campos) {
      expect(form.querySelector(`label[for="${campo.id}"]`)).not.toBeNull();
    }
    expect(campos.filter(campo => campo.required).map(campo => campo.name)).toEqual(['nombres', 'apellidos', 'fechaNacimiento']);
    expect((host.querySelector('#paciente-form-nombres') as HTMLInputElement).placeholder).toBe('Ingrese nombres');
    expect((host.querySelector('#paciente-form-genero') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Seleccionar género');
    expect((host.querySelector('#paciente-form-sangre') as HTMLSelectElement).selectedOptions[0].textContent).toBe('Seleccionar tipo de sangre');
    const foto = host.querySelector('#paciente-foto-archivo') as HTMLInputElement;
    expect(foto.accept).toBe('image/jpeg,image/png,image/webp');
    expect(host.querySelector('label[for="paciente-foto-archivo"]')?.textContent).toContain('Seleccionar archivo');
    expect(host.querySelector('[aria-labelledby="foto-title"]')?.textContent).toContain('JPG, PNG y WebP (máx. 5 MB)');
    expect(api.crear).not.toHaveBeenCalled(); expect(api.guardarFoto).not.toHaveBeenCalled();
  });

  it('rechaza una entrada que no sea realmente File aunque imite nombre, MIME y tamaño', () => {
    const c = abrir();
    c.seleccionarFoto({ target: { files: [{ name: 'falsa.png', type: 'image/png', size: 100 }], value: 'x' } } as unknown as Event);
    expect(c.archivoFoto).toBeNull(); expect(c.errorFoto).toContain('archivo de imagen válido');
  });

  it('acepta JPEG, PNG y WebP válidos y crea una vista previa local', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
      const c = abrir(); elegir(c, archivo(type)); fixture.detectChanges();
      expect(c.archivoFoto?.type).toBe(type); expect(c.vistaPreviaFoto).toBe('blob:preview');
      expect((fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('img[alt="Fotografía del paciente"]')?.src).toContain('blob:preview');
      expect(api.guardarFoto).not.toHaveBeenCalled(); fixture.destroy();
    }
  });
  it('rechaza tipo inválido y archivo vacío o mayor de 5 MB', () => {
    let c = abrir(); elegir(c, archivo('image/gif')); expect(c.archivoFoto).toBeNull(); expect(c.errorFoto).toContain('JPEG'); fixture.destroy();
    c = abrir(); elegir(c, archivo('image/webp', 0)); expect(c.errorFoto).toContain('contenido'); fixture.destroy();
    c = abrir(); elegir(c, archivo('image/webp', 5 * 1024 * 1024 + 1)); expect(c.errorFoto).toContain('5 MB');
  });
  it('trata 404 al leer como ausencia de fotografía', () => {
    api.obtenerFoto.and.returnValue(throwError(() => problema(404))); const c = abrir('41', true);
    expect(api.obtenerFoto).toHaveBeenCalledOnceWith(41); expect(c.fotoDisponible).toBeFalse(); expect(c.errorFoto).toBe('');
  });
  it('muestra la fotografía obtenida mediante el endpoint protegido', () => {
    const c = abrir('41', true); expect(api.obtenerFoto).toHaveBeenCalledOnceWith(41); expect(c.fotoDisponible).toBeTrue(); expect(c.vistaPreviaFoto).toBe('blob:preview');
  });
  it('sustituye una fotografía una sola vez y relee tras confirmación coherente', () => {
    const pending = new Subject<{ url: string }>(); api.guardarFoto.and.returnValue(pending);
    const c = abrir('41', true); elegir(c, archivo()); c.guardarFoto(); c.guardarFoto();
    expect(api.guardarFoto).toHaveBeenCalledTimes(1); pending.next({ url: '/api/pacientes/41/foto' });
    expect(api.obtenerFoto).toHaveBeenCalledTimes(2); expect(c.avisoFoto).toContain('guardada');
  });
  it('elimina solo después de confirmar y bloquea un segundo DELETE', () => {
    const pending = new Subject<void>(); api.eliminarFoto.and.returnValue(pending);
    const c = abrir('41', true); c.solicitarEliminarFoto(); c.eliminarFoto(); c.eliminarFoto();
    expect(api.eliminarFoto).toHaveBeenCalledOnceWith(41); pending.next();
    expect(c.fotoDisponible).toBeFalse(); expect(c.avisoFoto).toContain('eliminada');
  });
  it('cierra el diálogo al pulsar Cancelar y solo elimina la fotografía al pulsar Eliminar', () => {
    const c = abrir('41', true);
    const dialogo = () => (fixture.nativeElement as HTMLElement).querySelector('app-confirm-dialog');
    const boton = (texto: string) => Array.from(dialogo()!.querySelectorAll('button'))
      .find(elemento => elemento.textContent?.trim() === texto) as HTMLButtonElement;

    c.solicitarEliminarFoto(); fixture.detectChanges();
    boton('Cancelar').click(); fixture.detectChanges();
    expect(c.confirmarEliminarFoto).toBeFalse(); expect(dialogo()).toBeNull();
    expect(api.eliminarFoto).not.toHaveBeenCalled();

    c.solicitarEliminarFoto(); fixture.detectChanges();
    boton('Eliminar').click(); fixture.detectChanges();
    expect(api.eliminarFoto).toHaveBeenCalledOnceWith(41);
    expect(c.fotoDisponible).toBeFalse();
  });
  it('no modifica fotografía sin Pacientes/Modificar', () => {
    const c = abrir('41'); elegir(c, archivo()); operaciones.update(x => new Set([...x].filter(o => o !== 'Modificar'))); c.guardarFoto();
    expect(api.guardarFoto).not.toHaveBeenCalled();
  });
  it('cancela la respuesta pendiente cuando cambia la sesión', () => {
    const pending = new Subject<{ url: string }>(); api.guardarFoto.and.returnValue(pending);
    const c = abrir('41'); elegir(c, archivo()); c.guardarFoto(); usuario.set({ idUsuario: 2, idRol: 1 }); token = 'token-dos'; fixture.detectChanges();
    expect(pending.observed).toBeFalse(); pending.next({ url: '/api/pacientes/41/foto' }); expect(c.avisoFoto).toBe('');
  });
  it('informa error R2 simulado sin declarar éxito', () => {
    api.guardarFoto.and.returnValue(throwError(() => problema(500))); const c = abrir('41'); elegir(c, archivo()); c.guardarFoto();
    expect(c.errorFoto).toContain('Resultado incierto'); expect(c.avisoFoto).toBe('');
  });
  for (const escenario of [
    { status: 400, error: { title: 'Validación fallida', errors: { Foto: ['El contenido de la fotografía está malformado.'] } }, esperado: 'malformado' },
    { status: 413, error: { title: 'Contenido demasiado grande', detail: 'La fotografía no puede superar 5 MB.' }, esperado: '5 MB' },
    { status: 415, error: { title: 'Formato no admitido', detail: 'El tipo MIME declarado no coincide con el contenido de la imagen.' }, esperado: 'MIME' },
    { status: 401, error: { title: 'No autorizado' }, esperado: 'sesión expiró' },
    { status: 403, error: { title: 'Acceso prohibido' }, esperado: 'autorización' },
    { status: 500, error: { title: 'Error interno' }, esperado: 'procesamiento o almacenamiento' },
    { status: 503, error: { title: 'Dependencia no disponible' }, esperado: 'procesamiento o almacenamiento' },
  ]) {
    it(`distingue el error HTTP ${escenario.status} al subir una fotografía sin reintentar`, () => {
      api.guardarFoto.and.returnValue(throwError(() => new HttpErrorResponse({ status: escenario.status, error: escenario.error })));
      const c = abrir('41'); elegir(c, new File([new Uint8Array([137, 80, 78, 71])], 'foto.png', { type: 'image/png' })); c.guardarFoto();
      expect(api.guardarFoto).toHaveBeenCalledTimes(1); expect(c.errorFoto).toContain(escenario.esperado); expect(c.avisoFoto).toBe('');
    });
  }
  it('crea primero al paciente y si falla la foto no repite el POST de paciente', () => {
    api.guardarFoto.and.returnValue(throwError(() => problema(500))); const c = abrir(); completar(c); elegir(c, archivo()); c.guardar(); c.guardar();
    expect(api.crear).toHaveBeenCalledTimes(1); expect(api.guardarFoto).toHaveBeenCalledOnceWith(41, jasmine.any(File));
    expect(c.idPaciente).toBe(41); expect(c.esEdicion).toBeTrue(); expect(c.errorFoto).toContain('fue creado'); expect(navegar).not.toHaveBeenCalled();
  });
  it('no envía urlFoto en el DTO general aunque el estado legado contenga una URL', () => {
    const c = abrir(); completar(c); c.form.urlFoto = 'https://sitio-ajeno/foto.jpg'; c.guardar();
    expect(Object.keys(api.crear.calls.mostRecent().args[0])).not.toContain('urlFoto');
  });
});

describe('WEB-PAC-01 contactos de emergencia', () => {
  let fixture: ComponentFixture<PacienteContactosComponent>;
  let api: jasmine.SpyObj<ContactosEmergenciaService>;
  let usuario: WritableSignal<{ idUsuario: number; idRol: number } | null>;
  let operaciones: WritableSignal<Set<string>>;
  let token: string;

  beforeEach(async () => {
    usuario = signal({ idUsuario: 1, idRol: 1 }); operaciones = signal(new Set(['Consultar', 'Crear', 'Modificar', 'Eliminar'])); token = 'uno';
    api = jasmine.createSpyObj<ContactosEmergenciaService>('ContactosEmergenciaService', ['listar', 'crear', 'actualizar', 'eliminar']);
    api.listar.and.returnValue(of(pagina([]))); api.crear.and.returnValue(of(contacto(1))); api.actualizar.and.returnValue(of(contacto(1))); api.eliminar.and.returnValue(of(void 0));
    await TestBed.configureTestingModule({ imports: [PacienteContactosComponent], providers: [
      { provide: ContactosEmergenciaService, useValue: api },
      { provide: AuthSessionService, useValue: { currentUser: usuario, isAuthenticated: () => !!usuario(), get token() { return token; } } },
      { provide: PermisosService, useValue: {
        puedeConsultar: () => operaciones().has('Consultar'), puedeCrear: () => operaciones().has('Crear'),
        puedeModificar: () => operaciones().has('Modificar'), puedeEliminar: () => operaciones().has('Eliminar'),
      } },
    ] }).compileComponents();
  });
  function abrir(id = 41): PacienteContactosComponent {
    fixture = TestBed.createComponent(PacienteContactosComponent); fixture.componentRef.setInput('idPaciente', id); fixture.detectChanges(); return fixture.componentInstance;
  }
  function completar(c: PacienteContactosComponent): void { c.form = { nombres: '  Ana ', apellidos: ' Paz ', telefono: ' 5555 ', direccion: ' Zona 1 ', correoElectronico: '', parentesco: ' Madre ' }; }

  for (const cantidad of [0, 1, 3, 10]) {
    it(`representa correctamente ${cantidad} contactos`, () => {
      api.listar.and.returnValue(of(pagina(Array.from({ length: cantidad }, (_, i) => contacto(i + 1)))));
      const c = abrir(); expect(c.contactos.length).toBe(cantidad); expect(c.total).toBe(cantidad); expect(c.error).toBe('');
    });
  }
  it('accede a contactos posteriores a la primera página y conserva el paciente', () => {
    api.listar.and.callFake((_id, page) => of(page === 1
      ? pagina(Array.from({ length: 10 }, (_, i) => contacto(i + 1)), 1, 11)
      : pagina([contacto(11)], 2, 11)));
    const c = abrir(); c.cambiarPagina(2); expect(c.contactos[0].idContacto).toBe(11); expect(api.listar).toHaveBeenCalledWith(41, 2, 10);
  });
  it('rechaza contactos pertenecientes a otro paciente', () => {
    api.listar.and.returnValue(of(pagina([contacto(1, 99)]))); const c = abrir(); expect(c.contactos).toEqual([]); expect(c.error).toContain('contradictorios');
  });
  it('crea un contacto con DTO independiente y paciente fijo, bloqueando doble POST', () => {
    const pending = new Subject<ContactoEmergenciaResponse>(); api.crear.and.returnValue(pending);
    const c = abrir(); c.nuevo(); completar(c); c.guardar(); c.form.nombres = 'Mutado'; c.guardar();
    expect(api.crear).toHaveBeenCalledTimes(1); expect(api.crear.calls.mostRecent().args[0]).toEqual({
      nombres: 'Ana', apellidos: 'Paz', telefono: '5555', direccion: 'Zona 1', correoElectronico: null, parentesco: 'Madre', idPaciente: 41,
    });
    pending.next(contacto(1)); expect(api.listar).toHaveBeenCalledTimes(2);
  });
  it('edita el contacto seleccionado por ID sin permitir cambiar IdPaciente', () => {
    api.listar.and.returnValue(of(pagina([contacto(7)]))); api.actualizar.and.returnValue(of(contacto(7)));
    const c = abrir(); c.editar(c.contactos[0]); c.form.nombres = 'Actualizado'; c.guardar();
    expect(api.actualizar).toHaveBeenCalledOnceWith(7, jasmine.objectContaining({ nombres: 'Actualizado', idPaciente: 41 }));
  });
  it('retira el contacto seleccionado por ID solo tras confirmar', () => {
    api.listar.and.returnValue(of(pagina([contacto(7), contacto(8)]))); const c = abrir(); c.solicitarRetiro(c.contactos[1]); c.confirmarRetiro(); c.confirmarRetiro();
    expect(api.eliminar).toHaveBeenCalledOnceWith(8); expect(api.listar).toHaveBeenCalledTimes(2);
  });
  it('cancela el retiro desde el botón del diálogo sin llamar a la API', () => {
    api.listar.and.returnValue(of(pagina([contacto(7)])));
    const c = abrir(); c.solicitarRetiro(c.contactos[0]); fixture.detectChanges();
    const dialogo = (fixture.nativeElement as HTMLElement).querySelector('app-confirm-dialog')!;
    const cancelar = Array.from(dialogo.querySelectorAll('button'))
      .find(boton => boton.textContent?.trim() === 'Cancelar') as HTMLButtonElement;
    cancelar.click(); fixture.detectChanges();
    expect(c.pendienteRetiro).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-confirm-dialog')).toBeNull();
    expect(api.eliminar).not.toHaveBeenCalled();
  });
  it('rechaza campos obligatorios vacíos y longitudes fuera de contrato', () => {
    const c = abrir(); c.nuevo(); c.guardar(); expect(api.crear).not.toHaveBeenCalled();
    completar(c); c.form.telefono = 'x'.repeat(21); c.guardar(); expect(api.crear).not.toHaveBeenCalled();
  });
  it('no crea, edita ni retira sin permisos CAME correspondientes', () => {
    api.listar.and.returnValue(of(pagina([contacto(7)]))); const c = abrir();
    operaciones.set(new Set(['Consultar'])); c.nuevo(); c.editar(c.contactos[0]); c.solicitarRetiro(c.contactos[0]);
    expect(c.mostrarFormulario).toBeFalse(); expect(c.pendienteRetiro).toBeNull();
  });
  it('cancela una carga pendiente cuando cambia el paciente', () => {
    const pending = new Subject<ReturnType<typeof pagina<ContactoEmergenciaResponse>>>(); api.listar.and.returnValue(pending);
    const c = abrir(); api.listar.and.returnValue(of(pagina([contacto(9, 42)]))); fixture.componentRef.setInput('idPaciente', 42); fixture.detectChanges();
    expect(pending.observed).toBeFalse(); pending.next(pagina([contacto(1)])); expect(c.contactos[0].idPaciente).toBe(42);
  });
  it('cancela operaciones pendientes cuando cambia la sesión', () => {
    const pending = new Subject<ContactoEmergenciaResponse>(); api.crear.and.returnValue(pending);
    const c = abrir(); c.nuevo(); completar(c); c.guardar(); usuario.set({ idUsuario: 2, idRol: 1 }); token = 'dos'; fixture.detectChanges();
    expect(pending.observed).toBeFalse(); pending.next(contacto(3)); expect(c.aviso).toBe('');
  });
  for (const status of [400, 401, 403, 404, 409, 500]) {
    it(`muestra error HTTP ${status} sin éxito ni segundo envío`, () => {
      api.crear.and.returnValue(throwError(() => problema(status))); const c = abrir(); c.nuevo(); completar(c); c.guardar();
      expect(api.crear).toHaveBeenCalledTimes(1); expect(c.aviso).toBe('');
      expect(c.error).toContain(status === 400 ? 'Nombre inválido' : status === 401 ? 'guardar el contacto'
        : status === 403 ? 'autorización' : status >= 500 ? 'Resultado incierto' : `Detalle ${status}`);
    });
  }
  it('rechaza una confirmación de otro paciente y preserva la relación', () => {
    api.crear.and.returnValue(of(contacto(9, 99))); const c = abrir(); c.nuevo(); completar(c); c.guardar();
    expect(c.error).toContain('no confirma'); expect(api.listar).toHaveBeenCalledTimes(1);
  });
  it('rechaza metadatos paginados contradictorios', () => {
    api.listar.and.returnValue(of({ ...pagina([contacto(1)]), totalPages: 2 })); const c = abrir();
    expect(c.contactos).toEqual([]); expect(c.error).toContain('paginación');
  });
});
