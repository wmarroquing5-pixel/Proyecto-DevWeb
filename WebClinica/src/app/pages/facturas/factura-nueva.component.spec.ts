import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { Subject, of } from 'rxjs';
import { FacturaCreada } from '../../core/models/factura.model';
import { CatalogosService } from '../../core/services/catalogos.service';
import { FacturaService } from '../../core/services/factura.service';
import { InventarioService } from '../../core/services/inventario.service';
import { PacientesService } from '../../core/services/paciente.service';
import { FacturaNuevaComponent } from './factura-nueva.component';

describe('FacturaNuevaComponent', () => {
  let fixture: ComponentFixture<FacturaNuevaComponent>;
  let crear: jasmine.Spy;
  let response: Subject<FacturaCreada>;

  beforeEach(async () => {
    response = new Subject<FacturaCreada>();
    crear = jasmine.createSpy('crear').and.returnValue(response.asObservable());
    await TestBed.configureTestingModule({
      imports: [FacturaNuevaComponent],
      providers: [
        provideRouter([]),
        { provide: FacturaService, useValue: { crear } },
        { provide: CatalogosService, useValue: {
          getSucursales: () => of([
            { idSucursal: 3, nombre: 'Central', direccion: null, activa: true },
            { idSucursal: 8, nombre: 'Cerrada', direccion: null, activa: false },
          ]),
          getServicios: () => of([{
            idServicio: 5, codigo: 'SRV-5', nombre: 'Consulta', descripcion: null,
            precioBase: 125, tipoServicio: 'Consulta', activo: true,
          }, {
            idServicio: 6, codigo: 'SRV-6', nombre: 'Inactivo', descripcion: null,
            precioBase: 80, tipoServicio: 'Otro', activo: false,
          }]),
        } },
        { provide: PacientesService, useValue: {
          listar: () => of({
            items: [
              { idPaciente: 4, nombres: 'Paciente', apellidos: 'Demo', activo: true },
              { idPaciente: 9, nombres: 'Paciente', apellidos: 'Inactivo', activo: false },
            ],
            page: 1, pageSize: 50, totalCount: 2, totalPages: 1,
          }),
          obtener: () => of({
            idPaciente: 4, nombres: 'Paciente', apellidos: 'Demo', fechaNacimiento: '2000-01-01',
            fechaRegistro: '2026-01-01', activo: true, nit: 'CF', nombreFacturacion: 'Paciente Demo',
          }),
        } },
        { provide: InventarioService, useValue: { listarCatalogo: () => of({
          items: [{
            idMedicamento: 7, codigo: 'MED-7', nombre: 'Medicamento', precioVenta: 12.5,
            marca: 'Marca', categoria: 'Categoría', descripcion: null, imagenURL: null, existenciaTotal: 4,
          }],
          page: 1, pageSize: 50, totalCount: 1, totalPages: 1,
        }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(FacturaNuevaComponent);
    fixture.detectChanges();
  });

  it('crea una factura mixta enviando solo identificadores, cantidades y datos generales', () => {
    const component = fixture.componentInstance;
    component.idSucursal = 3;
    component.idPaciente = 4;
    component.nit = ' CF ';
    component.nombreFacturacion = ' Paciente Demo ';
    component.servicioSeleccionado = 5;
    component.agregarServicio();
    component.medicamentoSeleccionado = 7;
    component.agregarMedicamento();
    component.guardar();

    expect(crear).toHaveBeenCalledOnceWith({
      idSucursal: 3, idPaciente: 4, nit: 'CF', nombreFacturacion: 'Paciente Demo',
      servicios: [{ idServicio: 5, cantidad: 1 }],
      medicamentos: [{ idMedicamento: 7, cantidad: 1 }],
    });
    const sent = JSON.stringify(crear.calls.mostRecent().args[0]);
    expect(sent).not.toContain('precio');
    expect(sent).not.toContain('total');
    expect(sent).not.toContain('idUsuario');
    expect(sent).not.toContain('idLote');
  });

  it('impide el doble envío y navega al detalle confirmado', () => {
    const router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    const component = fixture.componentInstance;
    component.idSucursal = 3;
    component.idPaciente = 4;
    component.servicioSeleccionado = 5;
    component.agregarServicio();
    component.guardar();
    component.guardar();
    expect(crear).toHaveBeenCalledTimes(1);

    response.next({
      idFactura: 19, idUsuario: 2, idSucursal: 3, idPaciente: 4,
      fechaFactura: '2026-10-20T10:00:00Z', tipoFactura: 'Estancia Medica',
      nit: null, nombreFacturacion: null, total: 125,
      detalles: [{ idDetalle: 1, idServicio: 5, idLote: null, idMedicamento: null, cantidad: 1, precioUnitario: 125, subtotal: 125 }],
    });
    expect(router.navigate).toHaveBeenCalledWith(['/facturas', 19]);
  });

  it('presenta el ProblemDetails de conflicto y permite una corrección manual', () => {
    const component = fixture.componentInstance;
    component.idSucursal = 3;
    component.idPaciente = 4;
    component.servicioSeleccionado = 5;
    component.agregarServicio();
    component.guardar();
    response.error(new HttpErrorResponse({
      status: 409, statusText: 'Conflict', error: { detail: 'El inventario cambió durante la factura.' },
    }));
    fixture.detectChanges();
    expect(component.guardando).toBeFalse();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('El inventario cambió durante la factura.');
  });

  it('exige paciente, sucursal y al menos una línea antes de enviar', () => {
    fixture.componentInstance.guardar();
    expect(crear).not.toHaveBeenCalled();
  });

  it('excluye sucursales, pacientes y servicios inactivos de nuevas relaciones', () => {
    const component = fixture.componentInstance;
    expect(component.sucursales.map(item => item.idSucursal)).toEqual([3]);
    expect(component.pacientes.map(item => item.idPaciente)).toEqual([4]);
    expect(component.servicios.map(item => item.idServicio)).toEqual([5]);
  });
});
