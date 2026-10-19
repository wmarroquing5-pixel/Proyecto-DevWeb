import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { FuncionalidadPendienteComponent } from './funcionalidad-pendiente.component';

describe('FuncionalidadPendienteComponent', () => {
  let fixture: ComponentFixture<FuncionalidadPendienteComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FuncionalidadPendienteComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: {
          titulo: 'Citas médicas',
          descripcion: 'La gestión de citas se encuentra en preparación.',
        } } } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FuncionalidadPendienteComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('muestra el nombre de la funcionalidad conocida', () => {
    expect(element.querySelector('h1')?.textContent).toContain('Citas médicas');
  });

  it('la distingue como funcionalidad en desarrollo', () => {
    expect(element.textContent).toContain('Funcionalidad en desarrollo');
    expect(element.textContent).toContain('La gestión de citas se encuentra en preparación.');
  });

  it('ofrece un regreso accesible al dashboard', () => {
    const link = element.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/dashboard');
    expect(link?.textContent).toContain('Volver al dashboard');
  });

  it('utiliza una estructura responsive de Bootstrap', () => {
    expect(element.querySelector('.container.py-md-5')).not.toBeNull();
    expect(element.querySelector('.col-12.col-lg-8.col-xl-7')).not.toBeNull();
    expect(element.querySelector('[aria-labelledby="funcionalidad-pendiente-titulo"]')).not.toBeNull();
  });
});
