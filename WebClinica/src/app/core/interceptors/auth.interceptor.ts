import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiErrorService } from '../services/api-error.service';
import { AuthSessionService } from '../services/auth-session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const session = inject(AuthSessionService);
  const apiErrors = inject(ApiErrorService);
  const token = session.token;

  const apiUrl = environment.apiUrl.replace(/\/$/, '');
  const isApiRequest = req.url === apiUrl || req.url.startsWith(`${apiUrl}/`) || req.url.startsWith(`${apiUrl}?`);
  const isLoginRequest = req.url === `${apiUrl}/auth/login`
    || req.url.startsWith(`${apiUrl}/auth/login?`);
  const isAuthorizationRefreshRequest = req.url === `${apiUrl}/auth/permisos`
    || req.url.startsWith(`${apiUrl}/auth/permisos?`)
    || req.url === `${apiUrl}/menu`
    || req.url.startsWith(`${apiUrl}/menu?`);
  const requestToken = token && isApiRequest && !isLoginRequest ? token : null;

  if (requestToken) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${requestToken}`,
      },
    });
  }

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isApiRequest) {
        if (error.status === 401 && requestToken) {
          session.invalidateForToken(requestToken);
        } else if (error.status === 403) {
          apiErrors.notifyForbidden(error, !isAuthorizationRefreshRequest);
        }
      }
      return throwError(() => error);
    }),
  );
};
