import { Component, EventEmitter, Input, Output } from '@angular/core';

export type UiStateKind = 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-ui-state',
  standalone: true,
  template: `
    <section class="ui-state" [class.ui-state--error]="kind === 'error'"
             [class.ui-state--compact]="compact"
             [attr.role]="kind === 'error' ? 'alert' : 'status'">
      @if (kind === 'loading') { <span class="spinner-border text-primary" aria-hidden="true"></span> }
      @else { <i [class]="kind === 'error' ? 'bi bi-exclamation-triangle-fill' : 'bi bi-inbox'" aria-hidden="true"></i> }
      <div>
        <strong>{{ title }}</strong>
        @if (description) { <p class="mb-0">{{ description }}</p> }
        @if (retryable) {
          <button type="button" class="btn btn-outline-secondary btn-sm mt-2" (click)="retry.emit()">
            <i class="bi bi-arrow-clockwise" aria-hidden="true"></i> Reintentar
          </button>
        }
      </div>
    </section>
  `,
})
export class UiStateComponent {
  @Input({ required: true }) kind: UiStateKind = 'loading';
  @Input({ required: true }) title = '';
  @Input() description = '';
  @Input() retryable = false;
  @Input() compact = false;
  @Output() readonly retry = new EventEmitter<void>();
}
