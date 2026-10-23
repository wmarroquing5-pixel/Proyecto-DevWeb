import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialogComponent } from './confirm-dialog.component';

describe('ConfirmDialogComponent', () => {
  let fixture: ComponentFixture<ConfirmDialogComponent>;
  let component: ConfirmDialogComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmDialogComponent] }).compileComponents();
    fixture = TestBed.createComponent(ConfirmDialogComponent);
    component = fixture.componentInstance;
    component.title = 'Eliminar usuario';
    component.description = '¿Deseas continuar?';
    fixture.detectChanges();
  });

  it('expone un diálogo accesible y enfoca cancelar al abrir', () => {
    const dialog = fixture.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;
    const cancel = fixture.nativeElement.querySelector('button.btn-secondary') as HTMLButtonElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe(component.titleId);
    expect(document.activeElement).toBe(cancel);
  });

  it('emite cancelación por botón o Escape', () => {
    const cancelled = jasmine.createSpy('cancelled');
    component.cancelled.subscribe(cancelled);
    (fixture.nativeElement.querySelector('button.btn-secondary') as HTMLButtonElement).click();
    fixture.nativeElement.querySelector('[role="alertdialog"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(cancelled).toHaveBeenCalledTimes(2);
  });

  it('permite un texto alternativo de cancelación sin cambiar el valor predeterminado', () => {
    const cancel = fixture.nativeElement.querySelector('button.btn-secondary') as HTMLButtonElement;
    expect(cancel.textContent).toContain('Cancelar');
    component.cancelLabel = 'Conservar';
    fixture.detectChanges();
    expect(cancel.textContent).toContain('Conservar');
  });

  it('emite confirmación una sola vez hasta finalizar la operación', () => {
    const confirmed = jasmine.createSpy('confirmed');
    component.confirmed.subscribe(confirmed);
    const button = fixture.nativeElement.querySelector('button.btn-danger') as HTMLButtonElement;
    button.click();
    button.click();
    expect(confirmed).toHaveBeenCalledTimes(1);
    component.busy = true;
    fixture.detectChanges();
    expect(button.disabled).toBeTrue();
  });

  it('mantiene el foco dentro del diálogo al usar Tab', () => {
    const cancel = fixture.nativeElement.querySelector('button.btn-secondary') as HTMLButtonElement;
    const confirm = fixture.nativeElement.querySelector('button.btn-danger') as HTMLButtonElement;
    confirm.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
    fixture.nativeElement.querySelector('[role="alertdialog"]').dispatchEvent(tab);
    expect(document.activeElement).toBe(cancel);
  });
});
