import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ServiciosAdminComponent } from './servicios-admin.component';

describe('ServiciosAdminComponent', () => {
  let fixture: ComponentFixture<ServiciosAdminComponent>;
  let component: ServiciosAdminComponent;
  let service: jasmine.SpyObj<CatalogosService>;
  const item = {
    idServicio: 23, codigo: 'SRV-23', nombre: 'Consulta general', descripcion: null,
    precioBase: 125.5, tipoServicio: 'Consulta' as const, activo: true,
  };
  const page = { items: [item], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };

  beforeEach(async () => {
    service = jasmine.createSpyObj<CatalogosService>('CatalogosService', [
      'listarServicios', 'crearServicio', 'actualizarServicio', 'desactivarServicio',
    ]);
    service.listarServicios.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [ServiciosAdminComponent],
      providers: [
        { provide: CatalogosService, useValue: service },
        { provide: PermisosService, useValue: {
          puedeCrear: () => true, puedeModificar: () => true, puedeEliminar: () => true,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ServiciosAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista y pagina conservando identificador, tipo y precio', () => {
    expect(service.listarServicios).toHaveBeenCalledOnceWith(1, 20);
    expect(component.rows[0].id).toBe(23);
    expect(component.rows[0].values['tipo']).toBe('Consulta');
    expect(component.rows[0].values['precio']).toContain('125');
    component.load(2);
    expect(service.listarServicios).toHaveBeenCalledWith(2, 20);
  });

  it('crea un servicio normalizado y evita el doble envío', () => {
    const pending = new Subject<typeof item>();
    service.crearServicio.and.returnValue(pending);
    component.openCreate();
    component.form.setValue({
      codigo: ' SRV-24 ', nombre: ' Radiografía ', descripcion: ' Imagen diagnóstica ',
      precioBase: 75.25, tipoServicio: 'Examen',
    });
    component.save();
    component.save();
    expect(service.crearServicio).toHaveBeenCalledOnceWith({
      codigo: 'SRV-24', nombre: 'Radiografía', descripcion: 'Imagen diagnóstica',
      precioBase: 75.25, tipoServicio: 'Examen',
    });
    pending.next(item);
    pending.complete();
  });

  it('edita y desactiva mediante los contratos vigentes', () => {
    service.actualizarServicio.and.returnValue(of(item));
    service.desactivarServicio.and.returnValue(of(void 0));
    component.openEdit(23);
    component.form.controls.tipoServicio.setValue('Procedimiento');
    component.save();
    expect(service.actualizarServicio).toHaveBeenCalledOnceWith(23, {
      codigo: 'SRV-23', nombre: 'Consulta general', descripcion: null,
      precioBase: 125.5, tipoServicio: 'Procedimiento',
    });
    component.deactivate(23);
    expect(service.desactivarServicio).toHaveBeenCalledOnceWith(23);
  });

  it('rechaza precios negativos o con más de dos decimales', () => {
    component.openCreate();
    component.form.patchValue({
      codigo: 'SRV', nombre: 'Servicio', precioBase: -1, tipoServicio: 'Otro',
    });
    component.save();
    expect(service.crearServicio).not.toHaveBeenCalled();
    component.form.controls.precioBase.setValue(10.123);
    component.save();
    expect(service.crearServicio).not.toHaveBeenCalled();
  });

  it('solo expone los tipos permitidos y no ofrece reactivación', () => {
    expect(component.tipos).toEqual([
      'Consulta', 'Examen', 'Habitacion', 'Procedimiento', 'Otro',
    ]);
    expect('reactivate' in component).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label^="Reactivar"]')).toBeNull();
  });

  it('presenta el conflicto del código sin ocultarlo ni reintentar', () => {
    component.openCreate();
    component.form.setValue({
      codigo: 'SRV-23', nombre: 'Consulta', descripcion: '',
      precioBase: 0, tipoServicio: 'Consulta',
    });
    service.crearServicio.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { detail: 'El código del servicio ya está registrado.' },
    })));
    component.save();
    expect(service.crearServicio).toHaveBeenCalledTimes(1);
    expect(component.operationError).toBe('El código del servicio ya está registrado.');
  });
});
