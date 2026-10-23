import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { ConsultaDetalleDto, PagedResponse } from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PacientesService } from '../../core/services/paciente.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultaDetalleComponent } from './consulta-detalle.component';

const consulta = (idPaciente = 11): ConsultaDetalleDto => ({
  idConsulta: 17, idPaciente, idMedico: 7, idSucursal: 3, idClinica: null,
  fechaConsulta: '2026-10-19T10:00:00Z', motivoConsulta: 'Control general',
  sintomas: 'Fatiga', observaciones: 'Seguimiento', pesoLb: 150,
  alturaCm: 170, presionSistolica: 120, presionDiastolica: 80,
});
const page = <T>(items: T[]): PagedResponse<T> => ({
  items, page: 1, pageSize: 100, totalCount: items.length, totalPages: items.length ? 1 : 0,
});

describe('CON-UX-01 detalle de consulta', () => {
  const readPacientes = signal(true);
  const readEmpleados = signal(true);
  const readHistorial = signal(true);
  const createHistorial = signal(true);
  const authenticated = signal(true);
  const userId = signal(4);
  let service: jasmine.SpyObj<HistorialService>;
  let patient: jasmine.Spy;
  let doctor: jasmine.Spy;

  beforeEach(() => {
    readPacientes.set(true); readEmpleados.set(true); readHistorial.set(true);
    createHistorial.set(true); authenticated.set(true); userId.set(4);
    service = jasmine.createSpyObj<HistorialService>('HistorialService', [
      'obtenerConsulta', 'listarDiagnosticos', 'listarTratamientos', 'listarExamenes',
      'listarHistorial', 'crearDiagnostico', 'crearExamen', 'crearEvolucion',
      'registrarConsumoClinico',
    ]);
    service.obtenerConsulta.and.returnValue(of(consulta()));
    service.listarDiagnosticos.and.returnValue(of(page([])));
    service.listarTratamientos.and.returnValue(of(page([])));
    service.listarExamenes.and.returnValue(of(page([])));
    service.listarHistorial.and.returnValue(of(page([])));
    patient = jasmine.createSpy('obtenerPaciente').and.returnValue(of({ idPaciente: 11, nombres: 'Ana', apellidos: 'López' }));
    doctor = jasmine.createSpy('obtenerMedico').and.returnValue(of({ idEmpleado: 7, nombres: 'Luis', apellidos: 'Pérez' }));
    TestBed.configureTestingModule({
      imports: [ConsultaDetalleComponent],
      providers: [provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: (key: string) => key === 'id' ? '11' : '17' } } } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => authenticated(), currentUser: () => ({ idUsuario: userId(), idRol: 2 }), token: 'session-one',
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.PACIENTES ? readPacientes()
            : modulo === MODULOS_PERMISO.EMPLEADOS ? readEmpleados() : readHistorial(),
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.HISTORIAL ? createHistorial() : false,
        } },
        { provide: HistorialService, useValue: service },
        { provide: PacientesService, useValue: { obtener: patient } },
        { provide: EmpleadosService, useValue: { obtener: doctor } },
        { provide: CatalogosService, useValue: {
          obtenerSucursal: () => of({ idSucursal: 3, nombre: 'Clínica Central' }),
          obtenerClinica: () => of(null),
        } },
        { provide: InventarioService, useValue: {} },
      ],
    });
  });

  function render() {
    const fixture = TestBed.createComponent(ConsultaDetalleComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('muestra nombres verificados y seis apartados con evaluación real', () => {
    const fixture = render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('[role="tab"]').length).toBe(6);
    expect(element.textContent).toContain('Ana López');
    expect(element.textContent).toContain('Luis Pérez');
    expect(element.textContent).toContain('Clínica Central');
    expect(element.textContent).toContain('Fatiga');
    expect(element.querySelector('#panel-evaluacion')).not.toBeNull();
  });

  it('cambia de pestaña por clic y teclado sin crear registros ni repetir lecturas', () => {
    const fixture = render();
    const tabs = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('[role="tab"]');
    tabs[1].click(); fixture.detectChanges();
    expect(fixture.componentInstance.tab).toBe('examenes');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay exámenes registrados');
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.tab).toBe('diagnosticos');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay diagnósticos registrados');
    tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.componentInstance.tab).toBe('hospitalizacion');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('no identifican una consulta concreta');
    expect(service.obtenerConsulta).toHaveBeenCalledTimes(1);
    expect(service.crearDiagnostico).not.toHaveBeenCalled();
    expect(service.crearExamen).not.toHaveBeenCalled();
    expect(service.crearEvolucion).not.toHaveBeenCalled();
    expect(service.registrarConsumoClinico).not.toHaveBeenCalled();
  });

  it('retira nombres y acciones cuando se revocan permisos', () => {
    const fixture = render();
    readEmpleados.set(false); createHistorial.set(false); fixture.detectChanges();
    expect(fixture.componentInstance.medico).toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Médico no disponible');
    expect(doctor).toHaveBeenCalledTimes(1);
    fixture.componentInstance.seleccionarTab('diagnosticos'); fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('form')).toBeNull();
    readHistorial.set(false); fixture.detectChanges();
    expect(fixture.componentInstance.consulta).toBeNull();
  });

  it('descarta un nombre antiguo si cambia el paciente y cancela al perder sesión', () => {
    const pending = new Subject<{ idPaciente: number; nombres: string; apellidos: string }>();
    patient.and.returnValues(pending, of({ idPaciente: 12, nombres: 'Bea', apellidos: 'Ruiz' }));
    const fixture = render();
    expect(fixture.componentInstance.paciente).toBeNull();
    service.obtenerConsulta.and.returnValue(of(consulta(12)));
    fixture.componentInstance.idPaciente = 12;
    fixture.componentInstance.cargarTodo(); fixture.detectChanges();
    pending.next({ idPaciente: 11, nombres: 'Nombre', apellidos: 'Anterior' });
    expect(fixture.componentInstance.nombrePaciente).toBe('Bea Ruiz');
    authenticated.set(false); fixture.detectChanges();
    expect(fixture.componentInstance.consulta).toBeNull();
    expect(fixture.componentInstance.paciente).toBeNull();
  });
});
