import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
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
  const modifyConsultas = signal(false);
  const authenticated = signal(true);
  const userId = signal(4);
  let service: jasmine.SpyObj<HistorialService>;
  let patient: jasmine.Spy;
  let doctor: jasmine.Spy;

  beforeEach(() => {
    readPacientes.set(true); readEmpleados.set(true); readHistorial.set(true);
    createHistorial.set(true); modifyConsultas.set(false); authenticated.set(true); userId.set(4);
    service = jasmine.createSpyObj<HistorialService>('HistorialService', [
      'obtenerConsulta', 'listarDiagnosticos', 'listarTratamientos', 'listarExamenes',
      'listarHistorial', 'crearDiagnostico', 'crearExamen', 'crearEvolucion',
      'registrarConsumoClinico', 'actualizarConsulta',
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
          puedeModificar: (modulo: string) => modulo === MODULOS_PERMISO.CONSULTAS && modifyConsultas(),
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

  it('organiza los nueve campos clínicos en dos secciones de solo lectura', () => {
    service.obtenerConsulta.and.returnValue(of({ ...consulta(), temperaturaC: 36.7, frecuenciaCardiaca: 72 }));
    const element = render().nativeElement as HTMLElement;
    const panel = element.querySelector('#panel-evaluacion')!;
    expect(panel.querySelector('#evaluacion-informacion')?.textContent).toBe('Información de la evaluación');
    expect(panel.querySelector('#evaluacion-signos')?.textContent).toBe('Signos vitales');
    expect(panel.querySelectorAll('.consulta-eval-field').length).toBe(9);
    for (const value of ['Control general', 'Fatiga', 'Seguimiento', '150 lb', '170 cm',
      '120 mmHg', '80 mmHg', '36.7 °C', '72 lpm']) {
      expect(panel.textContent).toContain(value);
    }
    expect(element.querySelector('header')?.textContent).not.toContain('Control general');
    expect(element.querySelector('header')?.textContent).toContain('Consulta médica');
    expect(panel.querySelectorAll('[aria-labelledby="evaluacion-signos"] .consulta-eval-field.col-12.col-md-6.col-xl-4').length).toBe(6);
  });

  it('muestra los NULL como sin registrar sin inventar ceros, y conserva un cero real', () => {
    service.obtenerConsulta.and.returnValue(of({ ...consulta(), motivoConsulta: null, sintomas: null,
      observaciones: null, pesoLb: null, alturaCm: null, presionSistolica: null,
      presionDiastolica: null, temperaturaC: null, frecuenciaCardiaca: null }));
    const fixture = render();
    let panel = (fixture.nativeElement as HTMLElement).querySelector('#panel-evaluacion')!;
    expect(panel.textContent).toContain('No hay datos de evaluación registrados.');
    expect(Array.from(panel.querySelectorAll('.consulta-eval-field dd'), dd => dd.textContent?.trim()))
      .toEqual(Array(9).fill('Sin registrar'));
    fixture.componentInstance.consulta = { ...consulta(), pesoLb: 0, temperaturaC: 0 };
    fixture.detectChanges();
    panel = (fixture.nativeElement as HTMLElement).querySelector('#panel-evaluacion')!;
    expect(panel.textContent).toContain('0 lb');
    expect(panel.textContent).toContain('0 °C');
  });

  it('mantiene Evaluación sin edición incluso con Consultas/Modificar mientras falta PATCH', () => {
    const fixture = render();
    const panel = (fixture.nativeElement as HTMLElement).querySelector('#panel-evaluacion')!;
    expect(panel.textContent).toContain('La edición y el guardado de la evaluación requieren habilitación del backend');
    expect(panel.querySelector('form, input, textarea, select, button')).toBeNull();
    fixture.componentInstance.consulta = { ...consulta(), estadoConsulta: 'Abierta' };
    modifyConsultas.set(true); fixture.detectChanges();
    expect(panel.querySelector('form, input, textarea, select, button')).toBeNull();
    expect(panel.textContent).not.toContain('Guardar');
    expect(panel.textContent).not.toContain('Cancelar');
    expect(service.actualizarConsulta).not.toHaveBeenCalled();
    expect(fixture.componentInstance.consulta?.estadoConsulta).toBe('Abierta');
  });

  it('no presenta Evaluación de otra consulta ni datos cuando falla GET', () => {
    service.obtenerConsulta.and.returnValue(of({ ...consulta(), idPaciente: 12 }));
    let fixture = render();
    expect(fixture.componentInstance.consulta).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#panel-evaluacion')).toBeNull();
    fixture.destroy();
    service.obtenerConsulta.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    fixture = render();
    expect(fixture.componentInstance.consulta).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('#panel-evaluacion')).toBeNull();
    expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).not.toBeNull();
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
