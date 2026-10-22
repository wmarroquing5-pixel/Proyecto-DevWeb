import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Subject, of, throwError } from 'rxjs';
import { ContactoEmergenciaRequest, ContactoEmergenciaResponse } from '../../core/models/contacto-emergencia.model';
import { PacienteResponse } from '../../core/models/paciente.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ContactosEmergenciaService } from '../../core/services/contacto-emergencia.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { PacienteContactosComponent } from './paciente-contactos.component';
import { PacienteFormComponent } from './paciente-form.component';

const paciente: PacienteResponse = { idPaciente: 41, nombres: 'Ana', apellidos: 'Paz', activo: true,
  fechaNacimiento: '1990-02-28', fechaRegistro: '2026-01-01T00:00:00Z', urlFoto: null };
const respuesta = (idContacto: number, dto: ContactoEmergenciaRequest): ContactoEmergenciaResponse =>
  ({ ...dto, idContacto, activo: true });

describe('WEB-PAC-03 alta con contactos de emergencia', () => {
  let fixture: ComponentFixture<PacienteFormComponent>;
  let api: jasmine.SpyObj<PacientesService>;
  let contactosApi: jasmine.SpyObj<ContactosEmergenciaService>;
  let navegar: jasmine.Spy;
  let ruta: string | null;
  let token: string;
  let usuario = signal<{ idUsuario: number; idRol: number } | null>({ idUsuario: 1, idRol: 1 });
  let permisos = signal(new Set<string>());

  beforeEach(async () => {
    ruta = null; token = 'token-uno'; usuario = signal({ idUsuario: 1, idRol: 1 });
    permisos = signal(new Set(['Pacientes/Consultar', 'Pacientes/Crear', 'Pacientes/Modificar',
      'ContactosEmergencia/Consultar', 'ContactosEmergencia/Crear', 'ContactosEmergencia/Modificar', 'ContactosEmergencia/Eliminar']));
    api = jasmine.createSpyObj<PacientesService>('PacientesService', ['obtener', 'crear', 'actualizar', 'guardarFoto', 'obtenerFoto', 'eliminarFoto']);
    api.obtener.and.returnValue(of(paciente)); api.crear.and.returnValue(of(paciente)); api.actualizar.and.returnValue(of(paciente));
    api.guardarFoto.and.returnValue(of({ url: '/api/pacientes/41/foto' }));
    contactosApi = jasmine.createSpyObj<ContactosEmergenciaService>('ContactosEmergenciaService', ['listar', 'crear', 'actualizar', 'eliminar']);
    contactosApi.listar.and.returnValue(of({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 }));
    let secuencia = 0;
    contactosApi.crear.and.callFake(dto => of(respuesta(++secuencia, dto)));
    await TestBed.configureTestingModule({ imports: [PacienteFormComponent], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: { get paramMap() { return convertToParamMap(ruta ? { id: ruta } : {}); } } } },
      { provide: PacientesService, useValue: api }, { provide: ContactosEmergenciaService, useValue: contactosApi },
      { provide: AuthSessionService, useValue: { currentUser: usuario, isAuthenticated: () => !!usuario(), get token() { return token; } } },
      { provide: PermisosService, useValue: {
        puedeConsultar: (modulo: string) => permisos().has(`${modulo}/Consultar`),
        puedeCrear: (modulo: string) => permisos().has(`${modulo}/Crear`),
        puedeModificar: (modulo: string) => permisos().has(`${modulo}/Modificar`),
        puedeEliminar: (modulo: string) => permisos().has(`${modulo}/Eliminar`),
      } },
    ] }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function abrir(id: string | null = null): { pacienteForm: PacienteFormComponent; contactos: PacienteContactosComponent } {
    ruta = id; fixture = TestBed.createComponent(PacienteFormComponent); fixture.detectChanges();
    return { pacienteForm: fixture.componentInstance,
      contactos: fixture.debugElement.query(By.directive(PacienteContactosComponent)).componentInstance as PacienteContactosComponent };
  }
  function completar(form: PacienteFormComponent): void {
    form.form.nombres = 'Ana'; form.form.apellidos = 'Paz'; form.form.fechaNacimiento = '1990-02-28';
  }
  function agregar(contactos: PacienteContactosComponent, nombre: string): void {
    contactos.nuevo(); contactos.form.nombres = nombre; contactos.form.apellidos = 'Paz';
    contactos.form.telefono = '5555-1234'; contactos.form.direccion = 'Zona 1'; contactos.guardar();
  }

  it('muestra las cuatro secciones en orden y permite cero contactos', () => {
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm);
    const host = fixture.nativeElement as HTMLElement;
    const partes = ['#paciente-datos-form', '[aria-labelledby="foto-title"]', 'app-paciente-contactos', '[aria-labelledby="acciones-paciente-title"]']
      .map(selector => host.querySelector(selector)!);
    for (let i = 1; i < partes.length; i++) expect(partes[i - 1].compareDocumentPosition(partes[i]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(contactos.borradores).toEqual([]); pacienteForm.guardar();
    expect(api.crear).toHaveBeenCalledTimes(1); expect(contactosApi.crear).not.toHaveBeenCalled(); expect(navegar).toHaveBeenCalledOnceWith(['/pacientes']);
  });

  it('muestra la tabla vacía y varios borradores con dirección sin anticipar peticiones de escritura', () => {
    const { contactos } = abrir();
    const host = fixture.nativeElement as HTMLElement;
    const tabla = host.querySelector('app-paciente-contactos table') as HTMLTableElement;
    expect([...tabla.querySelectorAll('thead th')].map(celda => celda.textContent?.trim())).toEqual([
      'Nombre', 'Parentesco', 'Teléfono', 'Dirección', 'Acciones',
    ]);
    expect(tabla.tBodies[0].rows.length).toBe(1);
    expect(tabla.tBodies[0].rows[0].cells[0].colSpan).toBe(5);
    expect(tabla.tBodies[0].textContent).toContain('No hay contactos de emergencia registrados.');
    agregar(contactos, 'Primero'); agregar(contactos, 'Segundo'); fixture.detectChanges();
    expect(tabla.tBodies[0].rows.length).toBe(2);
    expect(tabla.tBodies[0].rows[0].cells[3].textContent).toContain('Zona 1');
    expect(tabla.tBodies[0].rows[1].cells[0].textContent).toContain('Segundo');
    expect(tabla.tBodies[0].querySelectorAll('button').length).toBe(4);
    expect(api.crear).not.toHaveBeenCalled(); expect(contactosApi.crear).not.toHaveBeenCalled();
  });

  it('conserva estado y controles de edición de un contacto existente en la tabla de cinco columnas', () => {
    contactosApi.listar.and.returnValue(of({ items: [respuesta(7, {
      idPaciente: 41, nombres: 'Ana', apellidos: 'Paz', telefono: '5555-1234',
      direccion: 'Zona 1', parentesco: 'Madre', correoElectronico: null,
    })], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 }));
    abrir('41');
    const tabla = (fixture.nativeElement as HTMLElement).querySelector('app-paciente-contactos table') as HTMLTableElement;
    expect([...tabla.querySelectorAll('thead th')].map(celda => celda.textContent?.trim())).toEqual([
      'Nombre', 'Parentesco', 'Teléfono', 'Dirección', 'Acciones',
    ]);
    expect(tabla.tBodies[0].rows[0].cells[0].textContent).toContain('Activo');
    expect(tabla.tBodies[0].rows[0].cells[3].textContent).toContain('Zona 1');
    expect(tabla.tBodies[0].querySelector('button[aria-label="Editar contacto 7"]')).not.toBeNull();
    expect(tabla.tBodies[0].querySelector('button[aria-label="Retirar contacto 7"]')).not.toBeNull();
    expect(contactosApi.actualizar).not.toHaveBeenCalled(); expect(contactosApi.eliminar).not.toHaveBeenCalled();
  });

  for (const cantidad of [1, 3, 10, 12]) {
    it(`prepara y registra ${cantidad} contactos sin un límite artificial ni POST anticipado`, () => {
      const { pacienteForm, contactos } = abrir(); completar(pacienteForm);
      for (let i = 0; i < cantidad; i++) agregar(contactos, `Contacto ${i}`);
      expect(contactos.borradores.length).toBe(cantidad); expect(contactosApi.crear).not.toHaveBeenCalled();
      pacienteForm.guardar();
      expect(api.crear).toHaveBeenCalledTimes(1); expect(contactosApi.crear).toHaveBeenCalledTimes(cantidad);
      expect(contactosApi.crear.calls.allArgs().every(([dto]) => dto.idPaciente === 41 && !('localId' in dto))).toBeTrue();
      expect(pacienteForm.contactosAlta.every(c => c.estado === 'confirmado')).toBeTrue();
    });
  }

  it('edita y quita borradores sin tocar la API', () => {
    const { contactos } = abrir(); agregar(contactos, 'Primero'); agregar(contactos, 'Segundo');
    const id = contactos.borradores[0].localId; contactos.editarBorrador(contactos.borradores[0]);
    contactos.form.nombres = 'Editado'; contactos.guardar(); contactos.quitarBorrador(contactos.borradores[1].localId);
    expect(contactos.borradores).toEqual([jasmine.objectContaining({ localId: id, datos: jasmine.objectContaining({ nombres: 'Editado' }) })]);
    expect(api.crear).not.toHaveBeenCalled(); expect(contactosApi.crear).not.toHaveBeenCalled();
  });

  it('valida campos obligatorios y longitudes antes de preparar contactos', () => {
    const { contactos } = abrir(); contactos.nuevo();
    for (const campo of ['nombres', 'apellidos', 'telefono', 'direccion'] as const) {
      contactos.form = { nombres: 'Ana', apellidos: 'Paz', telefono: '5555', direccion: 'Zona 1', correoElectronico: null, parentesco: null };
      contactos.form[campo] = ''; contactos.guardar(); expect(contactos.borradores.length).toBe(0);
    }
    contactos.form = { nombres: 'A'.repeat(101), apellidos: 'Paz', telefono: '5555', direccion: 'Zona 1', correoElectronico: null, parentesco: null };
    contactos.guardar(); expect(contactos.borradores.length).toBe(0);
  });

  it('registra fotografía y contactos con el mismo paciente, incluso si falla la fotografía', () => {
    api.guardarFoto.and.callFake(() => {
      expect(api.crear).toHaveBeenCalledTimes(1);
      return throwError(() => new HttpErrorResponse({ status: 500 }));
    });
    contactosApi.crear.and.callFake(dto => {
      expect(api.guardarFoto).toHaveBeenCalledTimes(1);
      return of(respuesta(7, dto));
    });
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm); agregar(contactos, 'Familiar');
    pacienteForm.seleccionarFoto({ target: { files: [new File(['foto'], 'foto.webp', { type: 'image/webp' })], value: 'x' } } as unknown as Event);
    spyOn(URL, 'createObjectURL').and.returnValue('blob:preview');
    pacienteForm.guardar();
    expect(contactosApi.crear.calls.mostRecent().args[0].idPaciente).toBe(41);
    expect(api.guardarFoto).toHaveBeenCalledOnceWith(41, jasmine.any(File));
    expect(pacienteForm.contactosAlta[0].estado).toBe('confirmado'); expect(pacienteForm.errorFoto).toContain('fue creado');
    expect(api.crear).toHaveBeenCalledTimes(1); expect(navegar).not.toHaveBeenCalled();
  });

  it('conserva el primer contacto confirmado cuando falla el segundo y no repite el paciente', () => {
    contactosApi.crear.and.callFake(dto => dto.nombres === 'Segundo'
      ? throwError(() => new HttpErrorResponse({ status: 400, error: { detail: 'Dato inválido' } }))
      : of(respuesta(7, dto)));
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm);
    agregar(contactos, 'Primero'); agregar(contactos, 'Segundo'); agregar(contactos, 'Tercero'); pacienteForm.guardar();
    expect(pacienteForm.contactosAlta.map(c => c.estado)).toEqual(['confirmado', 'fallido', 'confirmado']);
    pacienteForm.guardar(); expect(api.crear).toHaveBeenCalledTimes(1); expect(contactosApi.crear).toHaveBeenCalledTimes(3);
    expect(navegar).not.toHaveBeenCalled(); expect(pacienteForm.idPaciente).toBe(41);
  });

  it('marca respuesta incierta sin reintentar y bloquea doble envío', () => {
    const pending = new Subject<PacienteResponse>(); api.crear.and.returnValue(pending);
    contactosApi.crear.and.returnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm); agregar(contactos, 'Familiar');
    pacienteForm.guardar(); pacienteForm.guardar(); expect(api.crear).toHaveBeenCalledTimes(1);
    pending.next(paciente); pending.complete(); pacienteForm.guardar();
    expect(contactosApi.crear).toHaveBeenCalledTimes(1); expect(pacienteForm.contactosAlta[0].estado).toBe('incierto');
    expect(pacienteForm.error).toContain('Concilie');
  });

  it('permite cancelar borradores sin HTTP y explica la falta de permiso de contactos', () => {
    const { contactos } = abrir(); agregar(contactos, 'Familiar');
    expect(contactos.borradores.length).toBe(1); expect(api.crear).not.toHaveBeenCalled(); expect(contactosApi.crear).not.toHaveBeenCalled();
    const salida = new MouseEvent('click', { cancelable: true }); fixture.componentInstance.cancelar(salida);
    expect(salida.defaultPrevented).toBeTrue(); expect(navegar).toHaveBeenCalledOnceWith(['/pacientes']);
    fixture.destroy();
    permisos.update(actual => new Set([...actual].filter(p => p !== 'ContactosEmergencia/Crear')));
    const nuevo = abrir(); expect((fixture.nativeElement as HTMLElement).textContent).toContain('No tiene permiso ContactosEmergencia/Crear');
    nuevo.contactos.nuevo(); expect(nuevo.contactos.mostrarFormulario).toBeFalse();
  });

  it('advierte al cancelar después de un alta parcial sin simular rollback', () => {
    contactosApi.crear.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm); agregar(contactos, 'Familiar'); pacienteForm.guardar();
    const salida = new MouseEvent('click', { cancelable: true }); pacienteForm.cancelar(salida);
    expect(salida.defaultPrevented).toBeTrue(); expect(pacienteForm.confirmarSalidaParcial).toBeTrue();
    expect(pacienteForm.idPaciente).toBe(41); expect(navegar).not.toHaveBeenCalled();
    fixture.detectChanges();
    const dialogo = (fixture.nativeElement as HTMLElement).querySelector('app-confirm-dialog')!;
    const cancelar = Array.from(dialogo.querySelectorAll('button'))
      .find(boton => boton.textContent?.trim() === 'Cancelar') as HTMLButtonElement;
    cancelar.click(); fixture.detectChanges();
    expect(pacienteForm.confirmarSalidaParcial).toBeFalse();
    expect(navegar).not.toHaveBeenCalled();
  });

  it('conserva borradores al revocar Contactos/Crear y permite quitarlos antes del alta', () => {
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm); agregar(contactos, 'Familiar');
    permisos.update(actual => new Set([...actual].filter(p => p !== 'ContactosEmergencia/Crear'))); fixture.detectChanges();
    expect(contactos.borradores.length).toBe(1); pacienteForm.guardar();
    expect(api.crear).not.toHaveBeenCalled(); expect(contactosApi.crear).not.toHaveBeenCalled();
    contactos.quitarBorrador(contactos.borradores[0].localId); pacienteForm.guardar();
    expect(api.crear).toHaveBeenCalledTimes(1);
  });

  it('descarta una respuesta antigua del paciente al cambiar la sesión', () => {
    const pendiente = new Subject<PacienteResponse>(); api.crear.and.returnValue(pendiente);
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm); agregar(contactos, 'Familiar'); pacienteForm.guardar();
    usuario.set({ idUsuario: 2, idRol: 1 }); token = 'token-dos'; fixture.detectChanges();
    expect(pendiente.observed).toBeFalse(); pendiente.next(paciente);
    expect(contactosApi.crear).not.toHaveBeenCalled(); expect(pacienteForm.contactosAlta).toEqual([]);
  });

  it('cancela un POST de contacto pendiente al cambiar la sesión', () => {
    const pendiente = new Subject<ContactoEmergenciaResponse>(); contactosApi.crear.and.returnValue(pendiente);
    const { pacienteForm, contactos } = abrir(); completar(pacienteForm); agregar(contactos, 'Familiar'); pacienteForm.guardar();
    expect(contactosApi.crear).toHaveBeenCalledTimes(1);
    usuario.set({ idUsuario: 2, idRol: 1 }); token = 'token-dos'; fixture.detectChanges();
    expect(pendiente.observed).toBeFalse(); pendiente.next(respuesta(7,
      { nombres: 'Familiar', apellidos: 'Paz', telefono: '5555', direccion: 'Zona 1', idPaciente: 41 }));
    expect(pacienteForm.contactosAlta).toEqual([]); expect(navegar).not.toHaveBeenCalled();
  });
});
