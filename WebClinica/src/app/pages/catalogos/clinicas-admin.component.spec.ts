import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { CatalogosService } from '../../core/services/catalogos.service';
import { PermisosService } from '../../core/services/permisos.service';
import { ClinicasAdminComponent } from './clinicas-admin.component';

describe('ClinicasAdminComponent', () => {
  let fixture: ComponentFixture<ClinicasAdminComponent>;
  let component: ClinicasAdminComponent;
  let service: jasmine.SpyObj<CatalogosService>;
  const branch = { idSucursal: 3, nombre: 'Central', direccion: null, activa: true };
  const clinic = {
    idClinica: 17, nombreClinica: 'Clínica Central', especialidad: 'General',
    activa: true, idSucursal: 3,
  };
  const page = { items: [clinic], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };

  beforeEach(async () => {
    service = jasmine.createSpyObj<CatalogosService>('CatalogosService', [
      'listarClinicas', 'crearClinica', 'actualizarClinica', 'desactivarClinica', 'getSucursales',
    ]);
    service.listarClinicas.and.returnValue(of(page));
    service.getSucursales.and.returnValue(of([branch]));
    await TestBed.configureTestingModule({
      imports: [ClinicasAdminComponent],
      providers: [
        { provide: CatalogosService, useValue: service },
        { provide: PermisosService, useValue: {
          puedeCrear: () => true, puedeModificar: () => true, puedeEliminar: () => true,
        } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ClinicasAdminComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lista, pagina y conserva el identificador y la relación reales', () => {
    expect(service.listarClinicas).toHaveBeenCalledOnceWith(1, 20);
    expect(component.rows[0]).toEqual({
      id: 17,
      label: 'Clínica Central',
      activa: true,
      values: { nombre: 'Clínica Central', especialidad: 'General', sucursal: 'Sucursal 3' },
    });
    component.load(2);
    expect(service.listarClinicas).toHaveBeenCalledWith(2, 20);
  });

  it('carga sucursales al abrir y crea una clínica una sola vez', () => {
    const pending = new Subject<typeof clinic>();
    service.crearClinica.and.returnValue(pending);
    component.openCreate();
    expect(service.getSucursales).toHaveBeenCalledTimes(1);
    expect(component.formOpen).toBeTrue();
    expect(component.rows[0].values['sucursal']).toBe('Central');
    component.form.setValue({
      nombreClinica: '  Clínica Norte  ', especialidad: '  Pediatría ', idSucursal: 3,
    });
    component.save();
    component.save();
    expect(service.crearClinica).toHaveBeenCalledOnceWith({
      nombreClinica: 'Clínica Norte', especialidad: 'Pediatría', idSucursal: 3,
    });
    pending.next(clinic);
    pending.complete();
  });

  it('edita manteniendo el Id real y permite conservar la sucursal actual', () => {
    service.actualizarClinica.and.returnValue(of(clinic));
    component.openEdit(17);
    component.form.controls.nombreClinica.setValue('Clínica Central II');
    component.save();
    expect(service.actualizarClinica).toHaveBeenCalledOnceWith(17, {
      nombreClinica: 'Clínica Central II', especialidad: 'General', idSucursal: 3,
    });
  });

  it('desactiva lógicamente y no ofrece reactivación', () => {
    service.desactivarClinica.and.returnValue(of(void 0));
    component.deactivate(17);
    expect(service.desactivarClinica).toHaveBeenCalledOnceWith(17);
    expect('reactivate' in component).toBeFalse();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label^="Reactivar"]')).toBeNull();
  });

  it('impide guardar sin sucursal y presenta ProblemDetails de relación', () => {
    component.openCreate();
    component.form.patchValue({ nombreClinica: 'Clínica', idSucursal: 0 });
    component.save();
    expect(service.crearClinica).not.toHaveBeenCalled();

    component.form.controls.idSucursal.setValue(3);
    service.crearClinica.and.returnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { detail: 'La sucursal indicada ya no está disponible.' },
    })));
    component.save();
    expect(component.operationError).toBe('La sucursal indicada ya no está disponible.');
  });

  it('no abre el formulario cuando no puede consultar las sucursales', () => {
    component.sucursales = [];
    service.getSucursales.and.returnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    component.openCreate();
    expect(component.formOpen).toBeFalse();
    expect(component.operationError).toBe('No tienes autorización para realizar esta operación.');
  });

  it('excluye sucursales inactivas nuevas y conserva únicamente la relación histórica', () => {
    const inactive = { idSucursal: 9, nombre: 'Histórica', direccion: null, activa: false };
    const otherInactive = { idSucursal: 10, nombre: 'Otra', direccion: null, activa: false };
    component.items = [{ ...clinic, idSucursal: 9 }];
    component.sucursales = [branch, inactive, otherInactive];
    component.openEdit(17);
    expect(component.sucursalesActivas.map(item => item.idSucursal)).toEqual([3, 9]);

    component.form.controls.idSucursal.setValue(10);
    component.save();
    expect(component.operationError).toContain('sucursal disponible');
    expect(service.actualizarClinica).not.toHaveBeenCalled();
  });
});
