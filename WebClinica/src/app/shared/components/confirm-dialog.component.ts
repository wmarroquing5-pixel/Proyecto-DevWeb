import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, SimpleChanges, ViewChild } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  template: `
    <div class="ui-dialog-backdrop" (click)="cancelar()" aria-hidden="true"></div>
    <section class="ui-dialog" role="alertdialog" aria-modal="true"
             [attr.aria-labelledby]="titleId" [attr.aria-describedby]="descriptionId"
             (keydown.escape)="cancelar()" (keydown.tab)="mantenerFoco($event)">
      <div class="ui-dialog__content">
        <h2 [id]="titleId" class="h5 mb-2">{{ title }}</h2>
        <p [id]="descriptionId" class="mb-2">{{ description }}</p>
        @if (consequence) { <p class="ui-dialog__consequence mb-0">{{ consequence }}</p> }
      </div>
      <div class="ui-dialog__actions">
        <button #cancelButton type="button" class="btn btn-secondary" [disabled]="busy" (click)="cancelar()">
          <i class="bi bi-x-lg" aria-hidden="true"></i> {{ cancelLabel }}
        </button>
        <button #confirmButton type="button" class="btn" [class.btn-danger]="intent === 'destructive'"
                [class.btn-primary]="intent === 'primary'" [disabled]="busy || confirmationRequested" (click)="confirmar()">
          @if (busy) { <span class="spinner-border spinner-border-sm" aria-hidden="true"></span> }
          @else { <i [class]="intent === 'primary' ? 'bi bi-check-lg' : 'bi bi-trash'" aria-hidden="true"></i> }
          {{ busy ? busyLabel : confirmLabel }}
        </button>
      </div>
    </section>
  `,
})
export class ConfirmDialogComponent implements AfterViewInit, OnChanges {
  private static nextId = 0;

  @Input({ required: true }) title = '';
  @Input({ required: true }) description = '';
  @Input() consequence = '';
  @Input() confirmLabel = 'Eliminar';
  @Input() cancelLabel = 'Cancelar';
  @Input() busyLabel = 'Eliminando…';
  @Input() intent: 'destructive' | 'primary' = 'destructive';
  @Input() busy = false;
  @Output() readonly confirmed = new EventEmitter<void>();
  @Output() readonly cancelled = new EventEmitter<void>();
  @ViewChild('cancelButton') private readonly cancelButton?: ElementRef<HTMLButtonElement>;
  @ViewChild('confirmButton') private readonly confirmButton?: ElementRef<HTMLButtonElement>;

  readonly titleId = `confirm-dialog-title-${++ConfirmDialogComponent.nextId}`;
  readonly descriptionId = `confirm-dialog-description-${ConfirmDialogComponent.nextId}`;
  confirmationRequested = false;

  ngAfterViewInit(): void { this.cancelButton?.nativeElement.focus(); }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['busy'] && !this.busy) this.confirmationRequested = false;
  }

  cancelar(): void { if (!this.busy) this.cancelled.emit(); }

  confirmar(): void {
    if (this.busy || this.confirmationRequested) return;
    this.confirmationRequested = true;
    this.confirmed.emit();
  }

  mantenerFoco(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key !== 'Tab' || this.busy) return;
    const cancel = this.cancelButton?.nativeElement;
    const confirm = this.confirmButton?.nativeElement;
    if (!cancel || !confirm) return;
    const active = document.activeElement;
    if (keyboardEvent.shiftKey && active === cancel) {
      keyboardEvent.preventDefault();
      confirm.focus();
    } else if (!keyboardEvent.shiftKey && active === confirm) {
      keyboardEvent.preventDefault();
      cancel.focus();
    }
  }
}
