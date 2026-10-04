import { delay, Observable, of } from 'rxjs';
import { LoginResponse } from '../models/user.model';
import { MOCK_MENU, MOCK_USER } from './menu.mock';

/**
 * Simula POST /api/auth/login mientras la API .NET no existe.
 * Devuelve un Observable con demora artificial para probar estados de carga.
 */
export function mockLogin(usuario: string, _password: string): Observable<LoginResponse> {
  const response: LoginResponse = {
    token: 'demo-token-' + Date.now(),
    user: { ...MOCK_USER, username: usuario || MOCK_USER.username },
    menu: MOCK_MENU,
  };
  return of(response).pipe(delay(600));
}
