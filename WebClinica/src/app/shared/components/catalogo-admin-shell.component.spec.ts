import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { PermisosService } from '../../core/services/permisos.service';
import { CatalogoAdminShellComponent } from './catalogo-admin-shell.component';

describe('CatalogoAdminShellComponent', () => {
  let fixture: ComponentFixture<CatalogoAdminShellComponent>;
  let component: CatalogoAdminShellComponent;
  const operations = new Set<string>();
  const permissionStub = {
    puedeCrear: () => operations.has('Crear'),
    puedeModificar: () => operations.has('Modificar'),
    puedeEliminar: () => operations.has('Eliminar'),
  };

  beforeEach(async () => {
    operations.clear();
    await TestBed.configureTestingModule({
      imports: [CatalogoAdminShellComponent],
      providers: [{ provide: PermisosService, useValue: permissionStub }],
    }).compileComponents();
    fixture = TestBed.createComponent(CatalogoAdminShellComponent);
    component = fixture.componentInstance;
    component.title = 'Especialidades';
    component.description = 'Administración del catálogo';
    component.module = 'Especialidades';
    component.columns = [{ key: 'nombre', label: 'Nombre' }];
    component.rows = [];
  });

  it('representa estados de carga, error recuperable y vacío', () => {
    component.loading = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando catálogo');

    component.loading = false;
    component.errorMessage = 'Error controlado';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Error controlado');
    expect(fixture.debugElement.query(By.css('button')).nativeElement.textContent).toContain('Reintentar');

    component.errorMessage = '';
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No hay registros');
  });

  it('presenta confirmación de una operación completada', () => {
    component.successMessage = 'Registro guardado.';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent)
      .toContain('Registro guardado.');
  });

  it('presenta tabla paginada con correlativo y tracking por identificador', () => {
    component.page = 2;
    component.pageSize = 10;
    component.totalPages = 2;
    component.totalCount = 11;
    component.rows = [{
      id: 21, label: 'Cardiología', activa: true, values: { nombre: 'Cardiología' },
    }];
    fixture.detectChanges();
    const cells = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('tbody td'));
    expect(cells.map(cell => cell.textContent?.trim())).toContain('11');
    expect(fixture.nativeElement.textContent).toContain('Página 2 de 2');
  });

  it('muestra y emite exclusivamente las operaciones CAME autorizadas', () => {
    operations.add('Crear');
    operations.add('Modificar');
    operations.add('Eliminar');
    component.rows = [{ id: 2, label: 'Cardiología', activa: true, values: { nombre: 'Cardiología' } }];
    spyOn(component.createRequested, 'emit');
    spyOn(component.editRequested, 'emit');
    fixture.detectChanges();

    const create = fixture.debugElement.query(By.css('.btn-primary'));
    const edit = fixture.debugElement.query(By.css('[aria-label="Editar Cardiología"]'));
    const remove = fixture.debugElement.query(By.css('[aria-label="Desactivar Cardiología"]'));
    create.triggerEventHandler('click');
    edit.triggerEventHandler('click');
    remove.triggerEventHandler('click');
    expect(component.createRequested.emit).toHaveBeenCalled();
    expect(component.editRequested.emit).toHaveBeenCalledWith(2);
    expect(component.pendingDeactivation?.id).toBe(2);
  });

  it('oculta las acciones que no están autorizadas', () => {
    component.rows = [{ id: 2, label: 'Cardiología', activa: true, values: { nombre: 'Cardiología' } }];
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('.btn-primary'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[aria-label^="Editar"]'))).toBeNull();
    expect(fixture.debugElement.query(By.css('[aria-label^="Desactivar"]'))).toBeNull();
  });

  it('permite reactivar solo cuando el contrato y CAME lo autorizan', () => {
    operations.add('Modificar');
    component.rows = [{ id: 7, label: 'Central', activa: false, values: { nombre: 'Central' } }];
    component.allowReactivation = false;
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('[aria-label="Reactivar Central"]'))).toBeNull();

    component.allowReactivation = true;
    spyOn(component.reactivateRequested, 'emit');
    fixture.detectChanges();
    fixture.debugElement.query(By.css('[aria-label="Reactivar Central"]')).triggerEventHandler('click');
    expect(component.reactivateRequested.emit).toHaveBeenCalledOnceWith(7);
  });

  it('confirma la baja lógica una sola vez', () => {
    operations.add('Eliminar');
    component.rows = [{ id: 2, label: 'Cardiología', activa: true, values: { nombre: 'Cardiología' } }];
    spyOn(component.deactivateRequested, 'emit');
    fixture.detectChanges();
    fixture.debugElement.query(By.css('[aria-label="Desactivar Cardiología"]')).triggerEventHandler('click');
    fixture.detectChanges();
    const dialog = fixture.debugElement.query(By.css('app-confirm-dialog'));
    dialog.componentInstance.confirmar();
    dialog.componentInstance.confirmar();
    expect(component.deactivateRequested.emit).toHaveBeenCalledOnceWith(2);
  });

  it('bloquea el doble envío del formulario', () => {
    component.formOpen = true;
    component.formTitle = 'Nueva especialidad';
    component.formValid = true;
    spyOn(component.formSubmitted, 'emit');
    fixture.detectChanges();
    const form = fixture.debugElement.query(By.css('form'));
    form.triggerEventHandler('submit', new Event('submit'));
    form.triggerEventHandler('submit', new Event('submit'));
    expect(component.formSubmitted.emit).toHaveBeenCalledTimes(1);
    expect(component.submissionRequested).toBeTrue();
  });
});
