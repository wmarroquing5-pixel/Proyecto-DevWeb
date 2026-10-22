import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
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

describe('CON-UX-02 Gestión de Consultas', () => {
  let fixture: ComponentFixture<ConsultasListComponent>;
  let listar: jasmine.Spy<(filtro: ConsultaFiltroDto) => Observable<PagedResponse<ConsultaListadoDto>>>;
  let paciente: jasmine.Spy;
  let foto: jasmine.Spy;
  let medico: jasmine.Spy;
  let listarPacientes: jasmine.Spy;
  let listarMedicos: jasmine.Spy;
  let listarSucursales: jasmine.Spy;
  let listarClinicas: jasmine.Spy;
  let autorizacion: WritableSignal<boolean>;
  let pacientesPermitidos: WritableSignal<boolean>;
  let medicosPermitidos: WritableSignal<boolean>;
  let historialPermitido: WritableSignal<boolean>;
  let crearPermitido: WritableSignal<boolean>;
  let sucursalesPermitidas: WritableSignal<boolean>;
  let clinicasPermitidas: WritableSignal<boolean>;
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
    clinicasPermitidas = signal(true);
    usuario = signal(7);
    token = 'session-one';
    listar = jasmine.createSpy('listarConsultas').and.returnValue(of(page([consulta])));
    paciente = jasmine.createSpy('obtenerPaciente').and.callFake((id: number) =>
      of({ idPaciente: id, nombres: 'Ana', apellidos: 'Pérez' }));
    foto = jasmine.createSpy('obtenerFoto').and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    medico = jasmine.createSpy('obtenerMedico').and.callFake((id: number) =>
      of({ idEmpleado: id, nombres: 'Dra. Luz', apellidos: 'García' }));
    listarPacientes = jasmine.createSpy('listarPacientes').and.callFake(
      (_nombre: string, _activo: boolean, page: number, pageSize: number) => of({
        items: [{ idPaciente: 11, nombres: 'Ana', apellidos: 'Pérez', activo: true }],
        page, pageSize, totalCount: 1, totalPages: 1,
      }));
    listarMedicos = jasmine.createSpy('listarMedicos').and.callFake(
      (_nombre: string, _tipo: string, _sucursal: number, _activo: boolean,
       page: number, pageSize: number) => of({
        items: [{ idEmpleado: 8, nombres: 'Dra. Luz', apellidos: 'García', tipoEmpleado: 'Medico', activo: true, idSucursal: 3 }],
        page, pageSize, totalCount: 1, totalPages: 1,
      }));
    listarSucursales = jasmine.createSpy('getSucursales').and.returnValue(of([
      { idSucursal: 3, nombre: 'Central', direccion: null, activa: true },
    ]));
    listarClinicas = jasmine.createSpy('getClinicas').and.returnValue(of([
      { idClinica: 5, nombreClinica: 'General', especialidad: null, activa: true, idSucursal: 3 },
    ]));

    TestBed.configureTestingModule({
      imports: [ConsultasListComponent],
      providers: [
        provideRouter([]),
        { provide: HistorialService, useValue: { listarConsultas: listar } },
        { provide: CatalogosService, useValue: {
          getSucursales: listarSucursales,
          getClinicas: listarClinicas,
        } },
        { provide: PacientesService, useValue: {
          listar: listarPacientes,
          obtener: paciente, obtenerFoto: foto,
        } },
        { provide: EmpleadosService, useValue: {
          listar: listarMedicos,
          obtener: medico,
        } },
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
              case MODULOS_PERMISO.CLINICAS: return clinicasPermitidas();
              default: return false;
            }
          },
        } },
      ],
    });
  });

  it('muestra encabezado, guía informativa y tabla clínica compacta', () => {
    listar.and.returnValue(of(page([consulta, { ...consulta, idConsulta: 18 }])));
    render();
    expect(text()).toContain('Gestión de Consultas');
    expect(text()).toContain('Administra consultas médicas y accede al expediente clínico del paciente.');
    const flujo = (fixture.nativeElement as HTMLElement).querySelector('.consultas-flujo');
    expect(flujo?.textContent).toContain('Flujo de la consulta');
    expect(Array.from(flujo?.querySelectorAll('li') ?? [], item => item.textContent?.trim()))
      .toEqual(['Evaluación', 'Exámenes', 'Diagnóstico', 'Tratamiento', 'Evolución', 'Hospitalización']);
    expect(flujo?.querySelector('a, button')).toBeNull();
    const columnas = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('thead th'))
      .map(item => item.textContent?.trim());
    expect(columnas).toEqual(['No.', 'Paciente', 'Evaluación inicial', 'Fecha', 'Médico', 'Estado', 'Acciones']);
    expect(text()).toContain('Ana Pérez');
    expect(text()).toContain('Dra. Luz García');
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent).not.toContain('ID 11');
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent).not.toContain('ID 8');
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent).toContain('Central');
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody')?.textContent).toContain('No asignada');
    expect(paciente).toHaveBeenCalledOnceWith(11);
    expect(medico).toHaveBeenCalledOnceWith(8);
    expect(foto).toHaveBeenCalledOnceWith(11);
  });

  it('conserva filtros avanzados al cerrar el panel y no ofrece un filtro de Estado sin contrato', () => {
    const component = render();
    const element = fixture.nativeElement as HTMLElement;
    const panel = element.querySelector<HTMLDetailsElement>('.consultas-filtros__advanced')!;
    expect(panel.open).toBeFalse();
    expect(element.querySelector('#consulta-desde')).not.toBeNull();
    expect(element.querySelector('#consulta-hasta')).not.toBeNull();
    expect(element.querySelector('#consulta-id-estado')).toBeNull();
    panel.querySelector('summary')!.click();
    expect(panel.open).toBeTrue();
    component.seleccionarMedico(8);
    component.filtros.idSucursal = 3;
    component.filtros.idClinica = 5;
    panel.querySelector('summary')!.click();
    expect(panel.open).toBeFalse();
    component.buscar();
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      idMedico: 8, idSucursal: 3, idClinica: 5,
    }));
  });

  it('mantiene ubicación secundaria y las tres rutas accesibles en la fila', () => {
    render();
    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr')!;
    const location = row.querySelector<HTMLDetailsElement>('.consultas-ubicacion')!;
    expect(location.querySelector('summary')?.textContent).toContain('Ver ubicación');
    location.querySelector('summary')!.click();
    expect(location.open).toBeTrue();
    expect(location.textContent).toContain('Sucursal: Central');
    expect(location.textContent).toContain('Clínica: No asignada');
    expect(Array.from(row.querySelectorAll<HTMLAnchorElement>('.consultas-actions a'), a => a.getAttribute('aria-label')))
      .toEqual(['Ver detalle de consulta', 'Ver historial del paciente', 'Ver ficha médica del paciente']);
  });

  it('adapta la tabla al ancho disponible después del menú lateral sin ocultar acciones', async () => {
    render();
    const element = fixture.nativeElement as HTMLElement;
    const pageShell = element.querySelector<HTMLElement>('.page-shell')!;
    const wrapper = element.querySelector<HTMLElement>('.consultas-results')!;
    const row = element.querySelector<HTMLElement>('tbody tr')!;
    for (const width of [1440, 1116, 1042, 984, 728, 362]) {
      pageShell.style.setProperty('width', `${width}px`, 'important');
      pageShell.style.setProperty('min-width', '0', 'important');
      pageShell.style.setProperty('max-width', `${width}px`, 'important');
      fixture.detectChanges();
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
      expect(pageShell.isConnected).toBeTrue();
      expect(pageShell.style.width).toBe(`${width}px`);
      const edge = wrapper.getBoundingClientRect().right;
      const overflow = Array.from(wrapper.querySelectorAll<HTMLElement>('*'))
        .filter(node => node.getBoundingClientRect().right > edge + 1)
        .slice(0, 4).map(node => `${node.tagName}.${node.className}: ${Math.round(node.getBoundingClientRect().right - edge)}px`);
      expect(wrapper.scrollWidth).withContext(`ancho de contenido ${width}px; ${overflow.join(', ')}`)
        .toBeLessThanOrEqual(wrapper.clientWidth + 1);
      expect(row.querySelectorAll('.consultas-actions a').length).toBe(3);
      const statusCell = row.querySelector<HTMLElement>('td[data-label="Estado"]')!;
      const status = statusCell.querySelector<HTMLElement>('.consultas-estado')!;
      expect(status.getBoundingClientRect().right)
        .withContext(`estado dentro de su celda a ${width}px`)
        .toBeLessThanOrEqual(statusCell.getBoundingClientRect().right + 1);
      const actionsCell = row.querySelector<HTMLElement>('td[data-label="Acciones"]')!;
      for (const action of Array.from(actionsCell.querySelectorAll<HTMLElement>('a'))) {
        expect(action.getBoundingClientRect().right)
          .withContext(`acción dentro de su celda a ${width}px`)
          .toBeLessThanOrEqual(actionsCell.getBoundingClientRect().right + 1);
      }
      if (width <= 920) expect(getComputedStyle(row).display)
        .withContext(`target=${width}, shell=${pageShell.clientWidth}, computed=${getComputedStyle(pageShell).width}, min=${getComputedStyle(pageShell).minWidth}, max=${getComputedStyle(pageShell).maxWidth}, wrapper=${wrapper.clientWidth}, container=${getComputedStyle(wrapper).containerName}`)
        .toBe('block');
    }
    pageShell.style.width = '';
    pageShell.style.minWidth = '';
    pageShell.style.maxWidth = '';
  });

  it('usa los cinco campos del DTO enriquecido sin repetir lecturas de nombres', () => {
    listar.and.returnValue(of(page([{
      ...consulta, idClinica: 5, motivoConsulta: 'Revisión de dolor lumbar',
      nombrePaciente: 'Lucía Morales', nombreMedico: 'Dr. Carlos Rivera',
      nombreSucursal: 'Sucursal Norte', nombreClinica: 'Clínica de Medicina General',
    }])));
    render();
    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    expect(row?.textContent).toContain('Lucía Morales');
    expect(row?.querySelector('.consultas-evaluacion')?.textContent).toContain('Revisión de dolor lumbar');
    expect(row?.textContent).toContain('Dr. Carlos Rivera');
    expect(row?.textContent).toContain('Sucursal Norte');
    expect(row?.textContent).toContain('Clínica de Medicina General');
    expect(row?.textContent).not.toContain('ID 11');
    expect(paciente).not.toHaveBeenCalled();
    expect(medico).not.toHaveBeenCalled();
    expect(foto).toHaveBeenCalledOnceWith(11);
  });

  it('trata null como no disponible sin pedir lecturas que el API no autorizó', () => {
    listar.and.returnValue(of(page([{
      ...consulta, idClinica: 5, motivoConsulta: null,
      nombrePaciente: null, nombreMedico: null,
      nombreSucursal: null, nombreClinica: null,
    }])));
    render();
    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    expect(row?.textContent).toContain('Paciente no disponible');
    expect(row?.textContent).toContain('Médico no disponible');
    expect(row?.textContent).toContain('Sucursal no disponible');
    expect(row?.textContent).toContain('Clínica no disponible');
    expect(row?.textContent).toContain('No disponible');
    expect(row?.textContent).not.toContain('No asignada');
    expect(paciente).not.toHaveBeenCalled();
    expect(medico).not.toHaveBeenCalled();
    expect(foto).not.toHaveBeenCalled();
  });

  it('oculta nombres enriquecidos si se revocan los permisos locales relacionados', () => {
    pacientesPermitidos.set(false);
    medicosPermitidos.set(false);
    sucursalesPermitidas.set(false);
    clinicasPermitidas.set(false);
    listar.and.returnValue(of(page([{
      ...consulta, idClinica: 5, motivoConsulta: 'Control real',
      nombrePaciente: 'Dato protegido', nombreMedico: 'Médico protegido',
      nombreSucursal: 'Sucursal protegida', nombreClinica: 'Clínica protegida',
    }])));
    render();
    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    expect(row?.textContent).toContain('Control real');
    expect(row?.textContent).not.toContain('protegido');
    expect(row?.textContent).not.toContain('protegida');
    expect(row?.textContent).toContain('Paciente no disponible');
    expect(row?.textContent).toContain('Médico no disponible');
    expect(paciente).not.toHaveBeenCalled();
    expect(medico).not.toHaveBeenCalled();
    expect(foto).not.toHaveBeenCalled();
  });

  it('mantiene No asignada solo para clínica nula y nombres de catálogo en respuesta antigua', () => {
    listar.and.returnValue(of(page([{ ...consulta, motivoConsulta: undefined }])));
    render();
    const row = (fixture.nativeElement as HTMLElement).querySelector('tbody tr');
    expect(row?.textContent).toContain('Central');
    expect(row?.textContent).toContain('No asignada');
    expect(row?.querySelector('.consultas-evaluacion')?.textContent).toContain('No disponible');
    expect(paciente).toHaveBeenCalledOnceWith(11);
    expect(medico).toHaveBeenCalledOnceWith(8);
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
    clinicasPermitidas.set(false);
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

  it('filtra con los IDs elegidos por nombre y Limpiar conserva el contrato paginado', () => {
    const component = render();
    const form = (fixture.nativeElement as HTMLElement).querySelector('form.consultas-filtros');
    expect(form?.querySelectorAll('select').length).toBe(5);
    expect(form?.textContent).toContain('Ana Pérez');
    expect(form?.textContent).toContain('Dra. Luz García');
    expect(form?.textContent).toContain('Central');
    expect(form?.textContent).toContain('General');
    component.busquedaPaciente = 'Ana';
    component.busquedaMedico = 'Luz';
    component.cargarPacientes(1);
    component.cargarMedicos(1);
    expect(listarPacientes).toHaveBeenCalledWith('Ana', undefined, 1, 20);
    expect(listarMedicos).toHaveBeenCalledWith('Luz', 'Medico', undefined, undefined, 1, 20);
    component.seleccionarPaciente(11);
    component.seleccionarMedico(8);
    component.filtros.idSucursal = 3;
    component.filtros.idClinica = 5;
    component.buscar();
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      idPaciente: 11, idMedico: 8, idSucursal: 3, idClinica: 5, page: 1,
    }));
    component.limpiarFiltros();
    expect(listar.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({
      idPaciente: null, idMedico: null, idSucursal: null, idClinica: null,
    }));
  });

  it('navega catálogos paginados sin perder paciente ni médico seleccionados', () => {
    const pacientes = Array.from({ length: 21 }, (_, index) => ({
      idPaciente: index + 1, nombres: `Paciente ${index + 1}`, apellidos: 'Prueba', activo: true,
    }));
    const medicos = Array.from({ length: 21 }, (_, index) => ({
      idEmpleado: index + 1, nombres: `Médico ${index + 1}`, apellidos: 'Prueba',
      tipoEmpleado: 'Medico', activo: true, idSucursal: 3,
    }));
    listarPacientes.and.callFake((_nombre: string, _activo: boolean, page: number, pageSize: number) =>
      of({ items: pacientes.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: 21, totalPages: 2 }));
    listarMedicos.and.callFake((_nombre: string, _tipo: string, _sucursal: number,
      _activo: boolean, page: number, pageSize: number) =>
      of({ items: medicos.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: 21, totalPages: 2 }));
    const component = render();
    component.seleccionarPaciente(1);
    component.seleccionarMedico(1);
    component.cargarPacientes(2);
    component.cargarMedicos(2);
    fixture.detectChanges();
    expect(component.filtros.idPaciente).toBe(1);
    expect(component.filtros.idMedico).toBe(1);
    expect(component.pacientesPagina[0].idPaciente).toBe(21);
    expect(component.medicosPagina[0].idEmpleado).toBe(21);
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#consulta-id-paciente')?.textContent).toContain('Paciente 1');
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>('#consulta-id-medico')?.textContent).toContain('Médico 1');
  });

  it('explica ausencia de permisos y conserva filtros técnicos sin pedir catálogos', () => {
    pacientesPermitidos.set(false);
    medicosPermitidos.set(false);
    sucursalesPermitidas.set(false);
    clinicasPermitidas.set(false);
    render();
    const element = fixture.nativeElement as HTMLElement;
    for (const id of ['paciente', 'medico', 'sucursal', 'clinica']) {
      expect(element.querySelector(`#consulta-id-${id}`)?.getAttribute('type')).toBe('number');
    }
    expect(text()).toContain('Sin Pacientes/Consultar');
    expect(text()).toContain('Sin Empleados/Consultar');
    expect(listarPacientes).not.toHaveBeenCalled();
    expect(listarMedicos).not.toHaveBeenCalled();
    expect(listarSucursales).not.toHaveBeenCalled();
    expect(listarClinicas).not.toHaveBeenCalled();
  });

  it('no oculta un catálogo demasiado grande ni confunde relación existente con nula', () => {
    listar.and.returnValue(of(page([{ ...consulta, idClinica: 5 }])));
    listarSucursales.and.returnValue(throwError(() => new Error('El catálogo sucursales excede el límite seguro de consulta.')));
    listarClinicas.and.returnValue(throwError(() => new Error('El catálogo clinicas excede el límite seguro de consulta.')));
    render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('#consulta-id-sucursal')?.getAttribute('type')).toBe('number');
    expect(element.querySelector('#consulta-id-clinica')?.getAttribute('type')).toBe('number');
    expect(text()).toContain('excede el límite seguro');
    expect(element.querySelector('tbody')?.textContent).toContain('Sucursal no disponible');
    expect(element.querySelector('tbody')?.textContent).toContain('Clínica no disponible');
    expect(element.querySelector('tbody')?.textContent).not.toContain('No asignada');
  });

  it('descarta respuestas tardías del catálogo al cambiar de sesión', () => {
    const pendiente = new Subject<PagedResponse<{ idPaciente: number; nombres: string; apellidos: string; activo: boolean }>>();
    listarPacientes.and.returnValues(pendiente, of({
      items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0,
    }));
    const component = render();
    usuario.set(9);
    token = 'session-two';
    TestBed.flushEffects();
    pendiente.next({
      items: [{ idPaciente: 11, nombres: 'Paciente', apellidos: 'Anterior', activo: true }],
      page: 1, pageSize: 20, totalCount: 1, totalPages: 1,
    });
    fixture.detectChanges();
    expect(component.pacientesPagina).toEqual([]);
    expect((fixture.nativeElement as HTMLElement).querySelector('#consulta-id-paciente')?.textContent)
      .not.toContain('Paciente Anterior');
  });

  it('descarta una página enriquecida tardía al cambiar de sesión', () => {
    const pendiente = new Subject<PagedResponse<ConsultaListadoDto>>();
    listar.and.returnValue(pendiente);
    const component = render();
    usuario.set(9);
    token = 'session-two';
    TestBed.flushEffects();
    pendiente.next(page([{ ...consulta, nombrePaciente: 'Nombre de sesión anterior', motivoConsulta: 'Nota anterior' }]));
    fixture.detectChanges();
    expect(component.consultas).toEqual([]);
    expect(text()).not.toContain('Nombre de sesión anterior');
    expect(text()).not.toContain('Nota anterior');
  });
});
