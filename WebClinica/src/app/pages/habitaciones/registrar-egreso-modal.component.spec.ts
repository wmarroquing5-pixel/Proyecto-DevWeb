import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AsignacionHabitacionResponse, HabitacionResponse, PagedResponse } from '../../core/models/habitacion.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HabitacionesService } from '../../core/services/habitaciones.service';
import { PermisosService } from '../../core/services/permisos.service';
import { RegistrarEgresoModalComponent } from './registrar-egreso-modal.component';

describe('RegistrarEgresoModalComponent: búsqueda segura y egreso', () => {
  let fixture: ComponentFixture<RegistrarEgresoModalComponent>;
  let listar: jasmine.Spy;
  let egreso: jasmine.Spy;
  let usuario: ReturnType<typeof signal<number>>;
  let autorizado: ReturnType<typeof signal<boolean>>;
  const room: HabitacionResponse = {
    idHabitacion: 7, idSucursal: 1, numeroHabitacion: '101', tipoHabitacion: null,
    estado: 'Ocupada', activa: true,
  };
  const asignacion = (id = 9, habitacion = 7, activa = true): AsignacionHabitacionResponse => ({
    idAsignacion: id, idHabitacion: habitacion, idPaciente: id + 100,
    fechaIngreso: '2026-10-20T10:00:00Z', fechaEgreso: activa ? null : '2026-10-21T10:00:00Z',
    observaciones: null,
  });
  const pagina = (items: AsignacionHabitacionResponse[], page = 1, totalCount = items.length): PagedResponse<AsignacionHabitacionResponse> => ({
    items, page, pageSize: 100, totalCount, totalPages: Math.ceil(totalCount / 100),
  });
  const cerradas = (inicio: number) => Array.from({ length: 100 }, (_, i) => asignacion(inicio + i, 8, false));

  beforeEach(() => {
    usuario = signal(1);
    autorizado = signal(true);
    listar = jasmine.createSpy('listarAsignaciones').and.returnValue(of(pagina([asignacion()])));
    egreso = jasmine.createSpy('registrarEgreso').and.callFake((id: number) => of(asignacion(id, 7, false)));
    TestBed.configureTestingModule({
      imports: [RegistrarEgresoModalComponent],
      providers: [
        { provide: HabitacionesService, useValue: { listarAsignaciones: listar, registrarEgreso: egreso } },
        { provide: PermisosService, useValue: { puedeConsultar: () => autorizado(), puedeModificar: () => autorizado() } },
        { provide: AuthSessionService, useValue: {
          currentUser: () => ({ idUsuario: usuario() }), isAuthenticated: () => true, token: 'synthetic-token',
        } },
      ],
    });
    fixture = TestBed.createComponent(RegistrarEgresoModalComponent);
    fixture.componentRef.setInput('habitacion', room);
    fixture.detectChanges();
  });

  it('egresa la activa en primera página y notifica solo tras la confirmación del servidor', () => {
    const pending = new Subject<AsignacionHabitacionResponse>();
    egreso.and.returnValue(pending);
    const confirmed = spyOn(fixture.componentInstance.egresado, 'emit');
    fixture.componentInstance.registrarEgreso();
    expect(listar).toHaveBeenCalledOnceWith(1, 100);
    expect(egreso).toHaveBeenCalledOnceWith(9);
    expect(confirmed).not.toHaveBeenCalled();
    pending.next(asignacion(9, 7, false)); pending.complete();
    expect(confirmed).toHaveBeenCalledTimes(1);
    fixture.componentInstance.registrarEgreso();
    expect(egreso).toHaveBeenCalledTimes(1);
  });

  for (const posicion of [2, 3, 5]) {
    it(`encuentra la activa en página ${posicion} sin consultar páginas fuera del total`, () => {
      const total = (posicion - 1) * 100 + 1;
      listar.and.callFake((page: number) => of(page < posicion
        ? pagina(cerradas(page * 100), page, total) : pagina([asignacion(9)], page, total)));
      fixture.componentInstance.registrarEgreso();
      expect(listar.calls.allArgs()).toEqual(Array.from({ length: posicion }, (_, i) => [i + 1, 100]));
      expect(egreso).toHaveBeenCalledOnceWith(9);
    });
  }

  it('rechaza una habitación ajena y termina sin activa en todas las páginas', () => {
    listar.and.returnValue(of(pagina([asignacion(1, 8), asignacion(2, 7, false)])));
    fixture.componentInstance.registrarEgreso();
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain('No se encontró');
  });

  it('termina el paginado vacío sin inventar un egreso', () => {
    listar.and.returnValue(of(pagina([])));
    fixture.componentInstance.registrarEgreso();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cargando).toBeFalse();
  });

  it('detiene la búsqueda al fallar una página posterior, aun si ya encontró candidata', () => {
    const first = cerradas(100); first[0] = asignacion();
    listar.and.callFake((page: number) => page === 1 ? of(pagina(first, 1, 101))
      : throwError(() => new HttpErrorResponse({ status: 500 })));
    fixture.componentInstance.registrarEgreso();
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain('No fue posible');
    expect(fixture.componentInstance.cargando).toBeFalse();
  });

  it('invalida y cancela la respuesta de la habitación anterior', () => {
    const pending = new Subject<PagedResponse<AsignacionHabitacionResponse>>();
    listar.and.returnValue(pending);
    fixture.componentInstance.registrarEgreso();
    fixture.componentRef.setInput('habitacion', { ...room, idHabitacion: 8 });
    expect(pending.observed).toBeFalse();
    pending.next(pagina([asignacion()])); pending.complete();
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.cargando).toBeFalse();
  });

  it('cancela páginas pendientes al cerrar y no reutiliza el modal cerrado', () => {
    const pending = new Subject<PagedResponse<AsignacionHabitacionResponse>>();
    listar.and.returnValue(pending);
    fixture.componentInstance.registrarEgreso();
    const closed = spyOn(fixture.componentInstance.cerrar, 'emit');
    fixture.componentInstance.cancelar();
    expect(pending.observed).toBeFalse();
    fixture.componentInstance.registrarEgreso();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(closed).toHaveBeenCalledTimes(1);
    expect(egreso).not.toHaveBeenCalled();
  });

  it('cancela al destruir el modal durante una consulta', () => {
    const pending = new Subject<PagedResponse<AsignacionHabitacionResponse>>();
    listar.and.returnValue(pending);
    fixture.componentInstance.registrarEgreso(); fixture.destroy();
    expect(pending.observed).toBeFalse();
    expect(egreso).not.toHaveBeenCalled();
  });

  it('rechaza dos activas de la misma habitación en una página', () => {
    listar.and.returnValue(of(pagina([asignacion(1), asignacion(2)])));
    fixture.componentInstance.registrarEgreso();
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain('varias asignaciones activas');
  });

  it('rechaza activas duplicadas en páginas diferentes antes de escribir', () => {
    const first = cerradas(100); first[0] = asignacion(1);
    listar.and.callFake((page: number) => of(page === 1 ? pagina(first, 1, 101) : pagina([asignacion(2)], 2, 101)));
    fixture.componentInstance.registrarEgreso();
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain('varias asignaciones activas');
  });

  for (const cambio of ['page', 'pageSize', 'totalCount', 'totalPages', 'items'] as const) {
    it(`rechaza paginación contradictoria: ${cambio}`, () => {
      const p = pagina([asignacion()]);
      const invalid = { ...p, [cambio]: cambio === 'items' ? [] : 3 };
      listar.and.returnValue(of(invalid));
      fixture.componentInstance.registrarEgreso();
      expect(egreso).not.toHaveBeenCalled();
      expect(fixture.componentInstance.error).toContain('contradictorio');
    });
  }

  it('rechaza cambios del total entre páginas', () => {
    listar.and.callFake((page: number) => of(page === 1 ? pagina(cerradas(100), 1, 101)
      : pagina([asignacion(1), asignacion(2, 8, false)], 2, 102)));
    fixture.componentInstance.registrarEgreso();
    expect(egreso).not.toHaveBeenCalled();
  });

  it('rechaza páginas repetidas sin entrar en un ciclo', () => {
    listar.and.returnValue(of(pagina(cerradas(100), 1, 101)));
    fixture.componentInstance.registrarEgreso();
    expect(listar).toHaveBeenCalledTimes(2);
    expect(egreso).not.toHaveBeenCalled();
  });

  it('rechaza IDs repetidos entre páginas', () => {
    listar.and.callFake((page: number) => of(page === 1 ? pagina(cerradas(100), 1, 101)
      : pagina([asignacion(100)], 2, 101)));
    fixture.componentInstance.registrarEgreso();
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain('repetidas');
  });

  it('limita el recorrido y no egresa desde un resultado parcial', () => {
    listar.and.returnValue(of(pagina(cerradas(100), 1, 10001)));
    fixture.componentInstance.registrarEgreso();
    expect(listar).toHaveBeenCalledTimes(1);
    expect(egreso).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain('100 páginas');
  });

  it('bloquea doble clic durante consulta y durante POST', () => {
    const pending = new Subject<PagedResponse<AsignacionHabitacionResponse>>();
    const writing = new Subject<AsignacionHabitacionResponse>();
    listar.and.returnValue(pending); egreso.and.returnValue(writing);
    fixture.componentInstance.registrarEgreso(); fixture.componentInstance.registrarEgreso();
    expect(listar).toHaveBeenCalledTimes(1);
    pending.next(pagina([asignacion()])); pending.complete();
    fixture.componentInstance.registrarEgreso();
    expect(egreso).toHaveBeenCalledOnceWith(9);
  });

  for (const status of [401, 403, 404, 409]) {
    for (const etapa of ['consulta', 'egreso']) {
      it(`maneja ${status} en ${etapa} sin emitir éxito`, () => {
        const error = throwError(() => new HttpErrorResponse({ status, error: { detail: 'Respuesta controlada.' } }));
        (etapa === 'consulta' ? listar : egreso).and.returnValue(error);
        const confirmed = spyOn(fixture.componentInstance.egresado, 'emit');
        fixture.componentInstance.registrarEgreso();
        expect(confirmed).not.toHaveBeenCalled();
        expect(fixture.componentInstance.cargando).toBeFalse();
        expect(fixture.componentInstance.error).toContain(status === 401 ? 'sesión expiró'
          : status === 403 ? 'autorización' : 'Respuesta controlada.');
      });
    }
  }

  it('no confirma una respuesta POST contradictoria', () => {
    egreso.and.returnValue(of(asignacion(10, 8, false)));
    const confirmed = spyOn(fixture.componentInstance.egresado, 'emit');
    fixture.componentInstance.registrarEgreso();
    expect(confirmed).not.toHaveBeenCalled();
    expect(fixture.componentInstance.error).toContain('respuesta del egreso es contradictoria');
  });

  it('invalida la consulta al cambiar identidad', () => {
    const pending = new Subject<PagedResponse<AsignacionHabitacionResponse>>();
    listar.and.returnValue(pending);
    fixture.componentInstance.registrarEgreso(); usuario.set(2); fixture.detectChanges();
    expect(pending.observed).toBeFalse();
    expect(egreso).not.toHaveBeenCalled();
  });

  it('ignora éxito de POST después de cerrar el modal', () => {
    const pending = new Subject<AsignacionHabitacionResponse>();
    egreso.and.returnValue(pending);
    const confirmed = spyOn(fixture.componentInstance.egresado, 'emit');
    fixture.componentInstance.registrarEgreso(); fixture.componentInstance.cancelar();
    pending.next(asignacion(9, 7, false)); pending.complete();
    expect(confirmed).not.toHaveBeenCalled();
  });

  it('no consulta ni escribe sin los permisos vigentes', () => {
    autorizado.set(false);
    fixture.componentInstance.registrarEgreso();
    expect(listar).not.toHaveBeenCalled(); expect(egreso).not.toHaveBeenCalled();
  });
});
