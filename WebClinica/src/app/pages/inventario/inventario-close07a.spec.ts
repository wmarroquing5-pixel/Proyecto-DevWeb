import { Type, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PermisosService } from '../../core/services/permisos.service';
import { InventarioService } from '../../core/services/inventario.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';
import { User } from '../../core/models/user.model';
import { CatalogoMedicamentoResponse, CategoriaResponse, MedicamentoResponse, PagedResponse, LoteMedicamentoResponse } from '../../core/models/inventario.model';
import { InventarioListComponent } from './inventario-list.component';
import { MedicamentoFormComponent } from './medicamento-form.component';
import { LoteFormComponent } from './lote-form.component';
import { cargarCatalogoInventario } from './inventario-ui';

const pagina = <T>(items: T[], page = 1, total = items.length, pageSize = 100): PagedResponse<T> => ({
  items, page, pageSize, totalCount: total, totalPages: Math.ceil(total / pageSize),
});
const medicamento = (id = 7, activo = true): MedicamentoResponse => ({ idMedicamento: id, idCategoria: 1, idMarca: 2,
  codigo: `MED-${id}`, nombre: `Medicamento ${id}`, descripcion: null, precioVenta: 12.5, imagenURL: null, activo });
const catalogo = (stock = 0): CatalogoMedicamentoResponse => ({ ...medicamento(), categoria: 'General', marca: 'Marca', existenciaTotal: stock });
const lote: LoteMedicamentoResponse = { idLote: 9, idMedicamento: 7, numeroLote: 'L-9', fechaIngreso: '2026-01-01', fechaVencimiento: '2099-01-01', cantidadDisponible: 5 };

