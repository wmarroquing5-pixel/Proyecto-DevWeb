import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccesoDenegadoComponent } from './acceso-denegado.component';

describe('AccesoDenegadoComponent', () => {
  it('explica la falta de autorización y permite volver al dashboard', async () => {
    await TestBed.configureTestingModule({
      imports: [AccesoDenegadoComponent],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(AccesoDenegadoComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('Acceso denegado');
    expect(element.textContent).toContain('No tienes autorización');
    expect(element.querySelector('a')?.getAttribute('href')).toBe('/dashboard');
  });
});
