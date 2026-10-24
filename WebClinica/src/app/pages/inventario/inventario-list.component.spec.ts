import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { CatalogoMedicamentoResponse } from '../../core/models/inventario.model';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { InventarioListComponent } from './inventario-list.component';
import { AuthSessionService } from '../../core/services/auth-session.service';

describe('InventarioListComponent WEB-UX-01C2', () => {
  let fixture: ComponentFixture<InventarioListComponent>;
  let service: jasmine.SpyObj<InventarioService>;
  const medicamento: CatalogoMedicamentoResponse = {
    idMedicamento: 64, codigo: 'MED-064', nombre: 'Analgésico', precioVenta: 12.5,
    marca: 'Marca Uno', categoria: 'Dolor', descripcion: null, imagenURL: null, existenciaTotal: 8,
  };

  beforeEach(async () => {
    service = jasmine.createSpyObj<InventarioService>('InventarioService', [
      'listarCatalogo', 'listarCategorias', 'listarMarcas', 'desactivarMedicamento', 'obtenerFotoMedicamento',
    ]);
    service.listarCatalogo.and.returnValue(of({ items: [medicamento], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 }));
    service.listarCategorias.and.returnValue(of({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }));
    service.listarMarcas.and.returnValue(of({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }));
    service.desactivarMedicamento.and.returnValue(of(void 0));
    await TestBed.configureTestingModule({
      imports: [InventarioListComponent],
      providers: [
        provideRouter([]),
        { provide: AuthSessionService, useValue: { currentUser: () => ({ idUsuario: 1, idRol: 1 }), isAuthenticated: () => true, token: 'test-token' } },
        { provide: InventarioService, useValue: service },
        { provide: PermisosService, useValue: {
          puedeCrear: () => false, puedeConsultar: () => true,
          puedeModificar: () => true, puedeEliminar: () => true,
        } },
      ],
    }).compileComponents();
  });

  it('conserva el código operativo, el contenedor responsive y el ID real de edición', () => {
    fixture = TestBed.createComponent(InventarioListComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('.ui-table-wrap')).not.toBeNull();
    expect(element.querySelector('thead th')?.textContent?.trim()).toBe('Código');
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('MED-064');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Editar medicamento"]')?.getAttribute('href'))
      .toBe('/inventario/medicamentos/editar/64');
  });

  it('muestra en el catálogo el blob protegido y lo libera al salir', () => {
    service.listarCatalogo.and.returnValue(of({ items: [{ ...medicamento, imagenURL: '/api/medicamentos/64/foto' }],
      page: 1, pageSize: 10, totalCount: 1, totalPages: 1 }));
    service.obtenerFotoMedicamento.and.returnValue(of(new Blob(['imagen'], { type: 'image/webp' })));
    const crearUrl = spyOn(URL, 'createObjectURL').and.returnValue('blob:medicamento-protegido');
    const revocarUrl = spyOn(URL, 'revokeObjectURL');
    fixture = TestBed.createComponent(InventarioListComponent);
    fixture.detectChanges();
    expect(service.obtenerFotoMedicamento).toHaveBeenCalledOnceWith(64);
    expect(crearUrl).toHaveBeenCalled();
    const image = (fixture.nativeElement as HTMLElement).querySelector<HTMLImageElement>('img[alt="Fotografía de Analgésico"]');
    expect(image?.getAttribute('src')).toBe('blob:medicamento-protegido');
    fixture.destroy();
    expect(revocarUrl).toHaveBeenCalledWith('blob:medicamento-protegido');
  });

  it('mantiene el catálogo ante ausencia de foto o error de almacenamiento', () => {
    service.listarCatalogo.and.returnValue(of({ items: [{ ...medicamento, imagenURL: '/api/medicamentos/64/foto' }],
      page: 1, pageSize: 10, totalCount: 1, totalPages: 1 }));
    service.obtenerFotoMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));
    fixture = TestBed.createComponent(InventarioListComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Sin fotografía');
    service.obtenerFotoMedicamento.and.returnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    fixture.componentInstance.cargarMedicamentos();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Foto no disponible');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Analgésico');
  });
});
