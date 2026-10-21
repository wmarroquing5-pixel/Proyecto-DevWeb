import { HttpErrorResponse } from '@angular/common/http';
import { signal, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  EntradaInventarioResponse,
  LoteMedicamentoResponse,
  PagedResponse,
  RegistrarEntradaInventarioRequest,
} from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { LotesMedicamentoComponent } from './lotes-medicamento.component';

describe('LotesMedicamentoComponent', () => {
  let fixture: ComponentFixture<LotesMedicamentoComponent>;
  let listarLotes: jasmine.Spy<(page: number, pageSize: number) => Observable<PagedResponse<LoteMedicamentoResponse>>>;
  let registrarEntrada: jasmine.Spy<(id: number, body: RegistrarEntradaInventarioRequest) => Observable<EntradaInventarioResponse>>;
  let consultar: WritableSignal<boolean>;
  let modificar: WritableSignal<boolean>;
  let eliminar: WritableSignal<boolean>;
  let authenticated: WritableSignal<boolean>;
  let userId: WritableSignal<number>;
  let token: string;

  const lote: LoteMedicamentoResponse = {
    idLote: 7,
    idMedicamento: 3,
    numeroLote: 'LT-007',
    fechaIngreso: '2026-10-01',
    fechaVencimiento: '2027-10-01',
    cantidadDisponible: 25,
  };
  const entrada: EntradaInventarioResponse = {
    idMovimiento: 41,
    idLote: 7,
    idMedicamento: 3,
    idSucursal: 2,
    cantidad: 5,
    cantidadDisponible: 30,
    fechaMovimiento: '2026-10-19T18:00:00Z',
    observaciones: 'Compra',
  };

  function pagina(
    items: LoteMedicamentoResponse[] = [lote],
    page = 1,
    pageSize = 10,
    totalCount = items.length,
  ): PagedResponse<LoteMedicamentoResponse> {
    return {
      items,
      page,
      pageSize,
      totalCount,
      totalPages: totalCount === 0 ? 0 : Math.ceil(totalCount / pageSize),
    };
  }

  beforeEach(() => {
    consultar = signal(true);
    modificar = signal(true);
    eliminar = signal(false);
    authenticated = signal(true);
    userId = signal(7);
    token = 'session-one';
    listarLotes = jasmine.createSpy('listarLotes')
      .and.callFake((page, pageSize) => of(pagina([lote], page, pageSize, 21)));
    registrarEntrada = jasmine.createSpy('registrarEntrada').and.returnValue(of(entrada));

    TestBed.configureTestingModule({
      imports: [LotesMedicamentoComponent],
      providers: [
        provideRouter([]),
        { provide: InventarioService, useValue: {
          listarLotes,
          registrarEntrada,
          eliminarLote: jasmine.createSpy('eliminarLote').and.returnValue(of(undefined)),
        } },
        { provide: AuthSessionService, useValue: {
          isAuthenticated: () => authenticated(),
          currentUser: () => ({ idUsuario: userId() }),
          get token(): string { return token; },
        } },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([
            { idSucursal: 2, nombre: 'Central', direccion: null, activa: true },
            { idSucursal: 8, nombre: 'Cerrada', direccion: null, activa: false },
          ]),
        } },
        { provide: PermisosService, useValue: {
          puedeConsultar: (modulo: string) => modulo === MODULOS_PERMISO.SUCURSALES
            || (modulo === MODULOS_PERMISO.LOTES_MEDICAMENTO && consultar()),
          puedeCrear: () => false,
          puedeModificar: (modulo: string) => modulo === MODULOS_PERMISO.LOTES_MEDICAMENTO
            && modificar(),
          puedeEliminar: (modulo: string) => modulo === MODULOS_PERMISO.LOTES_MEDICAMENTO
            && eliminar(),
        } },
      ],
    });
  });

  function render(): LotesMedicamentoComponent {
    fixture = TestBed.createComponent(LotesMedicamentoComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  function abrirEntrada(component: LotesMedicamentoComponent): void {
    component.abrirEntrada(lote);
    component.entradaForm = { idSucursal: 2, cantidad: 5, observaciones: ' Compra ' };
  }

  it('carga lotes y existencias con paginación del servidor', () => {
    const component = render();
    expect(listarLotes).toHaveBeenCalledOnceWith(1, 10);
    expect(component.lotes).toEqual([lote]);
    expect(component.total).toBe(21);
    expect(component.totalPages).toBe(3);
    expect((fixture.nativeElement as HTMLElement).querySelector('thead th')?.textContent?.trim()).toBe('No.');
    expect((fixture.nativeElement as HTMLElement).querySelector('tbody td')?.textContent?.trim()).toBe('1');
  });

  it('continúa el correlativo y conserva el ID real en edición y entradas', () => {
    listarLotes.and.returnValue(of(pagina([{ ...lote, idLote: 93 }], 3, 10, 21)));
    const component = render();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('21');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Editar lote"]')?.getAttribute('href'))
      .toBe('/inventario/lotes/editar/93');
    (element.querySelector('[aria-label="Registrar entrada de lote"]') as HTMLButtonElement).click();
    expect(component.loteSeleccionado?.idLote).toBe(93);
  });

  it('muestra el estado vacío sin fabricar movimientos', () => {
    listarLotes.and.returnValue(of(pagina([], 1, 10, 0)));
    render();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No hay lotes registrados');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Historial de movimientos');
  });

  it('presenta ProblemDetails y permite reintentar la lectura', () => {
    listarLotes.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409,
      error: { title: 'Conflicto', detail: 'El inventario cambió.' },
    })));
    const component = render();
    expect(component.error).toBe('El inventario cambió.');
    listarLotes.and.returnValue(of(pagina()));
    component.cargarLotes();
    expect(component.lotes).toEqual([lote]);
  });

  it('pagina sin solicitar páginas inválidas ni repetir la actual', () => {
    const component = render();
    listarLotes.calls.reset();
    component.cambiarPagina(0);
    component.cambiarPagina(1);
    component.cambiarPagina(4);
    expect(listarLotes).not.toHaveBeenCalled();
    component.cambiarPagina(2);
    expect(listarLotes).toHaveBeenCalledOnceWith(2, 10);
  });

  it('no consulta ni conserva lotes sin LotesMedicamento/Consultar', () => {
    consultar.set(false);
    const component = render();
    expect(listarLotes).not.toHaveBeenCalled();
    expect(component.lotes).toEqual([]);
  });

  it('oculta y bloquea entradas sin LotesMedicamento/Modificar', () => {
    modificar.set(false);
    const component = render();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Entrada');
    component.abrirEntrada(lote);
    expect(component.loteSeleccionado).toBeNull();
  });

  it('rechaza sucursal, cero, negativos y decimales antes de escribir', () => {
    const component = render();
    component.abrirEntrada(lote);
    for (const [idSucursal, cantidad] of [[0, 1], [1, 0], [1, -1], [1, 1.5]]) {
      component.entradaForm = { idSucursal, cantidad };
      component.registrarEntrada(true);
    }
    expect(registrarEntrada).not.toHaveBeenCalled();
    expect(component.errorEntrada).toContain('sucursal activa');
  });

  it('ofrece sucursales descriptivas activas para registrar entradas', () => {
    const component = render();
    component.abrirEntrada(lote);
    fixture.detectChanges();
    expect(component.sucursales.map(item => item.idSucursal)).toEqual([2]);
    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('#entrada-sucursal option'),
    ).map(option => option.textContent?.trim());
    expect(options).toContain('Central');
    expect(options).not.toContain('Cerrada');
  });

  it('respeta la cancelación de la confirmación', () => {
    spyOn(window, 'confirm').and.returnValue(false);
    const component = render();
    abrirEntrada(component);
    component.registrarEntrada(true);
    expect(registrarEntrada).not.toHaveBeenCalled();
  });

  it('envía una entrada válida una sola vez y normaliza observaciones', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const pending = new Subject<EntradaInventarioResponse>();
    registrarEntrada.and.returnValue(pending);
    const component = render();
    abrirEntrada(component);
    component.registrarEntrada(true);
    component.registrarEntrada(true);
    expect(registrarEntrada).toHaveBeenCalledOnceWith(7, {
      idSucursal: 2,
      cantidad: 5,
      observaciones: 'Compra',
    });
    expect(component.cargandoEntrada).toBeTrue();
    pending.complete();
  });

  it('refresca existencias solo después de la confirmación del servidor', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const pending = new Subject<EntradaInventarioResponse>();
    registrarEntrada.and.returnValue(pending);
    const component = render();
    abrirEntrada(component);
    listarLotes.calls.reset();
    component.registrarEntrada(true);
    expect(listarLotes).not.toHaveBeenCalled();
    pending.next(entrada);
    pending.complete();
    expect(listarLotes).toHaveBeenCalledOnceWith(1, 10);
    expect(component.aviso).toContain('Existencia resultante: 30');
    expect(component.loteSeleccionado).toBeNull();
  });

  it('mantiene abierto el formulario y muestra errores de servidor', () => {
    spyOn(window, 'confirm').and.returnValue(true);
    registrarEntrada.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 404,
      error: { detail: 'Lote no encontrado.' },
    })));
    const component = render();
    abrirEntrada(component);
    component.registrarEntrada(true);
    expect(component.errorEntrada).toBe('Lote no encontrado.');
    expect(component.loteSeleccionado).toBe(lote);
    expect(component.cargandoEntrada).toBeFalse();
  });

  it('cierra la operación y evita nuevas escrituras al revocarse Modificar', () => {
    const component = render();
    abrirEntrada(component);
    modificar.set(false);
    TestBed.flushEffects();
    component.registrarEntrada(true);
    expect(component.loteSeleccionado).toBeNull();
    expect(registrarEntrada).not.toHaveBeenCalled();
  });

  it('limpia lotes al revocarse Consultar o finalizar la sesión', () => {
    const component = render();
    consultar.set(false);
    TestBed.flushEffects();
    expect(component.lotes).toEqual([]);
    consultar.set(true);
    authenticated.set(false);
    TestBed.flushEffects();
    expect(component.lotes).toEqual([]);
  });

  it('descarta la respuesta pendiente del usuario anterior y carga la nueva sesión', () => {
    const pending = new Subject<PagedResponse<LoteMedicamentoResponse>>();
    listarLotes.and.returnValue(pending);
    const component = render();
    userId.set(8);
    token = 'session-two';
    listarLotes.and.returnValue(of(pagina([], 1, 10, 0)));
    TestBed.flushEffects();
    pending.next(pagina([lote]));
    pending.complete();
    expect(component.lotes).toEqual([]);
    expect(listarLotes).toHaveBeenCalledTimes(2);
  });

  it('no contiene rutas antiguas ni una interfaz de salida general', () => {
    render();
    const element = fixture.debugElement;
    const hrefs = element.queryAll(By.css('a')).map(link =>
      (link.nativeElement as HTMLAnchorElement).getAttribute('href') ?? '');
    expect(hrefs.some(href => href.includes('/dashboard/inventario'))).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Nueva salida');
  });
});
