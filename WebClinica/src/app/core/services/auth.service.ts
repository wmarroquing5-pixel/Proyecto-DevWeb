import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, User } from '../models/user.model';
import { mockLogin } from '../mock/login.mock';

const TOKEN_KEY = 'auth_token';
const USER_KEY = 'auth_user';

@Injectable({ providedIn: 'root' })
export class AuthService {

  readonly currentUser = signal<User | null>(this.readUser());
  readonly isAuthenticated = computed(() => !!this.currentUser() && !!this.token);

  constructor(
    private http: HttpClient,
    private router: Router,
  ) {}

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  login(usuario: string, password: string): Observable<LoginResponse> {
    // MODO MOCK: simula la respuesta del backend mientras no exista
    if (environment.useMockApi) {
      return mockLogin(usuario, password).pipe(tap(res => this.storeSession(res)));
    }
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, { usuario, password })
      .pipe(tap(res => this.storeSession(res)));
  }

  private storeSession(res: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    this.currentUser.set(res.user);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
    this.router.navigate(['/login']);
  }

  hasRole(roles: string[]): boolean {
    if (!roles || roles.length === 0) return true;
    const user = this.currentUser();
    return !!user && roles.some(r => user.roles.includes(r));
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }
}