describe('CLOSE-07A: inventario sin truncación ni operaciones obsoletas', () => {
  let service: jasmine.SpyObj<InventarioService>, sucursales: jasmine.Spy;
  let routeId: string | null, navigate: jasmine.Spy;
  const usuario = signal<User | null>(null), token = signal<string | null>('token-a');
  const permisos = signal<ReadonlySet<string>>(new Set());
  const permitir = (modulo: string, operacion: string) => permisos().has(`${modulo}/${operacion}`);
  const revocar = (modulo: string, operacion: string) => permisos.update(p => new Set([...p].filter(x => x !== `${modulo}/${operacion}`)));
  const render = <T>(tipo: Type<T>): ComponentFixture<T> => {
    const fixture = TestBed.createComponent(tipo); fixture.detectChanges(); return fixture;
  };
  function llenarMedicamento(c: MedicamentoFormComponent): void {
    Object.assign(c.form, { idCategoria: 1, idMarca: 2, codigo: 'MED-N', nombre: 'Nuevo', precioVenta: 12.34 });
  }
  function llenarLote(c: LoteFormComponent): void {
    Object.assign(c.form, { idMedicamento: 7, numeroLote: 'L-N', fechaIngreso: '2026-01-01', fechaVencimiento: '2099-01-01', cantidadDisponible: 0 });
  }
  beforeEach(async () => {
    routeId = null; usuario.set({ idUsuario: 1, idRol: 1, username: 'autorizado' }); token.set('token-a');
    permisos.set(new Set(['Medicamentos', 'LotesMedicamento', 'Categorias', 'Marcas', 'Sucursales'].flatMap(m =>
      ['Consultar', 'Crear', 'Modificar', 'Eliminar'].map(o => `${m}/${o}`))));
    service = jasmine.createSpyObj<InventarioService>('InventarioService', ['listarCategorias', 'listarMarcas', 'listarMedicamentos',
      'listarCatalogo', 'obtenerMedicamento', 'crearMedicamento', 'actualizarMedicamento', 'desactivarMedicamento',
      'obtenerLote', 'crearLote', 'actualizarLote', 'eliminarLote', 'registrarEntrada']);
    service.listarCategorias.and.returnValue(of(pagina([{ idCategoria: 1, nombre: 'General', activa: true }])));
    service.listarMarcas.and.returnValue(of(pagina([{ idMarca: 2, nombre: 'Marca', activa: true }])));
    service.listarMedicamentos.and.returnValue(of(pagina([medicamento()])));
    service.listarCatalogo.and.returnValue(of(pagina([catalogo()], 1, 1, 10)));
    service.obtenerMedicamento.and.returnValue(of(medicamento()));
    service.crearMedicamento.and.returnValue(of(medicamento())); service.actualizarMedicamento.and.returnValue(of(medicamento()));
    service.desactivarMedicamento.and.returnValue(of(void 0)); service.obtenerLote.and.returnValue(of(lote));
    service.crearLote.and.returnValue(of(lote)); service.actualizarLote.and.returnValue(of(lote));
    sucursales = jasmine.createSpy('getSucursales').and.returnValue(of([{ idSucursal: 3, nombre: 'Central', activa: true }]));
    await TestBed.configureTestingModule({ imports: [InventarioListComponent, MedicamentoFormComponent, LoteFormComponent], providers: [
      provideRouter([]), { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => routeId } } } },
      { provide: InventarioService, useValue: service }, { provide: CatalogosService, useValue: { getSucursales: sucursales } },
      { provide: AuthSessionService, useValue: { currentUser: usuario, isAuthenticated: () => !!usuario() && !!token(), get token() { return token(); } } },
      { provide: PermisosService, useValue: {
        puedeConsultar: (m: string) => permitir(m, 'Consultar'), puedeCrear: (m: string) => permitir(m, 'Crear'),
        puedeModificar: (m: string) => permitir(m, 'Modificar'), puedeEliminar: (m: string) => permitir(m, 'Eliminar'),
      } },
    ] }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    spyOn(window, 'confirm').and.returnValue(true);
  });

  for (const stock of [0, 5]) {
    it(`permite baja lógica con stock ${stock} según contrato real`, () => {
      service.listarCatalogo.and.returnValue(of(pagina([catalogo(stock)], 1, 1, 10)));
      const f = render(InventarioListComponent), c = f.componentInstance;
      expect(f.nativeElement.querySelector('[aria-label="Eliminar medicamento"]').disabled).toBeFalse();
      c.desactivar(7); expect(service.desactivarMedicamento).toHaveBeenCalledOnceWith(7);
      expect(service.eliminarLote).not.toHaveBeenCalled(); expect(service.registrarEntrada).not.toHaveBeenCalled();
    });
  }
  it('mantiene confirmación cancelada sin DELETE ni recarga', () => {
    (window.confirm as jasmine.Spy).and.returnValue(false); const c = render(InventarioListComponent).componentInstance;
    c.desactivar(7); expect(window.confirm).toHaveBeenCalledOnceWith('¿Estás seguro de desactivar este medicamento?');
    expect(service.desactivarMedicamento).not.toHaveBeenCalled(); expect(service.listarCatalogo).toHaveBeenCalledTimes(1);
  });
  it('exige Medicamentos/Eliminar incluso invocando el método directamente', () => {
    revocar('Medicamentos', 'Eliminar'); const f = render(InventarioListComponent);
    expect(f.nativeElement.querySelector('[aria-label="Eliminar medicamento"]')).toBeNull();
    f.componentInstance.desactivar(7); expect(service.desactivarMedicamento).not.toHaveBeenCalled();
  });
  it('no envía un ID fuera del listado ni un identificador inválido', () => {
    const c = render(InventarioListComponent).componentInstance;
    [999, 0, -1, 1.5].forEach(id => c.desactivar(id)); expect(service.desactivarMedicamento).not.toHaveBeenCalled();
  });
  it('refresca solo después de respuesta y bloquea doble DELETE pendiente', () => {
    const pendiente = new Subject<void>(); service.desactivarMedicamento.and.returnValue(pendiente);
    const c = render(InventarioListComponent).componentInstance; c.desactivar(7); c.desactivar(7);
    expect(service.desactivarMedicamento).toHaveBeenCalledTimes(1); expect(service.listarCatalogo).toHaveBeenCalledTimes(1);
    expect(c.medicamentos.length).toBe(1); pendiente.next();
    expect(service.listarCatalogo).toHaveBeenCalledTimes(2); expect(c.desactivandoId).toBeNull();
  });
  for (const status of [401, 403, 404, 409]) {
    it(`baja ${status}: conserva la vista, informa error y no recarga`, () => {
      service.desactivarMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status,
        error: { detail: 'Conflicto de prueba' } })));
      const c = render(InventarioListComponent).componentInstance; c.desactivar(7);
      expect(c.errorOperacion).toBeTruthy(); expect(c.medicamentos.length).toBe(1);
      expect(service.listarCatalogo).toHaveBeenCalledTimes(1); expect(c.desactivandoId).toBeNull();
      if (status === 409) expect(c.errorOperacion).toBe('Conflicto de prueba');
    });
  }
  it('descarta DELETE tardío después de cambiar identidad aunque aún no haya render', () => {
    const pendiente = new Subject<void>(); service.desactivarMedicamento.and.returnValue(pendiente);
    const c = render(InventarioListComponent).componentInstance; c.desactivar(7); token.set('token-b'); pendiente.next();
    expect(service.listarCatalogo).toHaveBeenCalledTimes(1);
  });
  it('revocar permiso durante confirmación impide el DELETE', () => {
    const c = render(InventarioListComponent).componentInstance;
    (window.confirm as jasmine.Spy).and.callFake(() => { revocar('Medicamentos', 'Eliminar'); return true; });
    c.desactivar(7); expect(service.desactivarMedicamento).not.toHaveBeenCalled();
  });
  it('descarta listado antiguo cuando cambia el filtro', () => {
    const anterior = new Subject<PagedResponse<CatalogoMedicamentoResponse>>(); service.listarCatalogo.and.returnValue(anterior);
    const c = render(InventarioListComponent).componentInstance;
    service.listarCatalogo.and.returnValue(of(pagina([{ ...catalogo(), nombre: 'Nuevo filtro' }], 1, 1, 10)));
    c.filtroNombre = 'Nuevo'; c.buscar(); anterior.next(pagina([catalogo()], 1, 1, 10));
    expect(c.medicamentos[0].nombre).toBe('Nuevo filtro'); expect(anterior.observed).toBeFalse();
  });
  it('no ofrece una página vacía extra cuando el total es múltiplo del tamaño', () => {
    service.listarCatalogo.and.returnValue(of(pagina(Array.from({ length: 10 }, (_, i) => ({ ...catalogo(), idMedicamento: i + 1 })), 1, 10, 10)));
    const c = render(InventarioListComponent).componentInstance; c.cambiarPagina(2);
    expect(service.listarCatalogo).toHaveBeenCalledTimes(1);
  });
  it('carga categorías y marcas posteriores a100 en filtros sin duplicados', () => {
    service.listarCategorias.and.callFake(p => of(pagina(Array.from({ length: p === 1 ? 100 : 1 }, (_, i) =>
      ({ idCategoria: (p! - 1) * 100 + i + 1, nombre: `Categoría ${(p! - 1) * 100 + i + 1}`, activa: true })), p, 101)));
    service.listarMarcas.and.callFake(p => of(pagina(Array.from({ length: p === 1 ? 100 : 1 }, (_, i) =>
      ({ idMarca: (p! - 1) * 100 + i + 1, nombre: `Marca ${(p! - 1) * 100 + i + 1}`, activa: true })), p, 101)));
    const f = render(InventarioListComponent), c = f.componentInstance;
    expect(c.categorias.length).toBe(101); expect(c.marcas.length).toBe(101);
    c.filtroCategoriaId = 101; c.filtroMarcaId = 101; c.buscar();
    expect(service.listarCatalogo).toHaveBeenCalledWith(jasmine.objectContaining({ categoriaId: 101, marcaId: 101 }));
    expect(f.nativeElement.textContent).toContain('Categoría 101');
  });
  it('no solicita filtros de catálogo sin permisos de consulta', () => {
    revocar('Categorias', 'Consultar'); const c = render(InventarioListComponent).componentInstance;
    expect(service.listarCategorias).not.toHaveBeenCalled(); expect(c.errorCatalogos).toContain('Consultar');
  });

  it('medicamento permite categorías y marcas de página2 y conserva la selección al recargar', () => {
    service.listarCategorias.and.callFake(p => of(pagina(Array.from({ length: p === 1 ? 100 : 1 }, (_, i) =>
      ({ idCategoria: (p! - 1) * 100 + i + 1, nombre: `Categoría ${(p! - 1) * 100 + i + 1}`, activa: true })), p, 101)));
    service.listarMarcas.and.callFake(p => of(pagina(Array.from({ length: p === 1 ? 100 : 1 }, (_, i) =>
      ({ idMarca: (p! - 1) * 100 + i + 1, nombre: `Marca ${(p! - 1) * 100 + i + 1}`, activa: true })), p, 101)));
    const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c);
    c.form.idCategoria = c.form.idMarca = 101; c.cargarCatalogos(); c.guardar();
    expect(service.crearMedicamento).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idCategoria: 101, idMarca: 101 }));
  });
  for (const precio of [null, 0, -1, NaN, Infinity, 1.234, 1.0000000001, 1e16]) {
    it(`rechaza precio inválido ${precio}`, () => {
      const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c); c.form.precioVenta = precio as number;
      c.guardar(); expect(service.crearMedicamento).not.toHaveBeenCalled(); expect(c.error).toContain('precio positivo');
    });
  }
  for (const campo of ['codigo', 'nombre'] as const) {
    it(`rechaza ${campo} vacío aunque se invoque guardar directamente`, () => {
      const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c); c.form[campo] = '   ';
      c.guardar(); expect(service.crearMedicamento).not.toHaveBeenCalled();
    });
  }
  it('preserva relación histórica visible, pero impide medicamento activo con categoría inactiva', () => {
    routeId = '7'; service.listarCategorias.and.returnValue(of(pagina([{ idCategoria: 1, nombre: 'Histórica', activa: false }])));
    const c = render(MedicamentoFormComponent).componentInstance; c.guardar();
    expect(c.categoriasDisponibles.length).toBe(1); expect(c.error).toContain('activas');
    expect(service.actualizarMedicamento).not.toHaveBeenCalled();
    c.form.activo = false; c.guardar(); expect(service.actualizarMedicamento).toHaveBeenCalledTimes(1);
  });
  it('impide POST si falta categoría o marca o se manipula el ID', () => {
    const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c); c.form.idCategoria = 999;
    c.guardar(); expect(service.crearMedicamento).not.toHaveBeenCalled();
  });
  it('bloquea medicamento sin permiso de escritura', () => {
    revocar('Medicamentos', 'Crear'); const c = render(MedicamentoFormComponent).componentInstance;
    llenarMedicamento(c); c.guardar(); expect(service.crearMedicamento).not.toHaveBeenCalled();
  });
  it('catálogo incompleto tras error de página2 no permite guardar medicamento', () => {
    service.listarCategorias.and.callFake(p => p === 1 ? of(pagina(Array.from({ length: 100 }, (_, i) =>
      ({ idCategoria: i + 1, nombre: `C${i}`, activa: true })), 1, 101)) : throwError(() => new HttpErrorResponse({ status: 500 })));
    const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c); c.guardar();
    expect(c.categorias).toEqual([]); expect(c.errorCatalogos).toContain('completos'); expect(service.crearMedicamento).not.toHaveBeenCalled();
  });
  it('medicamento descarta una carga anterior de catálogos', () => {
    const antigua = new Subject<PagedResponse<CategoriaResponse>>(); service.listarCategorias.and.returnValue(antigua);
    const c = render(MedicamentoFormComponent).componentInstance;
    service.listarCategorias.and.returnValue(of(pagina([{ idCategoria: 2, nombre: 'Nueva', activa: true }])));
    c.cargarCatalogos(); antigua.next(pagina([{ idCategoria: 1, nombre: 'Vieja', activa: true }]));
    expect(c.categorias.map(i => i.idCategoria)).toEqual([2]); expect(antigua.observed).toBeFalse();
  });
  it('medicamento bloquea doble POST y no navega por una respuesta de otra sesión', () => {
    const post = new Subject<MedicamentoResponse>(); service.crearMedicamento.and.returnValue(post);
    const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c); c.guardar(); c.guardar();
    expect(service.crearMedicamento).toHaveBeenCalledTimes(1); token.set('token-b'); post.next(medicamento());
    expect(navigate).not.toHaveBeenCalled();
  });
  it('no permite edición tras fallo de lectura del medicamento', () => {
    routeId = '7'; service.obtenerMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c); c.guardar();
    expect(service.actualizarMedicamento).not.toHaveBeenCalled(); expect(c.registroCargado).toBeFalse();
  });

  it('lote localiza medicamento101, conserva selección válida y no genera consumos', () => {
    service.listarMedicamentos.and.callFake(p => of(pagina(Array.from({ length: p === 1 ? 100 : 1 }, (_, i) => medicamento((p! - 1) * 100 + i + 1)), p, 101)));
    const f = render(LoteFormComponent), c = f.componentInstance; llenarLote(c); c.form.idMedicamento = 101;
    c.cargarMedicamentos(); c.guardar();
    expect(c.form.idMedicamento).toBe(101); expect(f.nativeElement.textContent).toContain('MED-101');
    expect(service.crearLote).toHaveBeenCalledOnceWith(jasmine.objectContaining({ idMedicamento: 101, cantidadDisponible: 0 }));
    expect(service.registrarEntrada).not.toHaveBeenCalled(); expect(service.eliminarLote).not.toHaveBeenCalled();
  });
  for (const cantidad of [null, -1, 1.5, NaN, Infinity, 2147483648]) {
    it(`lote rechaza cantidad inválida ${cantidad}`, () => {
      const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.cantidadDisponible = cantidad as number;
      c.guardar(); expect(service.crearLote).not.toHaveBeenCalled(); expect(c.error).toContain('cantidad entera');
    });
  }
  it('lote permite cero sin pedir trazabilidad ni inventar una entrada', () => {
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.guardar();
    expect(service.crearLote).toHaveBeenCalledTimes(1); expect(window.confirm).not.toHaveBeenCalled();
    expect(sucursales).not.toHaveBeenCalled(); expect(service.registrarEntrada).not.toHaveBeenCalled();
  });
  it('lote con existencia inicial requiere vencimiento futuro y trazabilidad', () => {
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.cantidadDisponible = 2;
    c.form.fechaVencimiento = new Date().toISOString().slice(0, 10); c.guardar();
    expect(service.crearLote).not.toHaveBeenCalled(); expect(c.error).toContain('futuro');
    c.form.fechaVencimiento = '2099-01-01'; c.guardar(); expect(c.error).toContain('justificación');
    c.alCambiarCantidad(); c.form.idSucursal = 3; c.form.observaciones = 'Ingreso verificado'; c.guardar();
    expect(service.crearLote).toHaveBeenCalledTimes(1); expect(window.confirm).toHaveBeenCalledTimes(1);
  });
  it('lote vacío permite una fecha vencida histórica posterior al ingreso según contrato', () => {
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.fechaVencimiento = '2026-02-01'; c.guardar();
    expect(service.crearLote).toHaveBeenCalledTimes(1);
  });
  for (const [ingreso, vencimiento] of [['', '2099-01-01'], ['2026-02-30', '2099-01-01'], ['2026-01-01', '2026-01-01'], ['2026-01-01', '2025-12-31']]) {
    it(`lote rechaza fechas ${ingreso}/${vencimiento}`, () => {
      const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.fechaIngreso = ingreso; c.form.fechaVencimiento = vencimiento;
      c.guardar(); expect(service.crearLote).not.toHaveBeenCalled();
    });
  }
  it('lote no impone prohibición de ingreso futuro inexistente en ValidarDatos', () => {
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.fechaIngreso = '2098-01-01'; c.guardar();
    expect(service.crearLote).toHaveBeenCalledTimes(1);
  });
  it('lote no permite elegir otro medicamento inactivo al crear', () => {
    service.listarMedicamentos.and.returnValue(of(pagina([medicamento(7, false)])));
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.guardar();
    expect(c.medicamentosDisponibles).toEqual([]); expect(service.crearLote).not.toHaveBeenCalled();
  });
  it('lote exige ID conocido del catálogo', () => {
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.idMedicamento = 999; c.guardar();
    expect(service.crearLote).not.toHaveBeenCalled();
  });
  it('conserva el vínculo histórico inactivo al mostrarlo y presenta su rechazo por la API', () => {
    routeId = '9'; service.listarMedicamentos.and.returnValue(of(pagina([medicamento(7, false)])));
    service.actualizarLote.and.returnValue(throwError(() => new HttpErrorResponse({ status: 400,
      error: { errors: { IdMedicamento: ['El medicamento debe existir y estar activo.'] } } })));
    const c = render(LoteFormComponent).componentInstance; c.guardar();
    expect(c.medicamentosDisponibles.map(m => m.idMedicamento)).toEqual([7]);
    expect(c.error).toContain('estar activo'); expect(navigate).not.toHaveBeenCalled();
    expect(c.cantidadEsperada).toBe(5); expect(service.registrarEntrada).not.toHaveBeenCalled();
  });
  it('un catálogo de medicamentos pendiente no habilita el envío de un lote', () => {
    const pendiente = new Subject<PagedResponse<MedicamentoResponse>>(); service.listarMedicamentos.and.returnValue(pendiente);
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.guardar();
    expect(c.cargandoMedicamentos).toBeTrue(); expect(service.crearLote).not.toHaveBeenCalled();
  });
  it('no consulta sucursales después del cierre de sesión', () => {
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.cantidadDisponible = 1;
    token.set(null); c.alCambiarCantidad(); expect(sucursales).not.toHaveBeenCalled();
  });
  it('lote respeta rechazo de historial con movimientos sin reescribirlos', () => {
    routeId = '9'; service.listarMedicamentos.and.returnValue(of(pagina([medicamento(7), medicamento(8)])));
    service.actualizarLote.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409,
      error: { detail: 'No se puede cambiar el medicamento de un lote con historial asociado.' } })));
    const c = render(LoteFormComponent).componentInstance; c.form.idMedicamento = 8; c.guardar();
    expect(service.actualizarLote).toHaveBeenCalledOnceWith(9, jasmine.objectContaining({ cantidadEsperada: 5, idMedicamento: 8 }));
    expect(c.error).toContain('historial asociado'); expect(navigate).not.toHaveBeenCalled();
    expect(service.eliminarLote).not.toHaveBeenCalled(); expect(service.registrarEntrada).not.toHaveBeenCalled();
  });
  it('ajuste409 conserva cantidadEsperada en lugar de reintentar con otro stock', () => {
    routeId = '9'; service.actualizarLote.and.returnValue(throwError(() => new HttpErrorResponse({ status: 409,
      error: { detail: 'La existencia del lote cambió.' } })));
    const c = render(LoteFormComponent).componentInstance; c.form.cantidadDisponible = 4; c.alCambiarCantidad();
    c.form.idSucursal = 3; c.form.observaciones = 'Conteo'; c.guardar();
    expect(c.cantidadEsperada).toBe(5); expect(service.actualizarLote).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled(); expect(c.error).toContain('cambió');
  });
  it('lote bloquea doble envío y descarta navegación tras revocar permiso', () => {
    const post = new Subject<LoteMedicamentoResponse>(); service.crearLote.and.returnValue(post);
    const f = render(LoteFormComponent), c = f.componentInstance; llenarLote(c); c.guardar(); c.guardar();
    expect(service.crearLote).toHaveBeenCalledTimes(1); revocar('LotesMedicamento', 'Crear'); f.detectChanges(); post.next(lote);
    expect(navigate).not.toHaveBeenCalled(); expect(post.observed).toBeFalse();
  });
  it('lote no solicita medicamentos sin permiso de consulta', () => {
    revocar('Medicamentos', 'Consultar'); const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.guardar();
    expect(service.listarMedicamentos).not.toHaveBeenCalled(); expect(c.errorMedicamentos).toContain('Consultar');
    expect(service.crearLote).not.toHaveBeenCalled();
  });
  it('lote descarta catálogo antiguo al recargar y mantiene el ID si sigue válido', () => {
    const antigua = new Subject<PagedResponse<MedicamentoResponse>>(); service.listarMedicamentos.and.returnValue(antigua);
    const c = render(LoteFormComponent).componentInstance; llenarLote(c);
    service.listarMedicamentos.and.returnValue(of(pagina([medicamento()]))); c.cargarMedicamentos(); antigua.next(pagina([medicamento(99)]));
    expect(c.medicamentos.map(m => m.idMedicamento)).toEqual([7]); expect(c.form.idMedicamento).toBe(7);
  });
  it('lote descarta respuesta de sucursales de otra sesión', () => {
    const antigua = new Subject<[]>(); sucursales.and.returnValue(antigua);
    const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.form.cantidadDisponible = 1; c.alCambiarCantidad();
    token.set('token-b'); antigua.next([]); expect(c.sucursales).toEqual([]);
  });
  for (const tipo of [MedicamentoFormComponent, LoteFormComponent] as const) {
    it(`${tipo.name}: muestra catálogo vacío sin permitir guardar`, () => {
      service.listarCategorias.and.returnValue(of(pagina<CategoriaResponse>([])));
      service.listarMedicamentos.and.returnValue(of(pagina<MedicamentoResponse>([])));
      if (tipo === MedicamentoFormComponent) {
        const c = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(c); c.guardar();
        expect(service.crearMedicamento).not.toHaveBeenCalled();
      } else {
        const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.guardar();
        expect(service.crearLote).not.toHaveBeenCalled();
      }
    });
  }
  for (const status of [401, 403, 404, 409]) {
    it(`medicamento y lote conservan error HTTP ${status} sin éxito simulado`, () => {
      service.crearMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      const med = render(MedicamentoFormComponent).componentInstance; llenarMedicamento(med); med.guardar();
      service.crearLote.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      const lot = render(LoteFormComponent).componentInstance; llenarLote(lot); lot.guardar();
      expect(med.error).toBeTruthy(); expect(lot.error).toBeTruthy(); expect(navigate).not.toHaveBeenCalled();
    });
    it(`lote muestra error de catálogo ${status} y no crea`, () => {
      service.listarMedicamentos.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
      const c = render(LoteFormComponent).componentInstance; llenarLote(c); c.guardar();
      expect(c.errorMedicamentos).toBeTruthy(); expect(c.cargandoMedicamentos).toBeFalse(); expect(service.crearLote).not.toHaveBeenCalled();
    });
  }
  it('destruir formulario cancela POST pendiente sin navegación', () => {
    const post = new Subject<MedicamentoResponse>(); service.crearMedicamento.and.returnValue(post);
    const f = render(MedicamentoFormComponent); llenarMedicamento(f.componentInstance); f.componentInstance.guardar(); f.destroy(); post.next(medicamento());
    expect(post.observed).toBeFalse(); expect(navigate).not.toHaveBeenCalled();
  });
});

