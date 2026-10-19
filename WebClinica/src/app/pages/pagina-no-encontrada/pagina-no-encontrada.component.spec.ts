import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PaginaNoEncontradaComponent } from './pagina-no-encontrada.component';

describe('PaginaNoEncontradaComponent', () => {
  let fixture: ComponentFixture<PaginaNoEncontradaComponent>;
  let element: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PaginaNoEncontradaComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(PaginaNoEncontradaComponent);
    fixture.detectChanges();
    element = fixture.nativeElement as HTMLElement;
  });

  it('informa de forma explícita que la página no existe', () => {
    expect(element.textContent).toContain('404');
    expect(element.querySelector('h1')?.textContent).toContain('Página no encontrada');
  });

  it('ofrece regresar a una ruta válida', () => {
    const link = element.querySelector('a');
    expect(link?.getAttribute('href')).toBe('/dashboard');
    expect(link?.classList).toContain('btn-primary');
  });

  it('mantiene estructura accesible y responsive', () => {
    expect(element.querySelector('[aria-labelledby="pagina-no-encontrada-titulo"]')).not.toBeNull();
    expect(element.querySelector('.col-12.col-lg-8.col-xl-7')).not.toBeNull();
  });
});
