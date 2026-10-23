import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import { routes } from '../../app.routes';
import { Clinica } from '../../core/models/catalogos.model';
import { PacienteListadoResponse, PacienteResponse, PagedResponse } from '../../core/models/paciente.model';
import { ConsultaCreateDto, ConsultaDetalleDto } from '../../core/models/historial.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { HistorialService } from '../../core/services/historial.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultaNuevaComponent } from './consulta-nueva.component';

describe('AUDIT-PAC-CON-01 selección de paciente en Consultas', () => {
  let fixture: ComponentFixture<ConsultaNuevaComponent>;
  let component: ConsultaNuevaComponent;
  let listar: jasmine.Spy<(nombre?: string, activo?: boolean, page?: number, size?: number) => Observable<PagedResponse<PacienteListadoResponse>>>;
  let obtener: jasmine.Spy<(id: number) => Observable<PacienteResponse>>;
  let obtenerFoto: jasmine.Spy<(id: number) => Observable<Blob>>;
  let crear: jasmine.Spy<(request: ConsultaCreateDto) => Observable<ConsultaDetalleDto>>;
  let navegar: jasmine.Spy;
  let queryId: string | null;
  const usuario = signal({ idUsuario: 1, idRol: 2, username: 'operador', idEmpleado: null as number | null });
  const token = signal<string | null>('sesion-a');
  const consultarPacientes = signal(true);
  const crearConsultas = signal(true);
  const consultarClinicas = signal(false);
  const paciente = (id: number, activo = true): PacienteResponse => ({
    idPaciente: id, nombres: 'Ana', apellidos: `Paciente ${id}`, activo,
    fechaNacimiento: '1990-01-01', fechaRegistro: '2026-01-01',
  });
  const pagina = (page: number, total = 41): PagedResponse<PacienteListadoResponse> => ({
    items: Array.from({ length: Math.min(20, total - (page - 1) * 20) }, (_, i) => {
      const id = (page - 1) * 20 + i + 1;
      return { idPaciente: id, nombres: 'Ana', apellidos: `Paciente ${id}`, activo: true };
    }),
    page, pageSize: 20, totalCount: total, totalPages: Math.ceil(total / 20),
  });
  const respuesta = (request: ConsultaCreateDto): ConsultaDetalleDto => ({
    ...request, idConsulta: 73, idMedico: request.idMedico ?? 2,
    motivoConsulta: request.motivoConsulta ?? null, sintomas: null, observaciones: null, pesoLb: null,
    alturaCm: null, presionSistolica: null, presionDiastolica: null,
  });

  beforeEach(async () => {
    queryId = null;
    usuario.set({ idUsuario: 1, idRol: 2, username: 'operador', idEmpleado: null });
    token.set('sesion-a'); consultarPacientes.set(true); crearConsultas.set(true); consultarClinicas.set(false);
    listar = jasmine.createSpy('listarPacientes').and.callFake((_n, _a, page = 1) => of(pagina(page)));
    obtener = jasmine.createSpy('obtenerPaciente').and.callFake(id => of(paciente(id)));
    obtenerFoto = jasmine.createSpy('obtenerFoto').and.returnValue(of(new Blob(['foto'], { type: 'image/png' })));
    crear = jasmine.createSpy('crearConsulta').and.callFake(request => of(respuesta(request)));
    await TestBed.configureTestingModule({ imports: [ConsultaNuevaComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: {
        paramMap: { get: () => null }, queryParamMap: { get: () => queryId },
      } } },
      { provide: PacientesService, useValue: { listar, obtener, obtenerFoto } },
      { provide: HistorialService, useValue: { crearConsulta: crear } },
      { provide: AuthSessionService, useValue: {
        currentUser: usuario, isAuthenticated: () => !!usuario() && !!token(),
        get token() { return token(); },
      } },
      { provide: PermisosService, useValue: {
        puedeCrear: (modulo: string) => modulo === 'Consultas' && crearConsultas(),
        puedeConsultar: (modulo: string) => modulo === 'Pacientes' ? consultarPacientes()
          : modulo === 'Clinicas' ? consultarClinicas() : modulo === 'Empleados',
      } },
      { provide: EmpleadosService, useValue: {
        listar: () => of({ items: [{ idEmpleado: 2, nombres: 'Marta', apellidos: 'López',
          tipoEmpleado: 'Medico', activo: true, idSucursal: 3 }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 }),
        obtener: () => of({ idEmpleado: 2, nombres: 'Marta', apellidos: 'López',
          tipoEmpleado: 'Medico', activo: true, idSucursal: 3 }),
      } },
      { provide: CatalogosService, useValue: {
        getSucursales: () => of([{ idSucursal: 3, nombre: 'Central', activa: true }]),
        getClinicas: () => of([{ idClinica: 9, nombreClinica: 'General', idSucursal: 3, activa: true },
          { idClinica: 10, nombreClinica: 'Otra', idSucursal: 4, activa: true }] as Clinica[]),
      } },
    ] }).compileComponents();
    navegar = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  function abrir(): void {
    fixture = TestBed.createComponent(ConsultaNuevaComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    component.form.idSucursal = 3;
    component.seleccionarMedico(2);
  }

  it('la ruta principal reside en Consultas y la ruta histórica sigue disponible', () => {
    const children = routes.find(item => item.children)?.children ?? [];
    const nueva = children.find(item => item.path === 'consultas/nueva');
    const antigua = children.find(item => item.path === 'historial/:id/nueva-consulta');
    expect(nueva?.canActivate).toBeDefined();
    expect(antigua?.canActivate).toBeDefined();
    expect(JSON.stringify(nueva?.data)).toContain('Pacientes');
    expect(JSON.stringify(nueva?.data)).toContain('Consultas');
  });

  it('mantiene tres tarjetas y selector sin búsqueda ni paginación externa', () => {
    abrir(); fixture.detectChanges();
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelector('h1')?.textContent).toContain('Nueva Consulta');
    expect(view.querySelector('header a[href="/consultas"]')?.textContent).toContain('Volver al listado');
    for (const [id, title] of [
      ['consulta-paciente-title', 'Paciente'],
      ['consulta-datos-title', 'Datos de la consulta'],
      ['consulta-acciones-title', 'Acciones'],
    ]) {
      const section = view.querySelector(`section[aria-labelledby="${id}"]`);
      expect(section).not.toBeNull();
      expect(section?.querySelector(`#${id}`)?.textContent).toContain(title);
    }
    for (const name of ['idMedico', 'idSucursal', 'fechaConsulta', 'motivoConsulta']) {
      expect(view.querySelector(`[name="${name}"]`)).withContext(name).not.toBeNull();
    }
    for (const name of ['sintomas', 'observaciones', 'pesoLb', 'alturaCm',
      'presionSistolica', 'presionDiastolica', 'temperaturaC', 'frecuenciaCardiaca', 'estadoConsulta']) {
      expect(view.querySelector(`[name="${name}"]`)).withContext(name).toBeNull();
    }
    expect(view.querySelector('[name="buscarPaciente"]')).toBeNull();
    expect(view.querySelector('.consulta-nueva-page__pager[aria-label="Páginas de pacientes"]')).toBeNull();
    expect(view.querySelector<HTMLTextAreaElement>('[name="motivoConsulta"]')?.maxLength).toBe(300);
    expect(view.querySelector('#consulta-datos-title + .row .col-md-6')).not.toBeNull();
    expect(view.querySelector('#consulta-evaluacion-title')).toBeNull();
    expect(view.querySelector('form#consulta-nueva-form button[type="submit"]')?.textContent).toContain('Guardar consulta');
    expect(crear).not.toHaveBeenCalled();
  });

  it('muestra identidad y estado sin consultar automáticamente la fotografía al seleccionar', () => {
    abrir(); component.seleccionarPaciente(1); fixture.detectChanges();
    const view = fixture.nativeElement as HTMLElement;
    expect(view.querySelector('.consulta-nueva-page__patient')?.textContent).toContain('Ana Paciente 1');
    expect(view.querySelector('.consulta-nueva-page__patient')?.textContent).toContain('Identificador interno: 1');
    expect(view.querySelector('.consulta-nueva-page__patient .badge')?.textContent).toContain('Activo');
    expect(obtenerFoto).not.toHaveBeenCalled();
    expect(obtener).not.toHaveBeenCalled();
  });

  it('carga fotografía autenticada solo por acción explícita y revoca la URL al cambiar de paciente', () => {
    const crearUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:paciente-1');
    const revocarUrl = spyOn(URL, 'revokeObjectURL');
    abrir(); component.seleccionarPaciente(1); fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('.consulta-nueva-page__photo-button')!.click();
    fixture.detectChanges();
    expect(obtenerFoto).toHaveBeenCalledOnceWith(1);
    expect(crearUrl).toHaveBeenCalled();
    expect(component.fotoPacienteUrl).toBe('blob:paciente-1');
    expect((fixture.nativeElement as HTMLElement).querySelector('img.consulta-nueva-page__avatar')).not.toBeNull();
    component.seleccionarPaciente(2);
    expect(component.fotoPacienteUrl).toBeNull();
    expect(revocarUrl).toHaveBeenCalledOnceWith('blob:paciente-1');
    expect(obtenerFoto).toHaveBeenCalledTimes(1);
  });

  it('informa foto ausente y descarta una descarga tardía tras cambiar de sesión', () => {
    obtenerFoto.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    abrir(); component.seleccionarPaciente(1); component.cargarFotoPaciente();
    expect(component.avisoFoto).toContain('no tiene fotografía');
    const pendiente = new Subject<Blob>();
    obtenerFoto.and.returnValue(pendiente);
    component.cargarFotoPaciente();
    token.set('sesion-b'); fixture.detectChanges();
    pendiente.next(new Blob(['foto'], { type: 'image/png' }));
    expect(component.fotoPacienteUrl).toBeNull();
    expect(pendiente.observed).toBeFalse();
  });

  it('no muestra una fotografía cuando el servidor niega su lectura', () => {
    const crearUrl = spyOn(URL, 'createObjectURL');
    obtenerFoto.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    abrir(); component.seleccionarPaciente(1); component.cargarFotoPaciente(); fixture.detectChanges();
    expect(component.errorFoto).toBeTruthy();
    expect(component.fotoPacienteUrl).toBeNull();
    expect(crearUrl).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).querySelector('p[role="alert"]')?.textContent).toContain(component.errorFoto);
  });

  it('no crea automáticamente ni acepta guardar sin paciente seleccionado', () => {
    abrir();
    expect(listar).toHaveBeenCalledWith(undefined, true, 1, 20);
    expect(crear).not.toHaveBeenCalled();
    component.guardar();
    expect(component.error).toContain('paciente activo');
    expect(obtener).not.toHaveBeenCalled();
  });

  it('selecciona al paciente 41 fuera de la primera página y conserva su ID real', () => {
    abrir();
    component.elegirPaciente(-2); component.elegirPaciente(-2);
    component.seleccionarPaciente(41); component.cargarPacientes(1);
    component.guardar();
    expect(component.idPaciente).toBe(41);
    expect(obtener).toHaveBeenCalledWith(41);
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idPaciente: 41, idMedico: 2 }));
    expect(navegar).toHaveBeenCalledWith(['/consultas']);
  });

  it('ofrece opciones de avance y retroceso dentro del selector sin cambiar el paciente elegido', () => {
    abrir(); component.seleccionarPaciente(1); fixture.detectChanges();
    const opciones = () => Array.from((fixture.nativeElement as HTMLElement)
      .querySelector<HTMLSelectElement>('#paciente-consulta')!.options).map(option => option.textContent?.trim());
    expect(opciones()).toContain('Ver más pacientes');
    expect(opciones()).not.toContain('Ver pacientes anteriores');
    component.elegirPaciente(-2); fixture.detectChanges();
    expect(component.paginaPacientes).toBe(2);
    expect(component.idPaciente).toBe(1);
    expect(opciones()).toContain('Ver pacientes anteriores');
    component.elegirPaciente(-1); fixture.detectChanges();
    expect(component.paginaPacientes).toBe(1);
    expect(component.idPaciente).toBe(1);
    expect(listar.calls.allArgs().map(args => args[2])).toEqual([1, 2, 1]);
  });

  it('permite avanzar con teclado o ratón usando la opción del selector', async () => {
    abrir(); component.seleccionarPaciente(1); fixture.detectChanges();
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#paciente-consulta')!;
    select.selectedIndex = Array.from(select.options).findIndex(option => option.textContent?.trim() === 'Ver más pacientes');
    select.dispatchEvent(new Event('change'));
    await fixture.whenStable(); fixture.detectChanges();
    expect(component.paginaPacientes).toBe(2);
    expect(component.idPaciente).toBe(1);
    expect(select.textContent).toContain('Ana Paciente 21');
    expect(select.selectedOptions[0]?.textContent).toContain('Ana Paciente 1');
    expect(listar).toHaveBeenCalledWith(undefined, true, 2, 20);
  });

  it('crea sin campos clínicos ni estado y navega al listado de consultas', () => {
    abrir(); component.seleccionarPaciente(1); component.guardar();
    expect(Object.keys(crear.calls.mostRecent().args[0])).toEqual([
      'idPaciente', 'idMedico', 'idSucursal', 'idClinica', 'fechaConsulta',
    ]);
    expect(crear.calls.mostRecent().args[0].fechaConsulta).toBeTruthy();
    expect(navegar).toHaveBeenCalledOnceWith(['/consultas']);
  });

  it('envía motivo recortado solo si tiene contenido significativo', () => {
    abrir(); component.seleccionarPaciente(1);
    component.motivoConsulta = '  Control general  '; component.guardar();
    expect(crear.calls.mostRecent().args[0].motivoConsulta).toBe('Control general');
    fixture.destroy();
    abrir(); component.seleccionarPaciente(1);
    component.motivoConsulta = '   '; component.guardar();
    expect(Object.keys(crear.calls.mostRecent().args[0])).not.toContain('motivoConsulta');
  });

  it('rechaza motivo mayor a 300 caracteres sin enviar el POST', () => {
    abrir(); component.seleccionarPaciente(1);
    component.motivoConsulta = 'a'.repeat(301); component.guardar();
    expect(component.error).toContain('300');
    expect(crear).not.toHaveBeenCalled();
  });

  it('inicia con fecha local editable, acepta futuro y conserva la elección al cambiar paciente', () => {
    abrir(); fixture.detectChanges();
    const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#consulta-fecha')!;
    expect(input.readOnly).toBeFalse();
    expect(input.max).toBe('');
    expect(Math.abs(new Date(component.form.fechaConsulta).getTime() - Date.now())).toBeLessThan(60_000);
    component.form.fechaConsulta = '2099-01-01T10:30';
    component.seleccionarPaciente(1); component.seleccionarMedico(2);
    component.guardar();
    expect(crear.calls.mostRecent().args[0].fechaConsulta).toBe('2099-01-01T10:30');
  });

  it('rechaza una fecha ausente o inválida antes de enviar el POST', () => {
    abrir(); component.seleccionarPaciente(1);
    for (const fecha of ['', 'fecha-inválida', '2026-02-30T10:00']) {
      component.form.fechaConsulta = fecha; component.guardar();
      expect(component.error).toContain('fecha y hora');
    }
    expect(crear).not.toHaveBeenCalled();
  });

  it('respeta la primera y última página incompleta del total real', () => {
    abrir();
    expect(component.paginaPacientes).toBe(1);
    expect(component.totalPaginasPacientes).toBe(3);
    expect(component.pacientesPagina.length).toBe(20);
    component.cargarPacientes(3);
    expect(component.paginaPacientes).toBe(3);
    expect(component.pacientesPagina.map(item => item.idPaciente)).toEqual([41]);
    const solicitudes = listar.calls.count();
    component.cargarPacientes(4);
    expect(listar).toHaveBeenCalledTimes(solicitudes);
  });

  it('no agrega una página ficticia cuando el total es múltiplo exacto', () => {
    listar.and.callFake((_n, _a, page = 1) => of(pagina(page, 40)));
    abrir();
    expect(component.totalPaginasPacientes).toBe(2);
    component.cargarPacientes(2);
    expect(component.pacientesPagina.length).toBe(20);
    expect(component.pacientesPagina[19].idPaciente).toBe(40);
    const solicitudes = listar.calls.count();
    component.cargarPacientes(3);
    expect(listar).toHaveBeenCalledTimes(solicitudes);
  });

  it('acepta total cero sin mostrar pacientes ni una página siguiente', () => {
    listar.and.returnValue(of(pagina(1, 0)));
    abrir();
    expect(component.errorPacientes).toBe('');
    expect(component.totalPacientes).toBe(0);
    expect(component.totalPaginasPacientes).toBe(0);
    expect(component.pacientesPagina).toEqual([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay pacientes activos');
    expect((fixture.nativeElement as HTMLElement).querySelector('#paciente-consulta')?.textContent).not.toContain('Ver más pacientes');
    component.cargarPacientes(2);
    expect(listar).toHaveBeenCalledTimes(1);
    expect(crear).not.toHaveBeenCalled();
  });

  it('rechaza una página que deja de existir tras cambiar el total del catálogo', () => {
    abrir();
    listar.and.returnValue(of(pagina(2, 20)));
    component.cargarPacientes(2);
    expect(component.errorPacientes).toContain('paginación incoherente');
    expect(component.pacientesPagina).toEqual([]);
    expect(component.totalPaginasPacientes).toBe(0);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('paginación incoherente');
    expect((fixture.nativeElement as HTMLElement).querySelector('#paciente-consulta')?.textContent).not.toContain('Ver más pacientes');
    const solicitudes = listar.calls.count();
    component.cargarPacientes(3);
    expect(listar).toHaveBeenCalledTimes(solicitudes);
  });

  it('rechaza metadatos contradictorios aunque los elementos parezcan válidos', () => {
    listar.and.returnValue(of({ ...pagina(1, 21), totalPages: 1 }));
    abrir();
    expect(component.errorPacientes).toContain('paginación incoherente');
    expect(component.pacientesPagina).toEqual([]);
    expect(component.totalPaginasPacientes).toBe(0);
  });

  it('descarta una respuesta antigua al volver a la primera página', () => {
    abrir();
    const pendiente = new Subject<PagedResponse<PacienteListadoResponse>>();
    listar.and.returnValue(pendiente);
    component.elegirPaciente(-2);
    listar.and.returnValue(of(pagina(1, 1)));
    component.cargarPacientes(1);
    expect(listar.calls.mostRecent().args).toEqual([undefined, true, 1, 20]);
    pendiente.next(pagina(2));
    expect(component.paginaPacientes).toBe(1);
    expect(component.totalPacientes).toBe(1);
    expect(component.pacientesPagina.map(item => item.idPaciente)).toEqual([1]);
  });

  it('conserva el error HTTP y no expone paginación anterior', () => {
    abrir();
    listar.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    component.cargarPacientes(2);
    expect(component.errorPacientes).toBeTruthy();
    expect(component.pacientesPagina).toEqual([]);
    expect(component.totalPaginasPacientes).toBe(0);
    expect(component.totalPacientes).toBe(0);
  });

  it('admite más de una consulta para el mismo paciente existente sin crear pacientes', () => {
    abrir(); component.seleccionarPaciente(1); component.guardar();
    expect(crear).toHaveBeenCalledTimes(1);
    fixture.destroy();
    abrir(); component.seleccionarPaciente(1); component.guardar();
    expect(crear).toHaveBeenCalledTimes(2);
    expect(crear.calls.allArgs().every(([dto]) => dto.idPaciente === 1)).toBeTrue();
  });

  it('preselecciona un ID contextual solo después de GET y no envía POST por navegar', () => {
    queryId = '41'; abrir();
    expect(obtener).toHaveBeenCalledOnceWith(41);
    expect(component.pacienteSeleccionado?.idPaciente).toBe(41);
    expect(crear).not.toHaveBeenCalled();
  });

  it('rechaza un paciente que queda inactivo en la revalidación previa al POST', () => {
    abrir(); component.seleccionarPaciente(1);
    obtener.and.returnValue(of(paciente(1, false)));
    component.guardar();
    expect(crear).not.toHaveBeenCalled();
    expect(component.pacienteSeleccionado).toBeNull();
    expect(component.error).toContain('ya no está disponible');
  });

  it('muestra ProblemDetails cuando la consulta del paciente falla y no envía POST', () => {
    abrir(); component.seleccionarPaciente(1);
    obtener.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404,
      error: { title: 'No encontrado', detail: 'Paciente no encontrado.' },
    })));
    component.guardar();
    expect(component.error).toContain('Paciente no encontrado');
    expect(crear).not.toHaveBeenCalled();
  });

  it('no convierte una respuesta antigua de paciente en POST tras cambio de sesión', () => {
    abrir(); component.seleccionarPaciente(1);
    const pendiente = new Subject<PacienteResponse>();
    obtener.and.returnValue(pendiente); component.guardar();
    token.set('sesion-b'); pendiente.next(paciente(1));
    expect(crear).not.toHaveBeenCalled();
  });

  it('no acepta pacientes inactivos ni paginación contradictoria del catálogo', () => {
    listar.and.returnValue(of({ ...pagina(1), items: [{ idPaciente: 1, nombres: 'Ana', apellidos: 'Paz', activo: false }] }));
    abrir(); component.seleccionarPaciente(1); component.guardar();
    expect(component.errorPacientes).toContain('paginación incoherente');
    expect(component.totalPaginasPacientes).toBe(0);
    expect(component.pacienteSeleccionado).toBeNull();
    expect(crear).not.toHaveBeenCalled();
  });

  it('bloquea el alta al revocar Pacientes/Consultar o Consultas/Crear', () => {
    abrir(); component.seleccionarPaciente(1);
    consultarPacientes.set(false); fixture.detectChanges(); component.guardar();
    expect(crear).not.toHaveBeenCalled();
    consultarPacientes.set(true); crearConsultas.set(false); fixture.detectChanges(); component.guardar();
    expect(crear).not.toHaveBeenCalled();
  });

  it('conserva IdClinica opcional y valida sucursal y permiso', () => {
    consultarClinicas.set(true); abrir(); component.seleccionarPaciente(1);
    component.form.idClinica = 9; component.guardar();
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idClinica: 9 }));
    fixture.destroy();
    abrir(); component.seleccionarPaciente(1); component.form.idClinica = 10; component.guardar();
    expect(crear).toHaveBeenCalledTimes(1);
    expect(component.error).toContain('clínica activa');
  });
});
