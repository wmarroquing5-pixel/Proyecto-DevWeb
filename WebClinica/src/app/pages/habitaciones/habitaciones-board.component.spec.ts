import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { BehaviorSubject, of } from 'rxjs';
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
      providers: [{ provide: PermisosService, useValue: {
        puedeCrear: () => false,
        puedeModificar: () => false,
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
