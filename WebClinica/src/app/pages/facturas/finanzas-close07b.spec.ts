import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Router, provideRouter } from '@angular/router';
import { Subject, TimeoutError, of, throwError } from 'rxjs';
import { User } from '../../core/models/user.model';
import { CatalogoMedicamentoResponse, PagedResponse } from '../../core/models/inventario.model';
import { PacienteListadoResponse, PacienteResponse } from '../../core/models/paciente.model';
import { FacturaCreada } from '../../core/models/factura.model';
import { VentaResponse } from '../../core/models/venta.model';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PermisosService } from '../../core/services/permisos.service';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PacientesService } from '../../core/services/paciente.service';
import { InventarioService } from '../../core/services/inventario.service';
import { FacturaService } from '../../core/services/factura.service';
import { VentasService } from '../../core/services/venta.service';
import { authInterceptor } from '../../core/interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';
import { VentasNuevaComponent } from '../ventas/ventas-nueva.component';
import { FacturaNuevaComponent } from './factura-nueva.component';

const med = (id = 7, stock = 10, precio = 12.5): CatalogoMedicamentoResponse => ({ idMedicamento: id, codigo: `MED-${id}`,
  nombre: `Medicamento ${id}`, precioVenta: precio, existenciaTotal: stock, marca: 'Marca', categoria: 'General', descripcion: null, imagenURL: null });
const pagina = <T>(items: T[], page = 1, total = items.length): PagedResponse<T> => ({ items, page, pageSize: 100, totalCount: total, totalPages: Math.ceil(total / 100) });
const ventaRespuesta = (): VentaResponse => ({ idVenta: 90, idUsuario: 2, idSucursal: 3, fechaVenta: '2026-10-21T10:00:00Z', total: 12.5,
  detalles: [{ idVentaDetalle: 1, idLote: 8, idMedicamento: 7, cantidad: 1, precioUnitario: 12.5, subtotal: 12.5 }] });
const facturaRespuesta = (): FacturaCreada => ({ idFactura: 91, idUsuario: 2, idSucursal: 3, idPaciente: 4,
  fechaFactura: '2026-10-21T10:00:00Z', tipoFactura: 'Estancia Medica', nit: null, nombreFacturacion: null, total: 12.5,
  detalles: [{ idDetalle: 1, idServicio: null, idLote: 8, idMedicamento: 7, cantidad: 1, precioUnitario: 12.5, subtotal: 12.5 }] });

