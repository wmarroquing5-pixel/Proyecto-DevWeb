import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { ApiProblemDetails } from '../models/problem-details.model';

@Injectable({ providedIn: 'root' })
export class ApiErrorService {
  private readonly authorizationMessageState = signal<string | null>(null);
  private readonly authorizationRefreshRevisionState = signal(0);
  readonly authorizationMessage = this.authorizationMessageState.asReadonly();
  readonly authorizationRefreshRevision = this.authorizationRefreshRevisionState.asReadonly();

  notifyForbidden(error: HttpErrorResponse, requestRefresh = true): void {
    this.authorizationMessageState.set(
      this.messageFor(error, 'No tienes autorización para realizar esta operación.'),
    );
    if (requestRefresh) {
      this.authorizationRefreshRevisionState.update(revision => revision + 1);
    }
  }

  dismissAuthorizationMessage(): void {
    this.authorizationMessageState.set(null);
  }

  messageFor(error: HttpErrorResponse, fallback: string): string {
    if (error.status === 0) {
      return 'No se pudo conectar con el servidor.';
    }
    if (error.status === 401) {
      return fallback;
    }
    if (error.status === 403) {
      return 'No tienes autorización para realizar esta operación.';
    }

    const problem = this.readProblemDetails(error.error);
    if (error.status >= 400 && error.status < 500) {
      const validationMessage = problem?.errors
        ? Object.values(problem.errors).flat().find(message => !!message?.trim())
        : undefined;
      return validationMessage ?? problem?.detail ?? problem?.title ?? fallback;
    }

    return fallback;
  }

  readProblemDetails(value: unknown): ApiProblemDetails | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }

    const source = value as Record<string, unknown>;
    const errors = this.readValidationErrors(source['errors']);
    return {
      status: typeof source['status'] === 'number' ? source['status'] : undefined,
      title: typeof source['title'] === 'string' ? source['title'] : undefined,
      detail: typeof source['detail'] === 'string' ? source['detail'] : undefined,
      errors,
      traceId: typeof source['traceId'] === 'string' ? source['traceId'] : undefined,
    };
  }

  private readValidationErrors(value: unknown): Record<string, string[]> | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }

    const result: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(value)) {
      if (Array.isArray(messages)) {
        const safeMessages = messages.filter((message): message is string => typeof message === 'string');
        if (safeMessages.length > 0) {
          result[field] = safeMessages;
        }
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
}
