import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  ConsumoClinicoResponseDto,
  ConsultaDetalleDto,
  PagedResponse,
  TratamientoResponseDto,
} from '../../core/models/historial.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { By } from '@angular/platform-browser';
import { TratamientoFormComponent } from './tratamiento-form.component';
import { PermisosService } from '../../core/services/permisos.service';
import { ConsultaDetalleComponent } from './consulta-detalle.component';
import { PacientesService } from '../../core/services/paciente.service';
import { EmpleadosService } from '../../core/services/empleado.service';
import { CatalogosService } from '../../core/services/catalogos.service';

describe('ConsultaDetalleComponent: consumo clínico', () => {
  let fixture: ComponentFixture<ConsultaDetalleComponent>;
  let registrarConsumo: jasmine.Spy<(id: number, body: { cantidad: number }) => Observable<ConsumoClinicoResponseDto>>;
  let consumoPermitido: WritableSignal<boolean>;
  let authenticated: WritableSignal<boolean>;
  let userId: WritableSignal<number>;
  let token: string;
  let leerTratamientos: jasmine.Spy;
  let leerTratamiento: jasmine.Spy;

  const tratamiento: TratamientoResponseDto = {
    idTratamiento: 9,
    idConsulta: 17,
    idPaciente: 11,
    idMedico: 7,
    descripcion: 'Analgésico',
    indicaciones: null,
    fechaInicio: '2026-10-19',
    fechaFin: null,
    idLote: 7,
    cantidad: 2,
  };
  const consulta: ConsultaDetalleDto = {
    idConsulta: 17,
    idPaciente: 11,
    idMedico: 7,
    idSucursal: 3,
    idClinica: null,
    fechaConsulta: '2026-10-19T10:00:00Z',
    motivoConsulta: null,
    sintomas: null,
    observaciones: null,
    pesoLb: null,
    presionDiastolica: null,
    presionSistolica: null,
    alturaCm: null,
  };

  function page<T>(items: T[]): PagedResponse<T> {
    return { items, page: 1, pageSize: 100, totalCount: items.length, totalPages: items.length ? 1 : 0 };
  }

  beforeEach(() => {
    consumoPermitido = signal(true);
    authenticated = signal(true);
    userId = signal(7);
    token = 'session-one';
    leerTratamientos = jasmine.createSpy('listarTratamientos').and.returnValue(of(page([tratamiento])));
    leerTratamiento = jasmine.createSpy('obtenerTratamiento').and.returnValue(of(tratamiento));
    registrarConsumo = jasmine.createSpy('registrarConsumoClinico').and.returnValue(of({
      idMovimiento: 51,
      idTratamiento: 9,
      idLote: 7,
      cantidad: 2,
      idSucursal: 3,
      fechaMovimiento: '2026-10-19T19:00:00Z',
    }));

    TestBed.configureTestingModule({
      imports: [ConsultaDetalleComponent],
      providers: [
        { provide: InventarioService, useValue: {} },
        { provide: PacientesService, useValue: { obtener: () => of({ idPaciente: 11, nombres: 'Ana', apellidos: 'López' }) } },
        { provide: EmpleadosService, useValue: { obtener: () => of({ idEmpleado: 7, nombres: 'Luis', apellidos: 'Pérez' }) } },
        { provide: CatalogosService, useValue: { obtenerSucursal: () => of({ idSucursal: 3, nombre: 'Centro' }), obtenerClinica: () => of(null) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: {
          get: (key: string) => key === 'id' ? '11' : '17',
        } } } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => authenticated(),
          currentUser: () => ({ idUsuario: userId() }),
          get token(): string { return token; },
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: () => true,
          puedeCrear: (modulo: string) => modulo === MODULOS_PERMISO.CONSUMO_CLINICO
            ? consumoPermitido() : true,
        } },
        { provide: HistorialService, useValue: {
          obtenerConsulta: () => of(consulta),
          listarDiagnosticos: () => of(page([])),
          listarTratamientos: leerTratamientos,
          obtenerTratamiento: leerTratamiento,
          listarExamenes: () => of(page([])),
          listarHistorial: () => of(page([])),
          crearDiagnostico: jasmine.createSpy('crearDiagnostico'),
          crearTratamiento: jasmine.createSpy('crearTratamiento'),
          crearExamen: jasmine.createSpy('crearExamen'),
          crearEvolucion: jasmine.createSpy('crearEvolucion'),
          registrarConsumoClinico: registrarConsumo,
        } },
      ],
    });
  });

  function render(): ConsultaDetalleComponent {
    fixture = TestBed.createComponent(ConsultaDetalleComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.tab = 'tratamientos';
    fixture.detectChanges();
    return component;
  }

  it('ofrece consumo solo para un tratamiento asociado a lote y con permiso Crear', () => {
    render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Registrar consumo');
    consumoPermitido.set(false);
    TestBed.flushEffects();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Registrar consumo');
  });

  it('rechaza cantidad cero, negativa o decimal antes de escribir', () => {
    const component = render();
    component.abrirConsumo(tratamiento);
    for (const cantidad of [0, -1, 1.5]) {
      component.cantidadConsumo = cantidad;
      component.registrarConsumo();
    }
    expect(registrarConsumo).not.toHaveBeenCalled();
    expect(component.errorConsumo).toContain('entero mayor que cero');
  });

  it('pide confirmación y no escribe cuando se cancela', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const component = render();
    component.abrirConsumo(tratamiento);
    component.registrarConsumo();
    expect(registrarConsumo).not.toHaveBeenCalled();
  });

  it('envía el DTO real una sola vez mientras la escritura está pendiente', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const pending = new Subject<ConsumoClinicoResponseDto>();
    registrarConsumo.and.returnValue(pending);
    const component = render();
    component.abrirConsumo(tratamiento);
    component.registrarConsumo();
    component.registrarConsumo();
    expect(registrarConsumo).toHaveBeenCalledOnceWith(9, { cantidad: 2 });
    expect(component.guardandoConsumo).toBeTrue();
    pending.complete();
  });

  it('muestra la confirmación devuelta por el servidor', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const component = render();
    component.abrirConsumo(tratamiento);
    component.registrarConsumo();
    expect(component.avisoConsumo).toContain('Salida clínica #51 confirmada');
    expect(component.tratamientoConsumo).toBeNull();
  });

  it('presenta los conflictos del backend sin reintentar la escritura', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    registrarConsumo.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { detail: 'Stock insuficiente en el lote del tratamiento.' },
    })));
    const component = render();
    component.abrirConsumo(tratamiento);
    component.registrarConsumo();
    expect(component.errorConsumo).toContain('Stock insuficiente');
    expect(registrarConsumo).toHaveBeenCalledTimes(1);
  });

  it('cancela el formulario y bloquea nuevas salidas después de una revocación', () => {
    const component = render();
    component.abrirConsumo(tratamiento);
    consumoPermitido.set(false);
    fixture.detectChanges();
    component.registrarConsumo();
    expect(component.tratamientoConsumo).toBeNull();
    expect(registrarConsumo).not.toHaveBeenCalled();
  });

  it('ignora la respuesta de consumo si cambia el usuario autenticado', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const pending = new Subject<ConsumoClinicoResponseDto>();
    registrarConsumo.and.returnValue(pending);
    const component = render();
    component.abrirConsumo(tratamiento);
    component.registrarConsumo();
    userId.set(8);
    token = 'session-two';
    pending.next({
      idMovimiento: 51, idTratamiento: 9, idLote: 7,
      cantidad: 2, idSucursal: 3, fechaMovimiento: '2026-10-19T19:00:00Z',
    });
    pending.complete();
    expect(component.avisoConsumo).toBe('');
  });

  it('recibe la prescripción confirmada y relee la asociación sin consumir', () => {
    const component = render();
    const form = fixture.debugElement.query(By.directive(TratamientoFormComponent)).componentInstance as TratamientoFormComponent;
    leerTratamientos.and.returnValue(of(page([tratamiento])));
    form.registrado.emit(tratamiento);
    expect(leerTratamiento).toHaveBeenCalledOnceWith(9);
    expect(component.tratamientos[0].idLote).toBe(7);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Lote #7');
    expect(registrarConsumo).not.toHaveBeenCalled();
  });

  it('admite consumo parcial sin reducir ni marcar consumida la cantidad prescrita', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    registrarConsumo.and.returnValue(of({ idMovimiento: 52, idTratamiento: 9, idLote: 7,
      cantidad: 1, idSucursal: 3, fechaMovimiento: '2026-10-21T19:00:00Z' }));
    const component = render(); component.abrirConsumo(tratamiento); component.cantidadConsumo = 1;
    component.registrarConsumo();
    expect(registrarConsumo).toHaveBeenCalledOnceWith(9, { cantidad: 1 });
    expect(component.avisoConsumo).toContain('1 unidades');
    expect(component.tratamientos[0].cantidad).toBe(2);
    expect(component.revisionStock).toBe(1);
  });

  it('permite un nuevo consumo explícito tras uno confirmado, sin inventar consumo único', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const component = render(); component.abrirConsumo(tratamiento); component.registrarConsumo();
    component.abrirConsumo(tratamiento); component.registrarConsumo();
    expect(registrarConsumo).toHaveBeenCalledTimes(2);
    expect(component.tratamientos[0].cantidad).toBe(2);
  });

  for (const status of [401, 403, 404, 409, 500, 0]) {
    it(`conserva el error ${status} de consumo sin inventar salida ni reintentar`, () => {
      spyOn(window, 'confirm').and.returnValue(true);
      registrarConsumo.and.returnValue(throwError(() => new HttpErrorResponse({ status,
        error: { detail: 'El lote no está vigente para consumo.' } })));
      const component = render(); component.abrirConsumo(tratamiento); component.registrarConsumo();
      expect(registrarConsumo).toHaveBeenCalledTimes(1);
      expect(component.avisoConsumo).toBe(''); expect(component.revisionStock).toBe(0);
      expect(leerTratamientos).toHaveBeenCalledTimes(1);
      expect(component.errorConsumo).toContain(status === 401 ? 'sesión expiró'
        : status === 403 ? 'autorización' : status === 0 || status >= 500 ? 'Resultado incierto' : 'no está vigente');
    });
  }

  it('no muestra confirmación si el servidor responde por otro lote', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    registrarConsumo.and.returnValue(of({ idMovimiento: 51, idTratamiento: 9, idLote: 8,
      cantidad: 2, idSucursal: 3, fechaMovimiento: '2026-10-21T19:00:00Z' }));
    const component = render(); component.abrirConsumo(tratamiento); component.registrarConsumo();
    expect(component.errorConsumo).toContain('inconsistente');
    expect(component.avisoConsumo).toBe(''); expect(component.revisionStock).toBe(0);
  });

  it('no permite consumir tratamientos ajenos a la consulta actual', () => {
    const component = render(); component.abrirConsumo({ ...tratamiento, idConsulta: 99 });
    component.registrarConsumo(); expect(registrarConsumo).not.toHaveBeenCalled();
  });

  it('mantiene visible y relee por ID una prescripción fuera de la primera página del historial', () => {
    const nuevo = { ...tratamiento, idTratamiento: 101 };
    leerTratamiento.and.returnValue(of(nuevo));
    const component = render(); component.onTratamientoRegistrado(nuevo);
    expect(leerTratamiento).toHaveBeenCalledOnceWith(101);
    expect(component.tratamientos.find(t => t.idTratamiento === 101)?.idLote).toBe(7);
    expect(registrarConsumo).not.toHaveBeenCalled();
  });

  it('ignora relectura tardía de tratamientos tras cambiar identidad', () => {
    const pending = new Subject<PagedResponse<TratamientoResponseDto>>();
    leerTratamientos.and.returnValue(pending);
    const component = render(); userId.set(8);
    pending.next(page([tratamiento])); fixture.detectChanges();
    expect(component.tratamientos).toEqual([]);
    expect(pending.observed).toBeFalse();
  });
});
