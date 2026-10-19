import { HttpClient } from '@angular/common/http';
import { Injectable, computed, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, User } from '../models/user.model';

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
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/auth/login`, {
        username: usuario,   // 👈 "username" coincide con LoginRequest.Username
        password,
      })
      .pipe(tap(res => this.storeToken(res)));
  }

  private storeToken(res: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, res.accessToken);  // 👈 accessToken
  }

  /** Carga el usuario desde GET /api/auth/me */
  loadCurrentUser(): Observable<User> {
    return this.http.get<User>(`${environment.apiUrl}/auth/me`).pipe(
      tap(user => {
        const normalized: User = {
          ...user,
          id: user.idUsuario,
          fullName: user.fullName ?? user.username,
        };
        localStorage.setItem(USER_KEY, JSON.stringify(normalized));
        this.currentUser.set(normalized);
      })
    );
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
    return !!user && !!user.roles && roles.some(r => user.roles?.includes(r));
  }

  private readUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  }
}