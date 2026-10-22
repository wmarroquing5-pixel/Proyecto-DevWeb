import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { TratamientoCreateDto, TratamientoResponseDto } from '../../core/models/historial.model';
import { LoteMedicamentoResponse, PagedResponse } from '../../core/models/inventario.model';
import { MODULOS_PERMISO } from '../../core/models/permiso.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { HistorialService } from '../../core/services/historial.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { TratamientoFormComponent } from './tratamiento-form.component';

describe('TratamientoFormComponent: prescripción sin descuento', () => {
  let fixture: ComponentFixture<TratamientoFormComponent>;
  let crear: jasmine.Spy;
  let listar: jasmine.Spy;
  let obtener: jasmine.Spy;
  let medicamento: jasmine.Spy;
  let crearPermitido: ReturnType<typeof signal<boolean>>;
  let lotesPermitidos: ReturnType<typeof signal<boolean>>;
  let medicamentosPermitidos: ReturnType<typeof signal<boolean>>;
  let usuario: ReturnType<typeof signal<number>>;
  const lote = (id = 7): LoteMedicamentoResponse => ({ idLote: id, idMedicamento: 3,
    numeroLote: `LT-${id}`, fechaIngreso: '2020-01-01', fechaVencimiento: '2099-12-31', cantidadDisponible: 10 });
  const pagina = (items = [lote()], page = 1, total = items.length): PagedResponse<LoteMedicamentoResponse> => ({
    items, page, pageSize: 20, totalCount: total, totalPages: Math.ceil(total / 20),
  });
  const response = (body: TratamientoCreateDto): TratamientoResponseDto => ({
    ...body, idTratamiento: 9, idPaciente: 11, idMedico: 7,
  });
  const form = () => fixture.componentInstance;

  beforeEach(() => {
    crearPermitido = signal(true); lotesPermitidos = signal(true); medicamentosPermitidos = signal(true); usuario = signal(1);
    crear = jasmine.createSpy('crearTratamiento').and.callFake((body: TratamientoCreateDto) => of(response(body)));
    listar = jasmine.createSpy('listarLotes').and.returnValue(of(pagina()));
    obtener = jasmine.createSpy('obtenerLote').and.returnValue(of(lote()));
    medicamento = jasmine.createSpy('obtenerMedicamento').and.returnValue(of({ idMedicamento: 3, codigo: 'MED-3', nombre: 'Medicamento de prueba', activo: true }));
    TestBed.configureTestingModule({ imports: [TratamientoFormComponent], providers: [
      { provide: HistorialService, useValue: { crearTratamiento: crear } },
      { provide: InventarioService, useValue: { listarLotes: listar, obtenerLote: obtener, obtenerMedicamento: medicamento } },
      { provide: AuthSessionService, useValue: {
        currentUser: () => ({ idUsuario: usuario() }), isAuthenticated: () => true, token: 'synthetic-session',
      } },
      { provide: PermisosService, useValue: {
        puedeCrear: () => crearPermitido(), puedeConsultar: (modulo: string) =>
          modulo === MODULOS_PERMISO.LOTES_MEDICAMENTO ? lotesPermitidos() : medicamentosPermitidos(),
      } },
    ] });
    fixture = TestBed.createComponent(TratamientoFormComponent);
    fixture.componentRef.setInput('idConsulta', 17); fixture.componentRef.setInput('idPaciente', 11);
    fixture.detectChanges();
    form().descripcion = 'Tratamiento de prueba'; form().fechaInicio = '2026-10-21';
  });

  function farmaco(): void { form().cambiarTipo(true); form().seleccionarLote(7); form().cantidad = 2; }

  it('registra un tratamiento no farmacológico con lote/cantidad nulos sin consultar inventario', () => {
    form().cantidad = 5; form().guardar();
    expect(crear).toHaveBeenCalledOnceWith({ idConsulta: 17, descripcion: 'Tratamiento de prueba',
      indicaciones: null, fechaInicio: '2026-10-21', fechaFin: null, idLote: null, cantidad: null });
    expect(listar).not.toHaveBeenCalled(); expect(obtener).not.toHaveBeenCalled();
  });

  it('asocia lote y cantidad tras releer el lote, sin consumir ni modificar inventario', () => {
    farmaco(); const confirmed = spyOn(form().registrado, 'emit'); form().guardar();
    expect(obtener).toHaveBeenCalledOnceWith(7);
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idLote: 7, cantidad: 2 }));
    expect(confirmed).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idLote: 7, cantidad: 2 }));
    expect(lote().cantidadDisponible).toBe(10);
  });

  it('muestra lote, medicamento, vencimiento y disponibilidad con selectores descriptivos', () => {
    farmaco(); fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('LT-7'); expect(text).toContain('Medicamento de prueba');
    expect(text).toContain('2099-12-31'); expect(text).toContain('Disponible: 10');
    expect(text).toContain('no descuenta inventario');
  });

  for (const cantidad of [null, 0, -1, 1.5, 32768]) {
    it(`rechaza cantidad farmacológica inválida ${cantidad}`, () => {
      farmaco(); form().cantidad = cantidad; form().guardar();
      expect(crear).not.toHaveBeenCalled(); expect(obtener).not.toHaveBeenCalled();
      expect(form().error).toContain('entre 1 y 32767');
    });
  }

  it('acepta cantidad prescrita dentro de short aunque supere el stock; no la confunde con un consumo', () => {
    farmaco(); form().cantidad = 32767; form().guardar();
    expect(crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ cantidad: 32767 }));
  });

  it('rechaza lote no seleccionado o ID que no pertenece a la página', () => {
    form().cambiarTipo(true); form().seleccionarLote(999); form().cantidad = 2; form().guardar();
    expect(form().seleccion).toBeNull(); expect(crear).not.toHaveBeenCalled();
  });

  for (const invalid of [
    { nombre: 'vencido', lote: { ...lote(), fechaVencimiento: '2020-01-01' } },
    { nombre: 'vence hoy UTC', lote: { ...lote(), fechaVencimiento: new Date().toISOString().slice(0, 10) } },
    { nombre: 'sin stock', lote: { ...lote(), cantidadDisponible: 0 } },
    { nombre: 'ingreso futuro', lote: { ...lote(), fechaIngreso: '2099-01-01' } },
  ]) {
    it(`deshabilita el lote ${invalid.nombre} y no permite seleccionarlo`, () => {
      listar.and.returnValue(of(pagina([invalid.lote]))); form().cambiarTipo(true); fixture.detectChanges();
      const option = (fixture.nativeElement as HTMLElement).querySelectorAll('option')[1] as HTMLOptionElement;
      expect(option.disabled).toBeTrue(); form().seleccionarLote(7); form().cantidad = 2; form().guardar();
      expect(form().seleccion).toBeNull(); expect(crear).not.toHaveBeenCalled();
    });
  }

  it('no permite asociar un lote de medicamento inactivo cuando ese dato está disponible', () => {
    medicamento.and.returnValue(of({ idMedicamento: 3, codigo: 'MED-3', nombre: 'Inactivo', activo: false }));
    farmaco(); form().guardar(); expect(crear).not.toHaveBeenCalled();
  });

  it('detecta lote desaparecido al releerlo antes de crear', () => {
    farmaco(); obtener.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404, error: { detail: 'Lote no encontrado.' } })));
    form().guardar(); expect(crear).not.toHaveBeenCalled(); expect(form().error).toContain('Lote no encontrado');
  });

  it('rechaza stock que quedó en cero entre selección y guardado', () => {
    farmaco(); obtener.and.returnValue(of({ ...lote(), cantidadDisponible: 0 }));
    form().guardar(); expect(crear).not.toHaveBeenCalled(); expect(form().error).toContain('ya no está disponible');
  });

  it('rechaza cambio de medicamento del lote seleccionado', () => {
    farmaco(); obtener.and.returnValue(of({ ...lote(), idMedicamento: 4 }));
    form().guardar(); expect(crear).not.toHaveBeenCalled();
  });

  it('permite seleccionar el lote101 más allá de las primeras100 filas', () => {
    listar.and.callFake((page: number) => of(pagina(page === 6 ? [lote(101)]
      : Array.from({ length: 20 }, (_, i) => lote((page - 1) * 20 + i + 1)), page, 101)));
    obtener.and.returnValue(of(lote(101))); form().cambiarTipo(true); fixture.detectChanges();
    for (let i = 0; i < 5; i++) {
      const next = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(b => b.textContent?.includes('Siguiente'))!;
      next.click(); fixture.detectChanges();
    }
    expect(listar.calls.allArgs()).toEqual([[1, 20], [2, 20], [3, 20], [4, 20], [5, 20], [6, 20]]);
    form().seleccionarLote(101); form().cantidad = 2; form().guardar();
    expect(crear).toHaveBeenCalledWith(jasmine.objectContaining({ idLote: 101 }));
  });

  it('conserva un lote seleccionado al navegar a otra página sin seleccionar otro', () => {
    listar.and.callFake((page: number) => of(pagina(Array.from({ length: 20 }, (_, i) => lote((page - 1) * 20 + i + 1)), page, 40)));
    farmaco(); form().cargarLotes(2); fixture.detectChanges();
    expect(form().seleccion?.idLote).toBe(7);
    expect([...fixture.nativeElement.querySelectorAll('option')].some((o: any) => o.textContent.includes('LT-7'))).toBeTrue();
  });

  it('no consulta medicamentos sin permiso, pero identifica el medicamento por su ID disponible', () => {
    medicamentosPermitidos.set(false); farmaco(); fixture.detectChanges();
    expect(medicamento).not.toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Medicamento #3');
  });

  it('no consulta lotes ni permite asociarlos sin permiso Consultar', () => {
    lotesPermitidos.set(false); form().cambiarTipo(true); form().guardar();
    expect(listar).not.toHaveBeenCalled(); expect(crear).not.toHaveBeenCalled();
    expect(form().errorLotes).toContain('permiso');
  });

  it('no registra tratamientos sin Crear ni aun llamando guardar directamente', () => {
    crearPermitido.set(false); form().guardar(); expect(crear).not.toHaveBeenCalled();
  });

  it('bloquea doble clic durante revalidación del lote y durante POST', () => {
    farmaco(); const read = new Subject<LoteMedicamentoResponse>(); const post = new Subject<TratamientoResponseDto>();
    obtener.and.returnValue(read); crear.and.returnValue(post);
    form().guardar(); form().guardar(); expect(obtener).toHaveBeenCalledTimes(1);
    read.next(lote()); read.complete(); form().guardar(); expect(crear).toHaveBeenCalledTimes(1);
    expect(form().guardando).toBeTrue();
  });

  it('cancela el guardado y descarta respuesta tardía al cambiar consulta', () => {
    const pending = new Subject<TratamientoResponseDto>(); crear.and.returnValue(pending);
    const emitted = spyOn(form().registrado, 'emit'); form().guardar();
    fixture.componentRef.setInput('idConsulta', 18); fixture.detectChanges();
    expect(pending.observed).toBeFalse();
    pending.next(response({ idConsulta: 17, descripcion: 'Anterior', fechaInicio: '2026-10-21', fechaFin: null, indicaciones: null, idLote: null, cantidad: null }));
    expect(emitted).not.toHaveBeenCalled(); expect(form().descripcion).toBe('');
  });

  it('cancela catálogo tardío cuando cambia identidad', () => {
    const pending = new Subject<PagedResponse<LoteMedicamentoResponse>>(); listar.and.returnValue(pending);
    form().cambiarTipo(true); usuario.set(2); fixture.detectChanges();
    expect(pending.observed).toBeFalse(); expect(form().lotes).toEqual([]); expect(form().farmacologico).toBeFalse();
  });

  it('descarta catálogo tardío si se revocó Consultar antes de recibirlo', () => {
    const pending = new Subject<PagedResponse<LoteMedicamentoResponse>>(); listar.and.returnValue(pending);
    form().cambiarTipo(true); lotesPermitidos.set(false); pending.next(pagina()); pending.complete();
    expect(form().lotes).toEqual([]); expect(form().seleccion).toBeNull();
  });

  it('retira el lote seleccionado al revocar Consultar durante el formulario abierto', () => {
    farmaco(); expect(form().seleccion?.idLote).toBe(7);
    lotesPermitidos.set(false); fixture.detectChanges();
    expect(form().seleccion).toBeNull(); expect(form().lotes).toEqual([]);
    form().guardar(); expect(crear).not.toHaveBeenCalled();
  });

  for (const status of [401, 403, 404, 500]) {
    it(`expone el error de catálogo ${status} sin habilitar una selección falsa`, () => {
      listar.and.returnValue(throwError(() => new HttpErrorResponse({ status, error: { detail: 'No hay acceso al lote.' } })));
      form().cambiarTipo(true); form().seleccionarLote(7); form().cantidad = 2; form().guardar();
      expect(form().lotes).toEqual([]); expect(form().errorLotes).not.toBe('');
      expect(crear).not.toHaveBeenCalled();
    });
  }

  it('no crea si cambia identidad durante la relectura del lote', () => {
    farmaco(); const pending = new Subject<LoteMedicamentoResponse>(); obtener.and.returnValue(pending);
    form().guardar(); usuario.set(2); pending.next(lote()); pending.complete();
    expect(crear).not.toHaveBeenCalled();
  });

  it('cancela las solicitudes al destruir el formulario', () => {
    const pending = new Subject<TratamientoResponseDto>(); crear.and.returnValue(pending);
    form().guardar(); fixture.destroy(); expect(pending.observed).toBeFalse();
  });

  it('descarta un catálogo inconsistente sin truncarlo silenciosamente', () => {
    listar.and.returnValue(of({ ...pagina(), totalPages: 4 })); form().cambiarTipo(true);
    expect(form().lotes).toEqual([]); expect(form().errorLotes).toContain('inconsistente');
  });

  for (const status of [401, 403, 404, 409, 500, 0]) {
    it(`maneja error ${status} de creación sin emitir éxito ni reintentar`, () => {
      crear.and.returnValue(throwError(() => new HttpErrorResponse({ status, error: { detail: 'El tratamiento no se pudo registrar.' } })));
      const emitted = spyOn(form().registrado, 'emit'); form().guardar();
      expect(crear).toHaveBeenCalledTimes(1); expect(emitted).not.toHaveBeenCalled();
      expect(form().guardando).toBeFalse();
      expect(form().error).toContain(status === 401 ? 'sesión expiró' : status === 403 ? 'autorización'
        : status === 0 || status >= 500 ? 'Resultado incierto' : 'no se pudo registrar');
    });
  }

  it('no anuncia éxito para confirmación que cambió la asociación solicitada', () => {
    farmaco(); crear.and.callFake((body: TratamientoCreateDto) => of({ ...response(body), idLote: 99 }));
    const emitted = spyOn(form().registrado, 'emit'); form().guardar();
    expect(emitted).not.toHaveBeenCalled(); expect(form().error).toContain('inconsistente');
  });

  it('permite volver a tratamiento sin medicamento descartando asociación del formulario', () => {
    farmaco(); form().cambiarTipo(false); form().guardar();
    expect(crear).toHaveBeenCalledWith(jasmine.objectContaining({ idLote: null, cantidad: null }));
    expect(obtener).not.toHaveBeenCalled();
  });
});