describe('CLOSE-07B: ventas y facturas sin truncación ni reenvío incierto', () => {
  let ventas: jasmine.SpyObj<VentasService>, facturas: jasmine.SpyObj<FacturaService>;
  let inventario: jasmine.SpyObj<InventarioService>, pacientes: jasmine.SpyObj<PacientesService>, navigate: jasmine.Spy;
  const usuario = signal<User | null>(null), token = signal<string | null>('token-a');
  const permisos = signal<ReadonlySet<string>>(new Set());
  const revocar = (modulo: string, operacion: string) => permisos.update(p => new Set([...p].filter(x => x !== `${modulo}/${operacion}`)));
  function prepararVenta(): ComponentFixture<VentasNuevaComponent> {
    const f = TestBed.createComponent(VentasNuevaComponent); f.detectChanges();
    f.componentInstance.idSucursal = 3; f.componentInstance.agregarAlCarrito(med()); return f;
  }
  function prepararFactura(): ComponentFixture<FacturaNuevaComponent> {
    const f = TestBed.createComponent(FacturaNuevaComponent); f.detectChanges();
    const c = f.componentInstance; c.idSucursal = 3; c.idPaciente = 4; c.medicamentoSeleccionado = 7; c.agregarMedicamento(); return f;
  }
  beforeEach(async () => {
    usuario.set({ idUsuario: 2, idRol: 1, username: 'finanzas' }); token.set('token-a');
    permisos.set(new Set(['Ventas', 'Facturas', 'Sucursales', 'Pacientes', 'Servicios', 'Medicamentos'].flatMap(m => ['Crear', 'Consultar'].map(o => `${m}/${o}`))));
    ventas = jasmine.createSpyObj<VentasService>('VentasService', ['buscarMedicamentos', 'crearVenta', 'listarVentas', 'obtenerVenta']);
    facturas = jasmine.createSpyObj<FacturaService>('FacturaService', ['crear', 'listar', 'obtener']);
    inventario = jasmine.createSpyObj<InventarioService>('InventarioService', ['listarCatalogo', 'obtenerCatalogo', 'actualizarLote', 'registrarEntrada']);
    pacientes = jasmine.createSpyObj<PacientesService>('PacientesService', ['listar', 'obtener']);
    ventas.buscarMedicamentos.and.returnValue(of(pagina([med()]))); ventas.crearVenta.and.returnValue(of(ventaRespuesta()));
    facturas.crear.and.returnValue(of(facturaRespuesta())); inventario.listarCatalogo.and.returnValue(of(pagina([med()])));
    inventario.obtenerCatalogo.and.callFake(id => of(med(id)));
    pacientes.listar.and.returnValue(of(pagina([{ idPaciente: 4, nombres: 'Paciente', apellidos: 'Cuatro', activo: true }])));
    pacientes.obtener.and.callFake(id => of({ idPaciente: id, nombres: 'Paciente', apellidos: String(id), activo: true,
      fechaNacimiento: '2000-01-01', fechaRegistro: '2026-01-01', nit: `NIT-${id}`, nombreFacturacion: `Paciente ${id}` }));
    await TestBed.configureTestingModule({ imports: [VentasNuevaComponent, FacturaNuevaComponent], providers: [
      provideRouter([]), { provide: VentasService, useValue: ventas }, { provide: FacturaService, useValue: facturas },
      { provide: InventarioService, useValue: inventario }, { provide: PacientesService, useValue: pacientes },
      { provide: AuthSessionService, useValue: { currentUser: usuario, isAuthenticated: () => !!usuario() && !!token(), get token() { return token(); } } },
      { provide: PermisosService, useValue: {
        puedeConsultar: (m: string) => permisos().has(`${m}/Consultar`), puedeCrear: (m: string) => permisos().has(`${m}/Crear`),
        puedeModificar: () => false, puedeEliminar: () => false,
      } },
      { provide: CatalogosService, useValue: {
        getSucursales: () => of([{ idSucursal: 3, nombre: 'Central', direccion: null, activa: true }]),
        getServicios: () => of([{ idServicio: 5, codigo: 'S-5', nombre: 'Consulta', descripcion: null, precioBase: 100, tipoServicio: 'Consulta', activo: true }]),
      } },
    ] }).compileComponents();
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  for (const tipo of ['venta', 'factura'] as const) {
    function preparar() {
      if (tipo === 'venta') {
        const f = prepararVenta(), c = f.componentInstance;
        return { fixture: f, enviar: () => c.confirmarVenta(), post: ventas.crearVenta as jasmine.Spy,
          cantidad: (n: number | null) => c.carrito[0].cantidad = n as number,
          error: () => c.error, incierto: () => c.resultadoIncierto, confirmado: () => c.confirmada,
          recargar: () => c.buscarMedicamentos(), limite: c.carrito[0].existenciaTotal };
      }
      const f = prepararFactura(), c = f.componentInstance;
      return { fixture: f, enviar: () => c.guardar(), post: facturas.crear as jasmine.Spy,
        cantidad: (n: number | null) => c.lineasMedicamento[0].cantidad = n as number,
        error: () => c.error, incierto: () => c.resultadoIncierto, confirmado: () => c.confirmada,
        recargar: () => c.cargarCatalogos(), limite: c.lineasMedicamento[0].existenciaTotal };
    }
    it(`${tipo}: éxito confirmado navega al detalle sin descontar inventario local`, () => {
      const h = preparar(); const stock = med().existenciaTotal; h.enviar(); h.enviar();
      expect(h.post).toHaveBeenCalledTimes(1); expect(h.confirmado()).toBeTrue();
      expect(navigate).toHaveBeenCalledOnceWith([tipo === 'venta' ? '/ventas' : '/facturas', tipo === 'venta' ? 90 : 91]);
      expect(h.limite).toBe(stock); expect(inventario.actualizarLote).not.toHaveBeenCalled(); expect(inventario.registrarEntrada).not.toHaveBeenCalled();
    });
    for (const cantidad of [null, 0, -1, 1.5, NaN, Infinity, 2147483648]) {
      it(`${tipo}: rechaza cantidad ${cantidad} sin normalizarla artificialmente`, () => {
        const h = preparar(); h.cantidad(cantidad); h.enviar(); expect(h.post).not.toHaveBeenCalled();
      });
    }
    it(`${tipo}: rechaza exceso de stock de referencia`, () => {
      const h = preparar(); h.cantidad(11); h.enviar(); expect(h.post).not.toHaveBeenCalled();
    });
    it(`${tipo}: sin permiso Crear no realiza POST`, () => {
      const h = preparar(); revocar(tipo === 'venta' ? 'Ventas' : 'Facturas', 'Crear'); h.enviar(); expect(h.post).not.toHaveBeenCalled();
    });
    it(`${tipo}: cambio de identidad sin render no puede enviar el borrador anterior`, () => {
      const h = preparar(); token.set('token-b'); h.enviar(); expect(h.post).not.toHaveBeenCalled();
    });
    it(`${tipo}: revocar consulta de medicamentos bloquea el borrador antes del siguiente render`, () => {
      const h = preparar(); revocar('Medicamentos', 'Consultar'); h.enviar(); expect(h.post).not.toHaveBeenCalled();
    });
    it(`${tipo}: GET de verificación pendiente bloquea doble envío y captura DTO independiente`, () => {
      const lectura = new Subject<CatalogoMedicamentoResponse>(); inventario.obtenerCatalogo.and.returnValue(lectura);
      const h = preparar(); h.enviar(); h.enviar(); h.cantidad(9);
      expect(h.post).not.toHaveBeenCalled(); expect(inventario.obtenerCatalogo).toHaveBeenCalledTimes(1);
      lectura.next(med()); lectura.complete(); expect(h.post).toHaveBeenCalledOnceWith(jasmine.objectContaining({
        [tipo === 'venta' ? 'items' : 'medicamentos']: [{ idMedicamento: 7, cantidad: 1 }],
      }));
    });
    it(`${tipo}: no crea si el medicamento desaparece o queda sin stock al releer`, () => {
      const h = preparar(); inventario.obtenerCatalogo.and.returnValue(of(med(7, 0))); h.enviar();
      expect(h.post).not.toHaveBeenCalled(); expect(h.incierto()).toBeFalse();
    });
    it(`${tipo}: 404 del catálogo individual es corregible y no es un POST incierto`, () => {
      const h = preparar(); inventario.obtenerCatalogo.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
      h.enviar(); expect(h.post).not.toHaveBeenCalled(); expect(h.incierto()).toBeFalse();
    });
    for (const status of [400, 401, 403, 404, 409]) {
      it(`${tipo}: POST ${status} muestra error y no reintenta ni navega`, () => {
        const h = preparar(); h.post.and.returnValue(throwError(() => new HttpErrorResponse({ status,
          error: { detail: status === 409 ? 'Stock insuficiente o lote vencido.' : 'Dato rechazado.' } })));
        h.enviar(); expect(h.post).toHaveBeenCalledTimes(1); expect(navigate).not.toHaveBeenCalled();
        expect(h.error()).toBeTruthy(); expect(h.incierto()).toBeFalse();
        if (status === 409) expect(h.error()).toContain('Stock insuficiente o lote vencido');
      });
    }
    for (const status of [0, 408, 500, 503]) {
      it(`${tipo}: POST ${status} queda incierto y bloquea reenvío incluso tras recargar catálogo`, () => {
        const h = preparar(); h.post.and.returnValue(throwError(() => new HttpErrorResponse({ status })));
        h.enviar(); h.recargar(); h.enviar(); expect(h.post).toHaveBeenCalledTimes(1);
        expect(h.incierto()).toBeTrue(); expect(h.error()).toContain('incierto'); expect(navigate).not.toHaveBeenCalled();
        h.fixture.detectChanges(); expect(h.fixture.nativeElement.querySelector('a[href="' + (tipo === 'venta' ? '/ventas' : '/facturas') + '"]')).not.toBeNull();
      });
    }
    it(`${tipo}: TimeoutError sin respuesta HTTP no provoca retry`, () => {
      const h = preparar(); h.post.and.returnValue(throwError(() => new TimeoutError())); h.enviar(); h.enviar();
      expect(h.post).toHaveBeenCalledTimes(1); expect(h.incierto()).toBeTrue();
    });
    it(`${tipo}: respuesta de otro usuario no confirma la operación`, () => {
      const h = preparar(); h.post.and.returnValue(of(tipo === 'venta' ? { ...ventaRespuesta(), idUsuario: 9 } : { ...facturaRespuesta(), idUsuario: 9 }));
      h.enviar(); expect(h.incierto()).toBeTrue(); expect(navigate).not.toHaveBeenCalled();
    });
    it(`${tipo}: POST pendiente deshabilita acciones y no aplica respuesta de otra sesión`, () => {
      const pendiente = new Subject<VentaResponse | FacturaCreada>(); const h = preparar(); h.post.and.returnValue(pendiente);
      h.enviar(); h.enviar(); h.fixture.detectChanges();
      expect(h.fixture.nativeElement.querySelector('fieldset').disabled).toBeTrue(); expect(h.post).toHaveBeenCalledTimes(1);
      token.set('token-b'); pendiente.next(tipo === 'venta' ? ventaRespuesta() : facturaRespuesta()); expect(navigate).not.toHaveBeenCalled();
    });
    it(`${tipo}: revocación durante POST conserva bloqueo incierto sin repetir`, () => {
      const pendiente = new Subject<VentaResponse | FacturaCreada>(); const h = preparar(); h.post.and.returnValue(pendiente);
      h.enviar(); revocar(tipo === 'venta' ? 'Ventas' : 'Facturas', 'Crear'); h.fixture.detectChanges();
      pendiente.next(tipo === 'venta' ? ventaRespuesta() : facturaRespuesta()); h.enviar();
      expect(h.post).toHaveBeenCalledTimes(1); expect(h.incierto()).toBeTrue(); expect(pendiente.observed).toBeFalse();
    });
    it(`${tipo}: destruir el formulario cancela callbacks pero no declara rollback`, () => {
      const pendiente = new Subject<VentaResponse | FacturaCreada>(); const h = preparar(); h.post.and.returnValue(pendiente);
      h.enviar(); h.fixture.destroy(); pendiente.next(tipo === 'venta' ? ventaRespuesta() : facturaRespuesta());
      expect(pendiente.observed).toBeFalse(); expect(navigate).not.toHaveBeenCalled();
    });
  }

  it('factura alcanza medicamentos51 y101, preserva selección al recargar y mantiene DTO sin precios', () => {
    inventario.listarCatalogo.and.callFake(f => of(pagina(Array.from({ length: f.page === 1 ? 100 : 1 }, (_, i) => med((f.page! - 1) * 100 + i + 1)), f.page, 101)));
    const f = prepararFactura(), c = f.componentInstance; c.lineasMedicamento = [];
    c.medicamentoSeleccionado = 51; c.agregarMedicamento(); c.medicamentoSeleccionado = 101; c.cargarCatalogos();
    expect(c.medicamentoSeleccionado).toBe(101); c.agregarMedicamento();
    expect(c.lineasMedicamento.map(l => l.idMedicamento)).toEqual([51, 101]);
    c.guardar(); const dto = facturas.crear.calls.mostRecent().args[0];
    expect(dto.medicamentos).toEqual([{ idMedicamento: 51, cantidad: 1 }, { idMedicamento: 101, cantidad: 1 }]);
    expect(JSON.stringify(dto)).not.toMatch(/precio|total|idLote|idUsuario/);
    expect(f.nativeElement.textContent).toContain('MED-101');
  });
  it('venta alcanza medicamentos51 y101 con la paginación existente', () => {
    ventas.buscarMedicamentos.and.callFake((_n, p) => of(pagina(Array.from({ length: p === 1 ? 100 : 1 }, (_, i) => med((p! - 1) * 100 + i + 1)), p, 101)));
    const f = prepararVenta(), c = f.componentInstance; c.carrito = [];
    c.agregarAlCarrito(med(51)); c.busqueda = ''; c.buscarMedicamentos(); c.agregarAlCarrito(med(101));
    expect(c.carrito.map(i => i.idMedicamento)).toEqual([51, 101]);
    expect(ventas.buscarMedicamentos).toHaveBeenCalledWith(undefined, 2, 100);
  });
  for (const tipo of ['venta', 'factura'] as const) {
    it(`${tipo}: fallo de página2 no se presenta como catálogo completo`, () => {
      const primera = pagina(Array.from({ length: 100 }, (_, i) => med(i + 1)), 1, 101);
      ventas.buscarMedicamentos.and.callFake((_n, p) => p === 1 ? of(primera) : throwError(() => new HttpErrorResponse({ status: 500 })));
      inventario.listarCatalogo.and.callFake(f => f.page === 1 ? of(primera) : throwError(() => new HttpErrorResponse({ status: 500 })));
      if (tipo === 'venta') {
        const c = prepararVenta().componentInstance; expect(c.medicamentos).toEqual([]); expect(c.errorBusqueda).toContain('completo');
      } else {
        const c = prepararFactura().componentInstance; expect(c.errorCatalogos).toBeTruthy(); c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
      }
    });
    it(`${tipo}: catálogo vacío no permite confirmar`, () => {
      ventas.buscarMedicamentos.and.returnValue(of(pagina<CatalogoMedicamentoResponse>([])));
      inventario.listarCatalogo.and.returnValue(of(pagina<CatalogoMedicamentoResponse>([])));
      if (tipo === 'venta') { const c = prepararVenta().componentInstance; c.confirmarVenta(); expect(ventas.crearVenta).not.toHaveBeenCalled(); }
      else { const c = prepararFactura().componentInstance; c.guardar(); expect(facturas.crear).not.toHaveBeenCalled(); }
    });
  }
  it('venta cancela búsqueda anterior y no deja que sobrescriba resultados nuevos', () => {
    const antigua = new Subject<PagedResponse<CatalogoMedicamentoResponse>>(); ventas.buscarMedicamentos.and.returnValue(antigua);
    const c = prepararVenta().componentInstance; ventas.buscarMedicamentos.and.returnValue(of(pagina([med(101)])));
    c.busqueda = 'Nueva'; c.buscarMedicamentos(); antigua.next(pagina([med(1)]));
    expect(c.medicamentos.map(m => m.idMedicamento)).toEqual([101]); expect(antigua.observed).toBeFalse();
  });
  it('factura descarta catálogo anterior tras recarga', () => {
    const antigua = new Subject<PagedResponse<CatalogoMedicamentoResponse>>(); inventario.listarCatalogo.and.returnValue(antigua);
    const c = prepararFactura().componentInstance; inventario.listarCatalogo.and.returnValue(of(pagina([med(101)])));
    c.cargarCatalogos(); antigua.next(pagina([med(1)])); expect(c.medicamentos.map(m => m.idMedicamento)).toEqual([101]);
  });
  it('factura bloquea una línea cuyo medicamento desapareció del catálogo recargado', () => {
    const c = prepararFactura().componentInstance; inventario.listarCatalogo.and.returnValue(of(pagina([med(8)])));
    c.cargarCatalogos(); c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
  });
  it('factura mantiene paciente seleccionado fuera de una búsqueda y descarta autocompletado antiguo', () => {
    const antigua = new Subject<PacienteResponse>(); pacientes.obtener.and.returnValue(antigua);
    const c = prepararFactura().componentInstance; c.seleccionarPaciente();
    pacientes.listar.and.returnValue(of(pagina([{ idPaciente: 5, nombres: 'Otra', apellidos: 'Persona', activo: true }])));
    c.busquedaPaciente = 'Otra'; c.buscarPacientes(); expect(c.pacientesDisponibles.map(p => p.idPaciente)).toEqual([4, 5]);
    pacientes.obtener.and.returnValue(of({ idPaciente: 5, nombres: 'Otra', apellidos: 'Persona', activo: true,
      fechaNacimiento: '2000-01-01', fechaRegistro: '2026-01-01', nit: 'NUEVO', nombreFacturacion: 'Otra Persona' }));
    c.idPaciente = 5; c.seleccionarPaciente(); antigua.next({ idPaciente: 4, nombres: 'Vieja', apellidos: 'Persona', activo: true,
      fechaNacimiento: '2000-01-01', fechaRegistro: '2026-01-01', nit: 'VIEJO' }); expect(c.nit).toBe('NUEVO');
  });
  it('factura permite pacientes posteriores a100 y descarta búsqueda anterior', () => {
    pacientes.listar.and.callFake((_n, _a, p) => of(pagina(Array.from({ length: p === 1 ? 100 : 1 }, (_, i) =>
      ({ idPaciente: (p! - 1) * 100 + i + 1, nombres: 'Paciente', apellidos: String(i), activo: true })), p, 101)));
    const c = prepararFactura().componentInstance; expect(c.pacientes.some(p => p.idPaciente === 101)).toBeTrue();
    c.idPaciente = 101; c.seleccionarPaciente(); expect(c.pacienteElegido?.idPaciente).toBe(101);
  });
  it('factura rechaza servicio inactivo y cantidades fuera de Int32', () => {
    const c = prepararFactura().componentInstance; c.lineasMedicamento = []; c.servicioSeleccionado = 5; c.agregarServicio();
    c.lineasServicio[0].cantidad = 2147483648; c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
    c.lineasServicio[0].cantidad = 1; c.servicios[0].activo = false; c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
  });
  it('factura mixta manda cantidades y usa precios finales del servidor aunque cambien las referencias', () => {
    const c = prepararFactura().componentInstance; c.servicioSeleccionado = 5; c.agregarServicio();
    facturas.crear.and.returnValue(of({ ...facturaRespuesta(), total: 120,
      detalles: [{ idDetalle: 1, idServicio: 5, idMedicamento: null, idLote: null, cantidad: 1, precioUnitario: 105, subtotal: 105 },
        { idDetalle: 2, idServicio: null, idMedicamento: 7, idLote: 8, cantidad: 1, precioUnitario: 15, subtotal: 15 }] }));
    expect(c.totalReferencia).toBe(112.5); c.guardar(); expect(c.confirmada).toBeTrue();
    expect(facturas.crear).toHaveBeenCalledOnceWith(jasmine.objectContaining({ servicios: [{ idServicio: 5, cantidad: 1 }], medicamentos: [{ idMedicamento: 7, cantidad: 1 }] }));
  });
  it('factura no permite identidad, sucursal, paciente o línea inventados', () => {
    const c = prepararFactura().componentInstance; c.idPaciente = 999; c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
    c.idPaciente = 4; c.idSucursal = 999; c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
    c.idSucursal = 3; c.lineasMedicamento[0].idMedicamento = 999; c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
  });
  it('factura conserva rechazo de metadatos demasiado largos', () => {
    const c = prepararFactura().componentInstance; c.nit = 'x'.repeat(51); c.guardar(); expect(facturas.crear).not.toHaveBeenCalled();
  });
  it('cancelar borrador de venta no crea una operación ni deja confirmar carrito vacío', () => {
    const c = prepararVenta().componentInstance; c.limpiarCarrito(); c.confirmarVenta(); expect(ventas.crearVenta).not.toHaveBeenCalled();
  });
  it('factura cancelada mediante su enlace no ejecuta POST', () => {
    const f = prepararFactura(); expect(f.nativeElement.querySelector('a[href="/facturas"]')).not.toBeNull(); expect(facturas.crear).not.toHaveBeenCalled();
  });
  for (const defecto of ['total', 'subtotal', 'cantidad', 'lote', 'sucursal', 'detalle vacío'] as const) {
    it(`factura: respuesta con ${defecto} incoherente queda incierta`, () => {
      const r = facturaRespuesta();
      if (defecto === 'total') r.total = 999;
      if (defecto === 'subtotal') r.detalles[0].subtotal = 1;
      if (defecto === 'cantidad') r.detalles[0].cantidad = 2;
      if (defecto === 'lote') r.detalles[0].idLote = null;
      if (defecto === 'sucursal') r.idSucursal = 99;
      if (defecto === 'detalle vacío') r.detalles = [];
      facturas.crear.and.returnValue(of(r)); const c = prepararFactura().componentInstance; c.guardar();
      expect(c.resultadoIncierto).toBeTrue(); expect(navigate).not.toHaveBeenCalled();
    });
  }
  it('venta admite reparto FEFO en varios lotes sin exigir un lote desde Angular', () => {
    const c = prepararVenta().componentInstance; c.carrito[0].cantidad = 3;
    ventas.crearVenta.and.returnValue(of({ ...ventaRespuesta(), total: 37.5,
      detalles: [{ idVentaDetalle: 1, idLote: 8, idMedicamento: 7, cantidad: 1, precioUnitario: 12.5, subtotal: 12.5 },
        { idVentaDetalle: 2, idLote: 9, idMedicamento: 7, cantidad: 2, precioUnitario: 12.5, subtotal: 25 }] }));
    c.confirmarVenta(); expect(c.confirmada).toBeTrue();
    expect(ventas.crearVenta).toHaveBeenCalledOnceWith({ idSucursal: 3, items: [{ idMedicamento: 7, cantidad: 3 }] });
  });
  it('venta confirmada no permite modificar carrito ni repetir confirmación', () => {
    const c = prepararVenta().componentInstance; c.confirmarVenta();
    c.cambiarCantidad(c.carrito[0], 1); c.eliminarDelCarrito(c.carrito[0]); c.agregarAlCarrito(med()); c.limpiarCarrito(); c.confirmarVenta();
    expect(c.carrito.length).toBe(1); expect(c.carrito[0].cantidad).toBe(1); expect(ventas.crearVenta).toHaveBeenCalledTimes(1);
  });
  it('factura confirmada conserva sus líneas y no habilita edición financiera', () => {
    const c = prepararFactura().componentInstance; c.guardar();
    c.quitarMedicamento(7); c.servicioSeleccionado = 5; c.agregarServicio(); c.medicamentoSeleccionado = 7; c.agregarMedicamento(); c.guardar();
    expect(c.lineasMedicamento.length).toBe(1); expect(c.lineasServicio).toEqual([]); expect(facturas.crear).toHaveBeenCalledTimes(1);
  });
  it('la respuesta monetaria decimal se comprueba por centavos sin depender de la aritmética flotante del estimado', () => {
    const c = prepararVenta().componentInstance; c.carrito[0].cantidad = 3;
    ventas.crearVenta.and.returnValue(of({ ...ventaRespuesta(), total: 0.3,
      detalles: [{ idVentaDetalle: 1, idLote: 8, idMedicamento: 7, cantidad: 3, precioUnitario: 0.1, subtotal: 0.3 }] }));
    c.confirmarVenta(); expect(c.confirmada).toBeTrue();
  });
  it('no presenta precios editables ni acepta un precio inválido del catálogo al agregar', () => {
    inventario.listarCatalogo.and.returnValue(of(pagina([med(7, 10, -1)])));
    const f = prepararFactura(); expect(f.componentInstance.lineasMedicamento).toEqual([]);
    expect(f.nativeElement.querySelector('input[name*="precio"]')).toBeNull();
  });
  it('no muestra conciliación a ciegas si falta Consultar de facturas', () => {
    revocar('Facturas', 'Consultar'); facturas.crear.and.returnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    const f = prepararFactura(); f.componentInstance.guardar(); f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Solicite la comprobación');
  });
});

describe('CLOSE-07B: contratos HTTP y política existente del interceptor', () => {
  let http: HttpTestingController;
  const invalidar = jasmine.createSpy('invalidateForToken');
  beforeEach(() => {
    invalidar.calls.reset(); TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthSessionService, useValue: { token: 'test-token', invalidateForToken: invalidar } },
    ] }); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  for (const tipo of ['ventas', 'facturas'] as const) {
    it(`${tipo}: creación no envía precio, total, usuario ni lote`, () => {
      const dto = tipo === 'ventas' ? { idSucursal: 3, items: [{ idMedicamento: 7, cantidad: 1 }] }
        : { idSucursal: 3, idPaciente: 4, servicios: [], medicamentos: [{ idMedicamento: 7, cantidad: 1 }] };
      if (tipo === 'ventas') TestBed.inject(VentasService).crearVenta(dto as Parameters<VentasService['crearVenta']>[0]).subscribe();
      else TestBed.inject(FacturaService).crear(dto as Parameters<FacturaService['crear']>[0]).subscribe();
      const req = http.expectOne(`${environment.apiUrl}/${tipo}`);
      expect(req.request.method).toBe('POST'); expect(req.request.body).toEqual(dto);
      expect(req.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(JSON.stringify(req.request.body)).not.toMatch(/precio|total|idUsuario|idLote/);
      req.flush(tipo === 'ventas' ? ventaRespuesta() : facturaRespuesta());
    });
    for (const status of [401, 403]) {
      it(`${tipo}: ${status} usa el interceptor sin reintentar POST`, () => {
        if (tipo === 'ventas') TestBed.inject(VentasService).crearVenta({ idSucursal: 3, items: [{ idMedicamento: 7, cantidad: 1 }] }).subscribe({ error: () => undefined });
        else TestBed.inject(FacturaService).crear({ idSucursal: 3, idPaciente: 4, servicios: [], medicamentos: [{ idMedicamento: 7, cantidad: 1 }] }).subscribe({ error: () => undefined });
        http.expectOne(`${environment.apiUrl}/${tipo}`).flush({}, { status, statusText: 'Denied' });
        if (status === 401) expect(invalidar).toHaveBeenCalledOnceWith('test-token'); else expect(invalidar).not.toHaveBeenCalled();
      });
    }
  }
});
