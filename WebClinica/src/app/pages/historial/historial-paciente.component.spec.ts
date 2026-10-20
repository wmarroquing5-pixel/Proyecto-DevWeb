import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ConsultaListadoDto } from '../../core/models/historial.model';
import { HistorialService } from '../../core/services/historial.service';
import { PermisosService } from '../../core/services/permisos.service';
import { HistorialPacienteComponent } from './historial-paciente.component';

describe('HistorialPacienteComponent WEB-UX-01C2', () => {
  let fixture: ComponentFixture<HistorialPacienteComponent>;
  let listarConsultas: jasmine.Spy;

  const consulta: ConsultaListadoDto = {
    idConsulta: 81, idPaciente: 29, idMedico: 7, idSucursal: 3,
    idClinica: null, fechaConsulta: '2026-10-19T10:00:00',
  };

  beforeEach(async () => {
    listarConsultas = jasmine.createSpy('listarConsultas').and.callFake((filtro: { page: number; pageSize: number }) => of({
      items: [{ ...consulta, idConsulta: filtro.page === 1 ? 81 : 144 }],
      page: filtro.page, pageSize: filtro.pageSize, totalCount: 20, totalPages: 2,
    }));
    await TestBed.configureTestingModule({
      imports: [HistorialPacienteComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: '29' }) } } },
        { provide: HistorialService, useValue: { listarConsultas } },
        { provide: PermisosService, useValue: { puedeCrear: () => true, puedeConsultar: () => true } },
      ],
    }).compileComponents();
  });

  it('muestra No. y conserva el ID real en la ruta de detalle', () => {
    fixture = TestBed.createComponent(HistorialPacienteComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('thead th')?.textContent?.trim()).toBe('No.');
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('1');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Ver detalle de consulta"]')?.getAttribute('href'))
      .toBe('/historial/29/consulta/81');

    fixture.componentInstance.cambiarPagina(2);
    fixture.detectChanges();
    expect(element.querySelector('tbody td')?.textContent?.trim()).toBe('11');
    expect(element.querySelector<HTMLAnchorElement>('[aria-label="Ver detalle de consulta"]')?.getAttribute('href'))
      .toBe('/historial/29/consulta/144');
  });
});