describe('CLOSE-07A: integridad del paginado de selectores', () => {
  for (const fallo of ['duplicado', 'total cambiante', 'página incorrecta', 'vacía incompleta']) {
    it(`rechaza ${fallo} sin publicar un catálogo parcial`, () => {
      let datos: { id: number }[] | undefined, error: unknown;
      cargarCatalogoInventario(p => of(p === 1 ? pagina(Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })), 1, 101) :
        fallo === 'duplicado' ? pagina([{ id: 1 }], 2, 101) :
        fallo === 'total cambiante' ? pagina([{ id: 101 }, { id: 102 }], 2, 102) :
        fallo === 'página incorrecta' ? pagina([{ id: 101 }], 1, 101) : pagina([], 2, 101)), x => x.id)
        .subscribe({ next: d => datos = d, error: e => error = e });
      expect(datos).toBeUndefined(); expect(error).toBeTruthy();
    });
  }
});

describe('CLOSE-07A: contratos HTTP de inventario sin escrituras reales', () => {
  let http: HttpTestingController, service: InventarioService;
  const invalidar = jasmine.createSpy('invalidateForToken');
  beforeEach(() => {
    invalidar.calls.reset(); TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: { token: 'test-token', invalidateForToken: invalidar } },
    ] });
    http = TestBed.inject(HttpTestingController); service = TestBed.inject(InventarioService);
  });
  afterEach(() => http.verify());
  it('baja usa DELETE existente sin payload ni operaciones de lotes', () => {
    service.desactivarMedicamento(7).subscribe(); const req = http.expectOne(`${environment.apiUrl}/medicamentos/7`);
    expect(req.request.method).toBe('DELETE'); expect(req.request.body).toBeNull();
    expect(req.request.headers.get('Authorization')).toBe('Bearer test-token'); req.flush(null, { status: 204, statusText: 'No Content' });
  });
  it('paginación recorre GET categorías existentes con page2 y conserva todos los IDs', () => {
    let resultado: CategoriaResponse[] = [];
    cargarCatalogoInventario((p, t) => service.listarCategorias(p, t), c => c.idCategoria).subscribe(r => resultado = r);
    const primero = http.expectOne(req => req.url === `${environment.apiUrl}/categorias` && req.params.get('page') === '1');
    primero.flush(pagina(Array.from({ length: 100 }, (_, i) => ({ idCategoria: i + 1, nombre: 'C', activa: true })), 1, 101));
    const segundo = http.expectOne(req => req.url === `${environment.apiUrl}/categorias` && req.params.get('page') === '2');
    expect(segundo.request.params.get('pageSize')).toBe('100'); segundo.flush(pagina([{ idCategoria: 101, nombre: 'Última', activa: true }], 2, 101));
    expect(resultado.length).toBe(101); expect(resultado[100].idCategoria).toBe(101);
  });
  for (const status of [401, 403]) {
    it(`DELETE ${status} conserva la política actual del interceptor`, () => {
      service.desactivarMedicamento(7).subscribe({ error: () => undefined });
      http.expectOne(`${environment.apiUrl}/medicamentos/7`).flush({}, { status, statusText: 'Denied' });
      if (status === 401) expect(invalidar).toHaveBeenCalledOnceWith('test-token');
      else expect(invalidar).not.toHaveBeenCalled();
    });
  }
});
