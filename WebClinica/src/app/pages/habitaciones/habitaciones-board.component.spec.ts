import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog.component';
import { RegistrarEgresoModalComponent } from './registrar-egreso-modal.component';
import { HabitacionResponse } from '../../core/models/habitacion.model';
import {
  EstadoConexionHabitaciones,
  EstadoSincronizacionHabitaciones,
  HabitacionesService,
} from '../../core/services/habitaciones.service';
import { PermisosService } from '../../core/services/permisos.service';
import { HabitacionesBoardComponent } from './habitaciones-board.component';

describe('HabitacionesBoardComponent: estado de sincronización', () => {
  let fixture: ComponentFixture<HabitacionesBoardComponent>;
  let habitaciones: BehaviorSubject<HabitacionResponse[]>;
  let estadoConexion: ReturnType<typeof signal<EstadoConexionHabitaciones>>;
  let estadoSincronizacion: ReturnType<typeof signal<EstadoSincronizacionHabitaciones>>;
  let ultimaSincronizacion: ReturnType<typeof signal<number | null>>;
  let errorSincronizacion: ReturnType<typeof signal<string | null>>;
  let desactualizados: ReturnType<typeof signal<boolean>>;
  let cargar: jasmine.Spy;
  let reintentarConexion: jasmine.Spy;
  let reintentarSincronizacion: jasmine.Spy;

  const room: HabitacionResponse = {
    idHabitacion: 7, idSucursal: 1, numeroHabitacion: '7',
    tipoHabitacion: 'General', estado: 'Libre', activa: true,
  };

  beforeEach(() => {
    habitaciones = new BehaviorSubject<HabitacionResponse[]>([room]);
    estadoConexion = signal<EstadoConexionHabitaciones>('conectado');
    estadoSincronizacion = signal<EstadoSincronizacionHabitaciones>('actualizado');
    ultimaSincronizacion = signal<number | null>(Date.now());
    errorSincronizacion = signal<string | null>(null);
    desactualizados = signal(false);
    cargar = jasmine.createSpy('cargarHabitaciones').and.returnValue(of({
      items: [room], page: 1, pageSize: 100, totalCount: 1, totalPages: 1,
    }));
    reintentarConexion = jasmine.createSpy('reintentarConexion');
    reintentarSincronizacion = jasmine.createSpy('reintentarSincronizacion');

    const serviceMock = {
      habitaciones$: habitaciones.asObservable(),
      estadoConexion: estadoConexion.asReadonly(),
      estadoSincronizacion: estadoSincronizacion.asReadonly(),
      ultimaSincronizacion: ultimaSincronizacion.asReadonly(),
      errorSincronizacion: errorSincronizacion.asReadonly(),
      datosPotencialmenteDesactualizados: desactualizados.asReadonly(),
      cargarHabitaciones: cargar,
      reintentarConexion,
      reintentarSincronizacion,
    };

    TestBed.configureTestingModule({
      imports: [HabitacionesBoardComponent],
      providers: [{ provide: AuthSessionService, useValue: {
        currentUser: () => ({ idUsuario: 1 }), isAuthenticated: () => true, token: 'synthetic-token',
      } }, { provide: PermisosService, useValue: {
        puedeCrear: () => false,
        puedeModificar: () => false,
        puedeEliminar: () => false,
      } }],
    });
    TestBed.overrideComponent(HabitacionesBoardComponent, {
      set: { providers: [{ provide: HabitacionesService, useValue: serviceMock }] },
    });
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(HabitacionesBoardComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('distingue conexión activa y última sincronización HTTP', () => {
    const element = render();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(element.textContent).toContain('Tiempo real conectado');
    expect(element.textContent).toContain('Última sincronización HTTP');
    expect(element.textContent).not.toContain('Datos potencialmente desactualizados');
  });

  it('conserva los datos e informa que pueden estar desactualizados al reconectar', () => {
    const element = render();
    estadoConexion.set('reconectando');
    estadoSincronizacion.set('desactualizado');
    desactualizados.set(true);
    fixture.detectChanges();
    expect(element.textContent).toContain('Reconectando tiempo real');
    expect(element.textContent).toContain('Datos potencialmente desactualizados');
    expect(element.textContent).toContain('Hab. 7');
  });

  it('muestra un error de sincronización seguro y permite reintentar', () => {
    const element = render();
    estadoSincronizacion.set('error');
    errorSincronizacion.set('No fue posible sincronizar las habitaciones.');
    desactualizados.set(true);
    fixture.detectChanges();
    expect(element.textContent).toContain('No fue posible sincronizar las habitaciones.');
    const button = fixture.debugElement.queryAll(By.css('button'))
      .find(item => item.nativeElement.textContent.includes('Reintentar sincronización'));
    button?.nativeElement.click();
    expect(reintentarSincronizacion).toHaveBeenCalledTimes(1);
  });

  it('permite reintentar un error de conexión', () => {
    render();
    estadoConexion.set('error');
    desactualizados.set(true);
    fixture.detectChanges();
    const button = fixture.debugElement.queryAll(By.css('button'))
      .find(item => item.nativeElement.textContent.includes('Reintentar conexión'));
    button?.nativeElement.click();
    expect(reintentarConexion).toHaveBeenCalledTimes(1);
  });

  it('expone el indicador como estado accesible', () => {
    render();
    const status = fixture.debugElement.query(By.css('[role="status"]'));
    expect(status).not.toBeNull();
    expect(status.attributes['aria-live']).toBe('polite');
  });

  it('termina la suscripción reactiva al destruir el tablero', () => {
    render();
    fixture.destroy();
    habitaciones.next([{ ...room, numeroHabitacion: '99' }]);
    expect(fixture.componentInstance.habitaciones[0].numeroHabitacion).toBe('7');
  });
});

describe('HabitacionesBoardComponent: baja lógica y confirmación de egreso', () => {
  let fixture: ComponentFixture<HabitacionesBoardComponent>;
  let habitaciones: BehaviorSubject<HabitacionResponse[]>;
  let eliminar: jasmine.Spy;
  let cargar: jasmine.Spy;
  let permiso: ReturnType<typeof signal<boolean>>;
  let usuario: ReturnType<typeof signal<number>>;
  const room: HabitacionResponse = {
    idHabitacion: 7, idSucursal: 1, numeroHabitacion: '101', tipoHabitacion: 'General',
    estado: 'Libre', activa: true,
  };

  beforeEach(() => {
    habitaciones = new BehaviorSubject([room]);
    permiso = signal(true); usuario = signal(1);
    eliminar = jasmine.createSpy('desactivarHabitacion').and.returnValue(of(undefined));
    cargar = jasmine.createSpy('cargarHabitaciones').and.returnValue(of({ items: [room], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 }));
    TestBed.configureTestingModule({ imports: [HabitacionesBoardComponent], providers: [
      { provide: AuthSessionService, useValue: {
        currentUser: () => ({ idUsuario: usuario() }), isAuthenticated: () => true, token: 'synthetic-token',
      } },
      { provide: PermisosService, useValue: {
        puedeCrear: () => false, puedeModificar: () => true, puedeConsultar: () => true,
        puedeEliminar: () => permiso(),
      } },
    ] });
    TestBed.overrideComponent(HabitacionesBoardComponent, { set: { providers: [
      { provide: HabitacionesService, useValue: {
        habitaciones$: habitaciones.asObservable(), cargarHabitaciones: cargar,
        desactivarHabitacion: eliminar, estadoConexion: () => 'conectado',
        estadoSincronizacion: () => 'actualizado', ultimaSincronizacion: () => 1,
        errorSincronizacion: () => null, datosPotencialmenteDesactualizados: () => false,
      } },
    ] } });
    fixture = TestBed.createComponent(HabitacionesBoardComponent); fixture.detectChanges();
  });

  function bajaButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button[aria-label="Dar de baja la habitación 101"]');
  }
  function dialog(): ConfirmDialogComponent {
    return fixture.debugElement.query(By.directive(ConfirmDialogComponent)).componentInstance;
  }
  function abrir(): void { bajaButton()!.click(); fixture.detectChanges(); }

  it('ofrece baja con Eliminar, nombre descriptivo y confirmación accesible existente', () => {
    expect(bajaButton()?.disabled).toBeFalse(); abrir();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(dialog().description).toContain('101');
    expect(dialog().consequence).toContain('historial de asignaciones');
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('no ofrece ni ejecuta baja con Eliminar denegado', () => {
    permiso.set(false); fixture.detectChanges();
    expect(bajaButton()).toBeNull();
    fixture.componentInstance.abrirBaja(room); fixture.componentInstance.confirmarBaja();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('deshabilita la baja de ocupada y no permite abrirla programáticamente', () => {
    const ocupada = { ...room, estado: 'Ocupada' };
    habitaciones.next([ocupada]); fixture.detectChanges();
    expect(bajaButton()?.disabled).toBeTrue();
    fixture.componentInstance.abrirBaja(ocupada);
    expect(fixture.componentInstance.habitacionParaBaja).toBeNull();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('oculta baja de inactiva y rechaza estados desconocidos', () => {
    habitaciones.next([{ ...room, activa: false }]); fixture.detectChanges();
    expect(bajaButton()).toBeNull();
    habitaciones.next([{ ...room, estado: 'Desconocido' }]); fixture.detectChanges();
    expect(bajaButton()?.disabled).toBeTrue();
  });

  it('admite una habitación en limpieza sin inventar restricción adicional al contrato', () => {
    habitaciones.next([{ ...room, estado: 'En limpieza' }]); fixture.detectChanges();
    abrir(); dialog().confirmar();
    expect(eliminar).toHaveBeenCalledOnceWith(7);
  });

  it('cancela la confirmación sin solicitudes ni recarga', () => {
    abrir(); dialog().cancelar(); fixture.detectChanges();
    expect(fixture.componentInstance.habitacionParaBaja).toBeNull();
    expect(eliminar).not.toHaveBeenCalled(); expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('recarga solo tras éxito efectivo, sin borrar la historia ni actualizar optimistamente', () => {
    const pending = new Subject<void>(); eliminar.and.returnValue(pending);
    abrir(); dialog().confirmar(); fixture.detectChanges();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.habitaciones[0].activa).toBeTrue();
    expect(fixture.componentInstance.avisoBaja).toBe('');
    pending.next(); pending.complete(); fixture.detectChanges();
    expect(eliminar).toHaveBeenCalledOnceWith(7);
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.avisoBaja).toContain('101 quedó inactiva');
    expect(fixture.componentInstance.habitacionParaBaja).toBeNull();
  });

  for (const status of [401, 403, 404, 409, 500]) {
    it(`maneja ${status} sin éxito falso ni recarga`, () => {
      eliminar.and.returnValue(throwError(() => new HttpErrorResponse({ status, error: { detail: 'La habitación cambió.' } })));
      abrir(); dialog().confirmar(); fixture.detectChanges();
      expect(fixture.componentInstance.avisoBaja).toBe('');
      expect(fixture.componentInstance.errorBaja).toContain(status === 401 ? 'sesión expiró'
        : status === 403 ? 'autorización' : status === 500 ? 'No fue posible' : 'La habitación cambió.');
      expect(cargar).toHaveBeenCalledTimes(1);
      expect(fixture.componentInstance.desactivando).toBeFalse();
    });
  }

  it('revalida el estado recibido por SignalR antes de confirmar', () => {
    abrir(); habitaciones.next([{ ...room, estado: 'Ocupada' }]);
    dialog().confirmar(); fixture.detectChanges();
    expect(eliminar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.errorBaja).toContain('cambiaron');
    expect(fixture.componentInstance.habitacionParaBaja).toBeNull();
  });

  it('delega al backend la carrera de ocupación posterior a la confirmación', () => {
    const pending = new Subject<void>(); eliminar.and.returnValue(pending);
    abrir(); dialog().confirmar();
    habitaciones.next([{ ...room, estado: 'Ocupada' }]);
    pending.error(new HttpErrorResponse({ status: 409, error: { detail: 'No se puede desactivar una habitación ocupada.' } }));
    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.avisoBaja).toBe('');
    expect(fixture.componentInstance.errorBaja).toContain('ocupada');
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('bloquea doble clic y no permite cancelar una solicitud ya pendiente', () => {
    eliminar.and.returnValue(new Subject<void>()); abrir();
    dialog().confirmar(); dialog().confirmar();
    fixture.componentInstance.confirmarBaja(); fixture.componentInstance.cancelarBaja();
    expect(eliminar).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.habitacionParaBaja).not.toBeNull();
  });

  it('rechaza la confirmación con permiso revocado aunque el diálogo estuviera abierto', () => {
    abrir(); permiso.set(false); fixture.componentInstance.confirmarBaja();
    expect(eliminar).not.toHaveBeenCalled();
    expect(fixture.componentInstance.habitacionParaBaja).toBeNull();
  });

  it('cancela e ignora éxito antiguo al cambiar identidad', () => {
    const pending = new Subject<void>(); eliminar.and.returnValue(pending);
    abrir(); dialog().confirmar(); usuario.set(2); fixture.detectChanges();
    expect(pending.observed).toBeFalse();
    pending.next(); pending.complete();
    expect(cargar).toHaveBeenCalledTimes(1);
    expect(fixture.componentInstance.avisoBaja).toBe('');
  });

  it('cancela petición al destruir el tablero', () => {
    const pending = new Subject<void>(); eliminar.and.returnValue(pending);
    abrir(); dialog().confirmar(); fixture.destroy();
    expect(pending.observed).toBeFalse();
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('no confirma una habitación retirada del snapshot', () => {
    abrir(); habitaciones.next([]); dialog().confirmar();
    expect(eliminar).not.toHaveBeenCalled();
  });

  it('reutiliza el evento egresado del modal para cerrar y recargar el tablero', () => {
    fixture.componentInstance.abrirModalEgreso({ ...room, estado: 'Ocupada' }); fixture.detectChanges();
    const modal = fixture.debugElement.query(By.directive(RegistrarEgresoModalComponent)).componentInstance as RegistrarEgresoModalComponent;
    expect(cargar).toHaveBeenCalledTimes(1);
    modal.egresado.emit(); fixture.detectChanges();
    expect(cargar).toHaveBeenCalledTimes(2);
    expect(fixture.componentInstance.habitacionParaEgreso).toBeNull();
  });
});
