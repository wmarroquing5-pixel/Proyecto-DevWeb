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
  });

  beforeEach(async () => {
    queryId = null;
    usuario.set({ idUsuario: 1, idRol: 2, username: 'operador', idEmpleado: null });
    token.set('sesion-a'); consultarPacientes.set(true); crearConsultas.set(true); consultarClinicas.set(false);
    listar = jasmine.createSpy('listarPacientes').and.callFake((_n, _a, page = 1) => of(pagina(page)));
    obtener = jasmine.createSpy('obtenerPaciente').and.callFake(id => of(paciente(id)));
    crear = jasmine.createSpy('crearConsulta').and.callFake(request => of(respuesta(request)));
    await TestBed.configureTestingModule({ imports: [ConsultaNuevaComponent], providers: [
      provideRouter([]),
      { provide: ActivatedRoute, useValue: { snapshot: {
        paramMap: { get: () => null }, queryParamMap: { get: () => queryId },
      } } },
      { provide: PacientesService, useValue: { listar, obtener } },
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
    component.cargarPacientes(2); component.cargarPacientes(3);
    component.seleccionarPaciente(41); component.cargarPacientes(1);
    component.guardar();
    expect(component.idPaciente).toBe(41);
    expect(obtener).toHaveBeenCalledWith(41);
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idPaciente: 41, idMedico: 2 }));
    expect(navegar).toHaveBeenCalledWith(['/historial', 41, 'consulta', 73]);
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
