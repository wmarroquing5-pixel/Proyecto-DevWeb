import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { CatalogosService } from '../../core/services/catalogos.service';
import { HistorialService } from '../../core/services/historial.service';
import { ConsultaNuevaComponent } from './consulta-nueva.component';

describe('ConsultaNuevaComponent catálogos activos', () => {
  let fixture: ComponentFixture<ConsultaNuevaComponent>;
  let crearConsulta: jasmine.Spy;

  beforeEach(async () => {
    crearConsulta = jasmine.createSpy('crearConsulta').and.returnValue(of({
      idConsulta: 15, idPaciente: 8, idMedico: 2, idSucursal: 3, idClinica: null,
      fechaConsulta: '2026-10-20T10:00:00', motivoConsulta: null, sintomas: null,
      observaciones: null, pesoLb: null, presionDiastolica: null,
      presionSistolica: null, alturaCm: null,
    }));
    await TestBed.configureTestingModule({
      imports: [ConsultaNuevaComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: {
          snapshot: { paramMap: { get: () => '8' } },
        } },
        { provide: HistorialService, useValue: { crearConsulta } },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([
            { idSucursal: 3, nombre: 'Central', direccion: null, activa: true },
            { idSucursal: 4, nombre: 'Cerrada', direccion: null, activa: false },
          ]),
        } },
      ],
    }).compileComponents();
    spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(ConsultaNuevaComponent);
    fixture.detectChanges();
  });

  it('ofrece únicamente sucursales activas con etiquetas descriptivas', () => {
    const component = fixture.componentInstance;
    expect(component.sucursales.map(item => item.idSucursal)).toEqual([3]);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Central');
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('Cerrada');
  });

  it('conserva el identificador real y rechaza una sucursal inactiva', () => {
    const component = fixture.componentInstance;
    component.form.idSucursal = 4;
    component.guardar();
    expect(component.error).toContain('sucursal activa');
    expect(crearConsulta).not.toHaveBeenCalled();

    component.form.idSucursal = 3;
    component.guardar();
    expect(crearConsulta).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      idPaciente: 8, idSucursal: 3,
    }));
  });
});
