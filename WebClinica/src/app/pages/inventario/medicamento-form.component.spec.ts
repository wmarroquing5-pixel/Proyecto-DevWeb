import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { InventarioService } from '../../core/services/inventario.service';
import { MedicamentoResponse } from '../../core/models/inventario.model';
import { MedicamentoFormComponent } from './medicamento-form.component';
import { AuthSessionService } from '../../core/services/auth-session.service';
import { PermisosService } from '../../core/services/permisos.service';

describe('MedicamentoFormComponent catálogos activos', () => {
  let fixture: ComponentFixture<MedicamentoFormComponent>;
  let service: jasmine.SpyObj<InventarioService>;
  let routeId: string | null;

  beforeEach(async () => {
    routeId = null;
    service = jasmine.createSpyObj<InventarioService>('InventarioService', [
      'listarCategorias', 'listarMarcas', 'obtenerMedicamento',
      'crearMedicamento', 'actualizarMedicamento',
      'guardarFotoMedicamento', 'obtenerFotoMedicamento', 'eliminarFotoMedicamento',
    ]);
    service.listarCategorias.and.returnValue(of({
      items: [
        { idCategoria: 11, nombre: 'Analgésicos', activa: true },
        { idCategoria: 12, nombre: 'Histórica', activa: false },
        { idCategoria: 13, nombre: 'Otra inactiva', activa: false },
      ], page: 1, pageSize: 100, totalCount: 3, totalPages: 1,
    }));
    service.listarMarcas.and.returnValue(of({
      items: [
        { idMarca: 22, nombre: 'Laboratorio Uno', activa: true },
        { idMarca: 23, nombre: 'Marca histórica', activa: false },
        { idMarca: 24, nombre: 'Otra marca inactiva', activa: false },
      ], page: 1, pageSize: 100, totalCount: 3, totalPages: 1,
    }));
    service.obtenerMedicamento.and.returnValue(of({
      idMedicamento: 7, idCategoria: 12, idMarca: 23, codigo: 'MED-7',
      nombre: 'Medicamento histórico', descripcion: null, precioVenta: 12.5,
      imagenURL: null, activo: true,
    }));
    service.crearMedicamento.and.returnValue(of({
      idMedicamento: 8, idCategoria: 11, idMarca: 22, codigo: 'MED-8',
      nombre: 'Nuevo', descripcion: null, precioVenta: 10, imagenURL: null, activo: true,
    }));
    service.actualizarMedicamento.and.returnValue(of({
      idMedicamento: 7, idCategoria: 12, idMarca: 23, codigo: 'MED-7',
      nombre: 'Medicamento histórico', descripcion: null, precioVenta: 12.5,
      imagenURL: null, activo: true,
    }));
    service.guardarFotoMedicamento.and.returnValue(of({ url: '/api/medicamentos/8/foto' }));
    service.obtenerFotoMedicamento.and.returnValue(of(new Blob(
      [new Uint8Array([137])], { type: 'image/png' })));
    service.eliminarFotoMedicamento.and.returnValue(of(void 0));

    await TestBed.configureTestingModule({
      imports: [MedicamentoFormComponent],
      providers: [
        { provide: AuthSessionService, useValue: { currentUser: () => ({ idUsuario: 1, idRol: 1 }), isAuthenticated: () => true, token: 'test-token' } },
        { provide: PermisosService, useValue: { puedeCrear: () => true, puedeConsultar: () => true, puedeModificar: () => true, puedeEliminar: () => true } },
        { provide: InventarioService, useValue: service },
        provideRouter([]),
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: () => routeId } },
        } },
      ],
    }).compileComponents();
  });

  function render(): MedicamentoFormComponent {
    fixture = TestBed.createComponent(MedicamentoFormComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('ofrece únicamente categorías y marcas activas al crear', () => {
    const component = render();
    expect(service.listarCategorias).toHaveBeenCalledOnceWith(1, 100);
    expect(service.listarMarcas).toHaveBeenCalledOnceWith(1, 100);
    expect(component.categoriasDisponibles.map(item => item.idCategoria)).toEqual([11]);
    expect(component.marcasDisponibles.map(item => item.idMarca)).toEqual([22]);
  });

  it('rechaza identificadores de catálogos inactivos al crear', () => {
    const component = render();
    component.form.idCategoria = 12;
    component.form.idMarca = 23;
    component.guardar();
    expect(component.error).toContain('disponibles');
    expect(service.crearMedicamento).not.toHaveBeenCalled();
  });

  it('conserva solo las relaciones históricas inactivas al editar', () => {
    routeId = '7';
    const component = render();
    expect(component.categoriasDisponibles.map(item => item.idCategoria)).toEqual([11, 12]);
    expect(component.marcasDisponibles.map(item => item.idMarca)).toEqual([22, 23]);
    expect(component.categoriasDisponibles.some(item => item.idCategoria === 13)).toBeFalse();
    expect(component.marcasDisponibles.some(item => item.idMarca === 24)).toBeFalse();
  });

  function fotoPng(): File {
    return new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1])],
      'medicamento.png', { type: 'image/png' });
  }

  async function seleccionar(component: MedicamentoFormComponent, file: File): Promise<void> {
    await component.seleccionarFoto({ target: { files: [file], value: 'seleccionada' } } as unknown as Event);
    fixture.detectChanges();
  }

  function llenar(component: MedicamentoFormComponent): void {
    component.form.idCategoria = 11;
    component.form.idMarca = 22;
    component.form.codigo = 'MED-8';
    component.form.nombre = 'Nuevo';
    component.form.precioVenta = 10;
  }

  it('renderiza las tres tarjetas, campos previos y controles responsive', () => {
    render();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('#datos-medicamento-title')?.textContent).toContain('Datos del medicamento');
    expect(element.querySelector('#foto-medicamento-title')?.textContent).toContain('Fotografía');
    expect(element.querySelector('#acciones-medicamento-title')?.textContent).toContain('Acciones');
    for (const name of ['codigo', 'nombre', 'idCategoria', 'idMarca', 'precioVenta', 'imagenURL', 'descripcion']) {
      expect(element.querySelector(`[name="${name}"]`)).not.toBeNull();
    }
    expect(element.querySelector('#medicamento-codigo')?.parentElement?.classList).toContain('col-md-6');
    expect(element.querySelector('#medicamento-foto-archivo')).not.toBeNull();
    expect(element.querySelector<HTMLButtonElement>('#acciones-medicamento-title + div button')?.disabled).toBeFalse();
  });

  it('valida tipo, tamaño y contenido antes de generar la vista previa', async () => {
    const component = render();
    await seleccionar(component, new File(['texto'], 'imagen.txt', { type: 'text/plain' }));
    expect(component.errorFoto).toContain('JPEG');
    await seleccionar(component, new File([new Uint8Array(5 * 1024 * 1024 + 1)],
      'grande.png', { type: 'image/png' }));
    expect(component.errorFoto).toContain('5 MB');
    await seleccionar(component, new File(['no es PNG'], 'falsa.png', { type: 'image/png' }));
    expect(component.errorFoto).toContain('contenido');
    expect(component.archivoFoto).toBeNull();
    await seleccionar(component, fotoPng());
    expect(component.archivoFoto?.name).toBe('medicamento.png');
    expect(fixture.nativeElement.querySelector('img[alt="Vista previa de la fotografía del medicamento"]')).not.toBeNull();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Vista previa sin guardar');
  });

  it('crea una sola vez, usa el Id real para la fotografía y navega tras ambas confirmaciones', async () => {
    const component = render();
    const router = TestBed.inject(Router);
    const navigate = spyOn(router, 'navigate').and.resolveTo(true);
    llenar(component);
    await seleccionar(component, fotoPng());
    const pendiente = new Subject<MedicamentoResponse>();
    service.crearMedicamento.and.returnValue(pendiente);
    component.guardar(); component.guardar();
    expect(service.crearMedicamento).toHaveBeenCalledTimes(1);
    expect(service.guardarFotoMedicamento).not.toHaveBeenCalled();
    pendiente.next({ idMedicamento: 8, idCategoria: 11, idMarca: 22, codigo: 'MED-8',
      nombre: 'Nuevo', descripcion: null, precioVenta: 10, imagenURL: null, activo: true });
    expect(service.guardarFotoMedicamento).toHaveBeenCalledOnceWith(8, jasmine.any(File));
    expect(navigate).toHaveBeenCalledOnceWith(['/inventario']);
  });

  it('conserva el alta y ofrece ficha ante fallo parcial sin repetir POST', async () => {
    const component = render();
    llenar(component);
    await seleccionar(component, fotoPng());
    service.guardarFotoMedicamento.and.returnValue(throwError(() =>
      new HttpErrorResponse({ status: 503, statusText: 'Unavailable' })));
    component.guardar();
    fixture.detectChanges();
    expect(component.idCreado).toBe(8);
    expect(component.errorFoto).toContain('fue creado');
    expect(component.errorFoto).toContain('incierto');
    expect((fixture.nativeElement as HTMLElement).querySelector('a[href="/inventario/medicamentos/editar/8"]')).not.toBeNull();
    component.guardar();
    expect(service.crearMedicamento).toHaveBeenCalledTimes(1);
    expect(service.guardarFotoMedicamento).toHaveBeenCalledTimes(1);
  });

  it('bloquea una nueva alta si el POST devuelve resultado incierto', () => {
    const component = render();
    llenar(component);
    service.crearMedicamento.and.returnValue(throwError(() =>
      new HttpErrorResponse({ status: 503, statusText: 'Unavailable' })));
    component.guardar(); component.guardar();
    expect(component.resultadoAltaIncierto).toBeTrue();
    expect(service.crearMedicamento).toHaveBeenCalledTimes(1);
  });

  it('no permite seleccionar fotografías sin Medicamentos/Modificar', async () => {
    const permisos = TestBed.inject(PermisosService);
    spyOn(permisos, 'puedeModificar').and.returnValue(false);
    const component = render();
    expect((fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('#medicamento-foto-archivo')?.disabled).toBeTrue();
    await seleccionar(component, fotoPng());
    expect(component.archivoFoto).toBeNull();
    expect(component.errorFoto).toContain('Medicamentos/Modificar');
  });

  it('sube una fotografía al editar sin crear otro medicamento', async () => {
    routeId = '7';
    service.guardarFotoMedicamento.and.returnValue(of({ url: '/api/medicamentos/7/foto' }));
    const component = render();
    await seleccionar(component, fotoPng());
    component.guardarFoto();
    expect(service.guardarFotoMedicamento).toHaveBeenCalledOnceWith(7, jasmine.any(File));
    expect(service.crearMedicamento).not.toHaveBeenCalled();
    expect(component.avisoFoto).toContain('guardada');
  });

  it('muestra la foto protegida en la ficha y exige confirmación para eliminarla', () => {
    routeId = '7';
    service.obtenerMedicamento.and.returnValue(of({
      idMedicamento: 7, idCategoria: 12, idMarca: 23, codigo: 'MED-7',
      nombre: 'Medicamento histórico', descripcion: null, precioVenta: 12.5,
      imagenURL: '/api/medicamentos/7/foto', activo: true,
    }));
    const component = render();
    expect(service.obtenerFotoMedicamento).toHaveBeenCalledOnceWith(7);
    expect(component.vistaPreviaFoto).toContain('blob:');
    expect((fixture.nativeElement as HTMLElement).querySelector('img[alt="Vista previa de la fotografía del medicamento"]')).not.toBeNull();
    component.solicitarEliminarFoto();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('app-confirm-dialog')).not.toBeNull();
    expect(service.eliminarFotoMedicamento).not.toHaveBeenCalled();
    component.eliminarFoto();
    expect(service.eliminarFotoMedicamento).toHaveBeenCalledOnceWith(7);
    expect(component.fotoDisponible).toBeFalse();
    expect(component.form.imagenURL).toBeNull();
    expect(service.crearMedicamento).not.toHaveBeenCalled();
  });

  it('trata 404 como fotografía ausente y conserva la ficha ante error de R2', () => {
    routeId = '7';
    service.obtenerMedicamento.and.returnValue(of({
      idMedicamento: 7, idCategoria: 12, idMarca: 23, codigo: 'MED-7',
      nombre: 'Medicamento histórico', descripcion: null, precioVenta: 12.5,
      imagenURL: '/api/medicamentos/7/foto', activo: true,
    }));
    service.obtenerFotoMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    const component = render();
    expect(component.fotoDisponible).toBeFalse();
    expect(component.errorFoto).toBe('');
    service.obtenerFotoMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    component.ngOnInit();
    expect(component.errorFoto).not.toBe('');
    expect(component.form.nombre).toBe('Medicamento histórico');
  });

  it('no elimina la foto sin permiso y señala una eliminación de resultado incierto', () => {
    routeId = '7';
    service.obtenerMedicamento.and.returnValue(of({
      idMedicamento: 7, idCategoria: 12, idMarca: 23, codigo: 'MED-7',
      nombre: 'Medicamento histórico', descripcion: null, precioVenta: 12.5,
      imagenURL: '/api/medicamentos/7/foto', activo: true,
    }));
    const component = render();
    const permisos = TestBed.inject(PermisosService);
    const puedeModificar = spyOn(permisos, 'puedeModificar').and.returnValue(false);
    component.solicitarEliminarFoto();
    expect(component.confirmarEliminarFoto).toBeFalse();
    expect(service.eliminarFotoMedicamento).not.toHaveBeenCalled();
    puedeModificar.and.returnValue(true);
    service.eliminarFotoMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    component.solicitarEliminarFoto();
    component.eliminarFoto();
    expect(component.errorFoto).toContain('incierto');
    expect(component.fotoDisponible).toBeTrue();
  });
});
