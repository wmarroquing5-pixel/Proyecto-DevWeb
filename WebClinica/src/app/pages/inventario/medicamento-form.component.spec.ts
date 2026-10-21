import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { InventarioService } from '../../core/services/inventario.service';
import { MedicamentoFormComponent } from './medicamento-form.component';

describe('MedicamentoFormComponent catálogos activos', () => {
  let fixture: ComponentFixture<MedicamentoFormComponent>;
  let service: jasmine.SpyObj<InventarioService>;
  let routeId: string | null;

  beforeEach(async () => {
    routeId = null;
    service = jasmine.createSpyObj<InventarioService>('InventarioService', [
      'listarCategorias', 'listarMarcas', 'obtenerMedicamento',
      'crearMedicamento', 'actualizarMedicamento',
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

    await TestBed.configureTestingModule({
      imports: [MedicamentoFormComponent],
      providers: [
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
});
