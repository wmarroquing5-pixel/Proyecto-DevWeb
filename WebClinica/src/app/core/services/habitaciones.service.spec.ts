import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import * as signalR from '@microsoft/signalr';
import { environment } from '../../../environments/environment';
import { HabitacionesService } from './habitaciones.service';
import { HabitacionResponse } from '../models/habitacion.model';
import { HabitacionesBoardComponent } from '../../pages/habitaciones/habitaciones-board.component';

describe('Habitaciones: HTTP y ciclo de vida SignalR', () => {
  let http: HttpTestingController;
  let connection: jasmine.SpyObj<signalR.HubConnection>;
  let withUrl: jasmine.Spy;
  let previousToken: string | null;
  const room: HabitacionResponse = {
    idHabitacion: 7, idSucursal: 1, numeroHabitacion: '7',
    tipoHabitacion: null, estado: 'Libre', activa: true,
  };

  beforeEach(() => {
    previousToken = localStorage.getItem('auth_token');
    connection = jasmine.createSpyObj('HubConnection', ['start', 'stop', 'on', 'off']);
    connection.start.and.returnValue(Promise.resolve());
    connection.stop.and.returnValue(Promise.resolve());
    spyOn(signalR.HubConnectionBuilder.prototype, 'build').and.returnValue(connection);
    withUrl = spyOn(signalR.HubConnectionBuilder.prototype, 'withUrl').and.callThrough();
    TestBed.configureTestingModule({
      imports: [HabitacionesBoardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), HabitacionesService],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    if (previousToken === null) localStorage.removeItem('auth_token');
    else localStorage.setItem('auth_token', previousToken);
  });

  it('aplica el evento real a la lista cargada por HTTP y admite listas vacías', () => {
    const service = TestBed.inject(HabitacionesService);
    let rooms: HabitacionResponse[] = [];
    service.habitaciones$.subscribe(value => rooms = value);
    service.cargarHabitaciones().subscribe();
    const request = http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`);
    expect(request.request.method).toBe('GET');
    request.flush({ items: [room], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 });
    const [event, handler] = connection.on.calls.mostRecent().args;
    expect(event).toBe('ActualizarEstadoHabitacion');
    handler({ habitacionId: 7, estado: 'Ocupada' });
    expect(rooms[0].estado).toBe('Ocupada');
    expect(room.estado).toBe('Libre');
    service.cargarHabitaciones().subscribe();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`)
      .flush({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 });
    expect(rooms).toEqual([]);
  });

  it('consulta el token actual cada vez que SignalR lo solicita', () => {
    TestBed.inject(HabitacionesService);
    const [url, options] = withUrl.calls.mostRecent().args;
    expect(url).toBe(environment.hubUrl);
    expect(url).not.toContain('/api/hubs/');
    localStorage.setItem('auth_token', 'first-test-token');
    expect(options.accessTokenFactory()).toBe('first-test-token');
    localStorage.setItem('auth_token', 'renewed-test-token');
    expect(options.accessTokenFactory()).toBe('renewed-test-token');
  });

  it('retira el manejador y detiene la conexión al destruir el tablero', () => {
    const fixture = TestBed.createComponent(HabitacionesBoardComponent);
    fixture.detectChanges();
    http.expectOne(`${environment.apiUrl}/habitaciones?page=1&pageSize=100`)
      .flush({ items: [room], page: 1, pageSize: 100, totalCount: 1, totalPages: 1 });
    const handler = connection.on.calls.mostRecent().args[1];
    expect(connection.on).toHaveBeenCalledTimes(1);
    expect(connection.start).toHaveBeenCalledTimes(1);
    fixture.destroy();
    expect(connection.off).toHaveBeenCalledTimes(1);
    expect(connection.off.calls.mostRecent().args[0]).toBe('ActualizarEstadoHabitacion');
    expect(connection.stop).toHaveBeenCalledTimes(1);
    handler({ habitacionId: 7, estado: 'Ocupada' });
    expect(fixture.componentInstance.habitaciones[0].estado).toBe('Libre');
  });
});
