import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogoMedicamentoResponse } from '../../core/models/inventario.model';
import { InventarioService } from '../../core/services/inventario.service';
import { PermisosService } from '../../core/services/permisos.service';
import { InventarioListComponent } from './inventario-list.component';
import { AuthSessionService } from '../../core/services/auth-session.service';

describe('InventarioListComponent WEB-UX-01C2', () => {
  let fixture: ComponentFixture<InventarioListComponent>;
  const medicamento: CatalogoMedicamentoResponse = {
    idMedicamento: 64, codigo: 'MED-064', nombre: 'Analgésico', precioVenta: 12.5,
    marca: 'Marca Uno', categoria: 'Dolor', descripcion: null, imagenURL: null, existenciaTotal: 8,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InventarioListComponent],
      providers: [
        provideRouter([]),
        { provide: AuthSessionService, useValue: { currentUser: () => ({ idUsuario: 1, idRol: 1 }), isAuthenticated: () => true, token: 'test-token' } },
        { provide: InventarioService, useValue: {
          listarCatalogo: () => of({ items: [medicamento], page: 1, pageSize: 10, totalCount: 1, totalPages: 1 }),
          listarCategorias: () => of({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }),
          listarMarcas: () => of({ items: [], page: 1, pageSize: 100, totalCount: 0, totalPages: 0 }),
          desactivarMedicamento: () => of(void 0),
        } },
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
});
