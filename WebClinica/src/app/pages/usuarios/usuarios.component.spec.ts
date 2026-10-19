import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { PermisosService } from '../../core/services/permisos.service';
import { UsuariosService } from '../../core/services/usuarios.service';
import { UsuariosComponent } from './usuarios.component';

describe('UsuariosComponent permissions', () => {
  let fixture: ComponentFixture<UsuariosComponent>;
  let puedeCrear: boolean;
  let puedeModificar: boolean;
  let puedeEliminar: boolean;

  beforeEach(async () => {
    puedeCrear = false;
    puedeModificar = false;
    puedeEliminar = false;

    await TestBed.configureTestingModule({
      imports: [UsuariosComponent],
      providers: [
        provideRouter([]),
        {
          provide: UsuariosService,
          useValue: {
            listar: () => of({
              items: [{ idUsuario: 7, idRol: 2, username: 'operador', idEmpleado: null, activo: true }],
              totalCount: 1,
              totalPages: 1,
              page: 1,
              pageSize: 10,
            }),
          },
        },
        {
          provide: PermisosService,
          useValue: {
            puedeCrear: () => puedeCrear,
            puedeModificar: () => puedeModificar,
            puedeEliminar: () => puedeEliminar,
          },
        },
      ],
    }).compileComponents();
  });

  function render(): HTMLElement {
    fixture = TestBed.createComponent(UsuariosComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('mantiene visible la consulta sin mostrar acciones no autorizadas', () => {
    const element = render();

    expect(element.textContent).toContain('operador');
    expect(element.textContent).not.toContain('Nuevo Usuario');
    expect(element.querySelector('[aria-label="Editar usuario"]')).toBeNull();
    expect(element.querySelector('[aria-label="Eliminar usuario"]')).toBeNull();
  });

  it('muestra crear solamente con permiso Crear', () => {
    puedeCrear = true;
    const element = render();

    expect(element.textContent).toContain('Nuevo Usuario');
    expect(element.querySelector('[aria-label="Editar usuario"]')).toBeNull();
    expect(element.querySelector('[aria-label="Eliminar usuario"]')).toBeNull();
  });

  it('muestra editar solamente con permiso Modificar', () => {
    puedeModificar = true;
    const element = render();

    expect(element.querySelector('[aria-label="Editar usuario"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Nuevo Usuario');
    expect(element.querySelector('[aria-label="Eliminar usuario"]')).toBeNull();
  });

  it('muestra eliminar solamente con permiso Eliminar', () => {
    puedeEliminar = true;
    const element = render();

    expect(element.querySelector('[aria-label="Eliminar usuario"]')).not.toBeNull();
    expect(element.textContent).not.toContain('Nuevo Usuario');
    expect(element.querySelector('[aria-label="Editar usuario"]')).toBeNull();
  });

  it('oculta todas las acciones cuando el módulo no concede operaciones', () => {
    const element = render();

    expect(element.querySelectorAll('a.btn-primary, [aria-label="Editar usuario"], [aria-label="Eliminar usuario"].btn-danger').length).toBe(0);
  });
});
