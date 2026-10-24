import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { RecetaFarmaciaDto } from '../../core/models/receta-farmacia.model';
import { routes } from '../../app.routes';
import { RecetaFarmaciaService } from '../../core/services/receta-farmacia.service';
import { RecetasFarmaciaComponent } from './recetas-farmacia.component';

describe('RecetasFarmaciaComponent', () => {
  let fixture: ComponentFixture<RecetasFarmaciaComponent>;
  let service: jasmine.SpyObj<RecetaFarmaciaService>;

  const receta: RecetaFarmaciaDto = {
    idReceta: 42, idConsulta: 17, nombrePaciente: 'Paciente sintético',
    nombreMedicoPrescriptor: 'Médico sintético', fechaPrescripcionUtc: '2026-10-23T10:00:00Z',
    estado: 'Vigente', medicamentos: [{ idMedicamento: 3, nombreMedicamento: 'Medicina de prueba',
      presentacion: 'Caja', cantidadPrescritaUnidades: 4 }],
  };

  it('protege la ruta con Ventas/Consultar', () => {
    const route = routes.find(item => item.path === '')?.children
      ?.find(item => item.path === 'farmacia/recetas');
    expect(route?.data?.['permisos']).toEqual([{ modulo: 'Ventas', operacion: 'Consultar' }]);
  });

  beforeEach(async () => {
    service = jasmine.createSpyObj<RecetaFarmaciaService>('RecetaFarmaciaService', ['listar', 'obtener']);
    service.listar.and.returnValue(of({ items: [receta], page: 1, pageSize: 10,
      totalCount: 1, totalPages: 1 }));
    service.obtener.and.returnValue(of(receta));
    await TestBed.configureTestingModule({
      imports: [RecetasFarmaciaComponent],
      providers: [{ provide: RecetaFarmaciaService, useValue: service }],
    }).compileComponents();
    fixture = TestBed.createComponent(RecetasFarmaciaComponent);
    fixture.detectChanges();
  });

  it('presenta receta y medicamentos sin acciones de despacho ni inventario', () => {
    const html = fixture.nativeElement.textContent as string;
    expect(html).toContain('Paciente sintético');
    expect(html).toContain('Médico sintético');
    expect(html).toContain('Medicina de prueba');
    expect(html).toContain('Caja');
    expect(html).toContain('Vigente');
    expect(html).not.toMatch(/Entregar|Despachar|Confirmar salida/);
    const buttons = fixture.nativeElement.querySelectorAll('button');
    expect(Array.from(buttons).some((button: unknown) =>
      (button as HTMLButtonElement).textContent?.trim() === 'Ver detalle')).toBeTrue();
  });

  it('abre el detalle usando IdReceta y permite cerrarlo', () => {
    fixture.componentInstance.verDetalle(42);
    fixture.detectChanges();
    expect(service.obtener).toHaveBeenCalledWith(42);
    expect(fixture.nativeElement.querySelector('section[aria-label="Detalle de receta"]')).not.toBeNull();
    fixture.componentInstance.cerrarDetalle();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('section[aria-label="Detalle de receta"]')).toBeNull();
  });

  it('pagina y filtra sin pedir otra sucursal', () => {
    service.listar.and.returnValue(of({ items: [receta], page: 2, pageSize: 10,
      totalCount: 11, totalPages: 2 }));
    fixture.componentInstance.consultaFiltro = 17;
    fixture.componentInstance.buscar();
    expect(service.listar).toHaveBeenCalledWith(1, 10, 17);
    fixture.componentInstance.cambiarPagina(2);
    expect(service.listar).toHaveBeenCalledWith(2, 10, 17);
    fixture.componentInstance.cambiarPagina(3);
    expect(service.listar).not.toHaveBeenCalledWith(3, 10, 17);
  });

  it('muestra el error de autorización sin exponer recetas previas', () => {
    service.listar.and.returnValue(throwError(() => ({ status: 403, error: {} })));
    fixture.componentInstance.buscar();
    fixture.detectChanges();
    expect(fixture.componentInstance.recetas).toEqual([]);
    expect(fixture.nativeElement.textContent).toContain('No tienes autorización');
  });
});
