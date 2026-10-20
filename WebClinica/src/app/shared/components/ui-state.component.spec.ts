import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UiStateComponent } from './ui-state.component';

describe('UiStateComponent', () => {
  let fixture: ComponentFixture<UiStateComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UiStateComponent] }).compileComponents();
    fixture = TestBed.createComponent(UiStateComponent);
    fixture.componentInstance.title = 'Estado';
    fixture.detectChanges();
  });

  it('usa status para carga y permite reintentar', () => {
    fixture.componentInstance.kind = 'loading';
    fixture.componentInstance.retryable = true;
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });

  it('usa alert para errores', () => {
    fixture.componentInstance.kind = 'error';
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
  });
});
