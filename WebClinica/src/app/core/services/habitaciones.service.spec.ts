import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal, WritableSignal } from '@angular/core';
import { fakeAsync, flushMicrotasks, TestBed, tick } from '@angular/core/testing';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { HabitacionResponse } from '../models/habitacion.model';
import { MODULOS_PERMISO } from '../models/permiso.model';
import { AuthSessionService } from './auth-session.service';
import { HabitacionesService } from './habitaciones.service';
import { PermisosService } from './permisos.service';

describe('HabitacionesService: recuperación y SignalR', () => {
  let http: HttpTestingController;
  let connection: jasmine.SpyObj<signalR.HubConnection>;
  let withUrl: jasmine.Spy;
  let build: jasmine.Spy;
  let currentToken: string | null;
  let sessionActive: WritableSignal<boolean>;
  let canConsult: WritableSignal<boolean>;
  let userId: WritableSignal<number>;

  const room: HabitacionResponse = {
    idHabitacion: 7, idSucursal: 1, numeroHabitacion: '7',
    tipoHabitacion: null, estado: 'Libre', activa: true,
  };

  const page = (items: HabitacionResponse[] = [room]) => ({
    items, page: 1, pageSize: 100, totalCount: items.length,
    totalPages: items.length ? 1 : 0,
  });

  beforeEach(() => {
    currentToken = 'first-test-token';
    sessionActive = signal(true);
    canConsult = signal(true);
    userId = signal(7);
    connection = jasmine.createSpyObj<signalR.HubConnection>('HubConnection', [
      'start', 'stop', 'on', 'off', 'onreconnecting', 'onreconnected', 'onclose',
    ]);
    connection.start.and.returnValue(Promise.resolve());
    connection.stop.and.returnValue(Promise.resolve());
    build = spyOn(signalR.HubConnectionBuilder.prototype, 'build').and.returnValue(connection);
    withUrl = spyOn(signalR.HubConnectionBuilder.prototype, 'withUrl').and.callThrough();

    TestBed.configureTestingModule({ providers: [
      provideHttpClient(),
      provideHttpClientTesting(),
      HabitacionesService,
      { provide: PermisosService, useValue: {
        puedeConsultar: (module: string) => module === MODULOS_PERMISO.HABITACIONES
          && canConsult(),
      } },
      { provide: AuthSessionService, useValue: {
        isAuthenticated: sessionActive.asReadonly(),
        currentUser: () => ({ idUsuario: userId() }),
        get token(): string | null { return currentToken; },
      } },
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function service(): HabitacionesService {
    return TestBed.inject(HabitacionesService);
  }

  function eventHandler(): (data: { habitacionId: number; estado: string }) => void {
    return connection.on.calls.mostRecent().args[1] as
      (data: { habitacionId: number; estado: string }) => void;
  }

  function reconnectingHandler(): (error?: Error) => void {
    return connection.onreconnecting.calls.mostRecent().args[0] as (error?: Error) => void;
  }

  function reconnectedHandler(): (connectionId?: string) => void {
    return connection.onreconnected.calls.mostRecent().args[0] as
      (connectionId?: string) => void;
  }

  function closeHandler(): (error?: Error) => void {
    return connection.onclose.calls.mostRecent().args[0] as (error?: Error) => void;
  }

  it('inicia una única conexión y expone el estado conectado', fakeAsync(() => {
    const result = service();
    expect(result.estadoConexion()).toBe('conectando');
    expect(connection.start).toHaveBeenCalledTimes(1);
    flushMicrotasks();
    expect(result.estadoConexion()).toBe('conectado');
    result.reintentarConexion();
    expect(connection.start).toHaveBeenCalledTimes(1);
  }));

  it('registra una sola vez el evento y los callbacks de ciclo de vida', () => {
    service();
    expect(connection.on).toHaveBeenCalledOnceWith(
      'ActualizarEstadoHabitacion', jasmine.any(Function),
    );
    expect(connection.onreconnecting).toHaveBeenCalledTimes(1);
    expect(connection.onreconnected).toHaveBeenCalledTimes(1);
    expect(connection.onclose).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it('consulta el JWT vigente en cada intento de SignalR', () => {
    service();
    const [url, options] = withUrl.calls.mostRecent().args;
    expect(url).toBe(environment.hubUrl);
    expect(url).not.toContain('/api/hubs/');
    expect(options.accessTokenFactory()).toBe('first-test-token');
    currentToken = 'renewed-test-token';
    expect(options.accessTokenFactory()).toBe('renewed-test-token');
    currentToken = null;
    expect(options.accessTokenFactory()).toBe('');
  });

  it('marca la información como desactualizada durante una pérdida de conexión', fakeAsync(() => {
    const result = service();
    flushMicrotasks();
    reconnectingHandler()(new Error('network'));
    expect(result.estadoConexion()).toBe('reconectando');
    expect(result.estadoSincronizacion()).toBe('desactualizado');
    expect(result.datosPotencialmenteDesactualizados()).toBeTrue();
  }));

  it('recupera una fotografía HTTP confirmada después de reconectar', fakeAsync(() => {
    const result = service();
    flushMicrotasks();
    reconnectingHandler()();
    reconnectedHandler()('new-connection');
    expect(result.estadoConexion()).toBe('conectado');
    expect(result.estadoSincronizacion()).toBe('sincronizando');
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
    expect(result.estadoSincronizacion()).toBe('actualizado');
    expect(result.ultimaSincronizacion()).not.toBeNull();
  }));

  it('reintenta de forma acotada cuando la conexión inicial falla', fakeAsync(() => {
    connection.start.and.returnValues(Promise.reject(new Error('offline')), Promise.resolve());
    const result = service();
    flushMicrotasks();
    expect(result.estadoConexion()).toBe('error');
    tick(999);
    expect(connection.start).toHaveBeenCalledTimes(1);
    tick(1);
    expect(connection.start).toHaveBeenCalledTimes(2);
    flushMicrotasks();
    expect(result.estadoConexion()).toBe('conectado');
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
  }));

  it('permite reintentar manualmente una conexión fallida', fakeAsync(() => {
    connection.start.and.returnValues(Promise.reject(new Error('offline')), Promise.resolve());
    const result = service();
    flushMicrotasks();
    result.reintentarConexion();
    expect(connection.start).toHaveBeenCalledTimes(2);
    flushMicrotasks();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
    expect(result.estadoConexion()).toBe('conectado');
  }));

  it('realiza recuperación controlada después del cierre definitivo inesperado', fakeAsync(() => {
    service();
    flushMicrotasks();
    closeHandler()(new Error('closed'));
    tick(1_000);
    expect(connection.start).toHaveBeenCalledTimes(2);
    flushMicrotasks();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
  }));

  it('comparte una única solicitud HTTP concurrente', () => {
    const result = service();
    let first: unknown;
    let second: unknown;
    result.cargarHabitaciones().subscribe(value => first = value);
    result.cargarHabitaciones().subscribe(value => second = value);
    const requests = http.match(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`);
    expect(requests.length).toBe(1);
    requests[0].flush(page());
    expect(first).toEqual(page());
    expect(second).toEqual(page());
  });

  it('actualiza la lista con eventos consecutivos sin mutar el objeto original', () => {
    const result = service();
    let rooms: HabitacionResponse[] = [];
    result.habitaciones$.subscribe(value => rooms = value);
    result.cargarHabitaciones().subscribe();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
    eventHandler()({ habitacionId: 7, estado: 'Ocupada' });
    eventHandler()({ habitacionId: 7, estado: 'En limpieza' });
    expect(rooms[0].estado).toBe('En limpieza');
    expect(room.estado).toBe('Libre');
  });

  it('no permite que una respuesta HTTP anterior a un evento sobrescriba ese evento', () => {
    const result = service();
    let rooms: HabitacionResponse[] = [];
    result.habitaciones$.subscribe(value => rooms = value);
    result.cargarHabitaciones().subscribe();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());

    result.sincronizarHabitaciones().subscribe();
    const oldRequest = http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`);
    eventHandler()({ habitacionId: 7, estado: 'Ocupada' });
    oldRequest.flush(page([{ ...room, estado: 'Libre' }]));
    expect(rooms[0].estado).toBe('Ocupada');

    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`)
      .flush(page([{ ...room, estado: 'En limpieza' }]));
    expect(rooms[0].estado).toBe('En limpieza');
    expect(result.estadoSincronizacion()).toBe('actualizado');
  });

  it('expone el error de sincronización y permite reintentarlo', () => {
    const result = service();
    result.cargarHabitaciones().subscribe({ error: () => undefined });
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`)
      .flush({}, { status: 500, statusText: 'Server Error' });
    expect(result.estadoSincronizacion()).toBe('error');
    expect(result.errorSincronizacion()).toBe('No fue posible sincronizar las habitaciones.');

    result.reintentarSincronizacion();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
    expect(result.estadoSincronizacion()).toBe('actualizado');
    expect(result.errorSincronizacion()).toBeNull();
  });

  for (const status of [401, 403]) {
    it(`conserva el tratamiento seguro del error HTTP ${status}`, () => {
      const result = service();
      result.cargarHabitaciones().subscribe({ error: () => undefined });
      http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`)
        .flush({ title: 'No autorizado', traceId: 'internal' }, { status, statusText: 'Error' });
      expect(result.estadoSincronizacion()).toBe('error');
      expect(result.errorSincronizacion()).not.toContain('internal');
    });
  }

  it('detiene el hub, cancela solicitudes y limpia los datos durante logout', fakeAsync(() => {
    const result = service();
    result.cargarHabitaciones().subscribe();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
    result.cargarHabitaciones().subscribe();
    const pending = http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`);
    sessionActive.set(false);
    TestBed.flushEffects();
    expect(connection.stop).toHaveBeenCalledTimes(1);
    expect(pending.cancelled).toBeTrue();
    expect(result.estadoConexion()).toBe('desconectado');
    let rooms: HabitacionResponse[] = [room];
    result.habitaciones$.subscribe(value => rooms = value);
    expect(rooms).toEqual([]);
    closeHandler()(new Error('late close'));
    tick(10_000);
    expect(connection.start).toHaveBeenCalledTimes(1);
  }));

  it('detiene comunicación y reintentos cuando se revoca Habitaciones/Consultar', fakeAsync(() => {
    connection.start.and.returnValue(Promise.reject(new Error('offline')));
    const result = service();
    flushMicrotasks();
    canConsult.set(false);
    TestBed.flushEffects();
    tick(10_000);
    expect(connection.stop).toHaveBeenCalledTimes(1);
    expect(connection.start).toHaveBeenCalledTimes(1);
    expect(result.estadoConexion()).toBe('desconectado');
    result.cargarHabitaciones().subscribe({ error: () => undefined });
    http.expectNone(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`);
  }));

  it('crea una conexión nueva cuando el permiso vuelve a concederse', fakeAsync(() => {
    canConsult.set(false);
    const result = service();
    expect(build).not.toHaveBeenCalled();
    canConsult.set(true);
    TestBed.flushEffects();
    expect(build).toHaveBeenCalledTimes(1);
    expect(connection.start).toHaveBeenCalledTimes(1);
    flushMicrotasks();
    expect(result.estadoConexion()).toBe('conectado');
  }));

  it('aísla solicitudes y eventos al cambiar de usuario', () => {
    const result = service();
    result.cargarHabitaciones().subscribe();
    const pending = http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`);
    const oldHandler = eventHandler();
    userId.set(8);
    currentToken = 'second-user-token';
    TestBed.flushEffects();
    expect(pending.cancelled).toBeTrue();
    expect(connection.stop).toHaveBeenCalledTimes(1);
    oldHandler({ habitacionId: 7, estado: 'Ocupada' });
    let rooms: HabitacionResponse[] = [room];
    result.habitaciones$.subscribe(value => rooms = value);
    expect(rooms).toEqual([]);
  });

  it('ignora eventos mal formados y posteriores al cierre', () => {
    const result = service();
    result.cargarHabitaciones().subscribe();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`).flush(page());
    const handler = eventHandler();
    handler({ habitacionId: 0, estado: 'Ocupada' });
    canConsult.set(false);
    TestBed.flushEffects();
    handler({ habitacionId: 7, estado: 'Ocupada' });
    let rooms: HabitacionResponse[] = [room];
    result.habitaciones$.subscribe(value => rooms = value);
    expect(rooms).toEqual([]);
  });

  it('consulta la página de asignaciones por los parámetros existentes', () => {
    service().listarAsignaciones(3, 100).subscribe(response => expect(response.totalPages).toBe(3));
    const request = http.expectOne(`${environment.apiUrl}/asignaciones-habitacion?page=3&pageSize=100`);
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], page: 3, pageSize: 100, totalCount: 201, totalPages: 3 });
  });

  it('registra egreso por ID sin actualizar ni eliminar la asignación histórica', () => {
    service().registrarEgreso(19).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/asignaciones-habitacion/19/egreso`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({});
    request.flush({ idAsignacion: 19, idHabitacion: 7, fechaEgreso: '2026-10-21T10:00:00Z' });
    http.expectNone(req => req.method === 'DELETE' || req.method === 'PUT');
  });

  it('la baja usa solo DELETE habitación y no toca asignaciones ni lanza recarga por sí misma', () => {
    const result = service();
    result.desactivarHabitacion(7).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/habitaciones/7`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.body).toBeNull();
    request.flush(null, { status: 204, statusText: 'No Content' });
    http.expectNone(req => req.url.includes('asignaciones-habitacion'));
    http.expectNone(`${environment.apiUrl}/habitaciones`);
  });

  it('retira el handler, detiene el hub y limpia el estado al destruirse', () => {
    const result = service();
    result.ngOnDestroy();
    expect(connection.off).toHaveBeenCalledTimes(1);
    expect(connection.off.calls.mostRecent().args[0]).toBe('ActualizarEstadoHabitacion');
    expect(connection.stop).toHaveBeenCalledTimes(1);
    expect(result.estadoConexion()).toBe('desconectado');
  });
});
