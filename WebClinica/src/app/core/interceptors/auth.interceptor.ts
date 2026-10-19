import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../../environments/environment';

const TOKEN_KEY = 'auth_token';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);

  const apiUrl = environment.apiUrl.replace(/\/$/, '');
  const isApiRequest = req.url === apiUrl || req.url.startsWith(`${apiUrl}/`) || req.url.startsWith(`${apiUrl}?`);

  if (token && isApiRequest) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(req);
};
